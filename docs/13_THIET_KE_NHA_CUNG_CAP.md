# 13. Thiết kế module Nhà cung cấp (đơn nhập hàng + công nợ NCC)

- **Trạng thái:** ĐÃ DUYỆT ngày 02/11/2026 (chủ dự án duyệt thiết kế và chọn bắt đầu Sprint NCC-1). Các đề xuất §7 được duyệt nguyên trạng nếu không có ghi chú ngược lại.
- **Bối cảnh:** Đặc tả gốc (00_MASTER_CORE_SPEC §7.5) đã hoãn module này:
  "Chưa làm quản lý nhà cung cấp chuyên sâu", chỉ để ngỏ ghi chú đơn giản.
  Các mục tồn đọng khi đó: quản lý nhà cung cấp chi tiết, công nợ nhà cung
  cấp, lịch sử nhập hàng theo nhà cung cấp, báo giá nhà cung cấp.
  Ngày 02/11/2026, chủ dự án chọn làm **trọn bộ (mức 3)**: danh bạ nhà cung
  cấp + đơn nhập hàng + công nợ nhà cung cấp.
- **Schema hiện tại:** chưa có bảng nhà cung cấp nào. Module này chỉ THÊM
  bảng mới và mở rộng enum loại giao dịch kho; không sửa bảng, cột hay dữ
  liệu cũ (đơn hàng, tồn kho, nhật ký audit hiện tại giữ nguyên).

## 1. Nguyên tắc: tuân thủ 12_QUY_TAC_CHOT_CUNG

Module mới tuân thủ toàn bộ quy tắc đã chốt cứng, không ngoại lệ:

1. **SKU là đơn vị duy nhất:** mọi dòng đơn nhập đều tham chiếu
   `product_variant_id` (SKU), không nhập theo sản phẩm cha. Sản phẩm không
   biến thể dùng đúng 1 SKU mặc định như đơn bán.
2. **Mọi thay đổi kho có transaction, không trừ/hoàn 2 lần, không tồn âm:**
   nhận hàng, hủy đơn nhập sau khi nhận, trả hàng NCC đều ghi
   `inventory_transactions` trong cùng DB transaction với thay đổi tồn kho.
   Nhận hàng chỉ một lần (cờ `received`/`received_at`), hoàn kho khi hủy chỉ
   một lần (cờ `restored`/`restored_at`), trả hàng chỉ trừ phần chưa trả.
   Tồn kho không âm: trả hàng hoặc hủy sau nhận vượt quá tồn hiện tại thì
   toàn bộ thao tác bị chặn và rollback (giống đơn bán).
3. **Tiền suy ra từ payment, không sửa tay:** `paid_total` của đơn nhập =
   tổng payment NCC đang hoạt động; `debt_total = grand_total - paid_total`;
   công nợ theo NCC = tổng công nợ các đơn nhập của NCC đó. Frontend không
   được gửi paid/debt lên, backend luôn tính lại.
4. **Chống trùng:** số điện thoại NCC chuẩn hóa như khách hàng (bỏ khoảng
   trắng/chấm/gạch, `+84` → `0`) và kiểm tra trùng trong phạm vi nhà cung
   cấp + trong chính danh sách của NCC đó. SKU vẫn duy nhất toàn cục như cũ.
5. **Không xóa cứng dữ liệu đã có giao dịch:** NCC có đơn nhập thì chỉ
   ngừng hợp tác (status inactive), không xóa cứng. Payment NCC hủy thì giữ
   bản ghi kèm lý do, không xóa.
6. **Backend kiểm tra quyền:** mọi API kiểm tra đăng nhập, quyền và phạm vi
   ở backend; giá nhập và công nợ NCC được lọc theo quyền như giá nhập
   sản phẩm và công nợ khách hàng hiện tại.

## 2. Thực thể mới

### 2.1. Supplier (nhà cung cấp)

| Trường | Ghi chú |
|---|---|
| `name` | Bắt buộc. |
| `taxCode` | Mã số thuế, không bắt buộc; nếu nhập thì duy nhất (xem §7.4). |
| `email`, `address`, `note` | Không bắt buộc. |
| `status` | `active` / `inactive` (Ngừng hợp tác). |
| `createdById` | Người tạo, phục vụ phạm vi `view_own`. |

