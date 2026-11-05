# THIẾT KẾ NHIỀU KHO (Multi-Warehouse)

> Tài liệu thiết kế trình chủ dự án duyệt trước khi triển khai.
> Ngày viết: 2026-11-04. Trạng thái: **CHỜ DUYỆT**.
> Căn cứ: code hiện tại trên GitHub (main, sau commit e5ad0b6) và quy tắc chốt cứng docs/12.

## 1. Bối cảnh và nhu cầu

Hiện tại phần mềm chỉ có **một kho ngầm định**:

- `InventoryItem.variantId` là duy nhất: mỗi SKU chỉ có đúng một dòng tồn, một con số toàn cục.
- `warehouseCode` chỉ là nhãn ghi cứng `"MAIN"`, không phải kho thật. Chính ghi chú trong schema đã viết: multi-warehouse nằm ngoài phạm vi MVP.
- Giữ kho của đơn nháp, trừ kho khi xác nhận, hoàn kho khi hủy/trả đều tính trên tồn toàn cục của SKU, không có chiều kho.
- Form tạo đơn không có chỗ chọn kho; trang Kho không có lọc theo kho.

Nhu cầu chủ dự án nêu ngày 2026-11-04: **khi bán hàng, tạo đơn có thể chọn sản phẩm ở các kho khác nhau** — tức một đơn bán có thể lấy hàng từ nhiều kho, mỗi dòng đơn gắn với một kho cụ thể.

## 2. Phạm vi v1 và ngoài phạm vi

**Trong v1:**

- Thực thể Kho: tạo/sửa/ngừng/hard delete (khi chưa có dữ liệu liên quan), 1 kho mặc định.
- Tồn kho theo từng cặp SKU × kho: xem, lọc, nhập/xuất/điều chỉnh/tồn đầu theo kho, lịch sử giao dịch theo kho.
- Đơn bán: chọn kho theo từng dòng; giữ/trừ/hoàn kho tính riêng theo từng kho.
- Đơn nhập: chọn kho đích theo đơn (1 kho cho cả đơn); nhận/hủy/trả vào đúng kho đích.
- Chuyển kho: chuyển hàng giữa 2 kho (cặp giao dịch xuất/nhập nguyên tử, kèm lý do).
- Migration chuyển toàn bộ tồn kho và lịch sử hiện tại về kho mặc định, không mất số liệu.

**Ngoài v1 (ghi nhận làm sau nếu cần):**

- Phân quyền xem kho theo từng kho: v1 mọi người xem được kho đều thấy tất cả các kho.
- Báo cáo/Dashboard theo kho: v1 Dashboard và Báo cáo vẫn tính toàn cục như cũ (tổng tồn, giá trị tồn toàn hệ thống); xem tồn theo kho đã có ở trang Kho.
- Đơn nhập tách kho đích theo từng dòng (v1: 1 kho đích cho cả đơn).
- Cột kho trong file CSV import/export (v1: import sản phẩm mới vẫn tạo dòng tồn 0 ở kho mặc định; không có import tồn kho bằng CSV).

## 3. Mô hình dữ liệu

### 3.1. Bảng mới `Warehouse`

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | cuid | Khóa chính |
| code | String @unique | Mã kho do người dùng nhập, trim + viết hoa (theo quy ước mã SKU), ví dụ `KHO-CHINH`, `KHO-PHU` |
| name | String | Tên kho, bắt buộc, ví dụ "Kho chính", "Cửa hàng" |
| address | String? | Địa chỉ kho, tùy chọn |
| note | String? | Ghi chú, tùy chọn |
| status | WarehouseStatus @default(active) | `active` / `inactive` |
| isDefault | Boolean @default(false) | Đúng 1 kho mặc định tại một thời điểm |
| createdById | String? | Người tạo (để tra cứu; v1 không phân phạm vi kho theo người tạo — xem mục 6) |
| createdAt / updatedAt | DateTime | Như các bảng khác |

### 3.2. Thay đổi bảng hiện có

