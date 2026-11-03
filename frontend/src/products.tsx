import { useCallback, useEffect, useState } from "react";
import { clearCustomValidity, invalidMessage } from "./validity";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface Category {
  id: string;
  name: string;
  productCount?: number;
}

interface ProductImageItem {
  id: string;
  productId: string;
  variantId: string | null;
  mimeType: string;
  size: number;
  sortOrder: number;
  createdAt: string;
}

interface VariantRow {
  id?: string;
  sku: string;
  variantName: string;
  attributes: { name: string; value: string }[];
  isDefault: boolean;
  sellingPrice: number;
  importPrice: number | null;
  barcode: string;
  status: string;
  isSellable?: boolean;
  stockQuantity?: number;
  thumbnailImageId?: string | null;
}

interface ProductListItem {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  category: Category | null;
  status: string;
  variantCount: number;
  activeVariantCount: number;
  totalStock: number;
  variants: VariantRow[];
  images: ProductImageItem[];
  thumbnailImageId: string | null;
  createdAt: string;
}

interface OptionGroupDraft {
  name: string;
  valuesText: string;
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

/** Tiền hiển thị theo kiểu Việt Nam: 1000000 -> "1.000.000". */
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

/** Ô nhập tiền: hiển thị có dấu phân cách nghìn, giá trị lưu là số.
 *  Ô số của trình duyệt không hiểu dấu phân cách (gõ "1,000" thành rỗng
 *  rồi lưu thành 0), nên dùng ô chữ và tự định dạng khi gõ. */
function PriceInput({ value, onChange, placeholder, className, disabled }: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      className={className ?? "input"}
      value={formatMoney(value)}
      onChange={(e) => onChange(parseMoney(e.target.value))}
      disabled={disabled}
    />
  );
}

/** Ảnh sản phẩm tải qua API có kèm token (thẻ <img> không gửi được
 *  Authorization header) rồi hiển thị bằng blob URL. URL blob được cache
 *  theo id ảnh trong phiên làm việc để không tải lại khi render lại. */
const imageBlobCache = new Map<string, string>();

function ProductImg({ token, imageId, className }: { token: string; imageId: string; className?: string }) {
  const [src, setSrc] = useState<string | undefined>(() => imageBlobCache.get(imageId));
  useEffect(() => {
    const cached = imageBlobCache.get(imageId);
    if (cached) {
      setSrc(cached);
      return;
    }
    let alive = true;
    fetch(`${API_BASE}/api/product-images/${imageId}/file`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Lỗi ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        imageBlobCache.set(imageId, url);
        if (alive) setSrc(url);
      })
      .catch(() => { /* giữ khung chờ, không vỡ giao diện */ });
    return () => { alive = false; };
  }, [token, imageId]);
  if (!src) {
    return <div className={`${className ?? ""} flex items-center justify-center bg-gray-100 text-xs text-gray-400`}>…</div>;
  }
  return <img src={src} alt="Ảnh sản phẩm" className={className} />;
}

/** Local cartesian product (preview only — the backend re-generates authoritatively on save). */
function cartesian(groups: { name: string; values: string[] }[]): { name: string; value: string }[][] {
  let combos: { name: string; value: string }[][] = [[]];
  for (const g of groups) {
    const next: { name: string; value: string }[][] = [];
    for (const c of combos) for (const v of g.values) next.push([...c, { name: g.name, value: v }]);
    combos = next;
  }
  return combos;
}

function emptyVariant(isDefault = false): VariantRow {
  return {
    sku: "", variantName: "", attributes: [], isDefault,
    sellingPrice: 0, importPrice: null, barcode: "", status: "active",
  };
}

