import { useCallback, useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

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

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Math.round(n).toLocaleString("vi-VN");
}

function periodQuery(preset: string, from: string, to: string): string {
  if (preset === "custom") return `from=${from}&to=${to}`;
  return `preset=${preset}`;
}

function usePeriod() {
  const [preset, setPreset] = useState("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  return { preset, setPreset, from, setFrom, to, setTo };
}

function PeriodPicker(p: {
  preset: string; setPreset: (v: string) => void;
  from: string; setFrom: (v: string) => void;
  to: string; setTo: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2">
        Khoảng thời gian
        <select className="rounded border p-2" value={p.preset} onChange={(e) => p.setPreset(e.target.value)}>
          <option value="today">Hôm nay</option>
          <option value="7d">7 ngày qua</option>
          <option value="30d">30 ngày qua</option>
          <option value="all">Tất cả</option>
          <option value="custom">Tùy chọn</option>
        </select>
      </label>
      {p.preset === "custom" && (
        <>
          <label className="flex items-center gap-2">Từ <input type="date" className="rounded border p-2" value={p.from} onChange={(e) => p.setFrom(e.target.value)} /></label>
          <label className="flex items-center gap-2">Đến <input type="date" className="rounded border p-2" value={p.to} onChange={(e) => p.setTo(e.target.value)} /></label>
        </>
      )}
    </div>
  );
}

export function DashboardPage({ token }: { token: string }) {
  const { preset, setPreset, from, setFrom, to, setTo } = usePeriod();
  const [summary, setSummary] = useState<any>(null);
  const [days, setDays] = useState<any[]>([]);
  const [topSkus, setTopSkus] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const q = periodQuery(preset, from, to);
      const s = await api(`/api/dashboard/summary?${q}`, token);
      setSummary((s as any).data);
      if (preset !== "all") {
        const d = await api(`/api/dashboard/revenue-by-day?${q}`, token);
        setDays(((d as any).data?.days ?? []) as any[]);
      } else {
        setDays([]);
      }
      const skus = await api(`/api/reports/top-skus?${q}&limit=5`, token);
      setTopSkus(((skus as any).data?.items ?? []) as any[]);
      const cust = await api(`/api/reports/top-customers?${q}&limit=5`, token);
      setTopCustomers(((cust as any).data?.items ?? []) as any[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được dashboard.");
    }
  }, [token, preset, from, to]);

  useEffect(() => { load(); }, [load]);

  const maxDay = Math.max(0, ...days.map((d) => d.salesTotal));
  const sales = summary?.sales;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Dashboard tổng quan</h2>
      <PeriodPicker preset={preset} setPreset={setPreset} from={from} setFrom={setFrom} to={to} setTo={setTo} />
      <button onClick={load} className="rounded bg-blue-600 px-4 py-2 text-white">Xem</button>
      {error && <p className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
      {summary && (
        <>
          <p className="text-sm text-gray-500">
            Phạm vi: {summary.scope} — {summary.scopeNote}
            {summary.omittedNote ? ` ${summary.omittedNote}` : ""}
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {sales && (
              <>
                <div className="rounded border p-3"><p className="text-sm text-gray-500">Doanh thu (đơn đã xác nhận/hoàn thành)</p><p className="text-xl font-bold">{fmt(sales.salesTotal)}</p></div>
                <div className="rounded border p-3"><p className="text-sm text-gray-500">Tiền đã thu (theo đơn trong khoảng)</p><p className="text-xl font-bold">{fmt(sales.paidTotal)}</p></div>
                <div className="rounded border p-3"><p className="text-sm text-gray-500">Công nợ trong khoảng</p><p className="text-xl font-bold">{fmt(sales.debtTotal)}</p></div>
                <div className="rounded border p-3"><p className="text-sm text-gray-500">Giá trị đơn trung bình</p><p className="text-xl font-bold">{fmt(sales.averageOrderValue)}</p></div>
              </>
            )}
            <div className="rounded border p-3"><p className="text-sm text-gray-500">Số đơn (đã xác nhận/hoàn thành)</p><p className="text-xl font-bold">{summary.orders?.count ?? 0}</p><p className="text-sm text-gray-500">Nháp: {summary.orders?.draftCount ?? 0} · Đã hủy: {summary.orders?.cancelledCount ?? 0}</p></div>
            <div className="rounded border p-3"><p className="text-sm text-gray-500">Công nợ còn lại (toàn thời gian, trong phạm vi)</p><p className="text-xl font-bold">{fmt(summary.debt?.debtInScopeOwing)}</p><p className="text-sm text-gray-500">Tiền thừa cần hoàn: {fmt(summary.debt?.debtInScopeCredit)} · Số đơn còn nợ: {summary.debt?.debtOrderCount ?? 0}</p></div>
            <div className="rounded border p-3"><p className="text-sm text-gray-500">Khách hàng</p><p className="text-xl font-bold">Tổng {summary.customers?.total ?? 0} · Mới trong khoảng {summary.customers?.newInPeriod ?? 0}</p></div>
            <div className="rounded border p-3"><p className="text-sm text-gray-500">Tồn kho</p><p className="text-xl font-bold">Tổng tồn {summary.inventory?.totalQuantity ?? 0} · Tồn thấp {summary.inventory?.lowStockCount ?? 0} · Hết hàng {summary.inventory?.outOfStockCount ?? 0}</p>{summary.inventory?.inventoryValueEstimate !== undefined && summary.inventory?.inventoryValueEstimate !== null && (<p className="text-sm text-gray-500">Giá trị tồn ước tính: {fmt(summary.inventory.inventoryValueEstimate)}</p>)}</div>
            <div className="rounded border p-3"><p className="text-sm text-gray-500">Nhắc việc</p><p className="text-xl font-bold">Quá hạn {summary.reminders?.overdueCount ?? 0} · Hôm nay {summary.reminders?.dueTodayCount ?? 0}</p></div>
          </div>

          {days.length > 0 && (
            <div className="rounded border p-4">
              <h3 className="font-semibold">Doanh thu theo ngày (theo ngày tạo đơn, ngày UTC)</h3>
              <div className="mt-3 space-y-2">
                {days.map((d) => (
                  <div key={d.date} className="flex items-center gap-2 text-sm">
                    <span className="w-24 shrink-0">{d.date}</span>
                    <div className="h-4 rounded bg-blue-500" style={{ width: `${maxDay > 0 ? Math.max(2, (d.salesTotal / maxDay) * 100) : 0}%` }} />
                    <span>{fmt(d.salesTotal)} · {d.ordersCount} đơn</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded border p-4">
              <h3 className="font-semibold">Top SKU bán chạy</h3>
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {topSkus.map((s) => (
                    <tr key={s.productVariantId} className="border-t">
                      <td className="py-1 pr-2">{s.sku} — {s.productName} {s.variantName}</td>
                      <td className="py-1 text-right">{s.quantitySold} · {fmt(s.revenue)}</td>
                    </tr>
                  ))}
                  {topSkus.length === 0 && <tr><td className="py-1 text-gray-500">Chưa có dữ liệu bán trong khoảng.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="rounded border p-4">
              <h3 className="font-semibold">Top khách hàng</h3>
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {topCustomers.map((c) => (
                    <tr key={c.customerId} className="border-t">
                      <td className="py-1 pr-2">{c.customerName ?? c.customerId}</td>
                      <td className="py-1 text-right">{c.ordersCount} đơn · {fmt(c.grandTotal)}{c.currentDebt ? ` · Nợ ${fmt(c.currentDebt)}` : ""}</td>
                    </tr>
                  ))}
                  {topCustomers.length === 0 && <tr><td className="py-1 text-gray-500">Chưa có dữ liệu bán trong khoảng.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export function ReportsPage({ token }: { token: string }) {
  const { preset, setPreset, from, setFrom, to, setTo } = usePeriod();
  const [topSkus, setTopSkus] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [debt, setDebt] = useState<any>(null);
  const [inventory, setInventory] = useState<any>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const q = periodQuery(preset, from, to);
      const [skus, cust, meth, deb, inv] = await Promise.all([
        api(`/api/reports/top-skus?${q}&limit=10`, token),
        api(`/api/reports/top-customers?${q}&limit=10`, token),
        api(`/api/dashboard/revenue-by-payment-method?${q}`, token),
        api(`/api/reports/debt?${q}&limit=10`, token),
        api(`/api/reports/inventory?lowStockThreshold=5&pageSize=20`, token),
      ]);
      setTopSkus(((skus as any).data?.items ?? []) as any[]);
      setTopCustomers(((cust as any).data?.items ?? []) as any[]);
      setMethods(((meth as any).data?.methods ?? []) as any[]);
      setDebt((deb as any).data);
      setInventory((inv as any).data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được báo cáo.");
    }
  }, [token, preset, from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Báo cáo</h2>
      <PeriodPicker preset={preset} setPreset={setPreset} from={from} setFrom={setFrom} to={to} setTo={setTo} />
      <button onClick={load} className="rounded bg-blue-600 px-4 py-2 text-white">Xem</button>
      {error && <p className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}

      <div className="rounded border p-4">
        <h3 className="font-semibold">Tiền thu theo phương thức (payment active, theo ngày tạo payment)</h3>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {methods.map((m) => (
              <tr key={m.paymentMethod} className="border-t">
                <td className="py-1 pr-2">{m.paymentMethodLabel}</td>
                <td className="py-1 text-right">{m.paymentCount} payment · {fmt(m.totalAmount)}</td>
              </tr>
            ))}
            {methods.length === 0 && <tr><td className="py-1 text-gray-500">Chưa có payment trong khoảng.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded border p-4">
          <h3 className="font-semibold">Top SKU</h3>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {topSkus.map((s) => (
                <tr key={s.productVariantId} className="border-t">
                  <td className="py-1 pr-2">{s.sku} — {s.productName} {s.variantName}</td>
                  <td className="py-1 text-right">{s.quantitySold} · {fmt(s.revenue)}{s.grossProfitEstimate !== null && s.grossProfitEstimate !== undefined ? ` · Lãi ước tính ${fmt(s.grossProfitEstimate)}` : ""}</td>
                </tr>
              ))}
              {topSkus.length === 0 && <tr><td className="py-1 text-gray-500">Chưa có dữ liệu.</td></tr>}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-gray-500">Lãi gộp là ước tính theo giá nhập hiện tại, không phải lãi chính xác theo lô.</p>
        </div>
        <div className="rounded border p-4">
          <h3 className="font-semibold">Top khách hàng</h3>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {topCustomers.map((c) => (
                <tr key={c.customerId} className="border-t">
                  <td className="py-1 pr-2">{c.customerName ?? c.customerId}</td>
                  <td className="py-1 text-right">{c.ordersCount} đơn · {fmt(c.grandTotal)} · Đã thu {fmt(c.paidTotal)} · Nợ {fmt(c.currentDebt)}</td>
                </tr>
              ))}
              {topCustomers.length === 0 && <tr><td className="py-1 text-gray-500">Chưa có dữ liệu.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {debt && (
        <div className="rounded border p-4">
          <h3 className="font-semibold">Báo cáo công nợ</h3>
          <p className="text-sm">Trong khoảng: nợ {fmt(debt.inPeriod?.totalDebtOwing)} · {debt.inPeriod?.debtOrderCount ?? 0} đơn còn nợ · {debt.inPeriod?.debtCustomerCount ?? 0} khách còn nợ · Tiền thừa {fmt(debt.inPeriod?.totalCredit)}</p>
          {debt.totalDebtAllTime !== undefined && <p className="text-sm">Tổng nợ toàn thời gian: {fmt(debt.totalDebtAllTime)}</p>}
          <table className="mt-2 w-full text-sm">
            <tbody>
              {(debt.topDebtCustomers ?? []).map((c: any) => (
                <tr key={c.customerId} className="border-t">
                  <td className="py-1 pr-2">{c.customerName ?? c.customerId}</td>
                  <td className="py-1 text-right">{c.orderCount} đơn · {fmt(c.debtTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inventory && (
        <div className="rounded border p-4">
          <h3 className="font-semibold">Báo cáo tồn kho</h3>
          <p className="text-sm">Tổng SKU {inventory.summary?.totalSkuCount ?? 0} · Tổng tồn {inventory.summary?.totalQuantity ?? 0} · Tồn thấp {inventory.summary?.lowStockCount ?? 0} · Hết hàng {inventory.summary?.outOfStockCount ?? 0}{inventory.summary?.inventoryValueEstimate !== null && inventory.summary?.inventoryValueEstimate !== undefined ? ` · Giá trị tồn ước tính ${fmt(inventory.summary.inventoryValueEstimate)}` : ""}</p>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {(inventory.lowStock ?? []).map((r: any) => (
                <tr key={r.productVariantId} className="border-t">
                  <td className="py-1 pr-2">{r.sku} — {r.productName} {r.variantName}</td>
                  <td className="py-1 text-right">Tồn {r.quantity} · Khả dụng {r.availableQuantity}</td>
                </tr>
              ))}
              {(inventory.lowStock ?? []).length === 0 && <tr><td className="py-1 text-gray-500">Không có SKU tồn thấp.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
