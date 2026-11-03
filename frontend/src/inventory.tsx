import { useCallback, useEffect, useState } from "react";
import { INVENTORY_TX_LABELS, isoToVnDateTime, labelFor } from "./labels";
import { clearCustomValidity, invalidMessage } from "./validity";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface StockItem {
  variantId: string;
  warehouseCode: string;
  quantity: number;
  sku: string | null;
  variantName: string | null;
  variantStatus: string | null;
  productId: string | null;
  productName: string | null;
  productStatus: string | null;
  categoryName: string | null;
  isSellable: boolean;
}

interface StockTransaction {
  id: string;
  transactionType: string;
  quantityBefore: number;
  quantityChanged: number;
  quantityAfter: number;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
}

interface OpLine {
  variantId: string;
  quantity: string;
  setTo: string;
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

export default function InventoryPage({ token, permissions }: { token: string; permissions: string[] }) {
  const [items, setItems] = useState<StockItem[]>([]);
  // Full SKU list for the operation form's dropdown. The table's `items` are
  // only the current page, so building the dropdown from them made SKUs on
  // other pages unselectable. This list ignores table filters/pagination.
  const [allItems, setAllItems] = useState<StockItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [variantStatus, setVariantStatus] = useState("");
  const [maxQuantity, setMaxQuantity] = useState("");
  const [sort, setSort] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [historyVariant, setHistoryVariant] = useState<StockItem | null>(null);
  const [history, setHistory] = useState<StockTransaction[]>([]);

  const [op, setOp] = useState<"initial" | "import" | "export" | "adjust">("import");
  const [adjustMode, setAdjustMode] = useState<"increase" | "decrease" | "set">("increase");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<OpLine[]>([{ variantId: "", quantity: "", setTo: "" }]);
  const [busy, setBusy] = useState(false);

  const canImport = permissions.includes("inventory.import_stock");
  const canExport = permissions.includes("inventory.export");
  const canAdjust = permissions.includes("inventory.adjust");
  const canViewTx = permissions.includes("inventory.view_transactions");
  const canOperate = canImport || canExport || canAdjust;

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (q.trim()) params.set("q", q.trim());
      if (variantStatus) params.set("variantStatus", variantStatus);
      if (maxQuantity.trim()) params.set("maxQuantity", maxQuantity.trim());
      if (sort) params.set("sort", sort);
      const data = await api(`/api/inventory?${params.toString()}`, token);
      setItems((data.items ?? []) as StockItem[]);
      setTotal(Number(data.total ?? 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được tồn kho.");
    }
  }, [token, page, q, variantStatus, maxQuantity, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const loadAllItems = useCallback(async () => {
    try {
      const collected: StockItem[] = [];
      let pageNo = 1;
      let totalNo = Infinity;
      while (collected.length < totalNo) {
        const data = await api(`/api/inventory?page=${pageNo}&pageSize=100`, token);
        collected.push(...((data.items ?? []) as StockItem[]));
        totalNo = Number(data.total ?? 0);
        if (!data.items || (data.items as unknown[]).length === 0) break;
        pageNo += 1;
      }
      setAllItems(collected);
    } catch {
      // Dropdown falls back to the current page's items below.
    }
  }, [token]);

  useEffect(() => {
    loadAllItems();
  }, [loadAllItems]);

  async function loadHistory(item: StockItem) {
    setError("");
    try {
      const data = await api(`/api/inventory/${item.variantId}/transactions?pageSize=50`, token);
      setHistoryVariant(item);
      setHistory((data.transactions ?? []) as StockTransaction[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được lịch sử kho.");
    }
  }

  function startOp(nextOp: typeof op, item: StockItem) {
    setOp(nextOp);
    setLines([{ variantId: item.variantId, quantity: "", setTo: "" }]);
    setInfo(`Đã chọn SKU ${item.sku} cho thao tác ${nextOp === "initial" ? "nhập tồn ban đầu" : nextOp === "import" ? "nhập kho" : nextOp === "export" ? "xuất kho" : "điều chỉnh"}.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitOp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (op !== "initial" && !reason.trim()) {
      setError("Nhập kho, xuất kho và điều chỉnh bắt buộc phải có lý do.");
      return;
    }
    const built = lines
      .filter((l) => l.variantId.trim())
      .map((l) => {
        if (op === "adjust") {
          return adjustMode === "set"
            ? { variantId: l.variantId.trim(), mode: "set", setTo: Number(l.setTo) }
            : { variantId: l.variantId.trim(), mode: adjustMode, quantity: Number(l.quantity) };
        }
        return { variantId: l.variantId.trim(), quantity: Number(l.quantity) };
      });
    if (built.length === 0) {
      setError("Cần ít nhất một dòng SKU.");
      return;
    }
    if (built.some((l) => !Number.isInteger(l.quantity ?? l.setTo) || ((l.quantity ?? l.setTo) as number) < 0 || (op !== "adjust" && (l.quantity as number) <= 0))) {
      setError("Số lượng phải là số nguyên; nhập/xuất phải lớn hơn 0, tồn đặt về không âm.");
      return;
    }
    setBusy(true);
    try {
      const data = await api(`/api/inventory/${op}`, token, "POST", { items: built, reason: reason.trim() || undefined });
      const results = (data.results ?? []) as { sku: string; quantityBefore: number; quantityChanged: number; quantityAfter: number; skipped?: boolean }[];
      setInfo(
        results
          .map((r) => (r.skipped ? `${r.sku}: giữ nguyên ${r.quantityAfter} (nhập ban đầu 0 không ghi transaction)` : `${r.sku}: ${r.quantityBefore} → ${r.quantityAfter} (thay đổi ${r.quantityChanged >= 0 ? "+" : ""}${r.quantityChanged})`))
          .join(" · "),
      );
      setLines([{ variantId: "", quantity: "", setTo: "" }]);
      setReason("");
      load();
      loadAllItems();
    } catch (err) {
      // A failed bulk request applies NOTHING server-side (all-or-nothing).
      setError(err instanceof Error ? err.message : "Thao tác kho thất bại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Kho — tồn theo SKU</h2>
      <p className="text-sm text-gray-500">
        Mọi thay đổi tồn đều ghi transaction (trước / thay đổi / sau / lý do). Tồn không bao giờ âm ở MVP và thao tác
        hàng loạt lỗi ở 1 SKU thì hủy toàn bộ, không áp dụng một phần. SKU ngừng bán không được nhập/xuất kho, chỉ
        được điều chỉnh kiểm kê kèm lý do.
      </p>
      {error && <p className="alert-error">{error}</p>}
      {info && <p className="alert-success">{info}</p>}

      <div className="flex flex-wrap gap-2">
        <input className="field" placeholder="Tìm SKU / tên sản phẩm / biến thể" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className="field" value={variantStatus} onChange={(e) => { setVariantStatus(e.target.value); setPage(1); }}>
          <option value="">Mọi trạng thái SKU</option>
          <option value="active">SKU đang bán</option>
          <option value="inactive">SKU ngừng bán</option>
        </select>
        <input className="field" type="number" min={0} placeholder="Tồn tối đa (vd 5)" value={maxQuantity} onChange={(e) => { setMaxQuantity(e.target.value); setPage(1); }} />
        <select className="field" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="">Sắp xếp theo SKU</option>
          <option value="low_stock">Tồn thấp lên trước</option>
          <option value="high_stock">Tồn cao lên trước</option>
        </select>
      </div>

      <table className="w-full border text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th>SKU</th>
            <th>Sản phẩm / Biến thể</th>
            <th>Tồn</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.variantId}>
              <td className="font-mono">{it.sku}</td>
              <td>{it.productName} — {it.variantName}</td>
              <td className="font-semibold">{it.quantity}</td>
              <td>{it.isSellable ? "Đang bán" : "Ngừng bán"}</td>
              <td>
                <div className="flex flex-wrap gap-1">
                  {canViewTx && <button className="btn btn-sm btn-secondary" onClick={() => loadHistory(it)}>Lịch sử</button>}
                  {canImport && <button className="btn btn-sm btn-secondary" onClick={() => startOp("initial", it)}>Tồn ban đầu</button>}
                  {canImport && <button className="btn btn-sm btn-secondary" onClick={() => startOp("import", it)}>Nhập</button>}
                  {canExport && <button className="btn btn-sm btn-secondary" onClick={() => startOp("export", it)}>Xuất</button>}
                  {canAdjust && <button className="btn btn-sm btn-secondary" onClick={() => startOp("adjust", it)}>Điều chỉnh</button>}
                </div>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={5}>Chưa có SKU nào có dòng tồn, hoặc không khớp bộ lọc.</td></tr>
          )}
        </tbody>
      </table>
      <div className="flex items-center gap-2">
        <button className="btn btn-sm btn-secondary disabled:opacity-50" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button>
        <span>Trang {page} — tổng {total} dòng tồn</span>
        <button className="btn btn-sm btn-secondary disabled:opacity-50" disabled={items.length < 20} onClick={() => setPage(page + 1)}>Sau</button>
      </div>

      {historyVariant && (
        <div className="card">
          <h3 className="font-semibold">Lịch sử kho — {historyVariant.sku} ({historyVariant.productName} — {historyVariant.variantName})</h3>
          <p className="text-sm text-gray-500">Lịch sử bất biến, không sửa/xóa được.</p>
          <table className="mt-2 w-full border text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th>Thời gian</th>
                <th>Loại</th>
                <th>Trước</th>
                <th>Thay đổi</th>
                <th>Sau</th>
                <th>Lý do</th>
              </tr>
            </thead>
            <tbody>
              {history.map((t) => (
                <tr key={t.id}>
                  <td>{isoToVnDateTime(t.createdAt)}</td>
                  <td>{labelFor(INVENTORY_TX_LABELS, t.transactionType)}</td>
                  <td>{t.quantityBefore}</td>
                  <td>{t.quantityChanged >= 0 ? "+" : ""}{t.quantityChanged}</td>
                  <td className="font-semibold">{t.quantityAfter}</td>
                  <td>{t.reason}</td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={6}>Chưa có transaction nào cho SKU này.</td></tr>}
            </tbody>
          </table>
          <button className="mt-2 btn btn-sm btn-secondary" onClick={() => { setHistoryVariant(null); setHistory([]); }}>Đóng lịch sử</button>
        </div>
      )}

      {canOperate && (
        <form onSubmit={submitOp} className="space-y-3 card">
          <h3 className="font-semibold">Thao tác kho (một hoặc nhiều SKU — lỗi ở 1 dòng thì hủy toàn bộ)</h3>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2">
              Thao tác
              <select className="input" value={op} onChange={(e) => setOp(e.target.value as typeof op)}>
                {canImport && <option value="initial">Nhập tồn ban đầu (chỉ lần đầu)</option>}
                {canImport && <option value="import">Nhập kho</option>}
                {canExport && <option value="export">Xuất kho</option>}
                {canAdjust && <option value="adjust">Điều chỉnh</option>}
              </select>
            </label>
            {op === "adjust" && (
              <label className="flex items-center gap-2">
                Kiểu điều chỉnh
                <select className="input" value={adjustMode} onChange={(e) => setAdjustMode(e.target.value as typeof adjustMode)}>
                  <option value="increase">Tăng</option>
                  <option value="decrease">Giảm</option>
                  <option value="set">Đặt về số tuyệt đối</option>
                </select>
              </label>
            )}
          </div>
          <label className="block">
            Lý do {op === "initial" ? "(không bắt buộc cho tồn ban đầu)" : "(bắt buộc)"}
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="VD: Nhập hàng đợt 1 từ NCC An Phát, phiếu NH-001" />
          </label>
          {lines.map((line, idx) => (
            <div key={idx} className="flex flex-wrap items-end gap-2 card-sm">
              <label className="block">
                SKU
                <select className="input" value={line.variantId} onChange={(e) => {
                  const next = [...lines]; next[idx] = { ...next[idx], variantId: e.target.value }; setLines(next);
                }}>
                  <option value="">— Chọn SKU trong danh sách —</option>
                  {(allItems.length > 0 ? allItems : items).map((it) => (
                    <option key={it.variantId} value={it.variantId}>{it.sku} — {it.productName} / {it.variantName} (tồn {it.quantity})</option>
                  ))}
                </select>
              </label>
              {op === "adjust" && adjustMode === "set" ? (
                <label className="block">
                  Đặt về
                  <input type="number" min={0} className="input" value={line.setTo} onChange={(e) => {
                    clearCustomValidity(e);
                    const next = [...lines]; next[idx] = { ...next[idx], setTo: e.target.value }; setLines(next);
                  }} onInvalid={(e) => e.currentTarget.setCustomValidity(invalidMessage(e.currentTarget, { missing: "Vui lòng nhập số tồn muốn đặt.", underflow: "Số tồn muốn đặt không được nhỏ hơn 0.", badInput: "Số tồn phải là số nguyên." }))} required />
                </label>
              ) : (
                <label className="block">
                  Số lượng
                  <input type="number" min={1} className="input" value={line.quantity} onChange={(e) => {
                    clearCustomValidity(e);
                    const next = [...lines]; next[idx] = { ...next[idx], quantity: e.target.value }; setLines(next);
                  }} onInvalid={(e) => e.currentTarget.setCustomValidity(invalidMessage(e.currentTarget, { missing: "Vui lòng nhập số lượng.", underflow: "Số lượng phải từ 1 trở lên.", badInput: "Số lượng phải là số nguyên." }))} required />
                </label>
              )}
              <button type="button" className="btn btn-secondary" disabled={lines.length <= 1} onClick={() => setLines(lines.filter((_, i) => i !== idx))}>Xóa dòng</button>
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setLines([...lines, { variantId: "", quantity: "", setTo: "" }])}>+ Thêm dòng SKU</button>
            <button disabled={busy} className="btn btn-primary disabled:opacity-50">{busy ? "Đang lưu…" : "Lưu thao tác kho"}</button>
          </div>
          <p className="text-sm text-gray-500">
            Lưu ý: nút ở giao diện chỉ để tiện dùng — backend vẫn kiểm tra quyền, lý do và tồn âm. SKU ngừng bán không
            nhập/xuất được, chỉ điều chỉnh kiểm kê được.
          </p>
        </form>
      )}
    </div>
  );
}