### 2.2. SupplierPhone (số điện thoại NCC)

Mirroring bảng `customer_phones`: một NCC có **không giới hạn** số điện thoại,
đúng 1 số chính (`is_primary`), có nhãn (vd: kế toán, kho). Chuẩn hóa và
kiểm tra trùng như §1.4. **Phạm vi kiểm tra trùng chỉ trong nhà cung cấp:**
một số điện thoại có thể vừa là khách hàng vừa là NCC (cùng một người/đơn
vị vừa mua vừa bán) — đó là hợp lệ, không bị chặn.

### 2.3. PurchaseOrder (đơn nhập hàng)

| Trường | Ghi chú |
|---|---|
| `code` | `NH-YYYYMMDD-XXXXXX`, sinh như mã đơn bán (`DH-...`), thử lại tối đa 5 lần khi đụng độ. |
| `supplierId` | NCC của đơn. |
| `status` | `draft` / `confirmed` / `completed` / `cancelled`, đúng 4 trạng thái như đơn bán, không thêm trạng thái vận chuyển. |
| `grandTotal`, `paidTotal`, `debtTotal`, `paymentStatus` | Tiền nguyên (đồng), `paidTotal`/`debtTotal` suy ra từ payment, không nhập tay. |
| `received`, `receivedAt`, `restored`, `restoredAt` | Cờ chống nhận/hoàn 2 lần, mirroring `inventory_deducted`/`inventory_restored` của đơn bán. |
| `note`, `createdById` | Ghi chú đơn, người tạo. |

### 2.4. PurchaseOrderItem (dòng đơn nhập)

| Trường | Ghi chú |
|---|---|
| `variantId` | SKU, bắt buộc. Dòng chỉ ghi SKU thì hợp lệ; dòng chỉ ghi sản phẩm cha thì bị chặn. |
| `quantity` | Số lượng nhập, nguyên dương. |
| `unitCost` | Đơn giá nhập **snapshot tại lúc nhận hàng** (không lấy giá hiện tại của SKU lúc xem lại). |
| `returnedQuantity` | Số lượng đã trả lại NCC, phục vụ trả hàng từng phần. |
| `lineTotal` | `quantity × unitCost` tại lúc tạo; tổng đơn tính lại từ các dòng còn lại sau mỗi lần trả hàng. |

**Không có trong v1:** chiết khấu dòng, chiết khấu đơn, phí vận chuyển, thuế
trên đơn nhập. Tổng đơn v1 = Σ số lượng × đơn giá nhập. Các khoản này là
tồn đọng, thêm sau nếu chủ dự án yêu cầu (xem §7.5).

### 2.5. SupplierPayment (thanh toán cho NCC)

Mirror hoàn toàn bảng `Payment` của đơn bán:

- Chỉ nhận `{amount, paymentMethod, note?}`; `amount` nguyên dương, method
  bắt buộc, `amount` không vượt quá công nợ còn lại.
- Chỉ thanh toán cho đơn nhập `confirmed`/`completed`; đơn nháp không trả
  tiền; không tạo payment mới khi `debt_total <= 0`.
- Hủy payment bắt buộc có lý do, lưu trường cancelled, giữ bản ghi, hủy
  trùng → 409, không bao giờ xóa cứng, không động vào tồn kho hay trạng
  thái đơn.
- Trả hàng làm `grand_total < paid_total` thì công nợ âm = **tín dụng với
  NCC**, trạng thái đơn giữ `paid`, không tự hoàn tiền (mirror quyết định
  tín dụng khách hàng đã chốt cho đơn bán). Quy trình hoàn tiền thật là tồn
  đọng riêng.

## 3. Trạng thái đơn nhập và tác động kho

Mirror đơn bán, đảo chiều kho (nhập vào thay vì trừ ra):

