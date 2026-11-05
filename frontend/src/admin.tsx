import { useCallback, useEffect, useState } from "react";
import { clearCustomValidity, invalidMessage } from "./validity";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

// Trang Quản trị: danh sách nhân viên + tạo/sửa/khóa/đặt lại mật khẩu +
// quyền riêng cho từng người (vai trò + tùy chỉnh). Mọi thao tác đều gọi
// API admin đã có; backend kiểm tra quyền server-side, trang chỉ ẩn/hiện
// nút theo mã quyền của người đang đăng nhập (không thay thế kiểm tra đó).
//
// Hiệu lực cần nói rõ cho admin: quyền mới có hiệu lực NGAY với API vì
// backend nạp quyền theo từng request, nhưng giao diện của người đó chỉ
// cập nhật sau khi họ đăng nhập lại (bản snapshot quyền nạp lúc đăng nhập).

async function api(path: string, token: string, method = "GET", body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || `Lỗi ${res.status}`);
  }
  return data as Record<string, unknown>;
}

interface AdminUser {
  id: string;
  username: string;
  email: string;
  phone: string | null;
  fullName: string;
  status: string;
  role: string | null;
  roleName: string | null;
  requireOtp: boolean | null;
  lastLoginAt: string | null;
}

interface RoleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  permissions: string[];
}

interface PermMeta {
  code: string;
  module: string;
  description: string;
}

interface OverrideRow {
  code: string;
  effect: string;
}

interface PermDetail {
  role: string;
  rolePermissions: string[];
  overrides: OverrideRow[];
  effective: string[];
  allPermissions: PermMeta[];
}

// Thứ tự nhóm quyền hiển thị: theo đúng thứ tự khai báo trong PERMISSIONS.
const MODULE_ORDER = [
  "user",
  "settings",
  "customer",
  "product",
  "inventory",
  "order",
  "payment",
  "care",
  "report",
  "supplier",
  "purchase",
  "supplier_payment",
  "audit",
];

const MODULE_LABELS: Record<string, string> = {
  user: "Người dùng",
  settings: "Cấu hình hệ thống",
  customer: "Khách hàng",
  product: "Sản phẩm / SKU",
  inventory: "Kho",
  order: "Đơn hàng",
  payment: "Thanh toán & công nợ",
  care: "Chăm sóc & nhắc việc",
  report: "Báo cáo",
  supplier: "Nhà cung cấp",
  purchase: "Đơn nhập hàng",
  supplier_payment: "Thanh toán NCC",
  audit: "Nhật ký Audit",
};

// Thứ tự cột vai trò trong ma trận: từ cao xuống thấp, không theo thứ tự
// code alphabet mà API trả về.
const ROLE_ORDER = ["admin", "manager", "sales", "warehouse", "accountant"];

const STATUS_LABELS: Record<string, string> = {
  active: "Đang hoạt động",
  locked: "Bị khóa",
  inactive: "Ngừng",
};

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("vi-VN");
}

function emptyForm() {
  return {
    fullName: "",
    username: "",
    email: "",
    phone: "",
    role: "sales",
    requireOtp: "",
    password: "",
    status: "active",
  };
}

