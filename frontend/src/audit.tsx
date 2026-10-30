import { useCallback, useEffect, useState } from "react";
import { AUDIT_ACTION_LABELS, ENTITY_TYPE_LABELS, labelFor } from "./labels";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface AuditRow {
  id: string;
  actorId: string | null;
  actorUsername: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: string;
}

async function api(path: string, token: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || `Lỗi ${res.status}`);
  }
  return data as Record<string, unknown>;
}

// Second line of defence in the UI: if a sensitive key ever slipped
// into an old/new value, render it as *** instead of the real value.
// The backend already strips these at write time and at read time.
const SENSITIVE_PARTS = ["password", "token", "secret", "codehash", "otpcode", "otp_code", "authorization"];
function redactForDisplay(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactForDisplay);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      out[k] =
        lower === "otp" || SENSITIVE_PARTS.some((p) => lower.includes(p))
          ? "***"
          : redactForDisplay(v);
    }
    return out;
  }
  return value;
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) return "—";
  try {
    return JSON.stringify(redactForDisplay(value), null, 2);
  } catch {
    return String(value);
  }
}

function RowDetail({ row }: { row: AuditRow }) {
  return (
    <div className="mt-2 space-y-2 rounded border bg-gray-50 p-3 text-sm">
      <p>
        <strong>Người thực hiện:</strong> {row.actorName ?? row.actorUsername ?? row.actorId ?? "(hệ thống)"}
        {row.ipAddress ? ` · IP: ${row.ipAddress}` : ""}
      </p>
      <p>
        <strong>Hành động:</strong> {labelFor(AUDIT_ACTION_LABELS, row.action)} · <strong>Thực thể:</strong> {labelFor(ENTITY_TYPE_LABELS, row.entityType)} / {row.entityId}
      </p>
      <div>
        <p className="font-semibold">Giá trị cũ</p>
        <pre className="overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-xs">{formatJson(row.oldValue)}</pre>
      </div>
      <div>
        <p className="font-semibold">Giá trị mới</p>
        <pre className="overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-xs">{formatJson(row.newValue)}</pre>
      </div>
      <p className="text-xs text-gray-500">
        Các trường nhạy cảm (mật khẩu, token, mã OTP) nếu lỡ có sẽ hiển thị thành ***. Audit log không thể sửa hay xóa qua giao diện.
      </p>
    </div>
  );
}

/** Timeline of one entity, e.g. a customer. Reused in the customer detail view. */
export function EntityAuditTimeline({ token, entityType, entityId }: { token: string; entityType: string; entityId: string }) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api(
        `/api/audit-logs/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}?pageSize=20`,
        token,
      );
      setRows((data.data as AuditRow[]) ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tải lịch sử audit thất bại.");
    }
  }, [token, entityType, entityId]);

  return (
    <div className="mt-4 rounded border p-3">
      <button type="button" onClick={() => { setOpen(!open); if (!open) void load(); }} className="rounded border px-3 py-1">
        {open ? "Ẩn lịch sử audit" : "Xem lịch sử audit của hồ sơ này"}
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {error && <p className="text-sm text-red-700">{error}</p>}
          {rows.length === 0 && !error && <p className="text-sm text-gray-500">Chưa có dòng audit nào cho thực thể này (hoặc bạn chỉ xem được audit do chính mình thực hiện).</p>}
          {rows.map((r) => (
            <div key={r.id} className="rounded border p-2 text-sm">
              <button type="button" onClick={() => setSelectedId(selectedId === r.id ? null : r.id)} className="font-semibold text-left">
                {new Date(r.createdAt).toLocaleString("vi-VN")} — {labelFor(AUDIT_ACTION_LABELS, r.action)} — {r.actorName ?? r.actorUsername ?? "(hệ thống)"}
              </button>
              {selectedId === r.id && <RowDetail row={r} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AuditPage({ token }: { token: string }) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actorId, setActorId] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (actorId.trim()) params.set("actorId", actorId.trim());
      if (action.trim()) params.set("action", action.trim());
      if (entityType.trim()) params.set("entityType", entityType.trim());
      if (entityId.trim()) params.set("entityId", entityId.trim());
      if (q.trim()) params.set("q", q.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const data = await api(`/api/audit-logs?${params.toString()}`, token);
      setRows((data.data as AuditRow[]) ?? []);
      setTotal(((data.pagination as { total?: number })?.total ?? 0));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tải nhật ký audit thất bại.");
    }
  }, [token, page, actorId, action, entityType, entityId, q, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Nhật ký Audit (chỉ đọc)</h2>
      <p className="text-sm text-gray-600">
        Audit log không thể sửa hay xóa qua giao diện. Người có quyền xem toàn bộ thấy tất cả; người chỉ có quyền xem của mình chỉ thấy audit do chính mình thực hiện.
      </p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <label className="block text-sm">
          Người thực hiện (actorId)
          <input className="mt-1 w-full rounded border p-2" value={actorId} onChange={(e) => { setActorId(e.target.value); setPage(1); }} />
        </label>
        <label className="block text-sm">
          Hành động
          <input className="mt-1 w-full rounded border p-2" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} placeholder="vd: order.cancel" />
        </label>
        <label className="block text-sm">
          Loại thực thể
          <input className="mt-1 w-full rounded border p-2" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} placeholder="vd: order" />
        </label>
        <label className="block text-sm">
          Mã thực thể
          <input className="mt-1 w-full rounded border p-2" value={entityId} onChange={(e) => { setEntityId(e.target.value); setPage(1); }} />
        </label>
        <label className="block text-sm">
          Tìm kiếm
          <input className="mt-1 w-full rounded border p-2" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </label>
        <label className="block text-sm">
          Từ ngày
          <input type="date" className="mt-1 w-full rounded border p-2" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </label>
        <label className="block text-sm">
          Đến ngày
          <input type="date" className="mt-1 w-full rounded border p-2" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </label>
      </div>
      {error && <p className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
      <p className="text-sm text-gray-500">Tổng: {total} dòng · Trang {page}</p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded border p-3 text-sm">
            <button type="button" onClick={() => setSelectedId(selectedId === r.id ? null : r.id)} className="text-left">
              <strong>{new Date(r.createdAt).toLocaleString("vi-VN")}</strong> — {labelFor(AUDIT_ACTION_LABELS, r.action)} — {labelFor(ENTITY_TYPE_LABELS, r.entityType)}/{r.entityId} —{" "}
              {r.actorName ?? r.actorUsername ?? "(hệ thống)"}
            </button>
            {selectedId === r.id && <RowDetail row={r} />}
          </li>
        ))}
        {rows.length === 0 && !error && <li className="text-gray-500">Chưa có dòng audit nào khớp bộ lọc.</li>}
      </ul>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-50">Trang trước</button>
        <button disabled={rows.length < 20} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-50">Trang sau</button>
      </div>
    </div>
  );
}