| Chuyển đổi | Tác động kho | Ghi chú |
|---|---|---|
| Tạo đơn nháp | Không đổi | Đơn nháp không giữ, không tăng tồn (khác đơn bán: đơn bán nháp GIỮ tồn vì hàng đã có sẵn; đơn nhập nháp chưa có hàng nên không có gì để giữ). |
| Nháp → Xác nhận (nhận hàng) | **Tăng** tồn vật lý theo từng dòng, đúng một lần | Mỗi dòng ghi 1 transaction loại `purchase_received`, lý do mặc định "Nhập hàng theo đơn NH-..." (mã đơn chính là tham chiếu, không bắt nhập lý do tay). SKU hoặc sản phẩm cha đang ngừng bán thì **chặn nhận** (mirror chặn trừ kho SKU ngừng bán). |
| Xác nhận → Hoàn thành | Không đổi tồn | Hoàn thành thì không hủy được nữa, nhưng vẫn trả hàng được (mirror đơn bán). |
| Hủy đơn nháp | Không đổi | Chưa nhận nên không có gì để hoàn. |
| Hủy đơn đã xác nhận | **Giảm** tồn theo phần chưa trả, đúng một lần | Mỗi dòng ghi 1 transaction loại `purchase_cancelled`. Nếu đã trả một phần trước đó thì chỉ hoàn phần chưa trả (mirror hủy đơn bán sau khi trả một phần). Đơn đã hoàn thành thì không hủy được. |
| Trả hàng NCC (từng phần, trên đơn confirmed/completed) | **Giảm** tồn theo số lượng trả | Mỗi dòng ghi 1 transaction loại `purchase_return`. Tổng đơn tính lại từ số lượng còn lại. Trả vượt tồn hiện tại thì chặn toàn bộ. SKU đã ngừng bán sau khi nhận thì **vẫn cho trả** (mirror cho hoàn kho đơn bán dù SKU đã ngừng bán). |

Các loại transaction kho mới (`purchase_received`, `purchase_cancelled`,
`purchase_return`) được thêm vào enum hiện có; các loại cũ
(`initial`, `import`, `export`, `adjustment_*`, `set`, `order_confirmed`,
`order_cancelled`, `return`) giữ nguyên. Phiếu nhập kho thủ công (loại
`import`, không gắn đơn nhập) vẫn tồn tại song song — cửa hàng vẫn nhập lẻ
không cần đơn nhập được.

## 4. Công nợ nhà cung cấp

- **Trang Công nợ NCC** (mirror trang Công nợ khách hàng): chỉ liệt kê đơn
  nhập `confirmed`/`completed` còn `debt_total > 0`, kèm tìm kiếm theo mã
  đơn/tên NCC, tổng công nợ và số đơn.
- **Hồ sơ NCC:** tổng công nợ = tổng công nợ các đơn nhập của NCC đó;
  tín dụng (công nợ âm do trả hàng vượt) hiển thị riêng, không trừ lẫn vào
  tổng nợ (mirror cách hiển thị credit của khách hàng).
- **Báo cáo:** Reports thêm mục "Công nợ NCC" (mua trong kỳ, đã trả, còn
  nợ, tín dụng, dòng theo từng NCC), mirror báo cáo công nợ khách hàng.
  Dashboard **chưa** thêm thẻ NCC trong v1 (xem §7.6).

## 5. Phân quyền mặc định (đề xuất)

Đổi mặc định = sửa permission seed + re-seed, như các module trước.

| Quyền | Admin | Quản lý | Kho | Kế toán | Bán hàng |
|---|---|---|---|---|---|
| `supplier.view_all` / `supplier.view_own` | all | all | — | all | all (chỉ xem danh bạ) |
| `supplier.create`, `supplier.update` | ✓ | ✓ | — | — | — |
| `supplier.deactivate` | ✓ | — | — | — | — |
| `purchase.view_all` | ✓ | ✓ | ✓ | ✓ | — |
| `purchase.create`, `purchase.confirm` (nhận hàng) | ✓ | ✓ | ✓ (chỉ confirm) | — | — |
| `purchase.complete`, `purchase.cancel`, `purchase.return` | ✓ | — | — | — | — |
| `supplier_payment.create` | ✓ | ✓ | — | ✓ | — |
| `supplier_payment.cancel` | ✓ | — | — | ✓ | — |