export function AdminPage({ token, permissions }: { token: string; permissions: string[] }) {
  const canView = permissions.includes("user.view");
  const canCreate = permissions.includes("user.create");
  const canUpdate = permissions.includes("user.update");
  const canLock = permissions.includes("user.lock");
  const canReset = permissions.includes("user.reset_password");
  const canSetPerms = permissions.includes("user.set_permissions");
  const canSetOtp = permissions.includes("user.set_require_otp");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [allPerms, setAllPerms] = useState<PermMeta[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // Form tạo/sửa: null = đóng; "new" = tạo; id = sửa user đó.
  const [formTarget, setFormTarget] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  // Chi tiết quyền của user đang sửa / đang mở editor (để tính diff và draft).
  const [permDetail, setPermDetail] = useState<PermDetail | null>(null);
  const [permDetailFor, setPermDetailFor] = useState<string | null>(null);

  // Editor quyền riêng: userId đang mở, hoặc null.
  const [permEditorFor, setPermEditorFor] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, "role" | "allow" | "deny">>({});
  const [savingPerms, setSavingPerms] = useState(false);

  // Form đặt lại mật khẩu: userId đang mở, hoặc null.
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");

  const loadUsers = useCallback(async () => {
    const q = new URLSearchParams();
    if (search.trim()) q.set("search", search.trim());
    if (roleFilter) q.set("role", roleFilter);
    if (statusFilter) q.set("status", statusFilter);
    const data = await api(`/api/admin/users?${q.toString()}`, token);
    setUsers((data.users as AdminUser[]) ?? []);
  }, [token, search, roleFilter, statusFilter]);

  const loadRoles = useCallback(async () => {
    const data = await api("/api/admin/roles", token);
    setRoles((data.roles as RoleRow[]) ?? []);
    setAllPerms((data.allPermissions as PermMeta[]) ?? []);
  }, [token]);

  useEffect(() => {
    loadUsers().catch((e: Error) => setError(e.message));
  }, [loadUsers]);

  useEffect(() => {
    loadRoles().catch((e: Error) => setError(e.message));
  }, [loadRoles]);

  const loadPermDetail = useCallback(
    async (userId: string) => {
      const data = await api(`/api/admin/users/${userId}/permissions`, token);
      setPermDetail({
        role: data.role as string,
        rolePermissions: (data.rolePermissions as string[]) ?? [],
        overrides: (data.overrides as OverrideRow[]) ?? [],
        effective: (data.effective as string[]) ?? [],
        allPermissions: (data.allPermissions as PermMeta[]) ?? [],
      });
      setPermDetailFor(userId);
      return data;
    },
    [token],
  );

  const openCreate = () => {
    setForm(emptyForm());
    setFormTarget("new");
    setPermDetail(null);
    setPermDetailFor(null);
    setError("");
    setInfo("");
  };

  const openEdit = (u: AdminUser) => {
    setForm({
      fullName: u.fullName,
      username: u.username,
      email: u.email,
      phone: u.phone ?? "",
      role: u.role ?? "sales",
      requireOtp: u.requireOtp === null || u.requireOtp === undefined ? "" : String(u.requireOtp),
      password: "",
      status: u.status,
    });
    setFormTarget(u.id);
    setError("");
    setInfo("");
    loadPermDetail(u.id).catch((e: Error) => setError(e.message));
  };

  const openPermEditor = (u: AdminUser) => {
    setPermEditorFor(u.id);
    setError("");
    setInfo("");
    loadPermDetail(u.id)
      .then((data) => {
        const d: Record<string, "role" | "allow" | "deny"> = {};
        for (const o of (data.overrides as OverrideRow[]) ?? []) {
          d[o.code] = o.effect === "allow" ? "allow" : "deny";
        }
        setDraft(d);
      })
      .catch((e: Error) => setError(e.message));
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    try {
      if (formTarget === "new") {
        if (form.password.length < 8) {
          setError("Mật khẩu ban đầu phải có ít nhất 8 ký tự.");
          return;
        }
        await api("/api/admin/users", token, "POST", {
          username: form.username.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          fullName: form.fullName.trim(),
          password: form.password,
          role: form.role,
          requireOtp: canSetOtp && form.requireOtp !== "" ? form.requireOtp === "true" : undefined,
        });
        setInfo(`Đã tạo người dùng ${form.username.trim()} với vai trò ${form.role}.`);
      } else if (formTarget) {
        const body: Record<string, unknown> = {
          fullName: form.fullName.trim(),
          phone: form.phone,
          role: form.role,
          status: form.status,
        };
        if (canSetOtp && form.requireOtp !== "") body.requireOtp = form.requireOtp === "true";
        else if (canSetOtp) body.requireOtp = null;
        await api(`/api/admin/users/${formTarget}`, token, "PATCH", body);
        setInfo("Đã cập nhật người dùng. Người này cần đăng nhập lại để nhận quyền mới.");
      }
      setFormTarget(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    }
  };

  const handleLockToggle = async (u: AdminUser) => {
    const action = u.status === "locked" ? "unlock" : "lock";
    const verb = action === "lock" ? "khóa" : "mở khóa";
    if (!window.confirm(`Bạn có chắc muốn ${verb} tài khoản "${u.username}"?`)) return;
    setError("");
    setInfo("");
    try {
      await api(`/api/admin/users/${u.id}/${action}`, token, "POST", {});
      setInfo(`Đã ${verb} tài khoản ${u.username}.`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPw.length < 8) {
      setError("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }
    setError("");
    setInfo("");
    try {
      await api(`/api/admin/users/${resetFor}/reset-password`, token, "POST", { new_password: resetPw });
      setInfo("Đã đặt lại mật khẩu. Hãy báo mật khẩu mới cho người dùng qua kênh riêng.");
      setResetFor(null);
      setResetPw("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    }
  };

  const handleSavePerms = async (clearAll: boolean) => {
    if (!permEditorFor) return;
    if (clearAll && !window.confirm("Xóa hết quyền riêng của người này, trở về đúng quyền của vai trò?")) return;
    setSavingPerms(true);
    setError("");
    setInfo("");
    try {
      const allow: string[] = [];
      const deny: string[] = [];
      if (!clearAll) {
        for (const [code, v] of Object.entries(draft)) {
          if (v === "allow") allow.push(code);
          else if (v === "deny") deny.push(code);
        }
      }
      const data = await api(`/api/admin/users/${permEditorFor}/permissions`, token, "PUT", { allow, deny });
      setInfo(
        clearAll
          ? "Đã xóa hết quyền riêng, người này trở về đúng quyền của vai trò."
          : "Đã lưu quyền riêng. Quyền mới có hiệu lực ngay với API; giao diện của người này cập nhật sau khi họ đăng nhập lại.",
      );
      const d: Record<string, "role" | "allow" | "deny"> = {};
      for (const o of (data.overrides as OverrideRow[]) ?? []) {
        d[o.code] = o.effect === "allow" ? "allow" : "deny";
      }
      setDraft(d);
      await loadPermDetail(permEditorFor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setSavingPerms(false);
    }
  };

  if (!canView) {
    return <p className="mt-4 alert-error">Bạn không có quyền xem trang quản trị.</p>;
  }

  const editingUser = formTarget && formTarget !== "new" ? users.find((u) => u.id === formTarget) : undefined;
  const editorUser = permEditorFor ? users.find((u) => u.id === permEditorFor) : undefined;

  // Diff khi đổi vai trò trong form sửa: quyền hiệu lực mới (vai trò mới +
  // quyền riêng đang có) so với quyền hiệu lực hiện tại.
  let roleDiff: { added: PermMeta[]; removed: PermMeta[] } | null = null;
  if (editingUser && permDetail && permDetailFor === editingUser.id && form.role !== editingUser.role) {
    const newRole = roles.find((r) => r.code === form.role);
    const newRoleCodes = new Set(newRole?.permissions ?? []);
    const allow = new Set(permDetail.overrides.filter((o) => o.effect === "allow").map((o) => o.code));
    const deny = new Set(permDetail.overrides.filter((o) => o.effect === "deny").map((o) => o.code));
    const newEffective = new Set<string>();
    for (const c of newRoleCodes) if (!deny.has(c)) newEffective.add(c);
    for (const c of allow) newEffective.add(c);
    const oldEffective = new Set(permDetail.effective);
    const metaByCode = new Map(allPerms.map((p) => [p.code, p]));
    roleDiff = {
      added: [...newEffective].filter((c) => !oldEffective.has(c)).map((c) => metaByCode.get(c)).filter((p): p is PermMeta => !!p),
      removed: [...oldEffective].filter((c) => !newEffective.has(c)).map((c) => metaByCode.get(c)).filter((p): p is PermMeta => !!p),
    };
  }

  // Nhóm quyền theo module để render editor và ma trận.
  const grouped = MODULE_ORDER.map((m) => ({
    module: m,
    perms: allPerms.filter((p) => p.module === m),
  })).filter((g) => g.perms.length > 0);
  const orderedRoles = ROLE_ORDER.map((c) => roles.find((r) => r.code === c)).filter((r): r is RoleRow => !!r);
  for (const r of roles) if (!ROLE_ORDER.includes(r.code)) orderedRoles.push(r);

  // Cảnh báo khi cấp quyền nhóm Người dùng cho tài khoản không phải Admin.
  const grantsUserModule =
    editorUser &&
    editorUser.role !== "admin" &&
    Object.entries(draft).some(([code, v]) => v === "allow" && code.startsWith("user."));

  // Hiệu lực xem trước trong editor: vai trò hiện tại + draft.
  const editorRoleCodes = permDetail && permDetailFor === permEditorFor ? new Set(permDetail.rolePermissions) : new Set<string>();
  const previewEffective = (code: string): boolean => {
    const d = draft[code] ?? "role";
    if (d === "allow") return true;
    if (d === "deny") return false;
    return editorRoleCodes.has(code);
  };

  return (
    <div className="mt-4 space-y-4">
      <h2 className="text-lg font-semibold">Quản trị người dùng và phân quyền</h2>
      <p className="text-sm text-gray-600">
        Phân quyền gồm 2 lớp: vai trò (bộ quyền mặc định) cộng quyền riêng cho từng người (thêm hoặc chặn từng quyền).
        Quyền mới có hiệu lực ngay với API; giao diện của người đó cập nhật sau khi họ đăng nhập lại.
        Không đổi vai trò hay khóa admin đang hoạt động duy nhất.
      </p>

      {error && <p className="alert-error">{error}</p>}
      {info && <p className="alert-success">{info}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="field"
          placeholder="Tìm tên, tên đăng nhập, email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="field" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">Tất cả vai trò</option>
          {roles.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>
        <select className="field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="locked">Bị khóa</option>
          <option value="inactive">Ngừng</option>
        </select>
        {canCreate && (
          <button className="btn btn-primary" onClick={openCreate}>
            + Tạo nhân viên
          </button>
        )}
      </div>

      <table className="table">
        <thead>
          <tr className="border-b">
            <th>Họ tên</th>
            <th>Tên đăng nhập</th>
            <th>Email</th>
            <th>Vai trò</th>
            <th>Trạng thái</th>
            <th>Đăng nhập cuối</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b">
              <td>{u.fullName}</td>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td>{u.roleName ?? u.role ?? "—"}</td>
              <td><span className={u.status === "active" ? "badge badge-green" : u.status === "locked" ? "badge badge-red" : "badge badge-gray"}>{STATUS_LABELS[u.status] ?? u.status}</span></td>
              <td>{fmtDate(u.lastLoginAt)}</td>
              <td>
                <div className="flex flex-wrap gap-1">
                  {canUpdate && (
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(u)}>
                      Sửa
                    </button>
                  )}
                  {canSetPerms && (
                    <button className="btn btn-sm btn-secondary" onClick={() => openPermEditor(u)}>
                      Quyền riêng
                    </button>
                  )}
                  {canLock && (
                    <button className="btn btn-sm btn-secondary" onClick={() => handleLockToggle(u)}>
                      {u.status === "locked" ? "Mở khóa" : "Khóa"}
                    </button>
                  )}
                  {canReset && (
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => {
                        setResetFor(u.id);
                        setResetPw("");
                        setError("");
                        setInfo("");
                      }}
                    >
                      Đặt lại MK
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {resetFor && (
        <form onSubmit={handleResetPassword} onKeyDown={(e) => { if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault(); }} className="space-y-3 card">
          <h3 className="font-semibold">Đặt lại mật khẩu cho {users.find((u) => u.id === resetFor)?.username}</h3>
          <label className="block">
            Mật khẩu mới (ít nhất 8 ký tự)
            <input
              type="password"
              className="input"
              value={resetPw}
              onChange={(e) => {
                clearCustomValidity(e);
                setResetPw(e.target.value);
              }}
              onInvalid={(e) =>
                e.currentTarget.setCustomValidity(invalidMessage(e.currentTarget, { missing: "Vui lòng nhập mật khẩu mới." }))
              }
              required
            />
          </label>
          <div className="flex gap-2">
            <button className="btn btn-primary">Đặt lại</button>
            <button type="button" className="btn btn-secondary" onClick={() => setResetFor(null)}>
              Đóng
            </button>
          </div>
          <p className="text-sm text-gray-500">Mật khẩu mới không hiện lại sau khi lưu — hãy báo cho người dùng qua kênh riêng.</p>
        </form>
      )}

      {formTarget && (
        <form onSubmit={handleSubmitUser} onKeyDown={(e) => { if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault(); }} className="space-y-3 card">
          <h3 className="font-semibold">{formTarget === "new" ? "Tạo nhân viên" : `Sửa nhân viên ${editingUser?.username}`}</h3>
          <label className="block">
            Họ tên
            <input
              className="input"
              value={form.fullName}
              onChange={(e) => {
                clearCustomValidity(e);
                setForm({ ...form, fullName: e.target.value });
              }}
              onInvalid={(e) => e.currentTarget.setCustomValidity(invalidMessage(e.currentTarget, { missing: "Vui lòng nhập họ tên." }))}
              required
            />
          </label>
          <label className="block">
            Tên đăng nhập {formTarget !== "new" && <span className="text-gray-500">(không sửa được sau khi tạo)</span>}
            <input
              className="input"
              value={form.username}
              disabled={formTarget !== "new"}
              onChange={(e) => {
                clearCustomValidity(e);
                setForm({ ...form, username: e.target.value });
              }}
              onInvalid={(e) =>
                e.currentTarget.setCustomValidity(invalidMessage(e.currentTarget, { missing: "Vui lòng nhập tên đăng nhập." }))
              }
              required
            />
          </label>
          <label className="block">
            Email {formTarget !== "new" && <span className="text-gray-500">(không sửa được sau khi tạo)</span>}
            <input
              type="email"
              className="input"
              value={form.email}
              disabled={formTarget !== "new"}
              onChange={(e) => {
                clearCustomValidity(e);
                setForm({ ...form, email: e.target.value });
              }}
              onInvalid={(e) =>
                e.currentTarget.setCustomValidity(
                  invalidMessage(e.currentTarget, { missing: "Vui lòng nhập email.", badInput: "Email chưa đúng định dạng." }),
                )
              }
              required
            />
          </label>
          <label className="block">
            Số điện thoại
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label className="block">
            Vai trò
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {roles.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name} — {r.description ?? ""}
                </option>
              ))}
            </select>
          </label>
          {formTarget !== "new" && (
            <label className="block">
              Trạng thái
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Đang hoạt động</option>
                <option value="locked">Bị khóa</option>
                <option value="inactive">Ngừng</option>
              </select>
            </label>
          )}
          {canSetOtp && (
            <label className="block">
              Yêu cầu OTP riêng
              <select
                className="input"
                value={form.requireOtp}
                onChange={(e) => setForm({ ...form, requireOtp: e.target.value })}
              >
                <option value="">Theo hệ thống</option>
                <option value="true">Luôn yêu cầu OTP</option>
                <option value="false">Không yêu cầu OTP</option>
              </select>
            </label>
          )}
          {formTarget === "new" && (
            <label className="block">
              Mật khẩu ban đầu (ít nhất 8 ký tự)
              <input
                type="password"
                className="input"
                value={form.password}
                onChange={(e) => {
                  clearCustomValidity(e);
                  setForm({ ...form, password: e.target.value });
                }}
                onInvalid={(e) =>
                  e.currentTarget.setCustomValidity(invalidMessage(e.currentTarget, { missing: "Vui lòng nhập mật khẩu ban đầu." }))
                }
                required
              />
            </label>
          )}
          {roleDiff && (
            <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm">
              <p className="font-semibold">Đổi vai trò sẽ thay đổi quyền hiệu lực (quyền riêng đang có được giữ nguyên):</p>
              {roleDiff.added.length > 0 && (
                <p className="mt-1 text-green-700">+ Thêm: {roleDiff.added.map((p) => p.description).join("; ")}</p>
              )}
              {roleDiff.removed.length > 0 && (
                <p className="mt-1 text-red-700">− Mất: {roleDiff.removed.map((p) => p.description).join("; ")}</p>
              )}
              {roleDiff.added.length === 0 && roleDiff.removed.length === 0 && <p className="mt-1">Quyền hiệu lực không đổi.</p>}
            </div>
          )}
          <div className="flex gap-2">
            <button className="btn btn-primary">Lưu</button>
            <button type="button" className="btn btn-secondary" onClick={() => setFormTarget(null)}>
              Đóng
            </button>
          </div>
        </form>
      )}

      {permEditorFor && editorUser && (
        <div className="space-y-4 card">
          <h3 className="font-semibold">
            Quyền riêng của {editorUser.fullName} ({editorUser.username}) — vai trò {editorUser.roleName ?? editorUser.role}
          </h3>
          <p className="text-sm text-gray-600">
            Mỗi quyền có 3 trạng thái: Theo vai trò (mặc định), Luôn cho phép (thêm quyền vai trò không có), Luôn chặn (gỡ quyền
            vai trò đang có). Cột Hiệu lực xem trước kết quả ngay khi bạn đổi.
          </p>
          {grantsUserModule && (
            <p className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
              Cảnh báo: bạn đang cấp quyền nhóm Người dùng cho tài khoản không phải Admin — người này sẽ quản trị được người dùng
              khác. Hãy chắc chắn trước khi lưu.
            </p>
          )}
          {permDetail && permDetailFor === permEditorFor ? (
            grouped.map((g) => (
              <div key={g.module}>
                <h4 className="mt-3 font-semibold">{MODULE_LABELS[g.module] ?? g.module}</h4>
                <table className="table">
                  <thead>
                    <tr className="border-b">
                      <th>Quyền</th>
                      <th>Vai trò có</th>
                      <th>Tùy chỉnh</th>
                      <th>Hiệu lực</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.perms.map((p) => {
                      const roleHas = editorRoleCodes.has(p.code);
                      const v = draft[p.code] ?? "role";
                      const eff = previewEffective(p.code);
                      return (
                        <tr key={p.code} className="border-b">
                          <td>{p.description}</td>
                          <td>{roleHas ? "Có" : "—"}</td>
                          <td>
                            <select
                              className="rounded border p-1"
                              value={v}
                              onChange={(e) => setDraft({ ...draft, [p.code]: e.target.value as "role" | "allow" | "deny" })}
                            >
                              <option value="role">Theo vai trò</option>
                              <option value="allow">Luôn cho phép</option>
                              <option value="deny">Luôn chặn</option>
                            </select>
                          </td>
                          <td>
                            <span className={eff ? "text-green-700" : "text-gray-400"}>{eff ? "✓ Có" : "— Không"}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">Đang tải quyền hiện tại…</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={savingPerms} onClick={() => handleSavePerms(false)}>
              {savingPerms ? "Đang lưu…" : "Lưu quyền riêng"}
            </button>
            <button className="btn btn-secondary" disabled={savingPerms} onClick={() => handleSavePerms(true)}>
              Xóa hết quyền riêng
            </button>
            <button className="btn btn-secondary" onClick={() => setPermEditorFor(null)}>
              Đóng
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4 card">
        <h3 className="font-semibold">Ma trận quyền theo vai trò (chỉ xem)</h3>
        <p className="text-sm text-gray-600">
          Bộ quyền mặc định của mỗi vai trò do hệ thống định sẵn. Muốn khác mặc định cho một người cụ thể thì dùng Quyền riêng ở
          bảng trên, không sửa ma trận này.
        </p>
        {grouped.map((g) => (
          <div key={g.module}>
            <h4 className="mt-3 font-semibold">{MODULE_LABELS[g.module] ?? g.module}</h4>
            <table className="table">
              <thead>
                <tr className="border-b">
                  <th>Quyền</th>
                  {orderedRoles.map((r) => (
                    <th key={r.code}>
                      {r.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.perms.map((p) => (
                  <tr key={p.code} className="border-b">
                    <td>{p.description}</td>
                    {orderedRoles.map((r) => (
                      <td key={r.code}>
                        {r.permissions.includes(p.code) ? "✓" : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
