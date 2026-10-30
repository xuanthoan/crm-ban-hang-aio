import { useCallback, useEffect, useState } from "react";
import { ORDER_STATUS_LABELS, PAYMENT_RECORD_LABELS, PAYMENT_STATUS_LABELS, isoToVnDate, labelFor } from "./labels";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface OrderItem {
  id: string;
  productVariantId: string;
  sku: string;
  skuSnapshot: string;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  unitPrice: number;
  discountAmount: number;
  quantity: number;
  returnedQuantity: number;
  remainingQuantity: number;
  lineTotal: number;
}

interface Order {
  id: string;
  orderCode: string;
  customerId: string;
  customerName: string | null;
  status: string;
  paymentStatus: string;
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  grandTotal: number;
  paidTotal: number;
  debtTotal: number;
  inventoryDeducted: boolean;
  inventoryRestored: boolean;
  fullyReturned: boolean;
  createdById: string | null;
  note: string | null;
  createdAt: string;
  items?: OrderItem[];
  itemsCount?: number;
}

interface Payment {
  id: string;
  orderId: string;
  amount: number;
  paymentMethod: string;
  paymentMethodLabel: string;
  paidAt: string;
  note: string | null;
  status: string;
  cancelReason: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
  createdByName: string | null;
  createdAt: string;
}

interface CustomerOption {
  id: string;
  fullName: string;
}

interface VariantOption {
  id: string;
  sku: string;
  variantName: string;
  productName: string;
  sellingPrice: number;
  status: string;
  isSellable?: boolean;
}

interface FormLine {
  productVariantId: string;
  sku: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
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

export default function OrdersPage({ token, permissions }: { token: string; permissions: string[] }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [detail, setDetail] = useState<Order | null>(null);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [discountTotal, setDiscountTotal] = useState("");
  const [shippingFee, setShippingFee] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<FormLine[]>([{ productVariantId: "", sku: "", quantity: "1", unitPrice: "", discountAmount: "" }]);
  const [variantQuery, setVariantQuery] = useState("");
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([]);

  const [returnQty, setReturnQty] = useState<Record<string, string>>({});
  const [returnReason, setReturnReason] = useState("");
  const [busy, setBusy] = useState(false);

  // Sprint Thanh toán: payments are always re-read from the backend;
  // the frontend never computes paid/debt totals itself for display
  // after a payment change — it refreshes the order detail instead.
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNote, setPayNote] = useState("");
  const [cancelReasons, setCancelReasons] = useState<Record<string, string>>({});
  const [payBusy, setPayBusy] = useState(false);

