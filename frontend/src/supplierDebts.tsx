import { useCallback, useEffect, useState } from "react";
import { PAYMENT_STATUS_LABELS, isoToVnDate, labelFor } from "./labels";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

/**
 * Trang Công nợ NCC — Sprint NCC-3.
 * Mirror trang Công nợ khách hàng (debts.tsx): chỉ liệt kê đơn nhập
 * đã xác nhận hoặc đã hoàn thành còn nợ (debt > 0). Đơn nháp và đơn
 * đã hủy không tính là còn nợ. Kèm tổng nợ theo từng nhà cung cấp.
 */

interface SupplierDebtRow {
  id: string;
  code: string;
  supplierId: string;
  supplierName: string | null;
  status: string;
  paymentStatus: string;
  grandTotal: number;
  paidTotal: number;
  debtTotal: number;
  fullyReturned: boolean;
  createdAt: string;
}

interface PerSupplierTotal {
  supplierId: string;
  supplierName: string | null;
  totalDebt: number;
  poCount: number;
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

export default function SupplierDebtsPage({ token }: { token: string }) {
  const [debts, setDebts] = useState<SupplierDebtRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalDebt, setTotalDebt] = useState(0);
  const [perSupplier, setPerSupplier] = useState<PerSupplierTotal[]>([]);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortDebt, setSortDebt] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (q.trim()) params.set("q", q.trim());
      if (statusFilter) params.set("paymentStatus", statusFilter);
      if (sortDebt) params.set("sort", "debt");
      const data = await api(`/api/supplier-debts?${params.toString()}`, token);
      setDebts((data.data as SupplierDebtRow[]) ?? []);
      setTotal(((data.pagination as { total?: number })?.total ?? 0));
      setTotalDebt(((data.summary as { totalDebt?: number })?.totalDebt ?? 0));
      setPerSupplier((data.perSupplier as PerSupplierTotal[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tải danh sách công nợ NCC thất bại.");
    }
  }, [token, page, q, statusFilter, sortDebt]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Công nợ nhà cung cấp</h2>
      <p className="text-sm text-gray-600">
        Danh sách mặc định chỉ gồm đơn nhập đã xác nhận hoặc đã hoàn thành còn nợ (debt &gt; 0). Đơn nháp và đơn đã hủy không tính là còn nợ.
        Số liệu lấy trực tiếp từ debt_total của từng đơn — tổng nợ theo nhà cung cấp dưới đây phải khớp với tổng ở chi tiết từng đơn nhập.
      </p>
      <p className="text-sm font-semibold">Tổng nợ đang hiển thị (theo bộ lọc): {totalDebt.toLocaleString("vi-VN")} · {total} đơn</p>
      <div className="flex flex-wrap gap-2">
        <input
          className="rounded border p-2"
          placeholder="Tìm mã đơn / tên nhà cung cấp"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
        />
        <select className="rounded border p-2" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">Tất cả trạng thái thanh toán</option>
          <option value="unpaid">Chưa thanh toán</option>
          <option value="partial">Thanh toán một phần</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sortDebt} onChange={(e) => setSortDebt(e.target.checked)} /> Nợ lớn lên trước
        </label>
      </div>
      {error && <p className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}

      <div className="rounded border p-3">
        <h3 className="mb-2 font-semibold">Tổng nợ theo nhà cung cấp</h3>
        {perSupplier.length === 0 ? (
          <p className="text-sm text-gray-500">Không có nhà cung cấp nào còn nợ theo bộ lọc hiện tại.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-1 text-left">Nhà cung cấp</th>
                <th className="px-2 py-1 text-left">Số đơn còn nợ</th>
                <th className="px-2 py-1 text-left">Tổng nợ</th>
              </tr>
            </thead>
            <tbody>
              {perSupplier.map((s) => (
                <tr key={s.supplierId} className="border-b">
                  <td className="px-2 py-1">{s.supplierName ?? "—"}</td>
                  <td className="px-2 py-1">{s.poCount}</td>
                  <td className="px-2 py-1">{s.totalDebt.toLocaleString("vi-VN")}đ</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-2 py-1 text-left">Mã đơn</th>
            <th className="px-2 py-1 text-left">Nhà cung cấp</th>
            <th className="px-2 py-1 text-left">Trạng thái đơn</th>
            <th className="px-2 py-1 text-left">Tổng tiền</th>
            <th className="px-2 py-1 text-left">Đã trả</th>
            <th className="px-2 py-1 text-left">Còn nợ</th>
            <th className="px-2 py-1 text-left">Thanh toán</th>
            <th className="px-2 py-1 text-left">Ngày tạo</th>
          </tr>
        </thead>
        <tbody>
          {debts.map((d) => (
            <tr key={d.id} className="border-b">
              <td className="px-2 py-1">{d.code}</td>
              <td className="px-2 py-1">{d.supplierName ?? "—"}</td>
              <td className="px-2 py-1">{d.status === "confirmed" ? "Đã nhận hàng" : d.status === "completed" ? "Hoàn thành" : d.status}</td>
              <td className="px-2 py-1">{d.grandTotal.toLocaleString("vi-VN")}đ</td>
              <td className="px-2 py-1">{d.paidTotal.toLocaleString("vi-VN")}đ</td>
              <td className="px-2 py-1">{d.debtTotal.toLocaleString("vi-VN")}đ</td>
              <td className="px-2 py-1">{labelFor(PAYMENT_STATUS_LABELS, d.paymentStatus)}</td>
              <td className="px-2 py-1">{isoToVnDate(d.createdAt)}</td>
            </tr>
          ))}
          {debts.length === 0 && (
            <tr>
              <td colSpan={8} className="px-2 py-4 text-center text-gray-500">Không có đơn nhập nào còn nợ theo bộ lọc hiện tại.</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="flex items-center gap-2 text-sm">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-50">Trước</button>
        <span>Trang {page} / {Math.max(1, Math.ceil(total / 20))} (tổng {total})</span>
        <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-50">Sau</button>
      </div>
    </section>
  );
}
