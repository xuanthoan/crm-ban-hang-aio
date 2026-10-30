import { useCallback, useEffect, useState } from "react";
import { CustomerCareTab } from "./care";
import { VnDateInput, isoToVnDate } from "./VnDateInput";
import { EntityAuditTimeline } from "./audit";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface Tag {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  customerCount?: number;
}

interface PhoneRow {
  id?: string;
  phone: string;
  phoneNormalized?: string;
  label: string;
  isPrimary: boolean;
}

interface ChildRow {
  id?: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  note: string;
}

interface CustomerListItem {
  id: string;
  fullName: string;
  primaryPhone: string | null;
  phoneCount: number;
  tags: Tag[];
  childrenCount: number;
  status: string;
  source: string | null;
  createdAt: string;
}

interface CustomerDetail extends CustomerListItem {
  gender: string | null;
  dateOfBirth: string | null;
  address: string | null;
  email: string | null;
  note: string | null;
  phones: PhoneRow[];
  children: (ChildRow & { ageYears: number | null })[];
  orders: unknown[];
  payments: unknown[];
  debtTotal: unknown;
  ordersNote: string;
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
  fullName: string;
  gender: string;
  dateOfBirth: string;
  address: string;
  email: string;
  note: string;
  source: string;
  status: string;
  phones: PhoneRow[];
  tagIds: string[];
  children: ChildRow[];
} {
  return {
    fullName: "",
    gender: "",
    dateOfBirth: "",
    address: "",
    email: "",
    note: "",
    source: "",
    status: "active",
    phones: [{ phone: "", label: "", isPrimary: true }],
    tagIds: [],
    children: [],
  };
}