- **`InventoryItem`**: bỏ cột nhãn `warehouseCode`; thêm `warehouseId` (FK → Warehouse, bắt buộc sau migration); unique đổi từ `variantId` thành `@@unique([warehouseId, variantId])`. `quantity` và `reservedQuantity` giữ nguyên ý nghĩa nhưng tính **theo từng kho**: tồn khả dụng của một SKU tại một kho = `quantity - reservedQuantity` của dòng đó.
- **`InventoryTransaction`**: thêm `warehouseId` (FK → Warehouse, bắt buộc sau backfill). Hiện bảng này chưa có chiều kho nào. Thêm 2 loại giao dịch mới vào enum `InventoryTransactionType`: `transfer_out` (xuất chuyển kho) và `transfer_in` (nhập chuyển kho).
- **`OrderItem`**: thêm `warehouseId` (FK → Warehouse, bắt buộc sau backfill). Đây là kho mà dòng đơn đó lấy hàng.
- **`PurchaseOrder`**: thêm `destinationWarehouseId` (FK → Warehouse, bắt buộc sau backfill). Đây là kho đích nhận hàng của cả đơn.
- **`PurchaseOrderItem`**: không thêm cột — kho đích lấy từ đơn nhập cha.
- **`Order` và `PurchaseOrder`**: không thêm cột kho ở cấp đơn bán (vì đơn bán lấy hàng từ nhiều kho, kho nằm ở từng dòng).

### 3.3. Migration và chuyển đổi dữ liệu cũ

Migration SQL gồm 2 phần: đổi schema (như mục 3.2) và chuyển dữ liệu:

1. Seed tạo kho mặc định nếu chưa có: code `MAIN`, tên "Kho chính", `isDefault = true`.
2. Mọi `InventoryItem` hiện có → `warehouseId` = kho mặc định (số lượng và số đang giữ nguyên vẹn, kể cả đơn nháp đang giữ hàng).
3. Mọi `InventoryTransaction` hiện có → `warehouseId` = kho mặc định (lịch sử không mất, chỉ gắn thêm kho).
4. Mọi `OrderItem` hiện có (kể cả đơn nháp đang giữ hàng) → `warehouseId` = kho mặc định, để giữ kho đang giữ khớp đúng kho.
5. Mọi `PurchaseOrder` hiện có → `destinationWarehouseId` = kho mặc định (đơn nháp vẫn sửa được kho đích; đơn đã nhận thì kho đích chỉ còn ý nghĩa lịch sử).
6. Xóa cột `warehouseCode` sau khi chuyển xong (nó chỉ là nhãn, không mang dữ liệu thật).

Quy tắc chốt cứng §2 vẫn giữ nguyên, chỉ đổi phạm vi áp dụng: **mọi kiểm tra tồn âm, trừ/hoàn trùng, giữ kho đều tính theo từng cặp SKU × kho**, không tính toàn cục nữa. Một SKU có thể hết ở kho A nhưng vẫn bán được từ kho B.

## 4. Luật nghiệp vụ

### 4.1. Kho mặc định

- Luôn có đúng 1 kho mặc định. Form đơn bán và đơn nhập mặc định chọn kho mặc định, người dùng đổi được theo dòng (đơn bán) hoặc theo đơn (đơn nhập).
- Không được ngừng kho mặc định khi chưa chọn kho mặc định khác (chặn ở backend, kèm thông báo rõ ràng).
- Đổi kho mặc định: Admin/Manager chọn kho khác làm mặc định; kho cũ tự bỏ cờ trong cùng transaction.

### 4.2. Kho ngừng hoạt động (mirror quy tắc SKU ngừng bán)

- Kho ngừng hoạt động thì **chặn**: dòng đơn bán mới lấy hàng từ kho đó, nhận hàng đơn nhập vào kho đó, nhập/xuất/tồn đầu vào kho đó.
- Kho ngừng hoạt động thì **vẫn cho phép**: hoàn kho khi hủy/trả đơn (hàng phải về đúng kho nó đã lấy đi), điều chỉnh kho kèm lý do (kiểm kê), chuyển kho **đi** khỏi kho đó (để dọn kho).
- Chuyển kho **đến** kho ngừng hoạt động thì chặn (giống nhập kho vào kho ngừng).

### 4.3. SKU ngừng bán

Không đổi: SKU ngừng bán vẫn chặn trừ kho ở mọi kho (kiểm tra ở `deductForOrder` như cũ), nhưng vẫn cho hoàn kho nếu SKU ngừng sau khi bán. Hai lớp chặn (SKU ngừng, kho ngừng) kiểm tra độc lập, vi phạm lớp nào báo lớp đó.

