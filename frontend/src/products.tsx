import { useCallback, useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface Category {
  id: string;
  name: string;
  productCount?: number;
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
    const selling = bulkSelling === "" ? null : Number(bulkSelling);
    const importing = bulkImport === "" ? null : Number(bulkImport);
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

  if (!canView) return <p>Bạn không có quyền xem sản phẩm.</p>;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Sản phẩm / SKU</h2>
      <p className="text-sm text-gray-500">
        Sản phẩm cha chỉ để gom nhóm — đơn vị bán và trừ kho duy nhất là SKU (biến thể).
        Sản phẩm không có biến thể luôn có đúng 1 SKU mặc định. SKU trùng do bạn nhập sẽ bị chặn,
        SKU tự sinh trùng sẽ tự thêm hậu tố -002, -003…
      </p>
      {error && <p className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
      {info && <p className="rounded border border-green-300 bg-green-50 p-3 text-green-800">{info}</p>}

      {view === "list" && (
        <>
          <div className="flex flex-wrap gap-2">
            <input className="rounded border p-2" placeholder="Tìm tên sản phẩm, SKU, mã vạch…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="rounded border p-2" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">Tất cả danh mục</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="rounded border p-2" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang bán</option>
              <option value="inactive">Ngừng bán</option>
            </select>
            <button onClick={() => { setPage(1); load(); }} className="rounded border px-4 py-2">Tìm</button>
            {canCreate && <button onClick={() => { resetForm(); setView("form"); }} className="rounded bg-blue-600 px-4 py-2 text-white">Thêm sản phẩm</button>}
          </div>
          {loading ? <p>Đang tải…</p> : (
            <>
              <p className="text-sm text-gray-500">Tổng: {total} sản phẩm — trang {page}/{totalPages}</p>
              <ul className="space-y-2">
                {products.map((p) => (
                  <li key={p.id} className="rounded border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button onClick={() => openDetail(p.id)} className="text-left font-semibold text-blue-700">
                        {p.name} <span className="font-normal text-gray-500">({p.category?.name ?? "Chưa có danh mục"})</span>
                      </button>
                      <span className="text-sm text-gray-500">
                        {p.status === "active" ? "Đang bán" : "Ngừng bán"} · {p.variantCount} SKU · Tồn: {p.totalStock}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm">
                      {p.variants.slice(0, 5).map((v) => (
                        <li key={v.id ?? v.sku}>
                          {v.sku} — {v.variantName} — {v.sellingPrice.toLocaleString("vi-VN")}đ
                          {canViewCost && v.importPrice !== null && v.importPrice !== undefined ? ` (nhập: ${Number(v.importPrice).toLocaleString("vi-VN")}đ)` : ""}
                          {" · "}{v.status === "active" ? "Đang bán" : "Ngừng bán"} · Tồn: {v.stockQuantity ?? 0}
                          {v.isDefault ? " · Mặc định" : ""}
                        </li>
                      ))}
                      {p.variants.length > 5 && <li className="text-gray-500">… và {p.variants.length - 5} SKU khác (mở chi tiết để xem hết).</li>}
                    </ul>
                    <div className="mt-2 flex gap-2">
                      {canUpdate && <button onClick={() => openEdit(p)} className="rounded border px-3 py-1">Sửa</button>}
                      {canDeactivate && p.status === "active" && <button onClick={() => handleDeactivate(p.id)} className="rounded border px-3 py-1">Ngừng bán</button>}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-50">Trang trước</button>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-50">Trang sau</button>
              </div>
            </>
          )}
        </>
      )}

      {view === "detail" && detail && (
        <div className="space-y-3 rounded border p-4">
          <button onClick={() => setView("list")} className="rounded border px-3 py-1">← Danh sách</button>
          <h3 className="text-lg font-semibold">{detail.name}</h3>
          <p className="text-sm text-gray-600">
            Danh mục: {detail.category?.name ?? "Chưa có"} · Trạng thái: {detail.status === "active" ? "Đang bán" : "Ngừng bán"} ·
            Tổng tồn: {detail.totalStock} · {detail.variantCount} SKU
          </p>
          {detail.description && <p>{detail.description}</p>}
          <p className="text-sm text-gray-500">Tồn kho ban đầu được nhập ở Sprint Kho. Biến thể mới luôn bắt đầu với tồn 0 và chưa có transaction kho.</p>
          <table className="w-full text-sm">
            <thead><tr className="text-left">
              <th className="border-b p-2">SKU</th><th className="border-b p-2">Biến thể</th>
              <th className="border-b p-2">Giá bán</th>
              {canViewCost && <th className="border-b p-2">Giá nhập</th>}
              <th className="border-b p-2">Tồn</th><th className="border-b p-2">Trạng thái</th>
            </tr></thead>
            <tbody>
              {detail.variants.map((v) => (
                <tr key={v.id ?? v.sku}>
                  <td className="border-b p-2">{v.sku}</td>
                  <td className="border-b p-2">{v.variantName}{v.isDefault ? " (Mặc định)" : ""}</td>
                  <td className="border-b p-2">{v.sellingPrice.toLocaleString("vi-VN")}đ</td>
                  {canViewCost && <td className="border-b p-2">{v.importPrice !== null && v.importPrice !== undefined ? `${Number(v.importPrice).toLocaleString("vi-VN")}đ` : "—"}</td>}
                  <td className="border-b p-2">{v.stockQuantity ?? 0}</td>
                  <td className="border-b p-2">{v.status === "active" ? "Đang bán" : "Ngừng bán"}{v.isSellable === false ? " (không bán được)" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-2">
            {canUpdate && <button onClick={() => openEdit(detail)} className="rounded border px-3 py-1">Sửa sản phẩm</button>}
            {canDeactivate && detail.status === "active" && <button onClick={() => handleDeactivate(detail.id)} className="rounded border px-3 py-1">Ngừng bán</button>}
          </div>
        </div>
      )}

      {view === "form" && (
        <form onSubmit={handleSave} className="space-y-4 rounded border p-4">
          <h3 className="font-semibold">{formId ? "Sửa sản phẩm" : "Thêm sản phẩm"}</h3>
          <label className="block">Tên sản phẩm *
            <input className="mt-1 w-full rounded border p-2" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block">Mô tả
            <textarea className="mt-1 w-full rounded border p-2" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <label className="block flex-1">Danh mục có sẵn
              <select className="mt-1 w-full rounded border p-2" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">— Chưa chọn —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block flex-1">Hoặc danh mục mới
              <input className="mt-1 w-full rounded border p-2" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="VD: Sách thiếu nhi" />
            </label>
          </div>
          <label className="block">Trạng thái
            <select className="mt-1 rounded border p-2" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Đang bán</option>
              <option value="inactive">Ngừng bán</option>
            </select>
          </label>

          <div className="flex gap-2">
            <button type="button" onClick={() => setMode("simple")} className={`rounded border px-3 py-1 ${mode === "simple" ? "bg-blue-100" : ""}`}>Không có biến thể (1 SKU mặc định)</button>
            <button type="button" onClick={() => setMode("variants")} className={`rounded border px-3 py-1 ${mode === "variants" ? "bg-blue-100" : ""}`}>Có biến thể</button>
          </div>

          {mode === "simple" && (
            <fieldset className="space-y-2 rounded border p-3">
              <legend className="font-semibold">SKU mặc định</legend>
              <p className="text-sm text-gray-500">Để trống mã SKU để hệ thống tự sinh từ tên sản phẩm. Mã bạn tự nhập mà trùng sẽ bị chặn, không tự đổi.</p>
              <label className="block">Mã SKU <input className="mt-1 w-full rounded border p-2" value={defaultVariant.sku} onChange={(e) => setDefaultVariant({ ...defaultVariant, sku: e.target.value })} /></label>
              <label className="block">Tên biến thể <input className="mt-1 w-full rounded border p-2" value={defaultVariant.variantName} onChange={(e) => setDefaultVariant({ ...defaultVariant, variantName: e.target.value })} placeholder="Mặc định" /></label>
              <label className="block">Giá bán <input type="number" min="0" className="mt-1 w-full rounded border p-2" value={defaultVariant.sellingPrice} onChange={(e) => setDefaultVariant({ ...defaultVariant, sellingPrice: Number(e.target.value) })} disabled={!canUpdatePrice && !formId && false} /></label>
              {canViewCost && (
                <label className="block">Giá nhập <input type="number" min="0" className="mt-1 w-full rounded border p-2" value={defaultVariant.importPrice ?? ""} onChange={(e) => setDefaultVariant({ ...defaultVariant, importPrice: e.target.value === "" ? null : Number(e.target.value) })} /></label>
              )}
              <label className="block">Mã vạch <input className="mt-1 w-full rounded border p-2" value={defaultVariant.barcode} onChange={(e) => setDefaultVariant({ ...defaultVariant, barcode: e.target.value })} /></label>
            </fieldset>
          )}

          {mode === "variants" && (
            <div className="space-y-3">
              <div className="space-y-2 rounded border p-3">
                <h4 className="font-semibold">Nhóm thuộc tính (tối đa 3 nhóm)</h4>
                {optionGroups.map((g, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="rounded border p-2" placeholder="Tên nhóm, VD: Màu sắc" value={g.name} onChange={(e) => setOptionGroups(optionGroups.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                    <input className="flex-1 rounded border p-2" placeholder="Các giá trị cách nhau bằng dấu phẩy, VD: Đen, Trắng" value={g.valuesText} onChange={(e) => setOptionGroups(optionGroups.map((x, j) => j === i ? { ...x, valuesText: e.target.value } : x))} />
                    <button type="button" onClick={() => setOptionGroups(optionGroups.filter((_, j) => j !== i))} className="rounded border px-2">Xóa</button>
                  </div>
                ))}
                {optionGroups.length < 3 && (
                  <button type="button" onClick={() => setOptionGroups([...optionGroups, { name: "", valuesText: "" }])} className="rounded border px-3 py-1">+ Thêm nhóm thuộc tính</button>
                )}
                <button type="button" onClick={generateRows} className="rounded bg-blue-600 px-3 py-1 text-white">Sinh tổ hợp biến thể</button>
              </div>

              {manualVariants.length > 0 && (
                <div className="space-y-2 rounded border p-3">
                  <h4 className="font-semibold">Bảng biến thể ({manualVariants.length} SKU, tối đa 200)</h4>
                  <div className="flex gap-2">
                    <input type="number" min="0" className="rounded border p-2" placeholder="Giá bán áp dụng tất cả" value={bulkSelling} onChange={(e) => setBulkSelling(e.target.value)} />
                    {canViewCost && <input type="number" min="0" className="rounded border p-2" placeholder="Giá nhập áp dụng tất cả" value={bulkImport} onChange={(e) => setBulkImport(e.target.value)} />}
                    <button type="button" onClick={applyBulk} className="rounded border px-3 py-1">Áp dụng cho tất cả</button>
                  </div>
                  {manualVariants.map((v, i) => (
                    <div key={i} className="flex flex-wrap gap-2 rounded border p-2">
                      <span className="w-40 font-medium">{v.variantName}</span>
                      <input className="rounded border p-1" placeholder="SKU (để trống = tự sinh)" value={v.sku} onChange={(e) => setManualVariants(manualVariants.map((x, j) => j === i ? { ...x, sku: e.target.value } : x))} />
                      <input type="number" min="0" className="w-28 rounded border p-1" placeholder="Giá bán" value={v.sellingPrice} onChange={(e) => setManualVariants(manualVariants.map((x, j) => j === i ? { ...x, sellingPrice: Number(e.target.value) } : x))} />
                      {canViewCost && <input type="number" min="0" className="w-28 rounded border p-1" placeholder="Giá nhập" value={v.importPrice ?? ""} onChange={(e) => setManualVariants(manualVariants.map((x, j) => j === i ? { ...x, importPrice: e.target.value === "" ? null : Number(e.target.value) } : x))} />}
                      <select className="rounded border p-1" value={v.status} onChange={(e) => setManualVariants(manualVariants.map((x, j) => j === i ? { ...x, status: e.target.value } : x))}>
                        <option value="active">Đang bán</option>
                        <option value="inactive">Ngừng bán</option>
                      </select>
                      <button type="button" onClick={() => setManualVariants(manualVariants.filter((_, j) => j !== i))} className="rounded border px-2">Xóa dòng</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button className="rounded bg-blue-600 px-4 py-2 text-white">Lưu sản phẩm</button>
            <button type="button" onClick={() => setView("list")} className="rounded border px-4 py-2">Hủy</button>
          </div>
        </form>
      )}
    </section>
  );
}