export default function CustomersPage({ token, permissions }: { token: string; permissions: string[] }) {
  const [view, setView] = useState<"list" | "detail" | "form">("list");
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [formId, setFormId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [q, setQ] = useState("");
  const [tagId, setTagId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [newTagName, setNewTagName] = useState("");

  const canCreate = permissions.includes("customer.create");
  const canUpdate = permissions.includes("customer.update");
  const canDeactivate = permissions.includes("customer.deactivate");
  const canHardDelete = permissions.includes("customer.hard_delete");
  const canTagManage = permissions.includes("customer.tag_manage");
  const canViewDebt =
    permissions.includes("debt.view_all") || permissions.includes("debt.view_own");

  // Sprint Thanh toán: customer debt is computed live from the
  // customer's payable orders by the backend — never stored on the
  // customer row, so it cannot drift from the debt list.
  const [customerDebt, setCustomerDebt] = useState<{
    totalDebt: number;
    totalOwing: number;
    totalCredit: number;
    orders: { orderCode: string; debtTotal: number; paymentStatus: string; status: string }[];
  } | null>(null);

  const loadCustomerDebt = useCallback(
    async (customerId: string) => {
      if (!canViewDebt) {
        setCustomerDebt(null);
        return;
      }
      try {
        const data = await api(`/api/customers/${customerId}/debt`, token);
        setCustomerDebt(data.data as typeof customerDebt);
      } catch {
        // Debt is supplementary on the customer profile; a failure
        // here must not hide the profile itself.
        setCustomerDebt(null);
      }
    },
    [token, canViewDebt],
  );

  const loadTags = useCallback(async () => {
    try {
      const data = await api("/api/tags?pageSize=100", token);
      setTags(data.data as Tag[]);
    } catch {
      // Tag list is optional for the customer list; the error surfaces on save.
    }
  }, [token]);

  const loadCustomers = useCallback(
    async (p = 1) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ page: String(p), pageSize: "20" });
        if (q.trim()) params.set("q", q.trim());
        if (tagId) params.set("tagId", tagId);
        if (status) params.set("status", status);
        const data = await api(`/api/customers?${params.toString()}`, token);
        setCustomers(data.data as CustomerListItem[]);
        setTotal(((data.pagination as { total: number }).total ?? 0));
        setTotalPages((data.pagination as { totalPages: number }).totalPages ?? 1);
        setPage(p);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được danh sách khách hàng.");
      } finally {
        setLoading(false);
      }
    },
    [token, q, tagId, status],
  );

  useEffect(() => {
    loadTags();
    loadCustomers(1);
  }, [loadTags, loadCustomers]);

  async function openDetail(id: string) {
    setError("");
    try {
      const data = await api(`/api/customers/${id}`, token);
      setDetail(data.customer as CustomerDetail);
      setView("detail");
      await loadCustomerDebt(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không mở được hồ sơ khách hàng.");
    }
  }

  function openCreate() {
    setFormId(null);
    setForm(emptyForm());
    setView("form");
  }

  function openEdit(c: CustomerDetail) {
    setFormId(c.id);
    setForm({
      fullName: c.fullName,
      gender: c.gender ?? "",
      dateOfBirth: c.dateOfBirth ? c.dateOfBirth.slice(0, 10) : "",
      address: c.address ?? "",
      email: c.email ?? "",
      note: c.note ?? "",
      source: c.source ?? "",
      status: c.status,
      phones: c.phones.map((p) => ({ id: p.id, phone: p.phone, label: p.label ?? "", isPrimary: p.isPrimary })),
      tagIds: c.tags.map((t) => t.id),
      children: c.children.map((ch) => ({
        id: ch.id,
        fullName: ch.fullName,
        dateOfBirth: ch.dateOfBirth ? ch.dateOfBirth.slice(0, 10) : "",
        gender: ch.gender ?? "",
        note: ch.note ?? "",
      })),
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
    // Ngày sinh trong form đã là ISO do VnDateInput chọn/gõ và kiểm tra
    // (ngày thật, không tương lai); ở đây chỉ gửi thẳng, không kiểm tra
    // lại bằng chuỗi dd/mm/yyyy nữa để tránh lỗi với năm < 100.
    // Tag đã gõ tên nhưng chưa bấm "+ Tạo tag" thì tạo luôn ở đây,
    // tránh mất lặng: trước đây trường hợp này lưu xong hồ sơ không có tag.
    let tagIds = [...form.tagIds];
    if (newTagName.trim()) {
      try {
        const data = await api("/api/tags", token, "POST", { name: newTagName.trim() });
        const tag = data.tag as Tag;
        await loadTags();
        if (!tagIds.includes(tag.id)) tagIds.push(tag.id);
        setNewTagName("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Tạo tag thất bại.");
        return;
      }
    }
    const body = {
      fullName: form.fullName.trim(),
      gender: form.gender.trim() || null,
      dateOfBirth: form.dateOfBirth || null,
      address: form.address.trim() || null,
      email: form.email.trim() || null,
      note: form.note.trim() || null,
      source: form.source.trim() || null,
      status: form.status,
      phones: form.phones
        .filter((p) => p.phone.trim())
        .map((p) => ({ phone: p.phone.trim(), label: p.label.trim() || null, isPrimary: p.isPrimary })),
      tagIds,
      children: form.children.map((ch) => ({
        ...(ch.id ? { id: ch.id } : {}),
        fullName: ch.fullName.trim(),
        dateOfBirth: ch.dateOfBirth || null,
        gender: ch.gender.trim() || null,
        note: ch.note.trim() || null,
      })),
    };
    try {
      if (formId) {
        await api(`/api/customers/${formId}`, token, "PATCH", body);
        setInfo("Đã lưu thay đổi cho khách hàng.");
        await openDetail(formId);
      } else {
        const data = await api("/api/customers", token, "POST", body);
        setInfo("Đã tạo khách hàng mới.");
        await openDetail((data.customer as CustomerDetail).id);
      }
      loadCustomers(1);
    } catch (err) {
      // Backend duplicate errors already name the conflicting customer.
      setError(err instanceof Error ? err.message : "Lưu khách hàng thất bại.");
    }
  }

  async function handleDeactivate(id: string) {
    if (!window.confirm("Ngừng hoạt động khách hàng này? Dữ liệu vẫn được giữ lại (xóa mềm).")) return;
    setError("");
    try {
      await api(`/api/customers/${id}`, token, "DELETE");
      setInfo("Đã ngừng hoạt động khách hàng.");
      setView("list");
      loadCustomers(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ngừng hoạt động thất bại.");
    }
  }

  async function handleHardDelete(id: string) {
    if (!window.confirm("Xóa CỨNG khách hàng này? Chỉ thành công khi khách chưa có bất kỳ dữ liệu liên quan nào (số, tag, con, đơn, thanh toán...).")) return;
    setError("");
    try {
      await api(`/api/customers/${id}?hard=true`, token, "DELETE");
      setInfo("Đã xóa cứng khách hàng.");
      setView("list");
      loadCustomers(1);
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
      await api(`/api/customers/${detail.id}/phones/${phone.id}`, token, "DELETE", {
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
      await api(`/api/customers/${detail.id}/phones/${phone.id}/make-primary`, token, "POST", {});
      await openDetail(detail.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đổi số chính thất bại.");
    }
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) return;
    setError("");
    try {
      const data = await api("/api/tags", token, "POST", { name: newTagName.trim() });
      const tag = data.tag as Tag;
      await loadTags();
      setForm((f) => ({ ...f, tagIds: [...f.tagIds, tag.id] }));
      setNewTagName("");
      setInfo(`Đã tạo tag "${tag.name}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo tag thất bại.");
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Khách hàng</h2>
      <p className="text-sm text-gray-500">
        Một khách có thể có bao nhiêu số cũng được, đúng 1 số chính. Trùng bất kỳ số nào với khách khác đều bị chặn ở backend
        và báo rõ khách đã có số đó.
      </p>
      {error && <p className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
      {info && <p className="rounded border border-green-300 bg-green-50 p-3 text-green-800">{info}</p>}

      {view === "list" && (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              Tìm theo tên hoặc số
              <input className="mt-1 w-full rounded border p-2" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên, 0987…, +84…" />
            </label>
            <label className="block">
              Tag
              <select className="mt-1 rounded border p-2" value={tagId} onChange={(e) => setTagId(e.target.value)}>
                <option value="">Tất cả tag</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              Trạng thái
              <select className="mt-1 rounded border p-2" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Tất cả</option>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Ngừng hoạt động</option>
              </select>
            </label>
            <button onClick={() => loadCustomers(1)} className="rounded bg-blue-600 px-4 py-2 text-white">Tìm</button>
            {canCreate && (
              <button onClick={openCreate} className="rounded border px-4 py-2">+ Tạo khách hàng</button>
            )}
          </div>
          {loading && <p>Đang tải…</p>}
          <p className="text-sm text-gray-500">Tổng: {total} khách hàng · Trang {page}/{totalPages}</p>
          <ul className="space-y-2">
            {customers.map((c) => (
              <li key={c.id} className="rounded border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <strong>{c.fullName || "(chưa có tên)"}</strong>
                    {c.primaryPhone && <span> — {c.primaryPhone}</span>}
                    <span className="text-gray-500"> · {c.phoneCount} số · {c.childrenCount} con · {c.status === "active" ? "Đang hoạt động" : "Ngừng hoạt động"}</span>
                    <div className="text-sm text-gray-500">
                      {c.tags.map((t) => t.name).join(", ") || "Chưa có tag"}
                      {c.source ? ` · Nguồn: ${c.source}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openDetail(c.id)} className="rounded border px-3 py-1">Xem</button>
                    {canDeactivate && c.status === "active" && (
                      <button onClick={() => handleDeactivate(c.id)} className="rounded border px-3 py-1">Ngừng hoạt động</button>
                    )}
                  </div>
                </div>
              </li>
            ))}
            {customers.length === 0 && !loading && <li className="text-gray-500">Chưa có khách hàng nào khớp bộ lọc.</li>}
          </ul>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => loadCustomers(page - 1)} className="rounded border px-4 py-2 disabled:opacity-50">Trang trước</button>
            <button disabled={page >= totalPages} onClick={() => loadCustomers(page + 1)} className="rounded border px-4 py-2 disabled:opacity-50">Trang sau</button>
          </div>
        </>
      )}

      {view === "detail" && detail && (
        <div className="space-y-4">
          <button onClick={() => { setView("list"); loadCustomers(page); }} className="rounded border px-3 py-1">← Về danh sách</button>
          <div className="rounded border p-4">
            <h3 className="text-lg font-semibold">{detail.fullName || "(chưa có tên)"}</h3>
            <p className="text-sm text-gray-600">
              {detail.gender ? `Giới tính: ${detail.gender} · ` : ""}
              {detail.dateOfBirth ? `Ngày sinh: ${isoToVnDate(detail.dateOfBirth)} · ` : ""}
              {detail.email ? `Email: ${detail.email} · ` : ""}
              {detail.address ? `Địa chỉ: ${detail.address} · ` : ""}
              {detail.source ? `Nguồn: ${detail.source} · ` : ""}
              Trạng thái: {detail.status === "active" ? "Đang hoạt động" : "Ngừng hoạt động"}
            </p>
            {detail.note && <p className="mt-2 text-sm">Ghi chú: {detail.note}</p>}
            <p className="mt-2 text-sm text-gray-500">Tag: {detail.tags.map((t) => t.name).join(", ") || "Chưa có tag"}</p>
            <div className="mt-3 flex gap-2">
              {canUpdate && <button onClick={() => openEdit(detail)} className="rounded bg-blue-600 px-4 py-2 text-white">Sửa</button>}
              {canDeactivate && detail.status === "active" && (
                <button onClick={() => handleDeactivate(detail.id)} className="rounded border px-4 py-2">Ngừng hoạt động</button>
              )}
              {canHardDelete && (
                <button onClick={() => handleHardDelete(detail.id)} className="rounded border px-4 py-2 text-red-700">Xóa cứng (chỉ khi chưa có dữ liệu liên quan)</button>
              )}
            </div>
          </div>

          <div className="rounded border p-4">
            <h4 className="font-semibold">Số điện thoại ({detail.phones.length})</h4>
            <ul className="mt-2 space-y-2">
              {detail.phones.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2">
                  <span>{p.phone}</span>
                  {p.label && <span className="text-gray-500">({p.label})</span>}
                  {p.isPrimary && <strong className="text-blue-700">[Số chính]</strong>}
                  {canUpdate && !p.isPrimary && (
                    <button onClick={() => handleMakePrimary(p)} className="rounded border px-2 py-1 text-sm">Đặt làm số chính</button>
                  )}
                  {canUpdate && (
                    <button onClick={() => handleDeletePhone(p)} className="rounded border px-2 py-1 text-sm">Xóa số</button>
                  )}
                </li>
              ))}
              {detail.phones.length === 0 && <li className="text-gray-500">Chưa có số điện thoại.</li>}
            </ul>
          </div>

          <div className="rounded border p-4">
            <h4 className="font-semibold">Con cái ({detail.children.length})</h4>
            <ul className="mt-2 space-y-2">
              {detail.children.map((ch) => (
                <li key={ch.id}>
                  <strong>{ch.fullName}</strong>
                  {ch.dateOfBirth && <span> — sinh {isoToVnDate(ch.dateOfBirth)}{ch.ageYears !== null ? ` (${ch.ageYears} tuổi)` : ""}</span>}
                  {ch.gender && <span> · {ch.gender}</span>}
                  {ch.note && <span className="text-gray-500"> · {ch.note}</span>}
                </li>
              ))}
              {detail.children.length === 0 && <li className="text-gray-500">Chưa có thông tin con.</li>}
            </ul>
          </div>

          <div className="rounded border p-4">
            <h4 className="font-semibold">Đơn hàng và công nợ</h4>
            {canViewDebt && customerDebt ? (
              <>
                <p className="text-sm">
                  Tổng công nợ (ròng, theo đơn confirmed/completed): <strong>{customerDebt.totalDebt.toLocaleString("vi-VN")}</strong>
                  {customerDebt.totalCredit > 0 && ` · Tiền thừa cần hoàn: ${customerDebt.totalCredit.toLocaleString("vi-VN")}`}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {customerDebt.orders.map((o) => (
                    <li key={o.orderCode}>
                      {o.orderCode} · Còn nợ {o.debtTotal.toLocaleString("vi-VN")} · {o.paymentStatus} · {o.status}
                    </li>
                  ))}
                  {customerDebt.orders.length === 0 && <li className="text-gray-500">Khách này hiện không có đơn nào còn nợ.</li>}
                </ul>
                <p className="mt-2 text-sm text-gray-500">Số này tính trực tiếp từ các đơn của khách, phải khớp với tổng ở trang Công nợ. Đơn nháp và đơn đã hủy không tính là còn nợ.</p>
              </>
            ) : (
              <p className="text-sm text-gray-500">{detail.ordersNote} Số liệu ở đây đang để trống, không phải số thật.</p>
            )}
          </div>

          <div className="rounded border p-4">
            <CustomerCareTab token={token} permissions={permissions} customerId={detail.id} />
          </div>

          {(permissions.includes("audit.view_all") || permissions.includes("audit.view_own")) && (
            <EntityAuditTimeline token={token} entityType="customer" entityId={detail.id} />
          )}
        </div>
      )}

      {view === "form" && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded border p-4">
          <h3 className="font-semibold">{formId ? "Sửa khách hàng" : "Tạo khách hàng mới"}</h3>
          <p className="text-sm text-gray-500">Họ tên hoặc ít nhất một số điện thoại là bắt buộc (theo docs 01).</p>
          <label className="block">Họ tên<input className="mt-1 w-full rounded border p-2" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">Giới tính<input className="mt-1 w-full rounded border p-2" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} /></label>
            <label className="block">Ngày sinh (dd/mm/yyyy)<VnDateInput value={form.dateOfBirth} onChange={(iso) => setForm({ ...form, dateOfBirth: iso })} /></label>
            <label className="block">Email<input className="mt-1 w-full rounded border p-2" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="block">Nguồn<input className="mt-1 w-full rounded border p-2" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Facebook, Zalo, Offline…" /></label>
          </div>
          <label className="block">Địa chỉ<input className="mt-1 w-full rounded border p-2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
          <label className="block">Ghi chú<textarea className="mt-1 w-full rounded border p-2" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>

          <div>
            <h4 className="font-semibold">Số điện thoại (không giới hạn số lượng)</h4>
            {form.phones.map((p, i) => (
              <div key={i} className="mt-2 flex flex-wrap items-center gap-2">
                <input className="rounded border p-2" value={p.phone} onChange={(e) => setForm((f) => ({ ...f, phones: f.phones.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)) }))} placeholder="0987…" />
                <input className="rounded border p-2" value={p.label} onChange={(e) => setForm((f) => ({ ...f, phones: f.phones.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) }))} placeholder="Nhãn: chính, phụ, Zalo…" />
                <label className="flex items-center gap-1">
                  <input type="radio" name="primary-phone" checked={p.isPrimary} onChange={() => setPrimary(i)} /> Số chính
                </label>
                <button type="button" onClick={() => removePhone(i)} className="rounded border px-2 py-1">Xóa số</button>
              </div>
            ))}
            <button type="button" onClick={() => setForm((f) => ({ ...f, phones: [...f.phones, { phone: "", label: "", isPrimary: f.phones.length === 0 }] }))} className="mt-2 rounded border px-3 py-1">+ Thêm số điện thoại</button>
          </div>

          <div>
            <h4 className="font-semibold">Tag</h4>
            <div className="mt-2 flex flex-wrap gap-3">
              {tags.map((t) => (
                <label key={t.id} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={form.tagIds.includes(t.id)}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tagIds: e.target.checked ? [...f.tagIds, t.id] : f.tagIds.filter((id) => id !== t.id) }))
                    }
                  />
                  {t.name}
                </label>
              ))}
              {tags.length === 0 && <span className="text-gray-500">Chưa có tag nào.</span>}
            </div>
            {canTagManage && (
              <div className="mt-2 flex gap-2">
                <input className="rounded border p-2" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Tên tag mới" />
                <button type="button" onClick={handleCreateTag} className="rounded border px-3 py-1">+ Tạo tag</button>
              </div>
            )}
          </div>

          <div>
            <h4 className="font-semibold">Con cái (không giới hạn số lượng)</h4>
            {form.children.map((ch, i) => (
              <div key={i} className="mt-2 grid grid-cols-2 gap-2 rounded border p-2">
                <label className="block col-span-2">Họ tên con<input className="mt-1 w-full rounded border p-2" value={ch.fullName} onChange={(e) => setForm((f) => ({ ...f, children: f.children.map((x, j) => (j === i ? { ...x, fullName: e.target.value } : x)) }))} /></label>
                <label className="block">Ngày sinh (dd/mm/yyyy)<VnDateInput value={ch.dateOfBirth} onChange={(iso) => setForm((f) => ({ ...f, children: f.children.map((x, j) => (j === i ? { ...x, dateOfBirth: iso } : x)) }))} /></label>
                <label className="block">Giới tính<input className="mt-1 w-full rounded border p-2" value={ch.gender} onChange={(e) => setForm((f) => ({ ...f, children: f.children.map((x, j) => (j === i ? { ...x, gender: e.target.value } : x)) }))} /></label>
                <label className="block col-span-2">Ghi chú<input className="mt-1 w-full rounded border p-2" value={ch.note} onChange={(e) => setForm((f) => ({ ...f, children: f.children.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) }))} /></label>
                <button type="button" onClick={() => setForm((f) => ({ ...f, children: f.children.filter((_, j) => j !== i) }))} className="rounded border px-2 py-1">Xóa thông tin con</button>
              </div>
            ))}
            <button type="button" onClick={() => setForm((f) => ({ ...f, children: [...f.children, { fullName: "", dateOfBirth: "", gender: "", note: "" }] }))} className="mt-2 rounded border px-3 py-1">+ Thêm con</button>
          </div>

          <div className="flex gap-2">
            <button className="rounded bg-blue-600 px-4 py-2 text-white">{formId ? "Lưu thay đổi" : "Tạo khách hàng"}</button>
            <button type="button" onClick={() => setView("list")} className="rounded border px-4 py-2">Hủy</button>
          </div>
        </form>
      )}
    </section>
  );
}