### 4.4. Kho và xóa dữ liệu

- Ngừng hợp tác (deactivate): Admin/Manager, bất cứ lúc nào, tồn kho trong kho đó giữ nguyên (chỉ đóng băng xuất mới theo mục 4.2).
- Xóa cứng: chỉ Admin, chỉ kho chưa có dòng tồn, giao dịch hay dòng đơn nào tham chiếu tới; có dữ liệu liên quan → 409 (mirror xóa cứng nhà cung cấp). Mọi thao tác kho đều ghi audit.

## 5. Luồng nghiệp vụ chi tiết

### 5.1. Trang Kho

- Bảng tồn chuyển từ mỗi dòng một SKU thành **mỗi dòng một cặp SKU × kho**, thêm cột Kho và bộ lọc kho (mặc định "Tất cả các kho").
- Các nút trên dòng (Lịch sử, Tồn ban đầu, Nhập, Xuất, Điều chỉnh) thao tác trên đúng kho của dòng đó.
- Form thao tác hàng loạt: thêm ô chọn kho áp dụng chung cho tất cả các dòng trong lần thao tác đó (giữ nguyên quy ước cũ: một loại thao tác cho tất cả các dòng, lỗi 1 dòng thì hủy toàn bộ).
- Lịch sử giao dịch của SKU lọc thêm được theo kho; mỗi giao dịch hiện kho của nó.
- Tồn đầu (`initial`): chỉ được nhập 1 lần cho mỗi cặp SKU × kho (mirror quy tắc cũ: 1 lần mỗi SKU, nay là mỗi cặp).
- Thẻ "Danh sách kho" đặt ngay trên trang Kho (không thêm mục nav mới): liệt kê kho, tạo/sửa/ngừng, đặt mặc định, xóa cứng — các nút theo quyền mục 6.

### 5.2. Đơn bán (thay đổi lớn nhất)

- Form tạo/sửa đơn nháp: mỗi dòng có thêm ô chọn kho. Ô chọn kho hiện tồn khả dụng của SKU đó tại từng kho (ví dụ "Kho chính (khả dụng 112)"), mặc định là kho mặc định. Chỉ kho đang hoạt động mới chọn được.
- Kiểm tra khi lưu nháp: số lượng dòng ≤ tồn khả dụng **tại kho đã chọn** (không phải tồn toàn cục). Lỗi báo rõ SKU + tên kho + tồn khả dụng tại kho đó.
- Giữ kho của nháp: `reserveStock`/`releaseReservation` làm việc theo cặp (SKU, kho); `aggregateLines` gộp theo cặp thay vì theo SKU. Sửa nháp: giải phóng giữ cũ và giữ mới nguyên tử như cũ, nay theo từng kho.
- Xác nhận: `deductForOrder` trừ đúng kho của từng dòng, đúng 1 lần (cờ `inventory_deducted` như cũ); SKU ngừng hoặc kho ngừng tại thời điểm xác nhận → chặn toàn bộ đơn.
- Hủy đơn đã xác nhận / trả hàng: hoàn kho **về đúng kho của dòng đó** (kể cả khi kho đó đã ngừng sau khi bán — mirror quy tắc hoàn kho cho SKU ngừng).
- Chi tiết đơn: mỗi dòng hiện kho lấy hàng. Mã đơn, trạng thái, thanh toán, công nợ không đổi.

### 5.3. Đơn nhập

- Form tạo đơn nháp: thêm ô chọn kho đích (kho đang hoạt động, mặc định là kho mặc định). Sửa nháp được đổi kho đích; sau khi xác nhận thì khóa (đơn đã nhận không đổi kho đích).
- Xác nhận = nhận đủ toàn bộ vào **kho đích** (transaction `purchase_received` mang `warehouseId` kho đích, qua inventory service như cũ).
- Hủy đơn đã nhận: hoàn kho từ kho đích, chỉ phần chưa trả. Trả hàng: hoàn kho về kho đích. Đơn nhập hiển thị kho đích ở danh sách và chi tiết.
- Đơn giá nhập gợi ý và cột đơn giá nhập chặn theo `product.view_cost` như cũ, không đổi.

### 5.4. Chuyển kho