Lý do phân vai: nhận hàng là việc của kho nên Kho được confirm; hủy/hoàn
thành/trả hàng là quyết định quản trị nên chỉ Admin; kế toán tạo và hủy
payment (mirror kế toán hủy payment đơn bán).

## 6. Audit, Import/Export

- **Audit:** ghi log cho tạo/cập nhật/ngừng hợp tác NCC, thêm/xóa số điện
  thoại NCC, tạo/xác nhận/hoàn thành/hủy/trả hàng đơn nhập, tạo/hủy payment
  NCC. Cùng cơ chế redaction như hiện tại; không có route sửa/xóa audit.
- **Import/Export:** import NCC bằng CSV theo đúng mẫu 2 bước
  preview → xác nhận (cột: name, phones, email, address, tax_code, status,
  note; trùng số trong file hoặc với NCC khác → dòng không hợp lệ; mã số
  thuế trùng → dòng không hợp lệ). Export NCC và export đơn nhập (lọc cột
  theo quyền, tên file `export-suppliers-...` / `export-purchases-...`).
  **Không** import đơn nhập bằng CSV (đơn nhập tạo trên giao diện).

## 7. Các quyết định cần chủ dự án chốt (đề xuất của Muse)

| # | Vấn đề | Đề xuất (mặc định nếu duyệt) |
|---|---|---|
| 7.1 | Nhận hàng từng đợt (một đơn nhập nhận làm nhiều lần) | **KHÔNG có trong v1.** Xác nhận = nhận đủ toàn bộ. Muốn nhận một phần thì sửa đơn nháp cho khớp số lượng thực nhận rồi mới xác nhận. Nhận từng đợt làm sprint riêng sau nếu cần. |
| 7.2 | Nhận hàng có tự cập nhật giá nhập hiện tại của SKU không | **KHÔNG.** Đơn nhập chỉ lưu snapshot giá của đợt đó. Giá nhập hiện tại của SKU vẫn do người dùng sửa tay, tránh ghi đè lặng lẽ làm sai báo cáo lãi ước tính. |
| 7.3 | Trùng số điện thoại kiểm tra phạm vi nào | **Chỉ trong nhà cung cấp** (kể cả trùng trong chính danh sách của NCC đó). Một số vừa là khách vừa là NCC là hợp lệ. |
| 7.4 | Mã số thuế trùng nhau | **Nếu nhập thì phải duy nhất**, vì MST định danh một doanh nghiệp. Để trống thì không kiểm tra. |
| 7.5 | Chiết khấu/thuế/phí trên đơn nhập | **Chưa có trong v1.** Tổng đơn = Σ số lượng × đơn giá nhập. Thêm sau nếu cần. |
| 7.6 | Dashboard có thêm thẻ NCC không | **Chưa trong v1.** Chỉ thêm báo cáo công nợ NCC ở Reports. Thêm thẻ Dashboard sau nếu cần. |

## 8. Kế hoạch sprint (duyệt từng sprint ở mức code như trước)

1. **Sprint NCC-1 — Danh bạ:** Supplier + SupplierPhone, quyền, audit,
   giao diện danh sách/chi tiết, kiểm chứng ở mức code.
2. **Sprint NCC-2 — Đơn nhập:** PurchaseOrder + lines + nhận/hủy/hoàn
   thành/trả hàng + transaction kho mới, kiểm chứng ở mức code.
3. **Sprint NCC-3 — Thanh toán + công nợ NCC:** SupplierPayment + trang
   công nợ NCC + hồ sơ NCC, kiểm chứng ở mức code.
4. **Sprint NCC-4 — Tích hợp:** báo cáo công nợ NCC + import/export NCC
   và đơn nhập, kiểm chứng ở mức code.
5. **Kiểm chứng bằng database thật** theo checklist từng điểm (tạo NCC,
   trùng số, tạo đơn nháp, nhận hàng tăng tồn đúng một lần, hủy sau nhận
   hoàn tồn đúng phần chưa trả, trả hàng từng phần, chặn trả vượt tồn,
   chặn thanh toán đơn nháp, chặn trả thừa, hủy payment cần lý do, đối
   chiếu công nợ giữa chi tiết đơn, danh sách đơn và trang công nợ NCC),
   rồi mới coi module là xong.
