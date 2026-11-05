import { useCallback, useEffect, useState } from "react";
import { EntityAuditTimeline } from "./audit";
import { labelFor, SOCIAL_PLATFORM_LABELS, socialLinkHref } from "./labels";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface PhoneRow {
  id?: string;
  phone: string;
  phoneNormalized?: string;
  label: string;
  isPrimary: boolean;
}

interface SocialLinkRow {
  id?: string;
  platform: string;
  url: string;
  label: string;
}

const SOCIAL_PLATFORMS = ["zalo", "facebook", "telegram", "whatsapp"];

interface SupplierListItem {
  id: string;
  name: string;
  taxCode: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  status: string;
  rating: number | null;
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
  socialLinks: SocialLinkRow[];
  ratingNote: string | null;
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
  rating: string;
  ratingNote: string;
  phones: PhoneRow[];
  socialLinks: SocialLinkRow[];
} {
  return {
    name: "",
    taxCode: "",
    email: "",
    address: "",
    note: "",
    status: "active",
    rating: "",
    ratingNote: "",
    phones: [{ phone: "", label: "", isPrimary: true }],
    socialLinks: [],
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
  const [sort, setSort] = useState("");
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
        if (sort) params.set("sort", sort);
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
    [token, q, status, sort],
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
      rating: s.rating !== null && s.rating !== undefined ? String(s.rating) : "",
      ratingNote: s.ratingNote ?? "",
      phones: s.phones.map((p) => ({ id: p.id, phone: p.phone, label: p.label ?? "", isPrimary: p.isPrimary })),
      socialLinks: (s.socialLinks ?? []).map((l) => ({ id: l.id, platform: l.platform, url: l.url, label: l.label ?? "" })),
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
      rating: form.rating === "" ? null : parseInt(form.rating, 10),
      ratingNote: form.ratingNote.trim() || null,
      phones: form.phones
        .filter((p) => p.phone.trim())
        .map((p) => ({ phone: p.phone.trim(), label: p.label.trim() || null, isPrimary: p.isPrimary })),
      socialLinks: form.socialLinks
        .filter((l) => l.url.trim())
        .map((l) => ({ platform: l.platform, url: l.url.trim(), label: l.label.trim() || null })),
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

  async function handleDeleteSocialLink(link: SocialLinkRow) {
    if (!detail) return;
    if (!window.confirm(`Xóa link ${labelFor(SOCIAL_PLATFORM_LABELS, link.platform)} này?`)) return;
    setError("");
    try {
      await api(`/api/suppliers/${detail.id}/social-links/${link.id}`, token, "DELETE");
      setInfo("Đã xóa link mạng xã hội.");
      await openDetail(detail.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa link thất bại.");
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
            <label className="block">
              Sắp xếp
              <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="">Mới nhất</option>
                <option value="rating_desc">Điểm cao → thấp</option>
                <option value="rating_asc">Điểm thấp → cao</option>
                <option value="name_asc">Tên A→Z</option>
              </select>
            </label>
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
                    {s.rating !== null && s.rating !== undefined ? <span> · Điểm: <strong>{s.rating}/10</strong></span> : <span className="text-gray-500"> · Chưa đánh giá</span>}
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
            <h4 className="font-semibold">Mạng xã hội ({(detail.socialLinks ?? []).length})</h4>
            <ul className="mt-2 space-y-2">
              {(detail.socialLinks ?? []).map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{labelFor(SOCIAL_PLATFORM_LABELS, l.platform)}</span>
                  <a href={socialLinkHref(l.url)} target="_blank" rel="noreferrer" className="text-blue-700 underline break-all">
                    {l.label || l.url}
                  </a>
                  {l.label && <span className="text-gray-500">({l.url})</span>}
                  {canUpdate && (
                    <button onClick={() => handleDeleteSocialLink(l)} className="btn btn-sm btn-secondary text-sm">Xóa link</button>
                  )}
                </li>
              ))}
              {(detail.socialLinks ?? []).length === 0 && <li className="text-gray-500">Chưa có link mạng xã hội.</li>}
            </ul>
          </div>

          <div className="card">
            <h4 className="font-semibold">Đánh giá</h4>
            <p className="mt-2">Điểm: {detail.rating !== null && detail.rating !== undefined ? <strong>{detail.rating}/10</strong> : <span className="text-gray-500">Chưa đánh giá</span>}</p>
            {detail.ratingNote && <p className="mt-1 text-sm">Ghi chú: {detail.ratingNote}</p>}
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
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">Tên nhà cung cấp<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>

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
                  <input className="field" value={p.phone} onChange={(e) => setForm((f) => ({ ...f, phones: f.phones.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)) }))} placeholder="0987…" />
                  <input className="field" value={p.label} onChange={(e) => setForm((f) => ({ ...f, phones: f.phones.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) }))} placeholder="Nhãn: kế toán, kho…" />
                  <label className="flex items-center gap-1">
                    <input type="radio" name="primary-phone" checked={p.isPrimary} onChange={() => setPrimary(i)} /> Số chính
                  </label>
                  <button type="button" onClick={() => removePhone(i)} className="btn btn-secondary">Xóa số</button>
                </div>
              ))}
              <button type="button" onClick={() => setForm((f) => ({ ...f, phones: [...f.phones, { phone: "", label: "", isPrimary: f.phones.length === 0 }] }))} className="mt-2 btn btn-sm btn-secondary">+ Thêm số điện thoại</button>
            </div>

            <div>
              <h4 className="font-semibold">Mạng xã hội (không giới hạn số lượng link mỗi mạng)</h4>
              {form.socialLinks.map((l, i) => (
                <div key={i} className="mt-2 flex flex-wrap items-center gap-2">
                  <select className="field" value={l.platform} onChange={(e) => setForm((f) => ({ ...f, socialLinks: f.socialLinks.map((x, j) => (j === i ? { ...x, platform: e.target.value } : x)) }))}>
                    {SOCIAL_PLATFORMS.map((p) => (
                      <option key={p} value={p}>{labelFor(SOCIAL_PLATFORM_LABELS, p)}</option>
                    ))}
                  </select>
                  <input className="field" value={l.url} onChange={(e) => setForm((f) => ({ ...f, socialLinks: f.socialLinks.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) }))} placeholder="Link: zalo.me/… hoặc https://…" />
                  <input className="field" value={l.label} onChange={(e) => setForm((f) => ({ ...f, socialLinks: f.socialLinks.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) }))} placeholder="Nhãn: page bán hàng, nick cá nhân…" />
                  <button type="button" onClick={() => setForm((f) => ({ ...f, socialLinks: f.socialLinks.filter((_, j) => j !== i) }))} className="btn btn-secondary">Xóa link</button>
                </div>
              ))}
              <button type="button" onClick={() => setForm((f) => ({ ...f, socialLinks: [...f.socialLinks, { platform: "zalo", url: "", label: "" }] }))} className="mt-2 btn btn-sm btn-secondary">+ Thêm link mạng xã hội</button>
            </div>

            <label className="block">Email<input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>

            <label className="block">Mã số thuế<input className="input" value={form.taxCode} onChange={(e) => setForm({ ...form, taxCode: e.target.value })} placeholder="Để trống nếu không có" /></label>

            <label className="block">Địa chỉ<input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>

            <label className="block">Ghi chú<textarea className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>

            <div>
              <h4 className="font-semibold">Đánh giá (thang 10)</h4>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2">Điểm
                  <select className="field" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })}>
                    <option value="">Chưa đánh giá</option>
                    {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((n) => (
                      <option key={n} value={String(n)}>{n}/10</option>
                    ))}
                  </select>
                </label>
                <input className="field" value={form.ratingNote} onChange={(e) => setForm({ ...form, ratingNote: e.target.value })} placeholder="Ghi chú đánh giá: giao đúng hẹn, giá tốt…" />
              </div>
            </div>
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