- Form "Chuyển kho" trên trang Kho: chọn kho nguồn, kho đích, các dòng SKU + số lượng, lý do (bắt buộc). Kho nguồn ≠ kho đích; cả 2 kho phải đang hoạt động thì mới chuyển **đến** được, nhưng chuyển **đi** khỏi kho ngừng thì cho phép (mục 4.2).
- Một lần chuyển là **một transaction duy nhất**: trừ kho nguồn (`transfer_out`) và cộng kho đích (`transfer_in`) cùng lúc; thiếu hàng ở kho nguồn hoặc lỗi 1 dòng thì hủy toàn bộ, không chuyển một phần.
- Hai dòng giao dịch của cùng một lần chuyển chia sẻ `referenceId` là mã đợt chuyển (để tra cứu cặp xuất/nhập), `referenceType = "transfer"`, kèm lý do và người thực hiện.
- Chuyển kho không làm thay đổi tổng tồn toàn hệ thống của SKU, chỉ đổi phân bổ giữa các kho. Không cho chuyển số lượng đang bị đơn nháp giữ (chỉ chuyển phần khả dụng: `quantity - reservedQuantity` tại kho nguồn).

## 6. Phân quyền

Mã quyền mới (module `warehouse` và 1 mã kho):

| Mã | Mô tả | Admin | Manager | Sales | Kho | Kế toán |
|---|---|---|---|---|---|---|
| `warehouse.view` | Xem danh sách kho | ✓ | ✓ | ✓ | ✓ | ✓ |
| `warehouse.create` | Tạo kho | ✓ | ✓ | — | — | — |
| `warehouse.update` | Sửa kho, đặt mặc định, ngừng kho | ✓ | ✓ | — | — | — |
| `warehouse.deactivate` | Ngừng kho (mirror `supplier.deactivate`) | ✓ | ✓ | — | — | — |
| `warehouse.hard_delete` | Xóa cứng kho (backend kiểm tra thêm role === admin, mirror `supplier.hard_delete`) | ✓ | — | — | — | — |
| `inventory.transfer` | Chuyển kho | ✓ | — | — | ✓ | — |

Ghi chú về quyền:

- `warehouse.view` cấp cho tất cả các vai trò vì kho không phải thông tin nhạy cảm; nhân viên bán hàng cần thấy kho để chọn dòng đơn, nhân viên kho cần thấy kho để làm việc.
- Manager **không** có `inventory.transfer` vì Manager mặc định chỉ xem kho (đã kiểm chứng M1); chuyển kho là thao tác đổi tồn nên chỉ Admin và Kho.
- Các quyền kho cũ không đổi: `inventory.view`, `inventory.import_stock`, `inventory.export`, `inventory.adjust`, `inventory.view_transactions`, `inventory.view_value` vẫn giữ nguyên vai trò mặc định; chúng nay thao tác theo kho của dòng được chọn.
- Không có phân quyền theo từng kho trong v1 (mục 2): người xem được kho thì thấy tất cả các kho.
- Deploy cần re-seed (mã quyền mới + kho mặc định) và đăng nhập lại (snapshot quyền load lúc đăng nhập).

## 7. API (thay đổi và thêm mới)

| Route | Thay đổi |
|---|---|
| `GET /api/inventory` | Thêm filter `warehouseId`; mỗi dòng trả thêm `warehouseId`, `warehouseCode`, `warehouseName`; `quantity`/`reservedQuantity` là số của cặp SKU × kho |
| `GET /api/inventory/:variantId` | Trả tồn của SKU đó ở **tất cả các kho** (mảng dòng theo kho) thay vì một dòng duy nhất |
| `GET /api/inventory/:variantId/transactions` | Thêm filter `warehouseId`; mỗi giao dịch trả thêm `warehouseId`, `warehouseName` |
| `POST /api/inventory/initial\|import\|export\|adjust` | Body thêm `warehouseId` (bắt buộc); kiểm tra kho đang hoạt động (trừ adjust và hoàn kho — xem mục 4.2) |
| `POST /api/inventory/transfer` | Mới: `{ sourceWarehouseId, destinationWarehouseId, reason, lines: [{ variantId, quantity }] }`, authorize `inventory.transfer`, nguyên tử toàn bộ |
| `GET /api/warehouses`, `POST /api/warehouses` | Mới: danh sách + tạo kho (authorize `warehouse.create`) |
| `PATCH /api/warehouses/:id`, `DELETE /api/warehouses/:id` | Mới: sửa/đặt mặc định (authorize `warehouse.update`), ngừng kho (authorize `warehouse.deactivate`), xóa cứng (authorize `warehouse.hard_delete` + role admin) |
| `POST /api/orders`, `PATCH /api/orders/:id` | Body mỗi dòng thêm `warehouseId` (bắt buộc); kiểm tra tồn khả dụng theo kho; response chi tiết đơn trả kho theo dòng |
| `GET /api/orders/:id` | Chi tiết đơn trả thêm kho của từng dòng |
| `POST /api/purchase-orders`, `PATCH /api/purchase-orders/:id` | Body thêm `destinationWarehouseId` (bắt buộc khi tạo; sửa nháp đổi được, sau xác nhận khóa) |
| `GET /api/purchase-orders/:id` | Chi tiết đơn nhập trả thêm kho đích |
| `GET /api/variants?q=` (tìm SKU ở form đơn) | Mỗi SKU trả thêm `warehouses: [{ warehouseId, warehouseName, available }]` để form đơn hiện tồn khả dụng theo kho |
| `GET /api/reports/*`, Dashboard | **Không đổi trong v1** (tính toàn cục) |

