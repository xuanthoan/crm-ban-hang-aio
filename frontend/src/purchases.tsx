import { useCallback, useEffect, useRef, useState } from "react";
import { PAYMENT_RECORD_LABELS, PAYMENT_STATUS_LABELS, isoToVnDate, labelFor } from "./labels";
import { clearCustomValidity, invalidMessage } from "./validity";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

/** Tiền hiển thị theo kiểu Việt Nam: 1000000 -> "1.000.000" (đồng nguyên). */
function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return Math.trunc(value).toLocaleString("vi-VN");
}

/** Đọc số tiền người dùng gõ, chấp nhận "." "," khoảng trắng làm dấu phân cách nghìn. */
function parseMoney(text: string): number | null {
  const digits = text.replace(/\D/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Gõ tiền vào state chuỗi: hiển thị có dấu phân cách nghìn ngay khi gõ.
 * Ô số của trình duyệt không hiểu dấu phân cách (gõ "1,000" thành rỗng
 * rồi lưu thành 0), nên TẤT CẢ các ô tiền trên trang đơn nhập (đơn giá
 * nhập của từng dòng) đều dùng ô chữ + tự định dạng, giống trang Đơn hàng.
 */
function formatMoneyInput(text: string): string {
  const n = parseMoney(text);
  return n === null ? "" : formatMoney(n);
}

// Trạng thái đơn nhập (MVP: draft / confirmed / completed / cancelled).
// Khác với đơn bán: đơn nhập nháp KHÔNG giữ tồn (hàng chưa tồn tại),
// và "Đã xác nhận" ở đây nghĩa là đã nhận hàng vào kho.
const PURCHASE_STATUS_LABELS: Record<string, string> = {
  draft: "Nháp",
  confirmed: "Đã nhận hàng",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  variantId: string;
  sku: string;
  skuSnapshot: string;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  productName: string;
  variantName: string;
  quantity: number;
  // Optional: the backend omits unitCost for viewers without
  // product.view_cost (and without purchase.create). The detail column
  // is gated on canViewCost, and formatMoney already tolerates
  // undefined, so stripped items render safely.
  unitCost?: number;
  returnedQuantity: number;
  remainingQuantity: number;
  lineTotal: number;
}

interface PurchaseOrder {
  id: string;
  code: string;
  supplierId: string;
  supplierName: string | null;
  supplierTaxCode: string | null;
  supplierStatus: string | null;
  status: string;
  paymentStatus: string;
  grandTotal: number;
  paidTotal: number;
  debtTotal: number;
  received: boolean;
  receivedAt: string | null;
  restored: boolean;
  restoredAt: string | null;
  fullyReturned: boolean;
  createdById: string | null;
  note: string | null;
  createdAt: string;
  items?: PurchaseOrderItem[];
  itemsCount?: number;
  payments?: SupplierPayment[];
}

interface SupplierPayment {
  id: string;
  purchaseOrderId: string;
  amount: number;
  paymentMethod: string;
  paymentMethodLabel: string;
  note: string | null;
  status: string;
  cancelReason: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
  createdByName: string | null;
  createdAt: string;
}

interface SupplierOption {
  id: string;
  name: string;
  status: string;
}

interface VariantOption {
  id: string;
  sku: string;
  variantName: string;
  productName: string;
  sellingPrice: number;
  importPrice?: number;
  status: string;
  isSellable?: boolean;
}

interface FormLine {
  variantId: string;
  sku: string;
  quantity: string;
  unitCost: string;
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

export default function PurchasesPage({ token, permissions }: { token: string; permissions: string[] }) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [detail, setDetail] = useState<PurchaseOrder | null>(null);

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [supplierNameReadOnly, setSupplierNameReadOnly] = useState("");
  const [note, setNote] = useState("");
  // Lines exist ONLY once a SKU is picked from the search suggestions.
  // No placeholder "Dòng mới" line and no "+ Thêm dòng" button: an empty
  // line with no SKU means nothing in the UI, and picking a suggestion
  // already creates the line (same rule as the sales-order form).
  const [lines, setLines] = useState<FormLine[]>([]);
  const [variantQuery, setVariantQuery] = useState("");
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([]);
  const [variantSearched, setVariantSearched] = useState(false);
  // Mirrors variantQuery so a slow search response for an older keystroke
  // never overwrites suggestions for what the user has typed since.
  const latestQuery = useRef("");

  const [returnQty, setReturnQty] = useState<Record<string, string>>({});
  const [returnReason, setReturnReason] = useState("");
  const [busy, setBusy] = useState(false);

  // Sprint NCC-3: supplier payments live in the PO detail, mirroring
  // the payment section of the sales-order detail. The payment list
  // arrives inside the detail response (backend includes it); after a
  // payment create/cancel we simply re-open the detail to refresh.
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNote, setPayNote] = useState("");
  const [cancelReasons, setCancelReasons] = useState<Record<string, string>>({});
  const [payBusy, setPayBusy] = useState(false);

  const canCreate = permissions.includes("purchase.create");
  // Same rule as the product import-price column: the PO detail unit-cost
  // column shows only to viewers with product.view_cost. The create/edit
  // FORM keeps its cost inputs for purchase.create holders (they must
  // enter costs to do their job); only the read-only detail column is
  // gated here, and the backend omits unitCost for pure viewers.
  const canViewCost = permissions.includes("product.view_cost");
  const canConfirm = permissions.includes("purchase.confirm");
  const canComplete = permissions.includes("purchase.complete");
  const canCancel = permissions.includes("purchase.cancel");
  const canReturn = permissions.includes("purchase.return");
  // No new view codes for supplier payments: the payment section
  // follows PO visibility (purchase.view_all / view_own), same rule
  // as the detail itself.
  const canViewPayments =
    permissions.includes("purchase.view_all") || permissions.includes("purchase.view_own");
  const canCreatePayment = permissions.includes("supplier_payment.create");
  const canCancelPayment = permissions.includes("supplier_payment.cancel");

  const loadSuppliers = useCallback(async () => {
    // Best effort: users with a purchase role but no supplier role
    // (Warehouse) cannot read the directory — the supplier filter and
    // the create form simply stay hidden for them instead of erroring.
    try {
      const data = await api("/api/suppliers?pageSize=100", token);
      setSuppliers(((data.data as SupplierOption[]) ?? []).map((s) => ({ id: s.id, name: s.name, status: s.status })));
    } catch {
      setSuppliers([]);
    }
  }, [token]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (q.trim()) params.set("q", q.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (supplierFilter) params.set("supplierId", supplierFilter);
      const data = await api(`/api/purchase-orders?${params.toString()}`, token);
      setOrders((data.data as PurchaseOrder[]) ?? []);
      setTotal((data.total as number) ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tải danh sách đơn nhập thất bại.");
    }
  }, [token, page, q, statusFilter, supplierFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (id: string) => {
    try {
      const data = await api(`/api/purchase-orders/${id}`, token);
      setDetail(data.data as PurchaseOrder);
      setReturnQty({});
      setReturnReason("");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tải chi tiết đơn nhập thất bại.");
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setSupplierId("");
    setSupplierNameReadOnly("");
    setNote("");
    setLines([]);
    setVariantQuery("");
    latestQuery.current = "";
    setVariantOptions([]);
    setVariantSearched(false);
    setShowForm(true);
    setError("");
  };

  const openEditDraft = (order: PurchaseOrder) => {
    setEditingId(order.id);
    setSupplierId(order.supplierId);
    setSupplierNameReadOnly(order.supplierName ?? "");
    setNote(order.note ?? "");
    setLines(
      (order.items ?? []).map((i) => ({
        variantId: i.variantId,
        sku: i.sku,
        quantity: String(i.quantity),
        unitCost: formatMoney(i.unitCost),
      })),
    );
    setShowForm(true);
  };

  const searchVariants = async (q?: string) => {
    const query = q ?? variantQuery;
    try {
      const data = await api(`/api/variants?q=${encodeURIComponent(query)}&pageSize=20`, token);
      // The variants endpoint returns { variants: [...] }, NOT the { data: ... }
      // shape the purchase-order endpoints use.
      // Ignore stale responses: only the latest typed query may set options.
      if (latestQuery.current.trim() !== query.trim()) return;
      setVariantOptions((data.variants as VariantOption[]) ?? []);
      setVariantSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tìm SKU thất bại.");
    }
  };

  // Live suggestions: typing suggests matching SKUs as you type (debounced
  // 300ms) instead of waiting for a click on "Tìm SKU". The button stays as
  // an immediate-search fallback. Clearing the query clears the suggestions.
  useEffect(() => {
    if (!showForm) return;
    const query = variantQuery.trim();
    if (!query) {
      setVariantOptions([]);
      setVariantSearched(false);
      return;
    }
    const timer = setTimeout(() => { void searchVariants(query); }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantQuery, showForm]);

  const pickVariant = (v: VariantOption) => {
    if (lines.some((l) => l.variantId === v.id)) {
      setError(`SKU ${v.sku} đã có trong đơn nhập. Hãy sửa số lượng ở dòng đó thay vì thêm dòng mới.`);
      return;
    }
    // Prefill the unit cost with the variant's current import price when
    // the user may see it (product.view_cost). This is only a form
    // default: the PO line keeps its own snapshot, and receiving NEVER
    // writes back to the variant's importPrice (design 13 §7.2).
    setLines((prev) => [
      ...prev,
      {
        variantId: v.id,
        sku: v.sku,
        quantity: "1",
        unitCost: v.importPrice !== undefined && v.importPrice !== null ? formatMoney(v.importPrice) : "",
      },
    ]);
    setVariantQuery("");
    setVariantOptions([]);
    setVariantSearched(false);
    setError("");
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const items = lines
        .filter((l) => l.variantId)
        .map((l) => ({
          variantId: l.variantId,
          quantity: parseInt(l.quantity, 10),
          unitCost: parseMoney(l.unitCost),
        }));
      if (items.length === 0) throw new Error("Đơn nhập phải có ít nhất một dòng SKU.");
      if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity <= 0)) {
        throw new Error("Số lượng mỗi dòng phải là số nguyên lớn hơn 0.");
      }
      if (items.some((i) => i.unitCost === null || !Number.isInteger(i.unitCost) || (i.unitCost as number) < 0)) {
        throw new Error("Đơn giá nhập mỗi dòng phải là số nguyên (đồng) không âm (0 được phép).");
      }
      const body: Record<string, unknown> = {
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, unitCost: i.unitCost as number })),
        note: note.trim() || null,
      };
      let saved: PurchaseOrder;
      if (editingId) {
        // Draft edit never sends supplierId: the supplier of a draft
        // cannot be changed (cancel and recreate instead).
        const data = await api(`/api/purchase-orders/${editingId}`, token, "PATCH", body);
        saved = data.data as PurchaseOrder;
        setInfo(`Đã sửa đơn nhập nháp ${saved.code}. Đơn nháp không làm thay đổi tồn kho.`);
      } else {
        if (!supplierId) throw new Error("Vui lòng chọn nhà cung cấp.");
        const data = await api("/api/purchase-orders", token, "POST", { ...body, supplierId });
        saved = data.data as PurchaseOrder;
        setInfo(`Đã tạo đơn nhập nháp ${saved.code}. Đơn nháp không làm thay đổi tồn kho — chỉ khi bấm "Nhận hàng" thì tồn kho mới tăng.`);
      }
      setShowForm(false);
      setLines([]);
      setDetail(saved);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu đơn nhập thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const doAction = async (action: "confirm" | "complete" | "cancel", order: PurchaseOrder) => {
    const labels: Record<string, string> = {
      confirm: "nhận hàng (nhập kho toàn bộ các dòng)",
      complete: "hoàn thành đơn nhập",
      cancel: "hủy đơn nhập",
    };
    if (action === "cancel" && !window.confirm(`Hủy đơn nhập ${order.code}? ${order.status === "confirmed" ? "Tồn kho đã nhận sẽ được hoàn lại theo số chưa trả." : "Đơn nháp chưa làm thay đổi tồn kho."}`)) {
      return;
    }
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const data = await api(`/api/purchase-orders/${order.id}/${action}`, token, "POST", {});
      const saved = data.data as PurchaseOrder;
      setDetail(saved);
      setInfo(
        action === "confirm"
          ? `Đã ${labels.confirm} cho đơn ${saved.code}. Tồn kho đã tăng theo toàn bộ các dòng.`
          : action === "complete"
            ? `Đã hoàn thành đơn nhập ${saved.code}.`
            : `Đã hủy đơn nhập ${saved.code}.`,
      );
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Không ${labels[action]} được.`);
    } finally {
      setBusy(false);
    }
  };

  const createPayment = async () => {
    if (!detail) return;
    const amount = parseMoney(payAmount);
    if (amount === null || amount <= 0) {
      setError("Số tiền thanh toán phải là số nguyên (đồng) lớn hơn 0.");
      return;
    }
    if (detail.debtTotal <= 0) {
      setError(
        detail.debtTotal < 0
          ? `Đơn đang thừa tiền ${Math.abs(detail.debtTotal).toLocaleString("vi-VN")} (nhà cung cấp đang nợ lại), không tạo thêm payment. Hoàn tiền chưa làm ở sprint này.`
          : "Đơn đã thanh toán đủ, không tạo thêm payment.",
      );
      return;
    }
    setPayBusy(true);
    setError("");
    setInfo("");
    try {
      await api(`/api/purchase-orders/${detail.id}/payments`, token, "POST", {
        amount,
        paymentMethod: payMethod,
        note: payNote.trim() || null,
      });
      setPayAmount("");
      setPayNote("");
      setInfo(`Đã ghi nhận thanh toán NCC ${amount.toLocaleString("vi-VN")}. Số liệu đã được backend tính lại, không tự tính ở frontend.`);
      await openDetail(detail.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ghi nhận thanh toán NCC thất bại.");
    } finally {
      setPayBusy(false);
    }
  };

  const cancelPayment = async (paymentId: string) => {
    if (!detail) return;
    const reason = (cancelReasons[paymentId] ?? "").trim();
    if (!reason) {
      setError("Hủy thanh toán NCC bắt buộc phải có lý do.");
      return;
    }
    setPayBusy(true);
    setError("");
    setInfo("");
    try {
      await api(`/api/purchase-orders/${detail.id}/payments/${paymentId}/cancel`, token, "POST", { reason });
      setCancelReasons((prev) => ({ ...prev, [paymentId]: "" }));
      setInfo("Đã hủy thanh toán NCC. Công nợ đã được backend tính lại ngay; payment đã hủy vẫn hiển thị trong danh sách.");
      await openDetail(detail.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hủy thanh toán NCC thất bại.");
    } finally {
      setPayBusy(false);
    }
  };

  const submitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const items = Object.entries(returnQty)
        .map(([purchaseOrderItemId, qtyText]) => ({ purchaseOrderItemId, quantity: parseInt(qtyText, 10) }))
        .filter((i) => Number.isInteger(i.quantity) && i.quantity > 0);
      if (items.length === 0) throw new Error("Hãy nhập số lượng trả lớn hơn 0 cho ít nhất một dòng.");
      const data = await api(`/api/purchase-orders/${detail.id}/return`, token, "POST", {
        items,
        reason: returnReason.trim() || null,
      });
      const saved = data.data as PurchaseOrder;
      setDetail(saved);
      setReturnQty({});
      setReturnReason("");
      setInfo(`Đã trả hàng cho đơn ${saved.code}. Tồn kho đã giảm theo số lượng trả, tổng tiền đơn đã được tính lại.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trả hàng thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Đơn nhập hàng</h2>
      {error && <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {info && <div className="mb-3 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">{info}</div>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Tìm theo mã đơn (NH-...) hoặc tên nhà cung cấp"
          className="rounded border px-3 py-2"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded border px-3 py-2"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="draft">Nháp</option>
          <option value="confirmed">Đã nhận hàng</option>
          <option value="completed">Hoàn thành</option>
          <option value="cancelled">Đã hủy</option>
        </select>
        {suppliers.length > 0 && (
          <select
            value={supplierFilter}
            onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }}
            className="rounded border px-3 py-2"
          >
            <option value="">Tất cả nhà cung cấp</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.status !== "active" ? " (Ngừng hợp tác)" : ""}</option>
            ))}
          </select>
        )}
        {canCreate && (
          <button onClick={openCreate} className="rounded bg-blue-600 px-4 py-2 text-white">+ Tạo đơn nhập</button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submitForm} className="mb-6 rounded border p-4">
          <h3 className="mb-3 font-semibold">{editingId ? "Sửa đơn nhập nháp" : "Tạo đơn nhập nháp"}</h3>
          {editingId ? (
            <p className="mb-3 text-sm text-gray-600">
              Nhà cung cấp: <b>{supplierNameReadOnly}</b> (không đổi được nhà cung cấp của đơn nháp — muốn đổi, hãy hủy đơn và tạo đơn mới).
            </p>
          ) : (
            <label className="mb-3 block">
              <span className="mb-1 block text-sm">Nhà cung cấp *</span>
              <select value={supplierId} onChange={(e) => { clearCustomValidity(e); setSupplierId(e.target.value); }} onInvalid={(e) => e.currentTarget.setCustomValidity(invalidMessage(e.currentTarget, { missing: "Vui lòng chọn nhà cung cấp." }))} className="w-full rounded border px-3 py-2" required>
                <option value="">-- Chọn nhà cung cấp --</option>
                {suppliers.filter((s) => s.status === "active").map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="mb-3 block">
            <span className="mb-1 block text-sm">Ghi chú</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded border px-3 py-2" placeholder="Ghi chú đơn nhập (tùy chọn)" />
          </label>

          <div className="mb-3">
            <label className="mb-1 block text-sm">Tìm SKU để thêm dòng</label>
            <div className="flex gap-2">
              <input
                value={variantQuery}
                onChange={(e) => { setVariantQuery(e.target.value); latestQuery.current = e.target.value; }}
                placeholder="Gõ để tìm SKU (mã / tên biến thể)"
                className="flex-1 rounded border px-3 py-2"
              />
              <button type="button" onClick={() => searchVariants()} className="rounded border px-4 py-2">Tìm SKU</button>
            </div>
            {variantOptions.length > 0 && (
              <ul className="mt-2 max-h-64 overflow-auto rounded border">
                {variantOptions.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => pickVariant(v)}
                      className="block w-full px-3 py-2 text-left hover:bg-gray-100"
                    >
                      {v.sku} — {v.productName} / {v.variantName}
                      {v.status !== "active" ? " (ngừng bán)" : ""}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {variantSearched && variantOptions.length === 0 && variantQuery.trim() && (
              <p className="mt-2 text-sm text-gray-500">Không tìm thấy SKU nào khớp từ khóa.</p>
            )}
          </div>

          {lines.length === 0 ? (
            <p className="mb-3 text-sm text-gray-500">Chưa có dòng hàng nào. Gõ từ khóa rồi chọn một SKU từ danh sách gợi ý để thêm dòng.</p>
          ) : (
            <table className="mb-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-1 text-left">SKU</th>
                  <th className="px-2 py-1 text-left">Số lượng</th>
                  <th className="px-2 py-1 text-left">Đơn giá nhập (đồng)</th>
                  <th className="px-2 py-1 text-left">Thành tiền</th>
                  <th className="px-2 py-1" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => {
                  const qty = parseInt(l.quantity, 10);
                  const cost = parseMoney(l.unitCost);
                  const lineTotal = Number.isInteger(qty) && cost !== null ? qty * cost : 0;
                  return (
                    <tr key={l.variantId} className="border-b">
                      <td className="px-2 py-1">{l.sku}</td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={l.quantity}
                          onChange={(e) => { clearCustomValidity(e); setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x))); }}
                          onInvalid={(e) => e.currentTarget.setCustomValidity(invalidMessage(e.currentTarget, { missing: "Vui lòng nhập số lượng.", underflow: "Số lượng phải từ 1 trở lên.", badInput: "Số lượng phải là số nguyên." }))}
                          className="w-24 rounded border px-2 py-1"
                          required
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={l.unitCost}
                          onChange={(e) => { clearCustomValidity(e); setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, unitCost: formatMoneyInput(e.target.value) } : x))); }}
                          onInvalid={(e) => e.currentTarget.setCustomValidity(invalidMessage(e.currentTarget, { missing: "Vui lòng nhập đơn giá nhập." }))}
                          className="w-36 rounded border px-2 py-1"
                          placeholder="0"
                          required
                        />
                      </td>
                      <td className="px-2 py-1">{formatMoney(lineTotal)}đ</td>
                      <td className="px-2 py-1">
                        <button type="button" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))} className="text-red-600">Xóa dòng</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
              {editingId ? "Lưu đơn nháp" : "Tạo đơn nháp"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded border px-4 py-2">Hủy</button>
          </div>
        </form>
      )}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-2 py-1 text-left">Mã đơn</th>
            <th className="px-2 py-1 text-left">Nhà cung cấp</th>
            <th className="px-2 py-1 text-left">Trạng thái</th>
            <th className="px-2 py-1 text-left">Tổng tiền</th>
            <th className="px-2 py-1 text-left">Đã trả / Còn nợ</th>
            <th className="px-2 py-1 text-left">Ngày tạo</th>
            <th className="px-2 py-1" />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b">
              <td className="px-2 py-1">{o.code}</td>
              <td className="px-2 py-1">{o.supplierName ?? "—"}</td>
              <td className="px-2 py-1">{PURCHASE_STATUS_LABELS[o.status] ?? o.status}</td>
              <td className="px-2 py-1">{formatMoney(o.grandTotal)}đ</td>
              <td className="px-2 py-1">{formatMoney(o.paidTotal)}đ / {formatMoney(o.debtTotal)}đ</td>
              <td className="px-2 py-1">{isoToVnDate(o.createdAt)}</td>
              <td className="px-2 py-1">
                <button onClick={() => openDetail(o.id)} className="text-blue-600">Xem</button>
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr><td colSpan={7} className="px-2 py-4 text-center text-gray-500">Chưa có đơn nhập nào.</td></tr>
          )}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-2 text-sm">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-50">Trước</button>
        <span>Trang {page} / {Math.max(1, Math.ceil(total / 20))} (tổng {total})</span>
        <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-50">Sau</button>
      </div>

      {detail && (
        <div className="mt-6 rounded border p-4">
          <h3 className="mb-2 font-semibold">Chi tiết đơn nhập {detail.code}</h3>
          <p className="text-sm">Nhà cung cấp: <b>{detail.supplierName ?? "—"}</b>{detail.supplierTaxCode ? ` (MST: ${detail.supplierTaxCode})` : ""}</p>
          <p className="text-sm">Trạng thái: <b>{PURCHASE_STATUS_LABELS[detail.status] ?? detail.status}</b></p>
          <p className="text-sm">
            Đã nhận hàng: <b>{detail.received ? "Có" : "Không"}</b> · Đã hoàn kho: <b>{detail.restored ? "Có" : "Không"}</b>
            {detail.fullyReturned ? " · Đã trả hết hàng" : ""}
          </p>
          <p className="text-sm">
            Tổng tiền: <b>{formatMoney(detail.grandTotal)}đ</b> · Đã trả: {formatMoney(detail.paidTotal)}đ · Còn nợ: {formatMoney(detail.debtTotal)}đ
            ({PAYMENT_STATUS_LABELS[detail.paymentStatus] ?? detail.paymentStatus})
          </p>
          {detail.note && <p className="text-sm">Ghi chú: {detail.note}</p>}

          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-1 text-left">SKU</th>
                <th className="px-2 py-1 text-left">Sản phẩm / Biến thể</th>
                <th className="px-2 py-1 text-left">Số lượng</th>
                <th className="px-2 py-1 text-left">Đã trả</th>
                <th className="px-2 py-1 text-left">Còn trả được</th>
                {canViewCost && <th className="px-2 py-1 text-left">Đơn giá nhập</th>}
                <th className="px-2 py-1 text-left">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {(detail.items ?? []).map((i) => (
                <tr key={i.id} className="border-b">
                  <td className="px-2 py-1">{i.sku}</td>
                  <td className="px-2 py-1">{i.productName} / {i.variantName}</td>
                  <td className="px-2 py-1">{i.quantity}</td>
                  <td className="px-2 py-1">{i.returnedQuantity}</td>
                  <td className="px-2 py-1">{i.remainingQuantity}</td>
                  {canViewCost && <td className="px-2 py-1">{formatMoney(i.unitCost)}đ</td>}
                  <td className="px-2 py-1">{formatMoney(i.lineTotal)}đ</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 flex flex-wrap gap-2">
            {detail.status === "draft" && canCreate && (
              <button onClick={() => openEditDraft(detail)} className="rounded border px-4 py-2">Sửa nháp</button>
            )}
            {detail.status === "draft" && canConfirm && (
              <button onClick={() => doAction("confirm", detail)} disabled={busy} className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50">Nhận hàng</button>
            )}
            {detail.status === "confirmed" && canComplete && (
              <button onClick={() => doAction("complete", detail)} disabled={busy} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">Hoàn thành</button>
            )}
            {(detail.status === "draft" || detail.status === "confirmed") && canCancel && (
              <button onClick={() => doAction("cancel", detail)} disabled={busy} className="rounded border border-red-300 px-4 py-2 text-red-700 disabled:opacity-50">Hủy đơn nhập</button>
            )}
            <button onClick={() => setDetail(null)} className="rounded border px-4 py-2">Đóng</button>
          </div>

          {(detail.status === "confirmed" || detail.status === "completed") && canReturn && (
            <form onSubmit={submitReturn} className="mt-4 rounded border p-3">
              <h4 className="mb-2 font-semibold">Trả hàng cho nhà cung cấp</h4>
              <p className="mb-2 text-sm text-gray-600">
                Chỉ nhập số lượng trả cho các dòng cần trả (để trống = không trả dòng đó). Trả hàng giảm tồn kho ngay và tính lại tổng tiền đơn theo số còn giữ.
              </p>
              {(detail.items ?? []).filter((i) => i.remainingQuantity > 0).map((i) => (
                <label key={i.id} className="mb-2 flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 break-words">{i.sku} (còn trả được {i.remainingQuantity})</span>
                  <input
                    type="number"
                    min={0}
                    max={i.remainingQuantity}
                    step={1}
                    value={returnQty[i.id] ?? ""}
                    onChange={(e) => { clearCustomValidity(e); setReturnQty((prev) => ({ ...prev, [i.id]: e.target.value })); }}
                    onInvalid={(e) => e.currentTarget.setCustomValidity(invalidMessage(e.currentTarget, { overflow: `Số lượng trả không được vượt quá ${i.remainingQuantity} (số còn trả được của dòng này).`, underflow: "Số lượng trả không được nhỏ hơn 0.", badInput: "Số lượng trả phải là số nguyên." }))}
                    className="w-24 rounded border px-2 py-1"
                    placeholder="0"
                  />
                </label>
              ))}
              {(detail.items ?? []).filter((i) => i.remainingQuantity > 0).length === 0 && (
                <p className="mb-2 text-sm text-gray-500">Tất cả các dòng đã trả hết.</p>
              )}
              <label className="mb-2 block">
                <span className="mb-1 block text-sm">Lý do trả hàng (tùy chọn)</span>
                <input value={returnReason} onChange={(e) => setReturnReason(e.target.value)} className="w-full rounded border px-3 py-2" placeholder="VD: Hàng lỗi, sai mẫu..." />
              </label>
              <button type="submit" disabled={busy} className="rounded bg-orange-600 px-4 py-2 text-white disabled:opacity-50">Xác nhận trả hàng</button>
            </form>
          )}

          {canViewPayments && (
            <div className="mt-4 rounded border p-3">
              <h4 className="font-semibold">Thanh toán cho nhà cung cấp</h4>
              <p className="text-sm text-gray-600">
                Đã trả: {detail.paidTotal.toLocaleString("vi-VN")} · Còn nợ: {detail.debtTotal.toLocaleString("vi-VN")} · Trạng thái: {labelFor(PAYMENT_STATUS_LABELS, detail.paymentStatus)}
                {detail.debtTotal < 0 && ` · Đơn đang thừa tiền ${Math.abs(detail.debtTotal).toLocaleString("vi-VN")} (nhà cung cấp đang nợ lại — hoàn tiền chưa làm ở sprint này, không tạo thêm payment).`}
              </p>
              <ul className="mt-2 space-y-2 text-sm">
                {(detail.payments ?? []).map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 border-b pb-2">
                    <span>
                      <strong>{p.amount.toLocaleString("vi-VN")}</strong> · {p.paymentMethodLabel} · {isoToVnDate(p.createdAt)} · {labelFor(PAYMENT_RECORD_LABELS, p.status)}
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
                        <button disabled={payBusy} onClick={() => cancelPayment(p.id)} className="rounded border border-red-300 px-2 py-1 text-red-700 disabled:opacity-50">Hủy thanh toán</button>
                      </span>
                    )}
                  </li>
                ))}
                {(detail.payments ?? []).length === 0 && <li className="text-gray-500">Chưa có thanh toán NCC nào cho đơn này.</li>}
              </ul>
              {(detail.status === "confirmed" || detail.status === "completed") && canCreatePayment && (
                <div className="mt-3 space-y-2">
                  <h5 className="font-semibold">Ghi nhận thanh toán NCC mới</h5>
                  <p className="text-sm text-gray-600">Chỉ trả cho đơn nhập đã xác nhận hoặc đã hoàn thành. Số tiền không được vượt số còn nợ; backend kiểm tra lại trong cùng transaction.</p>
                  <label className="block text-sm">
                    Số tiền (đồng, số nguyên &gt; 0)
                    <input type="text" inputMode="numeric" className="mt-1 w-full rounded border p-2" value={payAmount} onChange={(e) => setPayAmount(formatMoneyInput(e.target.value))} />
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
                  <button disabled={payBusy || detail.debtTotal <= 0} onClick={createPayment} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">Ghi nhận thanh toán</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
