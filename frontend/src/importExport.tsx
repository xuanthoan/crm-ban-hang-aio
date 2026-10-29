import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface PreviewRow {
  row_number: number;
  valid: boolean;
  errors: string[];
  data: Record<string, unknown>;
}

interface PreviewResult {
  preview_id: string;
  entity: string;
  total_rows: number;
  valid_count: number;
  invalid_count: number;
  rows: PreviewRow[];
}

async function downloadCsv(path: string, token: string, filename: string) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || `Lỗi ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportExportPage({ token, permissions }: { token: string; permissions: string[] }) {
  const [importEntity, setImportEntity] = useState<"customers" | "products">("customers");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [exportEntity, setExportEntity] = useState<"customers" | "products" | "orders" | "inventory">("customers");
  const [exportQ, setExportQ] = useState("");

  const canImportCustomers = permissions.includes("customer.import");
  const canImportProducts = permissions.includes("product.import");
  const canExportCustomers = permissions.includes("customer.export");
  const canExportProducts = permissions.includes("product.export");
  const canExportOrders = permissions.includes("order.export");
  const canExportInventory = permissions.includes("inventory.view");

  async function handleTemplate() {
    setError("");
    try {
      await downloadCsv(`/api/import/templates/${importEntity}`, token, `template-${importEntity}.csv`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tải file mẫu thất bại.");
    }
  }

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Hãy chọn file CSV trước.");
      return;
    }
    setError("");
    setResult("");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/api/import/${importEntity}/preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { message?: string }).message || `Lỗi ${res.status}`);
      setPreview(data as PreviewResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/import/${preview.entity}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ preview_id: preview.preview_id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { message?: string }).message || `Lỗi ${res.status}`);
      const skipped = (data.skipped as { row_number: number; errors: string[] }[]) ?? [];
      setResult(
        `Đã nhập ${data.imported_count} dòng, bỏ qua ${data.skipped_count} dòng (tổng ${data.total_rows} dòng).` +
          (skipped.length > 0
            ? ` Các dòng bị bỏ qua: ${skipped.map((s) => `dòng ${s.row_number} (${s.errors.join("; ")})`).join(" | ")}`
            : ""),
      );
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xác nhận nhập thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    setError("");
    setResult("");
    try {
      const params = new URLSearchParams();
      if (exportQ.trim()) params.set("q", exportQ.trim());
      const query = params.toString();
      await downloadCsv(
        `/api/export/${exportEntity}${query ? `?${query}` : ""}`,
        token,
        `${exportEntity}-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      setResult(`Đã tải file export ${exportEntity}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export thất bại.");
    }
  }

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Import / Export (CSV UTF-8)</h2>
      <p className="text-sm text-gray-600">
        Import luôn qua 2 bước: preview (chỉ kiểm tra, chưa ghi dữ liệu) rồi xác nhận mới nhập các dòng hợp lệ.
        File tối đa 1000 dòng và 5MB. Định dạng .xlsx thật là tồn đọng sau này, sprint này chỉ làm CSV.
      </p>
      {error && <p className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
      {result && <p className="rounded border border-green-300 bg-green-50 p-3 text-green-800">{result}</p>}

      {(canImportCustomers || canImportProducts) && (
        <div className="space-y-3 rounded border p-4">
          <h3 className="font-semibold">Import</h3>
          <div className="flex flex-wrap items-center gap-2">
            <select className="rounded border p-2" value={importEntity} onChange={(e) => { setImportEntity(e.target.value as "customers" | "products"); setPreview(null); }}>
              {canImportCustomers && <option value="customers">Khách hàng</option>}
              {canImportProducts && <option value="products">Sản phẩm / SKU</option>}
            </select>
            <button type="button" onClick={handleTemplate} className="rounded border px-4 py-2">Tải file mẫu</button>
          </div>
          {importEntity === "customers" && (
            <p className="text-sm text-gray-600">
              Cột: name, phones (nhiều số ngăn cách bằng ; hoặc |), email, address, source, tags (ngăn cách bằng ;), status, note.
              Cần có tên hoặc ít nhất một số. Số trùng trong file hoặc với khách khác đều làm dòng đó không hợp lệ.
            </p>
          )}
          {importEntity === "products" && (
            <p className="text-sm text-gray-600">
              Cột: product_name, category, sku, variant_name, attributes (dạng color:Đen;size:S), sell_price, import_price, barcode, status.
              Các dòng cùng tên sản phẩm + danh mục được gom thành một sản phẩm cha với nhiều biến thể. SKU để trống sẽ tự sinh;
              SKU tự nhập mà trùng thì dòng đó không hợp lệ và hệ thống không tự đổi mã của bạn.
            </p>
          )}
          <form onSubmit={handlePreview} className="flex flex-wrap items-center gap-2">
            <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <button disabled={busy} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
              {busy ? "Đang kiểm tra…" : "Preview"}
            </button>
          </form>
          {preview && (
            <div>
              <p>
                Preview: tổng {preview.total_rows} dòng — hợp lệ {preview.valid_count}, không hợp lệ {preview.invalid_count}.
                Chỉ các dòng hợp lệ mới được nhập khi bạn xác nhận.
              </p>
              <table className="mt-2 w-full border-collapse border text-sm">
                <thead>
                  <tr>
                    <th className="border p-2 text-left">Dòng</th>
                    <th className="border p-2 text-left">Trạng thái</th>
                    <th className="border p-2 text-left">Lỗi / dữ liệu</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.row_number}>
                      <td className="border p-2">{row.row_number}</td>
                      <td className="border p-2">{row.valid ? "Hợp lệ" : "Không hợp lệ"}</td>
                      <td className="border p-2">{row.valid ? JSON.stringify(row.data) : row.errors.join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button disabled={busy || preview.valid_count === 0} onClick={handleConfirm} className="mt-3 rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50">
                Xác nhận nhập {preview.valid_count} dòng hợp lệ
              </button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 rounded border p-4">
        <h3 className="font-semibold">Export</h3>
        <p className="text-sm text-gray-600">
          Các cột nhạy cảm được lọc ở backend theo quyền của bạn: không có quyền xem giá nhập thì file sản phẩm không có cột
          import_price; không có quyền xem công nợ/doanh thu thì file đơn hàng không có các cột tiền. Export toàn bộ khách hàng
          chỉ dành cho người có quyền export khách.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select className="rounded border p-2" value={exportEntity} onChange={(e) => setExportEntity(e.target.value as typeof exportEntity)}>
            {canExportCustomers && <option value="customers">Khách hàng</option>}
            {canExportProducts && <option value="products">Sản phẩm / SKU</option>}
            {canExportOrders && <option value="orders">Đơn hàng</option>}
            {canExportInventory && <option value="inventory">Tồn kho</option>}
          </select>
          <input className="rounded border p-2" placeholder="Từ khóa tìm kiếm (tên/SKU)" value={exportQ} onChange={(e) => setExportQ(e.target.value)} />
          <button type="button" onClick={handleExport} className="rounded bg-blue-600 px-4 py-2 text-white">Tải CSV</button>
        </div>
      </div>
    </section>
  );
}