Các route cũ không có trong bảng trên giữ nguyên. Mọi route mới/trả thêm đều cộng thêm (additive) với dữ liệu cũ trừ `warehouseCode` (bỏ) và hình dạng `GET /api/inventory/:variantId` (đổi từ 1 dòng thành mảng theo kho).

## 8. Kế hoạch triển khai (sprint)

- **KHO-1 — Kho và tồn theo kho:** bảng `Warehouse` + migration + chuyển dữ liệu về kho mặc định; trang Kho theo cặp SKU × kho (lọc, thao tác dòng, thao tác hàng loạt theo kho, lịch sử theo kho); thẻ quản lý kho; quyền mới + seed.
- **KHO-2 — Đơn bán theo kho:** dòng đơn gắn kho; giữ/trừ/hoàn kho theo kho; form đơn hiện tồn khả dụng theo kho; chi tiết đơn hiện kho theo dòng.
- **KHO-3 — Đơn nhập theo kho đích + chuyển kho:** kho đích đơn nhập; form và API chuyển kho; audit cho kho và chuyển kho; cập nhật tài liệu bàn giao 14.
- **Kiểm chứng bằng database thật sau mỗi sprint** (theo nhịp làm việc hiện tại): tạo 2 kho, chia tồn, đặt đơn lấy hàng từ cả 2 kho, xác nhận trừ đúng kho, hủy hoàn đúng kho, nhận đơn nhập vào kho đích, chuyển kho nguyên tử, kho ngừng chặn xuất mới nhưng vẫn hoàn kho được, tồn âm ở 1 kho bị chặn dù SKU đó còn tồn ở kho khác, báo cáo toàn cục không lệch.

Deploy mỗi sprint: pull + rebuild + `prisma migrate deploy` (bảng/cột mới) + re-seed (quyền mới + kho mặc định) + đăng nhập lại. Không thay đổi cổng 5434 ở máy người dùng, không động vào `.env`.

## 9. Câu hỏi cần chủ dự án chốt trước khi làm

1. **Chuyển kho có trong v1 không?** Thiết kế này để trong v1 vì không có chuyển kho thì hàng rất dễ kẹt sai kho. Nếu muốn gọn hơn thì dời chuyển kho sang v2.
2. **Đơn nhập lấy kho đích theo đơn hay theo dòng?** Thiết kế này chọn theo đơn (1 kho cho cả đơn) cho đơn giản. Nếu đơn nhập thường xuyên tách hàng về nhiều kho thì đổi thành theo dòng.
3. **Kho mặc định có được đổi không?** Thiết kế này cho đổi (Admin/Manager), và chặn ngừng kho mặc định khi chưa chọn kho khác.
4. **Mã kho do người dùng nhập hay tự sinh?** Thiết kế này chọn người dùng nhập (unique, viết hoa), vì mã kho dùng để lọc và đối chiếu nhanh.
5. **Báo cáo theo kho có cần ngay trong v1 không?** Thiết kế này để báo cáo toàn cục như cũ; nếu cần xem giá trị tồn theo kho ngay thì thêm vào KHO-3.