  const canCreate = permissions.includes("order.create");
  const canUpdateDraft = permissions.includes("order.update_draft");
  const canConfirm = permissions.includes("order.confirm");
  const canComplete = permissions.includes("order.complete");
  const canCancel = permissions.includes("order.cancel");
  const canReturn = permissions.includes("order.return");
  const canViewPayments =
    permissions.includes("payment.view_all") || permissions.includes("payment.view_own");
  const canCreatePayment = permissions.includes("payment.create");
  const canCancelPayment = permissions.includes("payment.cancel");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (q.trim()) params.set("q", q.trim());
      if (statusFilter) params.set("status", statusFilter);
      const data = await api(`/api/orders?${params.toString()}`, token);
      setOrders((data.data as Order[]) ?? []);
      setTotal((data.total as number) ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tải danh sách đơn thất bại.");
    }
  }, [token, page, q, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const loadPayments = useCallback(
    async (orderId: string) => {
      if (!canViewPayments) return;
      try {
        const data = await api(`/api/orders/${orderId}/payments`, token);
        const payload = data.data as { order: Order; payments: Payment[] };
        setPayments(payload.payments ?? []);
        // Totals come from the backend, never recomputed here.
        setDetail((prev) =>
          prev && prev.id === orderId
            ? { ...prev, grandTotal: payload.order.grandTotal, paidTotal: payload.order.paidTotal, debtTotal: payload.order.debtTotal, paymentStatus: payload.order.paymentStatus }
            : prev,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Tải danh sách payment thất bại.");
      }
    },
    [token, canViewPayments],
  );

  const openDetail = async (id: string) => {
    try {
      const data = await api(`/api/orders/${id}`, token);
      setDetail(data.data as Order);
      setPayments([]);
      setError("");
      await loadPayments(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tải chi tiết đơn thất bại.");
    }
  };

  const openCreate = async () => {
    try {
      const data = await api("/api/customers?pageSize=100", token);
      setCustomers(((data.data as CustomerOption[]) ?? []).map((c) => ({ id: c.id, fullName: c.fullName })));
      setEditingId(null);
      setCustomerId("");
      setDiscountTotal("");
      setShippingFee("");
      setNote("");
      setLines([{ productVariantId: "", sku: "", quantity: "1", unitPrice: "", discountAmount: "" }]);
      setShowForm(true);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tải danh sách khách thất bại.");
    }
  };

  const openEditDraft = (order: Order) => {
    setEditingId(order.id);
    setCustomerId(order.customerId);
    setDiscountTotal(String(order.discountTotal));
    setShippingFee(String(order.shippingFee));
    setNote(order.note ?? "");
    setLines(
      (order.items ?? []).map((i) => ({
        productVariantId: i.productVariantId,
        sku: i.sku,
        quantity: String(i.quantity),
        unitPrice: String(i.unitPrice),
        discountAmount: String(i.discountAmount),
      })),
    );
    setShowForm(true);
  };

  const searchVariants = async () => {
    try {
      const data = await api(`/api/variants?q=${encodeURIComponent(variantQuery)}&pageSize=20`, token);
      setVariantOptions((data.data as VariantOption[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tìm SKU thất bại.");
    }
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const items = lines
        .filter((l) => l.productVariantId)
        .map((l) => ({
          productVariantId: l.productVariantId,
          quantity: parseInt(l.quantity, 10),
          ...(l.unitPrice !== "" ? { unitPrice: parseFloat(l.unitPrice) } : {}),
          ...(l.discountAmount !== "" ? { discountAmount: parseFloat(l.discountAmount) } : {}),
        }));
      if (items.length === 0) throw new Error("Đơn hàng phải có ít nhất một dòng SKU.");
      if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity <= 0)) {
        throw new Error("Số lượng mỗi dòng phải là số nguyên lớn hơn 0.");
      }
      const body: Record<string, unknown> = {
        items,
        discountTotal: discountTotal === "" ? 0 : parseFloat(discountTotal),
        shippingFee: shippingFee === "" ? 0 : parseFloat(shippingFee),
        note: note.trim() || null,
      };
      let saved: Order;
      if (editingId) {
        const data = await api(`/api/orders/${editingId}`, token, "PATCH", body);
        saved = data.data as Order;
        setInfo(`Đã sửa đơn nháp ${saved.orderCode}. Đặt giữ tồn đã được tính lại theo dòng mới.`);
      } else {
        if (!customerId) throw new Error("Vui lòng chọn khách hàng.");
        const data = await api("/api/orders", token, "POST", { ...body, customerId });
        saved = data.data as Order;
        setInfo(`Đã tạo đơn nháp ${saved.orderCode}. Tồn khả dụng của các SKU đã giảm theo số lượng giữ.`);
      }
      setShowForm(false);
      setDetail(saved);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu đơn thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const doAction = async (action: "confirm" | "complete" | "cancel") => {
    if (!detail) return;
    setBusy(true);
    setError("");
    try {
      const data = await api(`/api/orders/${detail.id}/${action}`, token, "POST", {});
      const saved = data.data as Order;
      setDetail(saved);
      setInfo(
        action === "confirm"
          ? `Đã xác nhận đơn ${saved.orderCode}: đặt giữ đã chuyển thành trừ kho thật, cờ đã trừ kho đã bật.`
          : action === "complete"
            ? `Đã hoàn thành đơn ${saved.orderCode}. Tồn kho và tiền không thay đổi.`
            : `Đã hủy đơn ${saved.orderCode}. Đơn nháp được giải phóng đặt giữ, đơn đã xác nhận được hoàn kho phần chưa trả.`,
      );
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đổi trạng thái thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const doReturn = async () => {
    if (!detail) return;
    const items = Object.entries(returnQty)
      .filter(([, v]) => v !== "" && parseInt(v, 10) > 0)
      .map(([orderItemId, v]) => ({ orderItemId, quantity: parseInt(v, 10) }));
    if (items.length === 0) {
      setError("Vui lòng nhập số lượng trả cho ít nhất một dòng.");
      return;
    }
    if (!returnReason.trim()) {
      setError("Trả hàng bắt buộc phải có lý do.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await api(`/api/orders/${detail.id}/return`, token, "POST", { items, reason: returnReason.trim() });
      const saved = data.data as Order;
      setDetail(saved);
      setReturnQty({});
      setReturnReason("");
      setInfo(
        `Đã trả hàng cho đơn ${saved.orderCode}. Tồn đã hoàn lại, tổng tiền đã tính lại theo số lượng còn lại.${saved.fullyReturned ? " Mọi dòng đã trả hết — trạng thái đơn giữ nguyên, cờ fullyReturned đã bật." : ""}`,
      );
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trả hàng thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const createPayment = async () => {
    if (!detail) return;
    const amount = parseInt(payAmount, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      setError("Số tiền thanh toán phải là số nguyên (đồng) lớn hơn 0.");
      return;
    }
    if (detail.debtTotal <= 0) {
      setError(
        detail.debtTotal < 0
          ? "Đơn đang thừa tiền (tiền thừa cần hoàn), không tạo thêm payment. Hoàn tiền chưa làm ở sprint này."
          : "Đơn đã thanh toán đủ, không tạo thêm payment.",
      );
      return;
    }
    if (amount > detail.debtTotal) {
      setError(`Số tiền (${amount.toLocaleString("vi-VN")}) vượt số còn nợ (${detail.debtTotal.toLocaleString("vi-VN")}).`);
      return;
    }
    setPayBusy(true);
    setError("");
    try {
      const data = await api(`/api/orders/${detail.id}/payments`, token, "POST", {
        amount,
        paymentMethod: payMethod,
        note: payNote.trim() || undefined,
      });
      const saved = (data.data as { order: Order }).order;
      setDetail((prev) => (prev ? { ...prev, grandTotal: saved.grandTotal, paidTotal: saved.paidTotal, debtTotal: saved.debtTotal, paymentStatus: saved.paymentStatus } : prev));
      setPayAmount("");
      setPayNote("");
      setInfo(`Đã ghi nhận payment ${amount.toLocaleString("vi-VN")}. Số liệu đã được backend tính lại, không tự tính ở frontend.`);
      await loadPayments(detail.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ghi nhận payment thất bại.");
    } finally {
      setPayBusy(false);
    }
  };

  const cancelPayment = async (paymentId: string) => {
    if (!detail) return;
    const reason = (cancelReasons[paymentId] ?? "").trim();
    if (!reason) {
      setError("Hủy payment bắt buộc phải có lý do.");
      return;
    }
    setPayBusy(true);
    setError("");
    try {
      await api(`/api/payments/${paymentId}/cancel`, token, "POST", { reason });
      setCancelReasons((prev) => ({ ...prev, [paymentId]: "" }));
      setInfo("Đã hủy payment. Công nợ đã được backend tính lại ngay; payment đã hủy vẫn hiển thị trong danh sách.");
      await loadPayments(detail.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hủy payment thất bại.");
    } finally {
      setPayBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Đơn hàng</h2>
      <p className="text-sm text-gray-600">
        MVP chỉ có 4 trạng thái: nháp / đã xác nhận / hoàn thành / đã hủy. Đơn nháp giữ tồn (tồn khả dụng = tồn vật lý − tồn đang giữ);
        xác nhận mới trừ kho thật và chỉ trừ 1 lần. Trả hàng một phần hoàn kho và tính lại tổng tiền, trạng thái đơn giữ nguyên.
      </p>
      {error && <p className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
      {info && <p className="rounded border border-green-300 bg-green-50 p-3 text-green-800">{info}</p>}

      <div className="flex flex-wrap gap-2">
        <input className="rounded border p-2" placeholder="Tìm mã đơn / tên khách" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className="rounded border p-2" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">Tất cả trạng thái</option>
          <option value="draft">Nháp</option>
          <option value="confirmed">Đã xác nhận</option>
          <option value="completed">Hoàn thành</option>
          <option value="cancelled">Đã hủy</option>
        </select>
        {canCreate && (
          <button onClick={openCreate} className="rounded bg-blue-600 px-4 py-2 text-white">+ Tạo đơn nháp</button>
        )}
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-2">Mã đơn</th>
            <th className="p-2">Khách hàng</th>
            <th className="p-2">Trạng thái</th>
            <th className="p-2">Tổng tiền</th>
            <th className="p-2">Còn nợ</th>
            <th className="p-2">Dòng</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="cursor-pointer border-b hover:bg-gray-50" onClick={() => openDetail(o.id)}>
              <td className="p-2 font-medium">{o.orderCode}</td>
              <td className="p-2">{o.customerName ?? o.customerId}</td>
              <td className="p-2">{labelFor(ORDER_STATUS_LABELS, o.status)}</td>
              <td className="p-2">{o.grandTotal.toLocaleString("vi-VN")}</td>
              <td className="p-2">{o.debtTotal.toLocaleString("vi-VN")}</td>
              <td className="p-2">{o.itemsCount ?? o.items?.length ?? 0}</td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr><td className="p-2 text-gray-500" colSpan={6}>Chưa có đơn hàng nào.</td></tr>
          )}
        </tbody>
      </table>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-50">Trang trước</button>
        <span className="py-1 text-sm">Trang {page} / {Math.max(1, Math.ceil(total / 20))} ({total} đơn)</span>
        <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-50">Trang sau</button>
      </div>

      {detail && (
        <div className="rounded border p-4">
          <h3 className="text-base font-semibold">Đơn {detail.orderCode} — {labelFor(ORDER_STATUS_LABELS, detail.status)}</h3>
          <p className="text-sm text-gray-600">
            Khách: {detail.customerName} · Tổng: {detail.grandTotal.toLocaleString("vi-VN")} (hàng {detail.subtotal.toLocaleString("vi-VN")}
            {detail.discountTotal > 0 && ` − giảm ${detail.discountTotal.toLocaleString("vi-VN")}`}
            {detail.shippingFee > 0 && ` + ship ${detail.shippingFee.toLocaleString("vi-VN")}`}) · Đã thu: {detail.paidTotal.toLocaleString("vi-VN")} · Còn nợ: {detail.debtTotal.toLocaleString("vi-VN")}
            {detail.fullyReturned && " · Đã trả hết (trạng thái giữ nguyên)"}
          </p>
          <p className="text-sm text-gray-600">
            Đã trừ kho: {detail.inventoryDeducted ? "Có" : "Chưa"} · Đã hoàn kho: {detail.inventoryRestored ? "Có" : "Chưa"}
            {detail.note && ` · Ghi chú: ${detail.note}`}
          </p>
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">SKU</th>
                <th className="p-2">Sản phẩm / Biến thể (snapshot)</th>
                <th className="p-2">Đơn giá</th>
                <th className="p-2">SL</th>
                <th className="p-2">Đã trả</th>
                <th className="p-2">Còn trả được</th>
                <th className="p-2">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {(detail.items ?? []).map((i) => (
                <tr key={i.id} className="border-b">
                  <td className="p-2">{i.skuSnapshot}</td>
                  <td className="p-2">{i.productNameSnapshot} / {i.variantNameSnapshot}</td>
                  <td className="p-2">{i.unitPrice.toLocaleString("vi-VN")}</td>
                  <td className="p-2">{i.quantity}</td>
                  <td className="p-2">{i.returnedQuantity}</td>
                  <td className="p-2">{i.remainingQuantity}</td>
                  <td className="p-2">{i.lineTotal.toLocaleString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 flex flex-wrap gap-2">
            {detail.status === "draft" && canUpdateDraft && (
              <button onClick={() => openEditDraft(detail)} className="rounded border px-4 py-2">Sửa đơn nháp</button>
            )}
            {detail.status === "draft" && canConfirm && (
              <button disabled={busy} onClick={() => doAction("confirm")} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">Xác nhận (trừ kho)</button>
            )}
            {detail.status === "confirmed" && canComplete && (
              <button disabled={busy} onClick={() => doAction("complete")} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">Hoàn thành</button>
            )}
            {(detail.status === "draft" || detail.status === "confirmed") && canCancel && (
              <button disabled={busy} onClick={() => doAction("cancel")} className="rounded border border-red-300 px-4 py-2 text-red-700 disabled:opacity-50">Hủy đơn</button>
            )}
          </div>

          {(detail.status === "confirmed" || detail.status === "completed") && canReturn && (
            <div className="mt-4 rounded border p-3">
              <h4 className="font-semibold">Trả hàng một phần</h4>
              <p className="text-sm text-gray-600">Nhập số lượng trả cho từng dòng (không vượt số còn trả được) và lý do bắt buộc. Trả hết mọi dòng thì cờ fullyReturned bật nhưng trạng thái đơn giữ nguyên.</p>
              {(detail.items ?? []).map((i) => (
                <label key={i.id} className="mt-2 block text-sm">
                  {i.skuSnapshot} — còn trả được {i.remainingQuantity}
                  <input
                    type="number"
                    min={0}
                    max={i.remainingQuantity}
                    className="ml-2 rounded border p-1"
                    value={returnQty[i.id] ?? ""}
                    onChange={(e) => setReturnQty({ ...returnQty, [i.id]: e.target.value })}
                  />
                </label>
              ))}
              <label className="mt-2 block text-sm">
                Lý do trả hàng (bắt buộc)
                <input className="mt-1 w-full rounded border p-2" value={returnReason} onChange={(e) => setReturnReason(e.target.value)} />
              </label>
              <button disabled={busy} onClick={doReturn} className="mt-2 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">Xác nhận trả hàng</button>
            </div>
          )}

          {canViewPayments && (
            <div className="mt-4 rounded border p-3">
              <h4 className="font-semibold">Thanh toán</h4>
              <p className="text-sm text-gray-600">
                Đã thu: {detail.paidTotal.toLocaleString("vi-VN")} · Còn nợ: {detail.debtTotal.toLocaleString("vi-VN")} · Trạng thái: {labelFor(PAYMENT_STATUS_LABELS, detail.paymentStatus)}
                {detail.debtTotal < 0 && ` · Đơn đang thừa tiền ${Math.abs(detail.debtTotal).toLocaleString("vi-VN")} (tiền thừa cần hoàn — hoàn tiền chưa làm ở sprint này, không tạo thêm payment).`}
              </p>
              <ul className="mt-2 space-y-2 text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 border-b pb-2">
                    <span>
                      <strong>{p.amount.toLocaleString("vi-VN")}</strong> · {p.paymentMethodLabel} · {isoToVnDate(p.paidAt)} · {labelFor(PAYMENT_RECORD_LABELS, p.status)}
                      {p.note && ` · ${p.note}`}
                      {p.status === "cancelled" && ` · Lý do hủy: ${p.cancelReason ?? ""}${p.cancelledByName ? ` (bởi ${p.cancelledByName})` : ""}`}
                    </span>
                    {p.status === "active" && canCancelPayment && (
                      <span className="flex items-center gap-2">
                        <input
                          className="rounded border p-1"
                          placeholder="Lý do hủy (bắt buộc)"
                          value={cancelReasons[p.id] ?? ""}
                          onChange={(e) => setCancelReasons({ ...cancelReasons, [p.id]: e.target.value })}
                        />
                        <button disabled={payBusy} onClick={() => cancelPayment(p.id)} className="rounded border border-red-300 px-2 py-1 text-red-700 disabled:opacity-50">Hủy payment</button>
                      </span>
                    )}
                  </li>
                ))}
                {payments.length === 0 && <li className="text-gray-500">Chưa có payment nào cho đơn này.</li>}
              </ul>
              {(detail.status === "confirmed" || detail.status === "completed") && canCreatePayment && (
                <div className="mt-3 space-y-2">
                  <h5 className="font-semibold">Ghi nhận payment mới</h5>
                  <p className="text-sm text-gray-600">Chỉ thu cho đơn đã xác nhận hoặc đã hoàn thành. Số tiền không được vượt số còn nợ; backend kiểm tra lại trong cùng transaction.</p>
                  <label className="block text-sm">
                    Số tiền (đồng, số nguyên &gt; 0)
                    <input type="number" min={1} step={1} className="mt-1 w-full rounded border p-2" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                  </label>
                  <label className="block text-sm">
                    Phương thức
                    <select className="mt-1 w-full rounded border p-2" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                      <option value="cash">Tiền mặt</option>
                      <option value="bank_transfer">Chuyển khoản</option>
                      <option value="cod">COD</option>
                      <option value="e_wallet">Ví điện tử</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    Ghi chú
                    <input className="mt-1 w-full rounded border p-2" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
                  </label>
                  <button disabled={payBusy || detail.debtTotal <= 0} onClick={createPayment} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">Ghi nhận payment</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={submitForm} className="space-y-3 rounded border p-4">
          <h3 className="text-base font-semibold">{editingId ? "Sửa đơn nháp" : "Tạo đơn nháp mới"}</h3>
          <p className="text-sm text-gray-600">
            Đơn nháp giữ tồn: tạo/sửa đơn sẽ kiểm tra tồn khả dụng (tồn vật lý − tồn đang giữ) và chặn toàn bộ nếu thiếu.
            Đơn giá mặc định lấy giá bán hiện tại của SKU và lưu snapshot — đổi giá sau này không làm thay đổi đơn cũ.
          </p>
          {!editingId && (
            <label className="block">
              Khách hàng
              <select className="mt-1 w-full rounded border p-2" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                <option value="">— Chọn khách hàng —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.fullName}</option>
                ))}
              </select>
            </label>
          )}
          <div className="flex gap-2">
            <input className="flex-1 rounded border p-2" placeholder="Tìm SKU (mã / tên biến thể)" value={variantQuery} onChange={(e) => setVariantQuery(e.target.value)} />
            <button type="button" onClick={searchVariants} className="rounded border px-4 py-2">Tìm SKU</button>
          </div>
          {variantOptions.length > 0 && (
            <div className="rounded border p-2 text-sm">
              {variantOptions.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className="mr-2 mt-1 rounded border px-2 py-1"
                  onClick={() => {
                    setLines([...lines, { productVariantId: v.id, sku: v.sku, quantity: "1", unitPrice: String(v.sellingPrice), discountAmount: "" }]);
                    setVariantOptions([]);
                    setVariantQuery("");
                  }}
                >
                  + {v.sku} — {v.productName} / {v.variantName} ({v.sellingPrice.toLocaleString("vi-VN")})
                </button>
              ))}
            </div>
          )}
          {lines.map((l, idx) => (
            <div key={idx} className="flex flex-wrap items-end gap-2 rounded border p-2">
              <span className="text-sm font-medium">{l.sku || "Dòng mới"}</span>
              <label className="text-sm">SL
                <input type="number" min={1} step={1} className="ml-1 w-20 rounded border p-1" value={l.quantity} onChange={(e) => {
                  const next = [...lines]; next[idx].quantity = e.target.value; setLines(next);
                }} required />
              </label>
              <label className="text-sm">Đơn giá
                <input type="number" min={0} step={0.01} className="ml-1 w-28 rounded border p-1" value={l.unitPrice} onChange={(e) => {
                  const next = [...lines]; next[idx].unitPrice = e.target.value; setLines(next);
                }} />
              </label>
              <label className="text-sm">Giảm giá dòng
                <input type="number" min={0} step={0.01} className="ml-1 w-24 rounded border p-1" value={l.discountAmount} onChange={(e) => {
                  const next = [...lines]; next[idx].discountAmount = e.target.value; setLines(next);
                }} />
              </label>
              <button type="button" className="rounded border px-2 py-1 text-sm" onClick={() => setLines(lines.filter((_, i) => i !== idx))}>Xóa dòng</button>
            </div>
          ))}
          <button type="button" className="rounded border px-3 py-1" onClick={() => setLines([...lines, { productVariantId: "", sku: "", quantity: "1", unitPrice: "", discountAmount: "" }])}>+ Thêm dòng (chọn SKU ở ô tìm kiếm)</button>
          <div className="flex gap-2">
            <label className="text-sm">Chiết khấu đơn
              <input type="number" min={0} step={0.01} className="ml-1 w-28 rounded border p-1" value={discountTotal} onChange={(e) => setDiscountTotal(e.target.value)} />
            </label>
            <label className="text-sm">Phí ship
              <input type="number" min={0} step={0.01} className="ml-1 w-28 rounded border p-1" value={shippingFee} onChange={(e) => setShippingFee(e.target.value)} />
            </label>
          </div>
          <label className="block text-sm">Ghi chú
            <input className="mt-1 w-full rounded border p-2" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button disabled={busy} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{editingId ? "Lưu đơn nháp" : "Tạo đơn nháp (giữ tồn)"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded border px-4 py-2">Hủy</button>
          </div>
        </form>
      )}
    </section>
  );
}
