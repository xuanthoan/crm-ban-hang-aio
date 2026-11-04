import { useCallback, useEffect, useState } from "react";
import { clearCustomValidity, invalidMessage } from "./validity";
import {
  ACTIVITY_RESULT_LABELS,
  ACTIVITY_TYPE_LABELS,
  REMINDER_GROUP_LABELS,
  REMINDER_STATUS_LABELS,
  REMINDER_TYPE_LABELS,
  TIME_GROUP_LABELS,
  isoToVnDate,
  labelFor,
} from "./labels";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

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

export const ACTIVITY_TYPES = [
  "call", "zalo", "facebook", "email", "visit", "consultation", "quote", "close",
  "reschedule", "refuse", "after_sales", "payment_reminder", "complaint", "internal_note", "other",
] as const;

export const ACTIVITY_RESULTS = [
  "contacted", "no_answer", "wrong_number", "interested", "not_interested", "callback",
  "quoted", "closed", "refused", "need_followup", "payment_reminded", "resolved", "other",
] as const;

export const REMINDER_TYPES = [
  "callback", "message", "after_sales", "birthday", "payment", "complaint", "delivery", "check_order", "other",
] as const;

interface Activity {
  id: string;
  customerId: string;
  customerName: string | null;
  type: string;
  title: string;
  content: string | null;
  result: string | null;
  performedAt: string;
  createdByName: string | null;
  createdAt: string;
}

interface Reminder {
  id: string;
  customerId: string | null;
  customerName: string | null;
  orderCode: string | null;
  title: string;
  description: string | null;
  type: string | null;
  dueAt: string;
  timeGroup: string;
  status: string;
  assignedToName: string | null;
  createdByName: string | null;
  completionNote: string | null;
  cancelReason: string | null;
}

