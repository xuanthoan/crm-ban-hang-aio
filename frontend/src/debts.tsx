import { useCallback, useEffect, useState } from "react";
import { PAYMENT_RECORD_LABELS, PAYMENT_STATUS_LABELS, isoToVnDate, labelFor } from "./labels";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface DebtOrder {
  id: string;
  orderCode: string;
  customerId: string;
  customerName: string | null;
  status: string;
  paymentStatus: string;
  grandTotal: number;
  paidTotal: number;
  debtTotal: number;
  fullyReturned: boolean;
  createdAt: string;
}

interface Payment {
  id: string;
  amount: number;
  paymentMethodLabel: string;
  paidAt: string;
  note: string | null;
  status: string;
  cancelReason: string | null;
  cancelledByName: string | null;
  createdAt: string;
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
    throw new Error((data as { message?: string }).message || `Lỗi ${res.status}`);
  }
  return data as Record<string, unknown>;
}

export default function DebtsPage({ token, permissions }: { token: string; permissions: string[] }) {
  const [debts, setDebts] = useState<DebtOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [totalDebt, setTotalDebt] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortDebt, setSortDebt] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [detailPayments, setDetailPayments] = useState<Payment[]>([]);
  const [error, setError] = useState("");

  const canViewPayments =
    permissions.includes("payment.view_all") || permissions.includes("payment.view_own");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (q.trim()) params.set("q", q.trim());
      if (statusFilter) params.set("paymentStatus", statusFilter);
      if (sortDebt) params.set("sort", "debt");
      const data = await api(`/api/debts?${params.toString()}`, token);
      setDebts((data.data as DebtOrder[]) ?? []);
      setTotal(((data.pagination as { total?: number })?.total ?? 0));
      setTotalDebt(((data.summary as { totalDebt?: number })?.totalDebt ?? 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tải danh sách công nợ thất bại.");
    }
  }, [token, page, q, statusFilter, sortDebt]);

  useEffect(() => {
    load();
  }, [load]);

  const openPayments = async (orderId: string) => {
    if (!canViewPayments) return;
    try {
      const data = await api(`/api/orders/${orderId}/payments`, token);
      setDetailOrderId(orderId);
      setDetailPayments(((data.data as { payments: Payment[] }).payments ?? []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tải payment của đơn thất bại.");
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Công nợ</h2>
      <p className="text-sm text-gray-600">
        Danh sách mặc định chỉ gồm đơn đã xác nhận hoặc đã hoàn thành còn nợ (debt &gt; 0). Đơn nháp và đơn đã hủy không tính là còn nợ.
        Số liệu lấy trực tiếp từ debt_total của từng đơn — tổng nợ theo khách ở hồ sơ khách phải khớp với tổng ở đây.
      </p>
      <p className="text-sm font-semibold">Tổng nợ đang hiển thị (theo bộ lọc): {totalDebt.toLocaleString("vi-VN")} · {total} đơn</p>
      <div className="flex flex-wrap gap-2">
        <input
          className="rounded border p-2"
          placeholder="Tìm mã đơn / tên khách"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
        />
        <select className="rounded border p-2" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">Tất cả trạng thái thanh toán</option>
          <option value="unpaid">Chưa thanh toán</option>
          <option value="partial">Thanh toán một phần</option>
          <option value="paid">Đã thanh toán</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sortDebt} onChange={(e) => setSortDebt(e.target.checked)} /> Nợ lớn lên trước
        </label>
      </div>
      {error && <p className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-2">Mã đơn</th>
            <th className="p-2">Khách hàng</th>
            <th className="p-2">Tổng đơn</th>
            <th className="p-2">Đã thu</th>
            <th className="p-2">Còn nợ</th>
            <th className="p-2">Thanh toán</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {debts.map((d) => (
            <tr key={d.id} className="border-b">
              <td className="p-2">{d.orderCode}</td>
              <td className="p-2">{d.customerName ?? ""}</td>
              <td className="p-2">{d.grandTotal.toLocaleString("vi-VN")}</td>
              <td className="p-2">{d.paidTotal.toLocaleString("vi-VN")}</td>
              <td className="p-2">{d.debtTotal.toLocaleString("vi-VN")}</td>
              <td className="p-2">{labelFor(PAYMENT_STATUS_LABELS, d.paymentStatus)}</td>
              <td className="p-2">
                {canViewPayments && (
                  <button onClick={() => openPayments(d.id)} className="rounded border px-2 py-1">Xem payment</button>
                )}
              </td>
            </tr>
          ))}
          {debts.length === 0 && (
            <tr>
              <td className="p-2 text-gray-500" colSpan={7}>Không có đơn nào còn nợ theo bộ lọc hiện tại.</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-50">Trang trước</button>
        <span className="py-1 text-sm">Trang {page} / {Math.max(1, Math.ceil(total / 20))} ({total} đơn)</span>
        <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-50">Trang sau</button>
      </div>
      {detailOrderId && (
        <div className="rounded border p-4">
          <h3 className="font-semibold">Payment của đơn đã chọn</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {detailPayments.map((p) => (
              <li key={p.id} className="border-b pb-2">
                <strong>{p.amount.toLocaleString("vi-VN")}</strong> · {p.paymentMethodLabel} · {isoToVnDate(p.paidAt)} · {labelFor(PAYMENT_RECORD_LABELS, p.status)}
                {p.note && ` · ${p.note}`}
                {p.status === "cancelled" && ` · Lý do hủy: ${p.cancelReason ?? ""}`}
              </li>
            ))}
            {detailPayments.length === 0 && <li className="text-gray-500">Đơn này chưa có payment nào.</li>}
          </ul>
        </div>
      )}
    </section>
  );
}