export default function ProductsPage({ token, permissions }: { token: string; permissions: string[] }) {
  const [view, setView] = useState<"list" | "detail" | "form">("list");
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [detail, setDetail] = useState<ProductListItem | null>(null);
  const [formId, setFormId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [status, setStatus] = useState("active");
  const [mode, setMode] = useState<"simple" | "variants">("simple");
  const [defaultVariant, setDefaultVariant] = useState<VariantRow>(emptyVariant(true));
  const [optionGroups, setOptionGroups] = useState<OptionGroupDraft[]>([{ name: "", valuesText: "" }]);
  const [manualVariants, setManualVariants] = useState<VariantRow[]>([]);
  const [bulkSelling, setBulkSelling] = useState("");
  const [bulkImport, setBulkImport] = useState("");
  const [q, setQ] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // Ảnh chung của sản phẩm đang mở (variantId null); thumbnail riêng của SKU nằm ở từng dòng biến thể.
  const detailCommonImages = detail ? (detail.images ?? []).filter((i) => !i.variantId) : [];

  const canView = permissions.includes("product.view");
  const canCreate = permissions.includes("product.create");
  const canUpdate = permissions.includes("product.update");
  const canDeactivate = permissions.includes("product.deactivate");
  const canViewCost = permissions.includes("product.view_cost");
  const canUpdatePrice = permissions.includes("product.update_price");
  const canUpdateCost = permissions.includes("product.update_cost");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (q) params.set("q", q);
      if (filterCategory) params.set("categoryId", filterCategory);
      if (filterStatus) params.set("status", filterStatus);
      const data = await api(`/api/products?${params}`, token);
      setProducts(data.products as ProductListItem[]);
      setTotal(data.total as number);
      setTotalPages(data.totalPages as number);
      const cats = await api("/api/categories", token);
      setCategories(cats.categories as Category[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách sản phẩm.");
    } finally {
      setLoading(false);
    }
  }, [token, page, q, filterCategory, filterStatus]);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  function resetForm() {
    setFormId(null);
    setName("");
    setDescription("");
    setCategoryId("");
    setCategoryName("");
    setStatus("active");
    setMode("simple");
    setDefaultVariant(emptyVariant(true));
    setOptionGroups([{ name: "", valuesText: "" }]);
    setManualVariants([]);
    setError("");
    setInfo("");
  }

  async function openDetail(id: string) {
    setError("");
    try {
      const data = await api(`/api/products/${id}`, token);
      setDetail(data.product as ProductListItem);
      setView("detail");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không mở được chi tiết sản phẩm.");
    }
  }

  function openEdit(p: ProductListItem) {
    resetForm();
    setFormId(p.id);
    setName(p.name);
    setDescription(p.description ?? "");
    setCategoryId(p.categoryId ?? "");
    setStatus(p.status);
    const hasAttrs = p.variants.some((v) => v.attributes && v.attributes.length > 0);
    if (hasAttrs) {
      setMode("variants");
      setManualVariants(p.variants.map((v) => ({
        id: v.id, sku: v.sku, variantName: v.variantName, attributes: v.attributes,
        isDefault: v.isDefault, sellingPrice: v.sellingPrice,
        importPrice: v.importPrice ?? null, barcode: v.barcode ?? "", status: v.status,
      })));
    } else {
      setMode("simple");
      const dv = p.variants.find((v) => v.isDefault) ?? p.variants[0];
      if (dv) setDefaultVariant({
        id: dv.id, sku: dv.sku, variantName: dv.variantName, attributes: [],
        isDefault: true, sellingPrice: dv.sellingPrice, importPrice: dv.importPrice ?? null,
        barcode: dv.barcode ?? "", status: dv.status,
      });
    }
    setView("form");
  }

  function generateRows() {
    const groups = optionGroups
      .map((g) => ({ name: g.name.trim(), values: g.valuesText.split(",").map((s) => s.trim()).filter(Boolean) }))
      .filter((g) => g.name && g.values.length > 0);
    if (groups.length === 0) {
      setError("Hãy nhập ít nhất 1 nhóm thuộc tính có tên và giá trị (các giá trị cách nhau bằng dấu phẩy).");
      return;
    }
    if (groups.length > 3) {
      setError("Tối đa 3 nhóm thuộc tính cho một sản phẩm.");
      return;
    }
    const combos = cartesian(groups);
    if (combos.length > 200) {
      setError(`Sinh ${combos.length} SKU vượt giới hạn 200 SKU cho một sản phẩm. Hãy giảm số giá trị thuộc tính.`);
      return;
    }
    setManualVariants(combos.map((attrs) => ({
      ...emptyVariant(false),
      variantName: attrs.map((a) => a.value).join(" / "),
      attributes: attrs,
    })));
    setError("");
    setInfo(`Đã sinh ${combos.length} tổ hợp biến thể. Bạn chỉnh giá từng dòng rồi bấm Lưu — SKU để trống sẽ do hệ thống tự sinh.`);
  }

  function applyBulk() {
    const selling = bulkSelling === "" ? null : parseMoney(bulkSelling);
    const importing = bulkImport === "" ? null : parseMoney(bulkImport);
    if (selling !== null && (Number.isNaN(selling) || selling < 0)) { setError("Giá bán áp dụng hàng loạt không hợp lệ."); return; }
    if (importing !== null && (Number.isNaN(importing) || importing < 0)) { setError("Giá nhập áp dụng hàng loạt không hợp lệ."); return; }
    setManualVariants((rows) => rows.map((r) => ({
      ...r,
      sellingPrice: selling !== null ? selling : r.sellingPrice,
      importPrice: importing !== null ? importing : r.importPrice,
    })));
    setInfo("Đã áp dụng giá cho tất cả dòng biến thể (chưa lưu — hãy bấm Lưu sản phẩm).");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!name.trim()) { setError("Tên sản phẩm không được để trống."); return; }
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        status,
        ...(categoryId ? { categoryId } : categoryName.trim() ? { categoryName: categoryName.trim() } : {}),
      };
      if (mode === "simple") {
        body.defaultVariant = {
          ...(formId && defaultVariant.id ? { id: defaultVariant.id } : {}),
          sku: defaultVariant.sku.trim() || undefined,
          variantName: defaultVariant.variantName.trim() || "Mặc định",
          sellingPrice: defaultVariant.sellingPrice,
          importPrice: defaultVariant.importPrice,
          barcode: defaultVariant.barcode.trim() || null,
          status: defaultVariant.status,
        };
      } else if (manualVariants.length > 0) {
        body.variants = manualVariants.map((v) => ({
          ...(v.id ? { id: v.id } : {}),
          sku: v.sku.trim() || undefined,
          variantName: v.variantName.trim(),
          attributes: v.attributes,
          isDefault: v.isDefault,
          sellingPrice: v.sellingPrice,
          importPrice: v.importPrice,
          barcode: v.barcode.trim() || null,
          status: v.status,
        }));
      } else {
        const groups = optionGroups
          .map((g) => ({ name: g.name.trim(), values: g.valuesText.split(",").map((s) => s.trim()).filter(Boolean) }))
          .filter((g) => g.name && g.values.length > 0);
        if (groups.length === 0) { setError("Hãy sinh tổ hợp biến thể hoặc nhập ít nhất 1 biến thể."); return; }
        body.variantOptions = groups;
        body.defaultSellingPrice = 0;
      }
      if (formId) {
        await api(`/api/products/${formId}`, token, "PATCH", body);
        setInfo("Đã lưu sản phẩm.");
      } else {
        await api("/api/products", token, "POST", body);
        setInfo("Đã tạo sản phẩm.");
      }
      setView("list");
      setPage(1);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu sản phẩm thất bại.");
    }
  }

  async function handleDeactivate(id: string) {
    if (!window.confirm("Chuyển sản phẩm và toàn bộ SKU sang Ngừng bán?")) return;
    try {
      const data = await api(`/api/products/${id}`, token, "DELETE");
      setInfo(data.message as string);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ngừng bán thất bại.");
    }
  }

  /** Tải ảnh lên: ảnh chung của sản phẩm (không variantId) hoặc thumbnail riêng của một SKU. */
  async function uploadImageFile(file: File, variantId?: string) {
    if (!detail) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Chỉ nhận ảnh jpg, png hoặc webp.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Mỗi ảnh tối đa 5MB.");
      return;
    }
    const form = new FormData();
    form.append("image", file);
    const path = variantId
      ? `/api/products/${detail.id}/variants/${variantId}/thumbnail`
      : `/api/products/${detail.id}/images`;
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { message?: string }).message || `Lỗi ${res.status}`);
      setInfo(variantId ? "Đã đặt thumbnail cho SKU." : "Đã tải ảnh lên.");
      await openDetail(detail.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tải ảnh thất bại.");
    }
  }

  async function handleDeleteImage(imageId: string) {
    if (!detail) return;
    if (!window.confirm("Xóa ảnh này?")) return;
    try {
      await api(`/api/product-images/${imageId}`, token, "DELETE");
      setInfo("Đã xóa ảnh.");
      await openDetail(detail.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa ảnh thất bại.");
    }
  }

  if (!canView) return <p>Bạn không có quyền xem sản phẩm.</p>;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Sản phẩm / SKU</h2>
      <p className="text-sm text-gray-500">
        Sản phẩm cha chỉ để gom nhóm — đơn vị bán và trừ kho duy nhất là SKU (biến thể).
        Sản phẩm không có biến thể luôn có đúng 1 SKU mặc định. SKU trùng do bạn nhập sẽ bị chặn,
        SKU tự sinh trùng sẽ tự thêm hậu tố -002, -003…
      </p>
      {error && <p className="alert-error">{error}</p>}
      {info && <p className="alert-success">{info}</p>}

      {view === "list" && (
        <>
          <div className="flex flex-wrap gap-2">
            <input className="field" placeholder="Tìm tên sản phẩm, SKU, mã vạch…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="field" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">Tất cả danh mục</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="field" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang bán</option>
              <option value="inactive">Ngừng bán</option>
            </select>
            <button onClick={() => { setPage(1); load(); }} className="btn btn-secondary">Tìm</button>
            {canCreate && <button onClick={() => { resetForm(); setView("form"); }} className="btn btn-primary">Thêm sản phẩm</button>}
          </div>
          {loading ? <p>Đang tải…</p> : (
            <>
              <p className="text-sm text-gray-500">Tổng: {total} sản phẩm — trang {page}/{totalPages}</p>
              <ul className="space-y-2">
                {products.map((p) => (
                  <li key={p.id} className="card-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {p.thumbnailImageId ? <ProductImg token={token} imageId={p.thumbnailImageId} className="h-14 w-14 shrink-0 rounded-lg border object-cover" /> : null}
                        <button onClick={() => openDetail(p.id)} className="text-left font-semibold text-blue-700">
                          {p.name} <span className="font-normal text-gray-500">({p.category?.name ?? "Chưa có danh mục"})</span>
                        </button>
                      </div>
                      <span className="text-sm text-gray-500">
                        <span className={p.status === "active" ? "badge badge-green" : "badge badge-gray"}>{p.status === "active" ? "Đang bán" : "Ngừng bán"}</span> · {p.variantCount} SKU · Tồn: {p.totalStock}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm">
                      {p.variants.slice(0, 5).map((v) => (
                        <li key={v.id ?? v.sku}>
                          {v.sku} — {v.variantName} — {v.sellingPrice.toLocaleString("vi-VN")}đ
                          {canViewCost && v.importPrice !== null && v.importPrice !== undefined ? ` (nhập: ${Number(v.importPrice).toLocaleString("vi-VN")}đ)` : ""}
                          {" · "}<span className={v.status === "active" ? "badge badge-green" : "badge badge-gray"}>{v.status === "active" ? "Đang bán" : "Ngừng bán"}</span> · Tồn: {v.stockQuantity ?? 0}
                          {v.isDefault ? " · Mặc định" : ""}
                        </li>
                      ))}
                      {p.variants.length > 5 && <li className="text-gray-500">… và {p.variants.length - 5} SKU khác (mở chi tiết để xem hết).</li>}
                    </ul>
                    <div className="mt-2 flex gap-2">
                      {canUpdate && <button onClick={() => openEdit(p)} className="btn btn-sm btn-secondary">Sửa</button>}
                      {canDeactivate && p.status === "active" && <button onClick={() => handleDeactivate(p.id)} className="btn btn-sm btn-secondary">Ngừng bán</button>}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn btn-sm btn-secondary disabled:opacity-50">Trang trước</button>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="btn btn-sm btn-secondary disabled:opacity-50">Trang sau</button>
              </div>
            </>
          )}
        </>
      )}

      {view === "detail" && detail && (
        <div className="space-y-3 card">
          <button onClick={() => setView("list")} className="btn btn-sm btn-secondary">← Danh sách</button>
          <h3 className="text-lg font-semibold">{detail.name}</h3>
          <p className="text-sm text-gray-600">
            Danh mục: {detail.category?.name ?? "Chưa có"} · Trạng thái: {detail.status === "active" ? "Đang bán" : "Ngừng bán"} ·
            Tổng tồn: {detail.totalStock} · {detail.variantCount} SKU
          </p>
          {detail.description && <p>{detail.description}</p>}
          <p className="text-sm text-gray-500">Tồn kho ban đầu được nhập ở Sprint Kho. Biến thể mới luôn bắt đầu với tồn 0 và chưa có transaction kho.</p>
          <div>
            <h4 className="font-semibold">Ảnh sản phẩm</h4>
            {detailCommonImages.length === 0 ? (
              <p className="text-sm text-gray-500">Chưa có ảnh.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {detailCommonImages.map((img) => (
                  <div key={img.id}>
                    <ProductImg token={token} imageId={img.id} className="h-24 w-24 rounded-lg border object-cover" />
                    {canUpdate && <button type="button" onClick={() => handleDeleteImage(img.id)} className="btn btn-sm btn-secondary mt-1 block w-full">Xóa ảnh</button>}
                  </div>
                ))}
              </div>
            )}
            {canUpdate && (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <label className="btn btn-sm btn-secondary cursor-pointer">
                  Tải ảnh lên
                  <input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImageFile(f); e.target.value = ""; }} />
                </label>
                <span className="text-xs text-gray-500">Chỉ nhận jpg, png, webp — mỗi ảnh tối đa 5MB, tối đa 10 ảnh chung.</span>
              </p>
            )}
          </div>
          <table className="table">
            <thead><tr>
              <th>Ảnh</th>
              <th>SKU</th><th>Biến thể</th>
              <th>Giá bán</th>
              {canViewCost && <th>Giá nhập</th>}
              <th>Tồn</th><th>Trạng thái</th>
            </tr></thead>
            <tbody>
              {detail.variants.map((v) => (
                <tr key={v.id ?? v.sku}>
                  <td>
                    {v.thumbnailImageId ? (
                      <ProductImg token={token} imageId={v.thumbnailImageId} className="h-12 w-12 rounded border object-cover" />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                    {canUpdate && v.id && (
                      <label className="btn btn-sm btn-secondary mt-1 block w-max cursor-pointer">
                        {v.thumbnailImageId ? "Đổi ảnh" : "Thêm ảnh"}
                        <input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImageFile(f, v.id); e.target.value = ""; }} />
                      </label>
                    )}
                  </td>
                  <td>{v.sku}</td>
                  <td>{v.variantName}{v.isDefault ? " (Mặc định)" : ""}</td>
                  <td>{v.sellingPrice.toLocaleString("vi-VN")}đ</td>
                  {canViewCost && <td>{v.importPrice !== null && v.importPrice !== undefined ? `${Number(v.importPrice).toLocaleString("vi-VN")}đ` : "—"}</td>}
                  <td>{v.stockQuantity ?? 0}</td>
                  <td><span className={v.status === "active" ? "badge badge-green" : "badge badge-gray"}>{v.status === "active" ? "Đang bán" : "Ngừng bán"}</span>{v.isSellable === false ? " (không bán được)" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-2">
            {canUpdate && <button onClick={() => openEdit(detail)} className="btn btn-sm btn-secondary">Sửa sản phẩm</button>}
            {canDeactivate && detail.status === "active" && <button onClick={() => handleDeactivate(detail.id)} className="btn btn-sm btn-secondary">Ngừng bán</button>}
          </div>
        </div>
      )}

      {view === "form" && (
        <form onSubmit={handleSave} className="space-y-4 card">
          <h3 className="font-semibold">{formId ? "Sửa sản phẩm" : "Thêm sản phẩm"}</h3>
          <label className="block">Tên sản phẩm *
            <input className="input" value={name} onChange={(e) => { clearCustomValidity(e); setName(e.target.value); }} onInvalid={(e) => e.currentTarget.setCustomValidity(invalidMessage(e.currentTarget, { missing: "Vui lòng nhập tên sản phẩm." }))} required />
          </label>
          <label className="block">Mô tả
            <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <label className="block flex-1">Danh mục có sẵn
              <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">— Chưa chọn —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block flex-1">Hoặc danh mục mới
              <input className="input" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="VD: Sách thiếu nhi" />
            </label>
          </div>
          <label className="block">Trạng thái
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Đang bán</option>
              <option value="inactive">Ngừng bán</option>
            </select>
          </label>

          <div className="flex gap-2">
            <button type="button" onClick={() => setMode("simple")} className={`btn btn-sm btn-secondary ${mode === "simple" ? "bg-blue-100" : ""}`}>Không có biến thể (1 SKU mặc định)</button>
            <button type="button" onClick={() => setMode("variants")} className={`btn btn-sm btn-secondary ${mode === "variants" ? "bg-blue-100" : ""}`}>Có biến thể</button>
          </div>

          {mode === "simple" && (
            <fieldset className="space-y-2 card-sm">
              <legend className="font-semibold">SKU mặc định</legend>
              <p className="text-sm text-gray-500">Để trống mã SKU để hệ thống tự sinh từ tên sản phẩm. Mã bạn tự nhập mà trùng sẽ bị chặn, không tự đổi.</p>
              <label className="block">Mã SKU <input className="input" value={defaultVariant.sku} onChange={(e) => setDefaultVariant({ ...defaultVariant, sku: e.target.value })} /></label>
              <label className="block">Tên biến thể <input className="input" value={defaultVariant.variantName} onChange={(e) => setDefaultVariant({ ...defaultVariant, variantName: e.target.value })} placeholder="Mặc định" /></label>
              <label className="block">Giá bán <PriceInput value={defaultVariant.sellingPrice} onChange={(v) => setDefaultVariant({ ...defaultVariant, sellingPrice: v ?? 0 })} disabled={!canUpdatePrice && !formId && false} /></label>
              {canViewCost && (
                <label className="block">Giá nhập <PriceInput value={defaultVariant.importPrice} onChange={(v) => setDefaultVariant({ ...defaultVariant, importPrice: v })} /></label>
              )}
              <label className="block">Mã vạch <input className="input" value={defaultVariant.barcode} onChange={(e) => setDefaultVariant({ ...defaultVariant, barcode: e.target.value })} /></label>
            </fieldset>
          )}

          {mode === "variants" && (
            <div className="space-y-3">
              <div className="space-y-2 card-sm">
                <h4 className="font-semibold">Nhóm thuộc tính (tối đa 3 nhóm)</h4>
                {optionGroups.map((g, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="input" placeholder="Tên nhóm, VD: Màu sắc" value={g.name} onChange={(e) => setOptionGroups(optionGroups.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                    <input className="flex-1 input" placeholder="Các giá trị cách nhau bằng dấu phẩy, VD: Đen, Trắng" value={g.valuesText} onChange={(e) => setOptionGroups(optionGroups.map((x, j) => j === i ? { ...x, valuesText: e.target.value } : x))} />
                    <button type="button" onClick={() => setOptionGroups(optionGroups.filter((_, j) => j !== i))} className="btn btn-sm btn-secondary">Xóa</button>
                  </div>
                ))}
                {optionGroups.length < 3 && (
                  <button type="button" onClick={() => setOptionGroups([...optionGroups, { name: "", valuesText: "" }])} className="btn btn-sm btn-secondary">+ Thêm nhóm thuộc tính</button>
                )}
                <button type="button" onClick={generateRows} className="btn btn-sm btn-primary">Sinh tổ hợp biến thể</button>
              </div>

              {manualVariants.length > 0 && (
                <div className="space-y-2 card-sm">
                  <h4 className="font-semibold">Bảng biến thể ({manualVariants.length} SKU, tối đa 200)</h4>
                  <div className="flex gap-2">
                    <input type="text" inputMode="numeric" className="input" placeholder="Giá bán áp dụng tất cả" value={bulkSelling} onChange={(e) => { const n = parseMoney(e.target.value); setBulkSelling(n === null ? "" : formatMoney(n)); }} />
                    {canViewCost && <input type="text" inputMode="numeric" className="input" placeholder="Giá nhập áp dụng tất cả" value={bulkImport} onChange={(e) => { const n = parseMoney(e.target.value); setBulkImport(n === null ? "" : formatMoney(n)); }} />}
                    <button type="button" onClick={applyBulk} className="btn btn-sm btn-secondary">Áp dụng cho tất cả</button>
                  </div>
                  {manualVariants.map((v, i) => (
                    <div key={i} className="flex flex-wrap gap-2 card-sm">
                      <span className="w-40 font-medium">{v.variantName}</span>
                      <input className="rounded border p-1" placeholder="SKU (để trống = tự sinh)" value={v.sku} onChange={(e) => setManualVariants(manualVariants.map((x, j) => j === i ? { ...x, sku: e.target.value } : x))} />
                      <PriceInput className="w-28 rounded border p-1" placeholder="Giá bán" value={v.sellingPrice} onChange={(n) => setManualVariants(manualVariants.map((x, j) => j === i ? { ...x, sellingPrice: n ?? 0 } : x))} />
                      {canViewCost && <PriceInput className="w-28 rounded border p-1" placeholder="Giá nhập" value={v.importPrice} onChange={(n) => setManualVariants(manualVariants.map((x, j) => j === i ? { ...x, importPrice: n } : x))} />}
                      <select className="rounded border p-1" value={v.status} onChange={(e) => setManualVariants(manualVariants.map((x, j) => j === i ? { ...x, status: e.target.value } : x))}>
                        <option value="active">Đang bán</option>
                        <option value="inactive">Ngừng bán</option>
                      </select>
                      <button type="button" onClick={() => setManualVariants(manualVariants.filter((_, j) => j !== i))} className="btn btn-sm btn-secondary">Xóa dòng</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button className="btn btn-primary">Lưu sản phẩm</button>
            <button type="button" onClick={() => setView("list")} className="btn btn-secondary">Hủy</button>
          </div>
        </form>
      )}
    </section>
  );
}