/** Care tab inside a customer detail view: history + new activity form. */
export function CustomerCareTab({ token, permissions, customerId }: { token: string; permissions: string[]; customerId: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [type, setType] = useState("call");
  const [content, setContent] = useState("");
  const [result, setResult] = useState("");
  const [performedAt, setPerformedAt] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const canView = permissions.includes("activity.view_all") || permissions.includes("activity.view_own");
  const canCreate = permissions.includes("activity.create");

  const load = useCallback(async () => {
    try {
      const data = await api(`/api/customers/${customerId}/activities?pageSize=50`, token);
      setActivities(data.activities as Activity[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được lịch sử chăm sóc.");
    }
  }, [customerId, token]);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    try {
      await api(`/api/customers/${customerId}/activities`, token, "POST", {
        type,
        content: content.trim(),
        result: result || null,
        performedAt: performedAt || null,
      });
      setContent("");
      setResult("");
      setPerformedAt("");
      setInfo("Đã ghi hoạt động chăm sóc. Hoạt động đã ghi không sửa/xóa được, ghi sai thì ghi thêm một hoạt động mới để đính chính.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không ghi được hoạt động.");
    }
  }

  if (!canView) return <p className="text-sm text-gray-500">Bạn không có quyền xem hoạt động chăm sóc.</p>;

  return (
    <div className="space-y-4">
      <h4 className="font-semibold">Chăm sóc ({activities.length})</h4>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {info && <p className="text-sm text-green-700">{info}</p>}
      {canCreate && (
        <form onSubmit={handleSubmit} className="space-y-2 card-sm">
          <div className="grid grid-cols-3 gap-2">
            <label className="block text-sm">Loại
              <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                {ACTIVITY_TYPES.map((t) => (<option key={t} value={t}>{labelFor(ACTIVITY_TYPE_LABELS, t)}</option>))}
              </select>
            </label>
            <label className="block text-sm">Kết quả (không bắt buộc)
              <select className="input" value={result} onChange={(e) => setResult(e.target.value)}>
                <option value="">—</option>
                {ACTIVITY_RESULTS.map((r) => (<option key={r} value={r}>{labelFor(ACTIVITY_RESULT_LABELS, r)}</option>))}
              </select>
            </label>
            <label className="block text-sm">Ngày thực hiện (mặc định hôm nay)
              <input type="date" className="input" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} />
            </label>
          </div>
          <label className="block text-sm">Nội dung (bắt buộc)
            <textarea className="input" value={content} onChange={(e) => { clearCustomValidity(e); setContent(e.target.value); }} onInvalid={(e) => e.currentTarget.setCustomValidity(invalidMessage(e.currentTarget, { missing: "Vui lòng nhập nội dung." }))} required />
          </label>
          <button type="submit" className="btn btn-primary">Ghi hoạt động</button>
        </form>
      )}
      <ul className="space-y-2">
        {activities.map((a) => (
          <li key={a.id} className="card-sm text-sm">
            <strong>{labelFor(ACTIVITY_TYPE_LABELS, a.type)}</strong> — {isoToVnDate(a.performedAt)}
            {a.result && <span> · Kết quả: {labelFor(ACTIVITY_RESULT_LABELS, a.result)}</span>}
            {a.createdByName && <span> · {a.createdByName}</span>}
            <p className="mt-1">{a.content}</p>
          </li>
        ))}
        {activities.length === 0 && <li className="text-gray-500">Chưa có hoạt động chăm sóc nào.</li>}
      </ul>
    </div>
  );
}

export default function RemindersPage({ token, permissions }: { token: string; permissions: string[] }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [group, setGroup] = useState("all");
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [type, setType] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const canView = permissions.includes("reminder.view_all") || permissions.includes("reminder.view_own");
  const canCreate = permissions.includes("reminder.create");
  const canComplete = permissions.includes("reminder.complete");
  const canCancel = permissions.includes("reminder.cancel");
  const canUpdate = permissions.includes("reminder.update");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ timeGroup: group, pageSize: "50" });
      const data = await api(`/api/reminders?${params.toString()}`, token);
      setReminders(data.reminders as Reminder[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được nhắc việc.");
    }
  }, [group, token]);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    try {
      await api("/api/reminders", token, "POST", {
        title: title.trim(),
        dueAt,
        type: type || null,
        customerId: customerId.trim() || null,
        description: note.trim() || null,
      });
      setTitle("");
      setDueAt("");
      setType("");
      setCustomerId("");
      setNote("");
      setInfo("Đã tạo nhắc việc.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tạo được nhắc việc.");
    }
  }

  async function handleAction(id: string, action: "complete" | "cancel") {
    setError("");
    try {
      const body = action === "cancel" ? { reason: window.prompt("Lý do hủy (không bắt buộc):") ?? undefined } : {};
      await api(`/api/reminders/${id}/${action}`, token, "POST", body);
      setInfo(action === "complete" ? "Đã hoàn thành nhắc việc." : "Đã hủy nhắc việc.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thao tác thất bại.");
    }
  }

  if (!canView) return <p className="text-sm text-gray-500">Bạn không có quyền xem nhắc việc.</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Nhắc việc</h2>
      <p className="text-sm text-gray-500">Quá hạn / hôm nay / sắp tới được tính trực tiếp từ hạn và trạng thái, không cần job chạy nền.</p>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {info && <p className="text-sm text-green-700">{info}</p>}
      <div className="flex flex-wrap gap-2">
        {["all", "overdue", "due_today", "upcoming", "done", "cancelled"].map((g) => (
          <button key={g} onClick={() => setGroup(g)} className={`btn btn-sm btn-secondary ${group === g ? "bg-blue-600 text-white" : ""}`}>{labelFor(REMINDER_GROUP_LABELS, g)}</button>
        ))}
      </div>
      {canCreate && (
        <form onSubmit={handleCreate} className="space-y-2 card-sm">
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">Tiêu đề (bắt buộc)<input className="input" value={title} onChange={(e) => { clearCustomValidity(e); setTitle(e.target.value); }} onInvalid={(e) => e.currentTarget.setCustomValidity(invalidMessage(e.currentTarget, { missing: "Vui lòng nhập tiêu đề." }))} required /></label>
            <label className="block text-sm">Hạn (bắt buộc)<input type="date" className="input" value={dueAt} onChange={(e) => { clearCustomValidity(e); setDueAt(e.target.value); }} onInvalid={(e) => e.currentTarget.setCustomValidity(invalidMessage(e.currentTarget, { missing: "Vui lòng chọn hạn." }))} required /></label>
            <label className="block text-sm">Loại
              <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">—</option>
                {REMINDER_TYPES.map((t) => (<option key={t} value={t}>{labelFor(REMINDER_TYPE_LABELS, t)}</option>))}
              </select>
            </label>
            <label className="block text-sm">ID khách (không bắt buộc)<input className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="Để trống nếu là việc chung" /></label>
          </div>
          <label className="block text-sm">Ghi chú<textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <button type="submit" className="btn btn-primary">Tạo nhắc việc</button>
          {!canUpdate && <span className="ml-2 text-sm text-gray-500">Bạn không có quyền sửa nhắc việc đang chờ.</span>}
        </form>
      )}
      <ul className="space-y-2">
        {reminders.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 card-sm text-sm">
            <strong>{r.title}</strong>
            <span>· Hạn {isoToVnDate(r.dueAt)}</span>
            <span>· {labelFor(TIME_GROUP_LABELS, r.timeGroup)} · {labelFor(REMINDER_STATUS_LABELS, r.status)}</span>
            {r.customerName && <span>· Khách: {r.customerName}</span>}
            {r.assignedToName && <span>· Giao: {r.assignedToName}</span>}
            {r.status === "pending" && canComplete && <button onClick={() => handleAction(r.id, "complete")} className="btn btn-sm btn-secondary">Hoàn thành</button>}
            {r.status === "pending" && canCancel && <button onClick={() => handleAction(r.id, "cancel")} className="btn btn-sm btn-secondary">Hủy</button>}
            {r.completionNote && <span className="text-gray-500">· Ghi chú hoàn thành: {r.completionNote}</span>}
            {r.cancelReason && <span className="text-gray-500">· Lý do hủy: {r.cancelReason}</span>}
          </li>
        ))}
        {reminders.length === 0 && <li className="text-gray-500">Không có nhắc việc nào trong nhóm này.</li>}
      </ul>
    </div>
  );
}

