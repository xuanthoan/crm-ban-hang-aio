import { useCallback, useEffect, useState } from "react";
import { EntityAuditTimeline } from "./audit";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface PhoneRow {
  id?: string;
  phone: string;
  phoneNormalized?: string;
  label: string;
  isPrimary: boolean;
}

interface SupplierListItem {
  id: string;
  name: string;
  taxCode: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  status: string;
  primaryPhone: string | null;
  phoneCount: number;
  createdAt: string;
}

interface SupplierProduct {
  variantId: string;
  sku: string;
  variantName: string;
  variantStatus: string;
  productId: string;
  productName: string;
  productStatus: string;
  sellingPrice?: number;
  importPrice?: number | null;
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.trunc(value).toLocaleString("vi-VN")}đ`;
}

interface SupplierDetail extends SupplierListItem {
  phones: PhoneRow[];
  products: SupplierProduct[];
}

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
    const err = new Error((data as { message?: string }).message || `Lỗi ${res.status}`) as Error & {
      conflict?: unknown;
    };
    err.conflict = (data as { conflict?: unknown }).conflict;
    throw err;
  }
  return data as Record<string, unknown>;
}

function emptyForm(): {
  name: string;
  taxCode: string;
  email: string;
  address: string;
  note: string;
  status: string;
  phones: PhoneRow[];
} {
  return {
    name: "",
    taxCode: "",
    email: "",
    address: "",
    note: "",
    status: "active",
    phones: [{ phone: "", label: "", isPrimary: true }],
  };
}

export default function SuppliersPage({
  token,
  permissions,
  isAdmin,
}: {
  token: string;
  permissions: string[];
  isAdmin: boolean;
}) {
  const [view, setView] = useState<"list" | "detail" | "form">("list");
  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([]);
  const [detail, setDetail] = useState<SupplierDetail | null>(null);
  const [formId, setFormId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const canCreate = permissions.includes("supplier.create");
  const canUpdate = permissions.includes("supplier.update");
  const canDeactivate = permissions.includes("supplier.deactivate");
  // Hard delete is Admin-only on the backend (permission + role check);
  // the button follows the same rule so non-admins never see it.
  const canHardDelete = isAdmin && permissions.includes("supplier.hard_delete");

  const loadSuppliers = useCallback(
    async (p = 1) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ page: String(p), pageSize: "20" });
        if (q.trim()) params.set("q", q.trim());
        if (status) params.set("status", status);
        const data = await api(`/api/suppliers?${params.toString()}`, token);
        setSuppliers(data.data as SupplierListItem[]);
        setTotal(((data.pagination as { total: number }).total ?? 0));
        setTotalPages((data.pagination as { totalPages: number }).totalPages ?? 1);
        setPage(p);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được danh sách nhà cung cấp.");
      } finally {
        setLoading(false);
      }
    },
    [token, q, status],
  );

  useEffect(() => {
    loadSuppliers(1);
  }, [loadSuppliers]);

  async function openDetail(id: string) {
    setError("");
    try {
      const data = await api(`/api/suppliers/${id}`, token);
      setDetail(data.supplier as SupplierDetail);
      setView("detail");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không mở được hồ sơ nhà cung cấp.");
    }
  }

  function openCreate() {
    setFormId(null);
    setForm(emptyForm());
    setView("form");
  }

  function openEdit(s: SupplierDetail) {
    setFormId(s.id);
    setForm({
      name: s.name,
      taxCode: s.taxCode ?? "",
      email: s.email ?? "",
      address: s.address ?? "",
      note: s.note ?? "",
      status: s.status,
      phones: s.phones.map((p) => ({ id: p.id, phone: p.phone, label: p.label ?? "", isPrimary: p.isPrimary })),
    });
    setView("form");
  }

  function setPrimary(index: number) {
    setForm((f) => ({
      ...f,
      phones: f.phones.map((p, i) => ({ ...p, isPrimary: i === index })),
    }));
  }

  function removePhone(index: number) {
    setForm((f) => {
      const phones = f.phones.filter((_, i) => i !== index);
      if (phones.length > 0 && !phones.some((p) => p.isPrimary)) phones[0].isPrimary = true;
      return { ...f, phones };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    const body = {
      name: form.name.trim(),
      taxCode: form.taxCode.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      note: form.note.trim() || null,
      status: form.status,
      phones: form.phones
        .filter((p) => p.phone.trim())
        .map((p) => ({ phone: p.phone.trim(), label: p.label.trim() || null, isPrimary: p.isPrimary })),
    };
    try {
      if (formId) {
        await api(`/api/suppliers/${formId}`, token, "PATCH", body);
        setInfo("Đã lưu thay đổi cho nhà cung cấp.");
        await openDetail(formId);
      } else {
        const data = await api("/api/suppliers", token, "POST", body);
        setInfo("Đã tạo nhà cung cấp mới.");
        await openDetail((data.supplier as SupplierDetail).id);
      }
      loadSuppliers(1);
    } catch (err) {
      // Backend duplicate errors already name the conflicting supplier.
      setError(err instanceof Error ? err.message : "Lưu nhà cung cấp thất bại.");
    }
  }

  async function handleDeactivate(id: string) {
    if (!window.confirm("Ngừng hợp tác nhà cung cấp này? Dữ liệu vẫn được giữ lại.")) return;
    setError("");
    try {
      await api(`/api/suppliers/${id}`, token, "DELETE");
      setInfo("Đã ngừng hợp tác nhà cung cấp.");
      setView("list");
      loadSuppliers(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ngừng hợp tác thất bại.");
    }
  }

  async function handleHardDelete(id: string) {
    if (!window.confirm("Xóa CỨNG nhà cung cấp này? Chỉ thành công khi nhà cung cấp chưa có đơn nhập nào.")) return;
    setError("");
    try {
      await api(`/api/suppliers/${id}?hard=true`, token, "DELETE");
      setInfo("Đã xóa cứng nhà cung cấp.");
      setView("list");
      loadSuppliers(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa cứng thất bại.");
    }
  }

  async function handleDeletePhone(phone: PhoneRow) {
    if (!detail) return;
    const isLastPrimary = phone.isPrimary && detail.phones.length === 1;
    if (isLastPrimary && !window.confirm("Đây là số chính duy nhất. Bạn có chắc muốn xóa số cuối cùng này không?")) return;
    setError("");
    try {
      await api(`/api/suppliers/${detail.id}/phones/${phone.id}`, token, "DELETE", {
        confirm_delete_last_phone: isLastPrimary,
      });
      setInfo("Đã ngừng sử dụng số điện thoại.");
      await openDetail(detail.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa số thất bại.");
    }
  }

  async function handleMakePrimary(phone: PhoneRow) {
    if (!detail) return;
    setError("");
    try {
      await api(`/api/suppliers/${detail.id}/phones/${phone.id}/make-primary`, token, "POST", {});
      await openDetail(detail.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đổi số chính thất bại.");
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Nhà cung cấp</h2>
      <p className="text-sm text-gray-500">
        Một nhà cung cấp có thể có bao nhiêu số cũng được, đúng 1 số chính. Trùng bất kỳ số nào với nhà cung cấp khác
        đều bị chặn ở backend và báo rõ nhà cung cấp đã có số đó. Một số vừa là khách hàng vừa là nhà cung cấp là hợp lệ,
        không bị chặn. Mã số thuế nếu nhập thì phải duy nhất.
      </p>
      {error && <p className="alert-error">{error}</p>}
      {info && <p className="alert-success">{info}</p>}

      {view === "list" && (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              Tìm theo tên hoặc số
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên, 0987…, +84…" />
            </label>
            <label className="block">
              Trạng thái
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Tất cả</option>
                <option value="active">Đang hợp tác</option>
                <option value="inactive">Ngừng hợp tác</option>
              </select>
            </label>
            <button onClick={() => loadSuppliers(1)} className="btn btn-primary">Tìm</button>
            {canCreate && (
              <button onClick={openCreate} className="btn btn-secondary">+ Tạo nhà cung cấp</button>
            )}
          </div>
          {loading && <p>Đang tải…</p>}
          <p className="text-sm text-gray-500">Tổng: {total} nhà cung cấp · Trang {page}/{totalPages}</p>
          <ul className="space-y-2">
            {suppliers.map((s) => (
              <li key={s.id} className="card-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <strong>{s.name || "(chưa có tên)"}</strong>
                    {s.primaryPhone && <span> — {s.primaryPhone}</span>}
                    <span className="text-gray-500"> · {s.phoneCount} số · </span><span className={s.status === "active" ? "badge badge-green" : "badge badge-gray"}>{s.status === "active" ? "Đang hợp tác" : "Ngừng hợp tác"}</span>
                    <div className="text-sm text-gray-500">
                      {s.taxCode ? `Mã số thuế: ${s.taxCode}` : "Chưa có mã số thuế"}
                      {s.email ? ` · ${s.email}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openDetail(s.id)} className="btn btn-sm btn-secondary">Xem</button>
                    {canDeactivate && s.status === "active" && (
                      <button onClick={() => handleDeactivate(s.id)} className="btn btn-sm btn-secondary">Ngừng hợp tác</button>
                    )}
                  </div>
                </div>
              </li>
            ))}
            {suppliers.length === 0 && !loading && <li className="text-gray-500">Chưa có nhà cung cấp nào khớp bộ lọc.</li>}
          </ul>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => loadSuppliers(page - 1)} className="btn btn-secondary disabled:opacity-50">Trang trước</button>
            <button disabled={page >= totalPages} onClick={() => loadSuppliers(page + 1)} className="btn btn-secondary disabled:opacity-50">Trang sau</button>
          </div>
        </>
      )}

      {view === "detail" && detail && (
        <div className="space-y-4">
          <button onClick={() => { setView("list"); loadSuppliers(page); }} className="btn btn-sm btn-secondary">← Về danh sách</button>
          <div className="card">
            <h3 className="text-lg font-semibold">{detail.name || "(chưa có tên)"}</h3>
            <p className="text-sm text-gray-600">
              {detail.taxCode ? `Mã số thuế: ${detail.taxCode} · ` : ""}
              {detail.email ? `Email: ${detail.email} · ` : ""}
              {detail.address ? `Địa chỉ: ${detail.address} · ` : ""}
              Trạng thái: <span className={detail.status === "active" ? "badge badge-green" : "badge badge-gray"}>{detail.status === "active" ? "Đang hợp tác" : "Ngừng hợp tác"}</span>
            </p>
            {detail.note && <p className="mt-2 text-sm">Ghi chú: {detail.note}</p>}
            <div className="mt-3 flex gap-2">
              {canUpdate && <button onClick={() => openEdit(detail)} className="btn btn-primary">Sửa</button>}
              {canDeactivate && detail.status === "active" && (
                <button onClick={() => handleDeactivate(detail.id)} className="btn btn-secondary">Ngừng hợp tác</button>
              )}
              {canHardDelete && (
                <button onClick={() => handleHardDelete(detail.id)} className="btn btn-secondary text-red-700">Xóa cứng (chỉ khi chưa có đơn nhập)</button>
              )}
            </div>
          </div>

          <div className="card">
            <h4 className="font-semibold">Số điện thoại ({detail.phones.length})</h4>
            <ul className="mt-2 space-y-2">
              {detail.phones.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2">
                  <span>{p.phone}</span>
                  {p.label && <span className="text-gray-500">({p.label})</span>}
                  {p.isPrimary && <strong className="text-blue-700">[Số chính]</strong>}
                  {canUpdate && !p.isPrimary && (
                    <button onClick={() => handleMakePrimary(p)} className="btn btn-sm btn-secondary text-sm">Đặt làm số chính</button>
                  )}
                  {canUpdate && (
                    <button onClick={() => handleDeletePhone(p)} className="btn btn-sm btn-secondary text-sm">Xóa số</button>
                  )}
                </li>
              ))}
              {detail.phones.length === 0 && <li className="text-gray-500">Chưa có số điện thoại.</li>}
            </ul>
          </div>

          <div className="card">
            <h4 className="font-semibold">Sản phẩm đã nhập từ nhà cung cấp này ({detail.products?.length ?? 0})</h4>
            <p className="mt-1 text-sm text-gray-500">Chỉ tính các đơn nhập đã nhận hàng (Đã nhận hàng / Hoàn thành); đơn nháp và đơn đã hủy không tính. Cả sản phẩm đang bán và đã ngừng bán đều hiện ở đây. Giá bán hiện với người có quyền xem sản phẩm, giá nhập chỉ hiện với người có quyền xem giá nhập.</p>
            {(detail.products?.length ?? 0) > 0 ? (
              <table className="table mt-2">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>SKU / Biến thể</th>
                    <th>Trạng thái sản phẩm</th>
                    <th>Trạng thái SKU</th>
                    {detail.products.some((p) => p.sellingPrice !== undefined) && <th>Giá bán</th>}
                    {detail.products.some((p) => p.importPrice !== undefined) && <th>Giá nhập</th>}
                  </tr>
                </thead>
                <tbody>
                  {detail.products.map((p) => (
                    <tr key={p.variantId}>
                      <td>{p.productName}</td>
                      <td>{p.sku}{p.variantName ? ` — ${p.variantName}` : ""}</td>
                      <td>
                        <span className={p.productStatus === "active" ? "badge badge-green" : "badge badge-gray"}>
                          {p.productStatus === "active" ? "Đang bán" : "Ngừng bán"}
                        </span>
                      </td>
                      <td>
                        <span className={p.variantStatus === "active" ? "badge badge-green" : "badge badge-gray"}>
                          {p.variantStatus === "active" ? "Đang bán" : "Ngừng bán"}
                        </span>
                      </td>
                      {p.sellingPrice !== undefined && <td>{formatMoney(p.sellingPrice)}</td>}
                      {p.importPrice !== undefined && <td>{formatMoney(p.importPrice)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-2 text-gray-500">Chưa có sản phẩm nào được nhập từ nhà cung cấp này.</p>
            )}
          </div>

          {(permissions.includes("audit.view_all") || permissions.includes("audit.view_own")) && (
            <EntityAuditTimeline token={token} entityType="supplier" entityId={detail.id} />
          )}
        </div>
      )}

      {view === "form" && (
        <form onSubmit={handleSubmit} className="space-y-4 card">
          <h3 className="font-semibold">{formId ? "Sửa nhà cung cấp" : "Tạo nhà cung cấp mới"}</h3>
          <p className="text-sm text-gray-500">Tên nhà cung cấp là bắt buộc. Số điện thoại không bắt buộc nhưng nếu nhập thì phải hợp lệ và không trùng với nhà cung cấp khác.</p>
          <label className="block">Tên nhà cung cấp<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">Mã số thuế<input className="input" value={form.taxCode} onChange={(e) => setForm({ ...form, taxCode: e.target.value })} placeholder="Để trống nếu không có" /></label>
            <label className="block">Email<input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          </div>
          <label className="block">Địa chỉ<input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
          <label className="block">Ghi chú<textarea className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
          <label className="block">Trạng thái
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Đang hợp tác</option>
              <option value="inactive">Ngừng hợp tác</option>
            </select>
          </label>

          <div>
            <h4 className="font-semibold">Số điện thoại (không giới hạn số lượng)</h4>
            {form.phones.map((p, i) => (
              <div key={i} className="mt-2 flex flex-wrap items-center gap-2">
                <input className="input" value={p.phone} onChange={(e) => setForm((f) => ({ ...f, phones: f.phones.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)) }))} placeholder="0987…" />
                <input className="input" value={p.label} onChange={(e) => setForm((f) => ({ ...f, phones: f.phones.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) }))} placeholder="Nhãn: kế toán, kho…" />
                <label className="flex items-center gap-1">
                  <input type="radio" name="primary-phone" checked={p.isPrimary} onChange={() => setPrimary(i)} /> Số chính
                </label>
                <button type="button" onClick={() => removePhone(i)} className="btn btn-sm btn-secondary">Xóa số</button>
              </div>
            ))}
            <button type="button" onClick={() => setForm((f) => ({ ...f, phones: [...f.phones, { phone: "", label: "", isPrimary: f.phones.length === 0 }] }))} className="mt-2 btn btn-sm btn-secondary">+ Thêm số điện thoại</button>
          </div>

          <div className="flex gap-2">
            <button className="btn btn-primary">{formId ? "Lưu thay đổi" : "Tạo nhà cung cấp"}</button>
            <button type="button" onClick={() => setView("list")} className="btn btn-secondary">Hủy</button>
          </div>
        </form>
      )}
    </section>
  );
}
