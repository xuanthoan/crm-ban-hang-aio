import { useCallback, useEffect, useState } from "react";

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
        <form onSubmit={handleSubmit} className="space-y-2 rounded border p-3">
          <div className="grid grid-cols-3 gap-2">
            <label className="block text-sm">Loại
              <select className="mt-1 w-full rounded border p-2" value={type} onChange={(e) => setType(e.target.value)}>
                {ACTIVITY_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </label>
            <label className="block text-sm">Kết quả (không bắt buộc)
              <select className="mt-1 w-full rounded border p-2" value={result} onChange={(e) => setResult(e.target.value)}>
                <option value="">—</option>
                {ACTIVITY_RESULTS.map((r) => (<option key={r} value={r}>{r}</option>))}
              </select>
            </label>
            <label className="block text-sm">Ngày thực hiện (mặc định hôm nay)
              <input type="date" className="mt-1 w-full rounded border p-2" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} />
            </label>
          </div>
          <label className="block text-sm">Nội dung (bắt buộc)
            <textarea className="mt-1 w-full rounded border p-2" value={content} onChange={(e) => setContent(e.target.value)} required />
          </label>
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">Ghi hoạt động</button>
        </form>
      )}
      <ul className="space-y-2">
        {activities.map((a) => (
          <li key={a.id} className="rounded border p-3 text-sm">
            <strong>{a.type}</strong> — {a.performedAt.slice(0, 10)}
            {a.result && <span> · Kết quả: {a.result}</span>}
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
          <button key={g} onClick={() => setGroup(g)} className={`rounded border px-3 py-1 ${group === g ? "bg-blue-600 text-white" : ""}`}>{g}</button>
        ))}
      </div>
      {canCreate && (
        <form onSubmit={handleCreate} className="space-y-2 rounded border p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">Tiêu đề (bắt buộc)<input className="mt-1 w-full rounded border p-2" value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
            <label className="block text-sm">Hạn (bắt buộc)<input type="date" className="mt-1 w-full rounded border p-2" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required /></label>
            <label className="block text-sm">Loại
              <select className="mt-1 w-full rounded border p-2" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">—</option>
                {REMINDER_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </label>
            <label className="block text-sm">ID khách (không bắt buộc)<input className="mt-1 w-full rounded border p-2" value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="Để trống nếu là việc chung" /></label>
          </div>
          <label className="block text-sm">Ghi chú<textarea className="mt-1 w-full rounded border p-2" value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">Tạo nhắc việc</button>
          {!canUpdate && <span className="ml-2 text-sm text-gray-500">Bạn không có quyền sửa nhắc việc đang chờ.</span>}
        </form>
      )}
      <ul className="space-y-2">
        {reminders.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 rounded border p-3 text-sm">
            <strong>{r.title}</strong>
            <span>· Hạn {r.dueAt.slice(0, 10)}</span>
            <span>· {r.timeGroup} · {r.status}</span>
            {r.customerName && <span>· Khách: {r.customerName}</span>}
            {r.assignedToName && <span>· Giao: {r.assignedToName}</span>}
            {r.status === "pending" && canComplete && <button onClick={() => handleAction(r.id, "complete")} className="rounded border px-2 py-1">Hoàn thành</button>}
            {r.status === "pending" && canCancel && <button onClick={() => handleAction(r.id, "cancel")} className="rounded border px-2 py-1">Hủy</button>}
            {r.completionNote && <span className="text-gray-500">· Ghi chú hoàn thành: {r.completionNote}</span>}
            {r.cancelReason && <span className="text-gray-500">· Lý do hủy: {r.cancelReason}</span>}
          </li>
        ))}
        {reminders.length === 0 && <li className="text-gray-500">Không có nhắc việc nào trong nhóm này.</li>}
      </ul>
    </div>
  );
}

export function SegmentsPage({ token, permissions }: { token: string; permissions: string[] }) {
  const [segments, setSegments] = useState<{ key: string; name: string; description: string; count: number | null; note: string }[]>([]);
  const [selected, setSelected] = useState("birthday_customers");
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [days, setDays] = useState("7");
  const [threshold, setThreshold] = useState("5000000");
  const [tagId, setTagId] = useState("");
  const [error, setError] = useState("");

  const canView = permissions.includes("segment.view");

  const loadSegments = useCallback(async () => {
    try {
      const data = await api(`/api/segments?days=${days}`, token);
      setSegments(data.segments as typeof segments);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được phân đoạn.");
    }
  }, [days, token]);

  const loadItems = useCallback(async () => {
    try {
      const params = new URLSearchParams({ days, threshold, pageSize: "50" });
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
      <h2 className="text-lg font-semibold">Phân đoạn remarketing (cơ bản)</h2>
      <p className="text-sm text-gray-500">Phân đoạn chỉ là danh sách để nhân viên tự chăm sóc và ghi hoạt động thủ công. Sprint này KHÔNG tự gửi Zalo/SMS/Email/Messenger và KHÔNG tự tạo hoạt động.</p>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <label className="text-sm">Số ngày tới (sinh nhật): <input className="rounded border p-1" value={days} onChange={(e) => setDays(e.target.value)} size={4} /></label>
        <label className="text-sm">Ngưỡng giá trị cao: <input className="rounded border p-1" value={threshold} onChange={(e) => setThreshold(e.target.value)} size={10} /></label>
        <label className="text-sm">Tag ID (cho phân đoạn theo tag): <input className="rounded border p-1" value={tagId} onChange={(e) => setTagId(e.target.value)} /></label>
      </div>
      <div className="grid gap-2">
        {segments.map((s) => (
          <button key={s.key} onClick={() => setSelected(s.key)} className={`rounded border p-3 text-left ${selected === s.key ? "border-blue-600" : ""}`}>
            <strong>{s.name}</strong> {s.count !== null && <span>({s.count})</span>}
            <p className="text-sm text-gray-600">{s.description}</p>
            <p className="text-sm text-gray-500">{s.note}</p>
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="rounded border p-3 text-sm">
            <strong>{String(it.childName ?? it.fullName ?? "")}</strong>
            {Boolean(it.customerName) && Boolean(it.childName) && <span> · Khách: {String(it.customerName)}</span>}
            {Boolean(it.nextBirthday) && <span> · Sinh nhật sắp tới: {String(it.nextBirthday)} ({String(it.upcomingAge)} tuổi)</span>}
            {Boolean(it.reason) && <span> · {String(it.reason)}</span>}
            {Boolean(it.phone) && <span> · {String(it.phone)}</span>}
          </li>
        ))}
        {items.length === 0 && <li className="text-gray-500">Phân đoạn này hiện không có khách nào.</li>}
      </ul>
    </div>
  );
}