// Same vi-VN dot grouping as the money inputs on the order/product
// forms: the threshold is displayed grouped but sent to the API as
// plain digits (parseInt would stop at the first dot otherwise).
function formatMoneyInput(text: string): string {
  const digits = text.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("vi-VN");
}

export function SegmentsPage({ token, permissions }: { token: string; permissions: string[] }) {
  const [segments, setSegments] = useState<{ key: string; name: string; description: string; count: number | null; note: string }[]>([]);
  const [selected, setSelected] = useState("birthday_customers");
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [days, setDays] = useState("7");
  const [threshold, setThreshold] = useState("5.000.000");
  const [tagId, setTagId] = useState("");
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");

  const canView = permissions.includes("segment.view");

  const loadSegments = useCallback(async () => {
    try {
      const params = new URLSearchParams({ days });
      if (tagId) params.set("tagId", tagId);
      // The counts must follow the typed threshold too: previously the
      // counts call never sent it, so the high-value count stayed frozen
      // at the 5.000.000 default no matter what the user typed.
      const thresholdDigits = threshold.replace(/[^0-9]/g, "");
      if (thresholdDigits) params.set("threshold", thresholdDigits);
      const data = await api(`/api/segments?${params.toString()}`, token);
      setSegments(data.segments as typeof segments);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được phân đoạn.");
    }
  }, [days, tagId, threshold, token]);

  // Tags for the by-tag segment: a dropdown by name, not a raw Tag ID
  // typed from memory (the ID is not shown anywhere in the UI).
  useEffect(() => {
    if (!canView) return;
    api("/api/tags?pageSize=100", token)
      .then((data) => setTags(((data.data as { id: string; name: string }[]) ?? [])))
      .catch(() => {});
  }, [canView, token]);

  const loadItems = useCallback(async () => {
    try {
      const params = new URLSearchParams({ days, threshold: threshold.replace(/[^0-9]/g, "") || "5000000", pageSize: "50" });
      if (tagId) params.set("tagId", tagId);
      const data = await api(`/api/segments/${selected}/customers?${params.toString()}`, token);
      setItems(data.items as Record<string, unknown>[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được danh sách phân đoạn.");
    }
  }, [selected, days, threshold, tagId, token]);

  useEffect(() => {
    if (canView) loadSegments();
  }, [canView, loadSegments]);

  useEffect(() => {
    if (canView) loadItems();
  }, [canView, loadItems]);

  if (!canView) return <p className="text-sm text-gray-500">Bạn không có quyền xem phân đoạn remarketing.</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Remarketing</h2>
      <p className="text-sm text-gray-500">Phân đoạn chỉ là danh sách để nhân viên tự chăm sóc và ghi hoạt động thủ công. Sprint này KHÔNG tự gửi Zalo/SMS/Email/Messenger và KHÔNG tự tạo hoạt động.</p>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <label className="text-sm">Số ngày tới (sinh nhật): <input className="rounded border p-1" value={days} onChange={(e) => setDays(e.target.value)} size={4} /></label>
        <label className="text-sm">Ngưỡng giá trị cao: <input className="rounded border p-1" value={threshold} onChange={(e) => setThreshold(formatMoneyInput(e.target.value))} inputMode="numeric" size={10} /></label>
        <label className="text-sm">Tag (cho phân đoạn theo tag): <select className="rounded border p-1" value={tagId} onChange={(e) => setTagId(e.target.value)}>
          <option value="">— Chọn tag —</option>
          {tags.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
        </select></label>
      </div>
      <div className="grid gap-2">
        {segments.map((s) => (
          <button key={s.key} onClick={() => setSelected(s.key)} className={`card-sm text-left ${selected === s.key ? "border-blue-600 bg-blue-50" : ""}`}>
            <strong>{s.name}</strong> {s.count !== null && <span>({s.count})</span>}
            <p className="text-sm text-gray-600">{s.description}</p>
            <p className="text-sm text-gray-500">{s.note}</p>
          </button>
        ))}
      </div>
      {/* Kết quả tách biệt rõ khỏi các thẻ tiêu đề filter phía trên: khối
          riêng có viền đậm + nền xanh nhạt + tiêu đề ghi rõ đang xem kết
          quả của phân đoạn nào, nên không còn lẫn với các thẻ filter.
          Thẻ filter đang chọn cũng được tô nền xanh nhạt để nhìn là biết
          kết quả thuộc về filter nào. */}
      <div className="mt-2 rounded-lg border-2 border-blue-600/30 bg-blue-50/50 p-3">
        <h3 className="font-semibold">
          Kết quả: {segments.find((s) => s.key === selected)?.name ?? "Phân đoạn đã chọn"}
          {items.length > 0 && <span> ({items.length})</span>}
        </h3>
        <ul className="mt-2 space-y-2">
          {items.map((it, i) => {
            // Dòng sinh nhật con: API đã trả sẵn customerId của cha mẹ nên
            // không cần sửa backend. Bấm vào dòng thì mở hồ sơ khách (cha
            // mẹ) trong tab mới qua deep link ?customer=, trang hiện tại
            // giữ nguyên. Các dòng phân đoạn khác không phải dòng con nên
            // giữ nguyên dạng text, không bấm được.
            const customerId = typeof it.customerId === "string" && it.customerId ? it.customerId : null;
            const childRow = Boolean(it.childName) && customerId;
            const content = (
              <>
                <strong>{String(it.childName ?? it.fullName ?? "")}</strong>
                {Boolean(it.customerName) && Boolean(it.childName) && <span> · Khách: {String(it.customerName)}</span>}
                {Boolean(it.nextBirthday) && <span> · Sinh nhật sắp tới: {isoToVnDate(String(it.nextBirthday))} ({String(it.upcomingAge)} tuổi)</span>}
                {/* Child-birthday rows already render nextBirthday/upcomingAge
                    above; their reason repeats the same info verbatim, so
                    showing it too prints the birthday twice. Other segments
                    keep their reason, which carries distinct info. */}
                {Boolean(it.reason) && !(Boolean(it.childName) && Boolean(it.nextBirthday)) && <span> · {String(it.reason)}</span>}
                {Boolean(it.phone) && <span> · {String(it.phone)}</span>}
              </>
            );
            return (
              <li key={i} className="card-sm text-sm">
                {childRow ? (
                  <button
                    type="button"
                    className="block w-full text-left"
                    title="Mở hồ sơ khách hàng (cha mẹ) trong tab mới"
                    onClick={() => {
                      if (customerId) window.open(`${window.location.origin}${window.location.pathname}?customer=${encodeURIComponent(customerId)}`, "_blank", "noopener,noreferrer");
                    }}
                  >
                    {content} <span className="text-xs text-blue-700">↗ Hồ sơ khách</span>
                  </button>
                ) : content}
              </li>
            );
          })}
          {items.length === 0 && <li className="text-gray-500">Phân đoạn này hiện không có khách nào.</li>}
        </ul>
      </div>
    </div>
  );
}
