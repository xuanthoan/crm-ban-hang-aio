# KẾ HOẠCH MVP THEO SPRINT

# Dự án: CRM_Ban_Hang

## 1. Mục tiêu của MVP

MVP của CRM_Ban_Hang không phải là bản demo sơ sài. MVP phải là phiên bản tối thiểu nhưng có thể dùng thật cho một cửa hàng nhỏ/vừa.

MVP cần làm chắc các nghiệp vụ lõi:

1. Quản lý khách hàng đầy đủ.
2. Chống trùng số điện thoại khách hàng.
3. Quản lý sản phẩm cha và SKU/biến thể.
4. Quản lý tồn kho theo SKU.
5. Tạo đơn hàng chọn đúng SKU.
6. Kiểm tra tồn kho khi bán.
7. Trừ kho khi xác nhận đơn.
8. Hoàn kho khi hủy đơn.
9. Ghi nhận thanh toán nhiều lần.
10. Theo dõi công nợ theo đơn và theo khách.
11. Ghi chú chăm sóc khách hàng.
12. Tạo nhắc việc.
13. Dashboard cơ bản.
14. Phân quyền cơ bản.
15. Import/export cơ bản.
16. Audit log cho thao tác nhạy cảm.

Nguyên tắc triển khai:

* Làm dữ liệu lõi trước, giao diện đẹp sau.
* Làm nghiệp vụ đúng trước, báo cáo nâng cao sau.
* Làm ít nhưng chắc, không làm nhiều tính năng nửa vời.
* Không code lan man sang SMS/Zalo/Facebook/AI khi MVP chưa ổn.
* Mỗi sprint phải có tiêu chí kiểm thử rõ ràng.
* Không được để lỗi dữ liệu kho, tiền, công nợ, SKU.

---

## 2. Thứ tự ưu tiên tổng thể

Thứ tự triển khai đề xuất:

1. Nền tảng dự án.
2. Auth / User / Role cơ bản.
3. Khách hàng / CRM.
4. Sản phẩm / SKU.
5. Kho hàng.
6. Đơn hàng.
7. Thanh toán / Công nợ.
8. Chăm sóc / Nhắc việc.
9. Dashboard / Báo cáo cơ bản.
10. Import / Export cơ bản.
11. Audit log nâng cao.
12. Kiểm thử tổng thể và đóng gói MVP.

Không nên làm Dashboard quá sớm vì chưa có dữ liệu lõi.
Không nên làm Import quá sớm khi model chưa ổn.
Không nên làm Báo cáo trước khi Đơn hàng, Kho, Payment đã đúng.

---

# PHASE 0 — NỀN TẢNG DỰ ÁN

## Sprint 0.1 — Kiểm tra và chuẩn hóa project

### Mục tiêu

Đảm bảo project có cấu trúc rõ ràng, chạy được ổn định trước khi code nghiệp vụ.

### Việc cần làm

* Kiểm tra cấu trúc frontend/backend/database hiện tại.
* Xác định stack chính:

  * Backend.
  * Frontend.
  * Database.
  * Docker compose.
* Kiểm tra port hiện tại.
* Kiểm tra biến môi trường.
* Kiểm tra migration/database schema.
* Kiểm tra seed data nếu có.
* Chuẩn hóa thư mục docs.
* Tạo file tài liệu:

  * README.md
  * DEVELOPMENT_PLAN.md
  * DATABASE_SCHEMA.md
  * API_SPEC.md
  * MVP_SPRINT_PLAN.md

### Không làm trong sprint này

* Không code nghiệp vụ mới.
* Không thay đổi kiến trúc lớn nếu chưa cần.
* Không xóa dữ liệu/database/volume.
* Không đổi port nếu chưa hỏi.

### Tiêu chí hoàn thành

* Project chạy được local.
* Backend health check OK.
* Frontend mở được.
* Database kết nối được.
* Có tài liệu cấu trúc project.
* Có kế hoạch sprint được lưu trong repo.

---

# PHASE 1 — AUTH / USER / ROLE CƠ BẢN

## Sprint 1.1 — Đăng nhập và người dùng cơ bản

### Mục tiêu

Có tài khoản người dùng, đăng nhập, xác định user hiện tại.

### Việc cần làm

Backend:

* Tạo bảng users.
* Lưu password_hash, không lưu plain text.
* Tạo API:

  * POST /auth/login
  * GET /auth/me
  * POST /auth/change-password
* Tạo user admin mặc định.
* Thêm trạng thái user:

  * active
  * inactive
  * locked

Frontend:

* Màn hình đăng nhập.
* Lưu token.
* Hiển thị user hiện tại.
* Logout.

### Tiêu chí hoàn thành

* Admin đăng nhập được.
* User sai mật khẩu không đăng nhập được.
* User locked không đăng nhập được.
* /auth/me trả đúng thông tin user.
* Không trả password_hash ra frontend.

---

## Sprint 1.2 — Role mặc định và permission guard cơ bản

### Mục tiêu

Có 5 vai trò mặc định và backend bắt đầu kiểm tra quyền.

### Vai trò mặc định

* Admin
* Manager
* Sales
* Warehouse
* Accountant

### Việc cần làm

Backend:

* Tạo bảng roles.
* Gán role_id cho user.
* Tạo permission service cơ bản.
* Tạo dependency/middleware kiểm tra đăng nhập.
* Seed 5 role mặc định.

Frontend:

* Ẩn/hiện menu theo role cơ bản.
* Admin thấy menu cấu hình.
* Sales không thấy menu cấu hình.

### Tiêu chí hoàn thành

* User có role.
* Admin có quyền cao nhất.
* Sales không vào được trang cấu hình.
* Backend chặn API nếu chưa đăng nhập.
* Không chỉ ẩn nút frontend, backend cũng phải kiểm tra.

---

# PHASE 2 — KHÁCH HÀNG / CRM

## Sprint 2.1 — Customer model, danh sách, thêm/sửa/xem chi tiết

### Mục tiêu

Tạo được hồ sơ khách hàng đầy đủ, không còn kiểu chỉ có tên và số điện thoại.

### Việc cần làm

Backend:

* Tạo bảng customers.
* Fields chính:

  * customer_code
  * full_name
  * phone_1
  * phone_2
  * phone_normalized_1
  * phone_normalized_2
  * gender
  * birthday
  * email
  * zalo
  * facebook
  * address
  * province
  * district
  * ward
  * source
  * status
  * potential_level
  * assigned_to
  * internal_note
  * created_by
  * updated_by
* API:

  * GET /customers
  * POST /customers
  * GET /customers/{id}
  * PUT /customers/{id}

Frontend:

* Danh sách khách hàng.
* Nút thêm khách hàng.
* Form thêm khách hàng đầy đủ, chia nhóm:

  * Thông tin cơ bản.
  * Liên hệ.
  * Địa chỉ.
  * Phân loại.
  * Phụ trách.
  * Ghi chú.
* Màn hình chi tiết khách hàng.
* Nút sửa khách hàng.

### Tiêu chí hoàn thành

* Tạo khách hàng được.
* Sửa khách hàng được.
* Xem chi tiết khách hàng được.
* Danh sách có nút xem/sửa.
* Sau khi tạo khách không bị rơi vào tình trạng không sửa được.
* Form không bị quá sơ sài.

---

## Sprint 2.2 — Chống trùng số điện thoại và tìm kiếm khách

### Mục tiêu

Dữ liệu khách hàng không bị trùng lặp lung tung.

### Việc cần làm

Backend:

* Chuẩn hóa số điện thoại.
* Kiểm tra trùng:

  * phone_1 với phone_1.
  * phone_1 với phone_2.
  * phone_2 với phone_1.
  * phone_2 với phone_2.
* API:

  * POST /customers/check-duplicate
* Tìm kiếm khách theo:

  * tên
  * số điện thoại
  * email
  * zalo
  * facebook

Frontend:

* Cảnh báo khi nhập số điện thoại trùng.
* Tìm kiếm trên danh sách khách.
* Khi trùng, hiển thị khách đã tồn tại.

### Tiêu chí hoàn thành

* Không tạo được khách trùng số điện thoại chính xác.
* Sửa số điện thoại thành số của khách khác bị chặn.
* Tìm “0987” ra khách có số đó.
* Số điện thoại có khoảng trắng/gạch ngang vẫn được chuẩn hóa.

---

## Sprint 2.3 — Tag, nguồn khách, trạng thái, phân loại

### Mục tiêu

Khách hàng có thể phân loại để chăm sóc và remarketing.

### Việc cần làm

Backend:

* Tạo customer_tags.
* Tạo customer_tag_links.
* Hỗ trợ source/status/potential_level.
* API tag:

  * GET /customer-tags
  * POST /customer-tags
  * PUT /customer-tags/{id}
* Filter customers theo:

  * source
  * status
  * potential_level
  * tag
  * assigned_to

Frontend:

* Gắn nhiều tag cho khách.
* Lọc danh sách khách theo tag/nguồn/trạng thái.
* Quản lý tag cơ bản.

### Tiêu chí hoàn thành

* Một khách có nhiều tag.
* Lọc khách theo tag được.
* Lọc khách theo nguồn được.
* Lọc khách theo trạng thái được.
* Không tạo tag trùng tên.

---

# PHASE 3 — SẢN PHẨM / SKU

## Sprint 3.1 — Product cha và SKU mặc định

### Mục tiêu

Tạo được sản phẩm không biến thể nhưng vẫn có SKU mặc định để bán/kho.

### Việc cần làm

Backend:

* Tạo bảng products.
* Tạo bảng product_variants.
* Tạo bảng inventory_items.
* Tạo bảng inventory_transactions nếu chưa có.
* API:

  * GET /products
  * POST /products/with-variants
  * GET /products/{id}
  * PUT /products/{id}

Với sản phẩm không biến thể:

* Tạo Product.
* Tạo ProductVariant mặc định.
* Tự sinh SKU nếu để trống.
* Tạo InventoryItem.
* Nếu initial_quantity > 0, tạo InventoryTransaction loại initial.

Frontend:

* Màn hình danh sách sản phẩm.
* Form thêm sản phẩm.
* Mặc định là sản phẩm không biến thể.
* Khối SKU mặc định:

  * SKU
  * đơn vị
  * giá nhập
  * giá bán
  * giá khuyến mãi
  * tồn kho ban đầu
  * ngưỡng tồn thấp
  * trạng thái

### Tiêu chí hoàn thành

* Tạo sản phẩm không biến thể được.
* Tự tạo SKU mặc định.
* Nhập tồn kho ban đầu 10 thì kho hiển thị đúng 10.
* SKU không bị trùng.
* Có inventory transaction initial.

---

## Sprint 3.2 — Sản phẩm có biến thể và sinh tổ hợp SKU

### Mục tiêu

Tạo sản phẩm có 1/2/3 biến thể, tự sinh tổ hợp SKU.

### Việc cần làm

Frontend:

* Checkbox “Sản phẩm có biến thể”.
* Chỉ khi bật mới hiện Biến thể 1.
* Biến thể 2 chỉ hiện khi Biến thể 1 có dữ liệu.
* Biến thể 3 chỉ hiện khi Biến thể 2 có dữ liệu.
* Nhập tên thuộc tính:

  * Màu sắc
  * Size
  * Chất liệu
  * Dung tích
  * Loại
* Nhập nhiều giá trị.
* Tự sinh bảng SKU tổ hợp.

Backend:

* Nhận danh sách variants.
* Tạo nhiều ProductVariant.
* Chống trùng SKU.
* Tự sinh SKU nếu trống.
* Tạo InventoryItem cho từng SKU.
* Tạo initial transaction nếu có tồn đầu.

### Tiêu chí hoàn thành

* Tạo sản phẩm 1 biến thể được.
* Tạo sản phẩm 2 biến thể được.
* Tạo sản phẩm 3 biến thể được.
* Tự sinh đúng tổ hợp.
* Có thể xóa bớt tổ hợp không bán.
* Mỗi tổ hợp là một SKU riêng.
* Tồn kho từng SKU lưu đúng.

---

## Sprint 3.3 — Bulk action SKU và tìm kiếm SKU

### Mục tiêu

Không bắt người dùng sửa từng SKU thủ công.

### Việc cần làm

Frontend:

* Bảng SKU có checkbox chọn dòng.
* Áp dụng cho tất cả:

  * đơn vị
  * giá nhập
  * giá bán
  * giá khuyến mãi
  * tồn kho ban đầu
  * ngưỡng tồn thấp
  * trạng thái
* Áp dụng cho SKU được chọn.
* Tìm kiếm SKU theo:

  * tên sản phẩm
  * SKU
  * biến thể
  * barcode

Backend:

* API GET /variants hoặc /product-variants.
* Search theo product_name, sku, variant_name, option values.

### Tiêu chí hoàn thành

* Có thể áp dụng giá/tồn cho tất cả SKU.
* Có thể chọn nhiều SKU và cập nhật.
* Tìm SKU “đen s” ra đúng SKU.
* Tìm theo mã SKU ra đúng.
* Không mất dữ liệu đã nhập khi sinh lại tổ hợp nếu tổ hợp còn tồn tại.

---

# PHASE 4 — KHO HÀNG

## Sprint 4.1 — Tồn kho theo SKU và theo sản phẩm cha

### Mục tiêu

Xem được tồn kho tổng quan và chi tiết.

### Việc cần làm

Backend:

* API:

  * GET /inventory/summary
  * GET /inventory/products
  * GET /inventory/variants
  * GET /inventory/variants/{id}
* Tính:

  * total_quantity.
  * low_stock_count.
  * out_of_stock_count.
  * stock_status.

Frontend:

* Màn hình tồn kho theo sản phẩm.
* Màn hình tồn kho theo SKU.
* Hiển thị:

  * SKU.
  * sản phẩm.
  * biến thể.
  * tồn hiện tại.
  * ngưỡng thấp.
  * trạng thái tồn.

### Tiêu chí hoàn thành

* Mỗi SKU có tồn riêng.
* Tổng tồn sản phẩm cha = tổng SKU con.
* Lọc được SKU hết hàng.
* Lọc được SKU sắp hết.
* Tồn ban đầu từ sản phẩm hiển thị đúng.

---

## Sprint 4.2 — Nhập kho một SKU và nhập kho hàng loạt

### Mục tiêu

Nhập thêm hàng và lưu lịch sử kho.

### Việc cần làm

Backend:

* API:

  * POST /inventory/variants/{variant_id}/import
  * POST /inventory/products/{product_id}/bulk-import
* Mỗi lần nhập kho:

  * cập nhật quantity.
  * tạo InventoryTransaction loại import.
  * lưu before/changed/after.
  * lưu reason/note/created_by.

Frontend:

* Form nhập kho một SKU.
* Form nhập kho hàng loạt theo sản phẩm cha.
* Hiển thị tồn sau dự kiến.

### Tiêu chí hoàn thành

* Nhập thêm 10 thì tồn tăng đúng 10.
* Bulk import nhiều SKU hoạt động đúng.
* SKU nhập 0 bị bỏ qua.
* Có transaction cho từng SKU nhập > 0.
* Không cho số lượng âm.
* Lý do nhập kho bắt buộc.

---

## Sprint 4.3 — Điều chỉnh kho và lịch sử kho

### Mục tiêu

Cho phép tăng/giảm/đặt lại tồn kho có lịch sử.

### Việc cần làm

Backend:

* API:

  * POST /inventory/variants/{variant_id}/adjust
  * POST /inventory/bulk-adjust
  * GET /inventory/transactions
* Loại điều chỉnh:

  * increase
  * decrease
  * set
* Chặn tồn âm.

Frontend:

* Form điều chỉnh kho.
* Bảng lịch sử kho.
* Bộ lọc lịch sử theo SKU, loại giao dịch, ngày.

### Tiêu chí hoàn thành

* Tăng tồn đúng.
* Giảm tồn đúng.
* Đặt lại tồn đúng.
* Không cho tồn âm.
* Mọi thay đổi có transaction.
* Lịch sử hiển thị before/changed/after, lý do, người thao tác.

---

# PHASE 5 — ĐƠN HÀNG

## Sprint 5.1 — Đơn hàng nháp

### Mục tiêu

Tạo được đơn hàng nháp, chọn khách và chọn SKU.

### Việc cần làm

Backend:

* Tạo bảng orders.
* Tạo bảng order_items.
* API:

  * GET /orders
  * POST /orders
  * GET /orders/{id}
  * PUT /orders/{id}
* Đơn nháp chưa trừ kho.
* Tính subtotal, discount, shipping_fee, grand_total ở backend.

Frontend:

* Màn hình tạo đơn.
* Chọn khách hàng.
* Nếu chưa có khách, mở form tạo khách đầy đủ.
* Tìm SKU.
* Thêm nhiều SKU vào đơn.
* Nhập số lượng.
* Tự tính tổng tiền.

### Tiêu chí hoàn thành

* Tạo đơn nháp được.
* Đơn có nhiều SKU.
* Không chọn sản phẩm cha, chỉ chọn SKU.
* Tổng tiền tính đúng.
* Đơn nháp sửa được.
* Đơn xuất hiện trong danh sách.

---

## Sprint 5.2 — Kiểm tra tồn kho khi tạo đơn

### Mục tiêu

Chặn bán vượt tồn kho trong MVP.

### Việc cần làm

Backend:

* Validate SKU active.
* Validate product active.
* Validate quantity > 0.
* Validate tồn kho đủ khi xác nhận.
* Có thể cảnh báo tồn thấp.

Frontend:

* Hiển thị tồn hiện tại khi chọn SKU.
* Khi nhập số lượng vượt tồn, cảnh báo.
* SKU hết hàng không cho thêm hoặc không cho xác nhận.

### Tiêu chí hoàn thành

* Không bán được SKU inactive.
* Không bán được sản phẩm inactive.
* Không xác nhận được đơn nếu tồn không đủ.
* Thông báo lỗi rõ SKU nào thiếu tồn.

---

## Sprint 5.3 — Xác nhận đơn và trừ kho

### Mục tiêu

Khi đơn chuyển sang Đã xác nhận, hệ thống trừ kho đúng một lần.

### Việc cần làm

Backend:

* API:

  * POST /orders/{id}/confirm
* Khi confirm:

  * kiểm tra đơn draft.
  * kiểm tra tồn từng SKU.
  * trừ kho từng SKU.
  * tạo InventoryTransaction loại order_confirmed.
  * set inventory_deducted = true.
  * lưu inventory_deducted_at.
  * tạo order_status_history.

Frontend:

* Nút xác nhận đơn.
* Hiển thị cảnh báo trước khi xác nhận.
* Cập nhật trạng thái đơn.

### Tiêu chí hoàn thành

* Confirm đơn trừ kho đúng.
* Mỗi SKU trong đơn có transaction.
* Không confirm nếu thiếu tồn.
* Bấm confirm lần 2 không trừ kho lần nữa.
* Đơn chuyển trạng thái confirmed.

---

## Sprint 5.4 — Hủy đơn và hoàn kho

### Mục tiêu

Hủy đơn an toàn, hoàn kho nếu đơn đã trừ kho.

### Việc cần làm

Backend:

* API:

  * POST /orders/{id}/cancel
* Khi cancel:

  * yêu cầu lý do.
  * nếu chưa trừ kho: chỉ đổi trạng thái.
  * nếu đã trừ kho: hoàn kho từng SKU.
  * tạo InventoryTransaction loại order_cancelled.
  * set inventory_restored = true.
  * không hoàn kho nhiều lần.
  * tạo order_status_history.

Frontend:

* Nút hủy đơn.
* Form nhập lý do hủy.
* Hiển thị trạng thái hủy.

### Tiêu chí hoàn thành

* Hủy đơn nháp không ảnh hưởng kho.
* Hủy đơn đã confirm hoàn kho đúng.
* Không hoàn kho 2 lần.
* Có lý do hủy.
* Có lịch sử trạng thái.

---

## Sprint 5.5 — Hoàn thành đơn và lịch sử mua hàng khách

### Mục tiêu

Đơn hoàn thành trở thành dữ liệu mua hàng của khách.

### Việc cần làm

Backend:

* API:

  * POST /orders/{id}/complete
* Cập nhật completed_at.
* Truy vấn đơn hàng trong chi tiết khách.

Frontend:

* Nút hoàn thành đơn.
* Trong hồ sơ khách có tab Đơn hàng.
* Hiển thị lịch sử mua hàng.

### Tiêu chí hoàn thành

* Đơn completed hiển thị trong hồ sơ khách.
* Customer detail có tổng số đơn/tổng đã mua cơ bản.
* Không tính đơn cancelled vào lịch sử mua hợp lệ.

---

# PHASE 6 — THANH TOÁN / CÔNG NỢ

## Sprint 6.1 — Payment cơ bản

### Mục tiêu

Một đơn có thể thanh toán nhiều lần.

### Việc cần làm

Backend:

* Tạo bảng payments.
* API:

  * POST /orders/{id}/payments
  * GET /orders/{id}/payments
* Khi tạo payment:

  * amount > 0.
  * payment_method bắt buộc.
  * không vượt debt_total trong MVP.
  * cập nhật paid_total.
  * cập nhật debt_total.
  * cập nhật payment_status.

Frontend:

* Trong chi tiết đơn có khu vực thanh toán.
* Form ghi nhận thanh toán.
* Lịch sử payment.

### Tiêu chí hoàn thành

* Một đơn có nhiều payment.
* paid_total tính đúng.
* debt_total tính đúng.
* payment_status đúng:

  * unpaid
  * partial
  * paid
* Không cho thanh toán vượt còn nợ.

---

## Sprint 6.2 — Thanh toán khi tạo đơn

### Mục tiêu

Khi tạo đơn có thể ghi nhận cọc/thanh toán ban đầu.

### Việc cần làm

Backend:

* POST /orders hỗ trợ:

  * paid_amount.
  * payment_method.
  * payment_note.
* Nếu paid_amount > 0, tạo payment.
* Tính payment_status.

Frontend:

* Khối thanh toán trong form tạo đơn.
* Nhập tiền khách trả ban đầu.
* Chọn phương thức.

### Tiêu chí hoàn thành

* Tạo đơn 1.000.000, khách trả 300.000 → debt 700.000.
* Payment history có record 300.000.
* Nếu không nhập thanh toán, đơn unpaid.

---

## Sprint 6.3 — Công nợ theo đơn và theo khách

### Mục tiêu

Theo dõi công nợ rõ ràng.

### Việc cần làm

Backend:

* API:

  * GET /debts/orders
  * GET /debts/customers
  * GET /customers/{id}/debts

Frontend:

* Màn hình công nợ theo đơn.
* Màn hình công nợ theo khách.
* Tab công nợ trong chi tiết khách.

### Tiêu chí hoàn thành

* Danh sách đơn còn nợ đúng.
* Danh sách khách còn nợ đúng.
* Tổng nợ khách = tổng nợ các đơn của khách.
* Ghi payment xong công nợ cập nhật ngay.

---

## Sprint 6.4 — Sửa/hủy payment có kiểm soát

### Mục tiêu

Tiền là dữ liệu nhạy cảm, sửa/hủy phải có quyền và cập nhật lại công nợ.

### Việc cần làm

Backend:

* API:

  * PUT /payments/{id}
  * POST /payments/{id}/cancel
* Payment có status:

  * active
  * cancelled
* Hủy payment cần reason.
* Tính lại order sau sửa/hủy.

Frontend:

* Nút sửa payment nếu có quyền.
* Nút hủy payment nếu có quyền.
* Form lý do hủy.

### Tiêu chí hoàn thành

* Hủy payment xong paid_total giảm đúng.
* debt_total tăng đúng.
* payment_status cập nhật đúng.
* Payment cancelled không bị tính vào tiền đã thu.
* Có audit log hoặc ít nhất lưu cancelled_by/cancelled_at/reason.

---

# PHASE 7 — CHĂM SÓC / NHẮC VIỆC / REMARKETING CƠ BẢN

## Sprint 7.1 — Customer activity

### Mục tiêu

Lưu lịch sử chăm sóc khách hàng.

### Việc cần làm

Backend:

* Tạo bảng customer_activities.
* API:

  * GET /customers/{id}/activities
  * POST /customers/{id}/activities
  * PUT /customer-activities/{id}

Frontend:

* Tab Chăm sóc trong chi tiết khách.
* Form thêm hoạt động:

  * loại hoạt động
  * nội dung
  * kết quả
  * ngày chăm sóc tiếp theo

### Tiêu chí hoàn thành

* Thêm activity được.
* Activity hiển thị trong timeline khách.
* Lưu người tạo và thời gian.
* Có loại hoạt động và kết quả.

---

## Sprint 7.2 — Reminder / Task

### Mục tiêu

Biết hôm nay cần chăm sóc khách nào.

### Việc cần làm

Backend:

* Tạo bảng reminders.
* API:

  * GET /reminders
  * POST /reminders
  * PUT /reminders/{id}
  * POST /reminders/{id}/complete
  * POST /reminders/{id}/cancel
  * POST /reminders/{id}/reschedule

Frontend:

* Màn hình nhắc việc:

  * hôm nay
  * quá hạn
  * sắp tới
  * hoàn thành
* Tạo reminder từ hồ sơ khách.
* Hoàn thành/dời lịch/hủy reminder.

### Tiêu chí hoàn thành

* Tạo reminder được.
* Reminder hôm nay hiển thị đúng.
* Reminder quá hạn hiển thị đúng.
* Hoàn thành reminder được.
* Dời lịch được.

---

## Sprint 7.3 — Liên kết activity và reminder

### Mục tiêu

Ghi chăm sóc xong có thể hẹn chăm sóc tiếp.

### Việc cần làm

Backend:

* Khi tạo activity có next_follow_up_at và create_reminder=true:

  * tự tạo reminder.
* Khi complete reminder:

  * có thể tạo activity kết quả.

Frontend:

* Trong form activity có checkbox tạo lịch nhắc tiếp.
* Khi hoàn thành reminder, cho nhập kết quả.

### Tiêu chí hoàn thành

* Tạo activity kèm ngày hẹn tạo reminder.
* Hoàn thành reminder có thể ghi kết quả chăm sóc.
* Không mất liên kết customer.

---

## Sprint 7.4 — Sinh nhật, khách lâu chưa mua, khách còn nợ

### Mục tiêu

Có các tệp chăm sóc cơ bản.

### Việc cần làm

Backend:

* API:

  * GET /customers/birthdays
  * GET /marketing/customers
* Filter:

  * sinh nhật hôm nay/tháng này.
  * lâu chưa mua.
  * có công nợ.
  * theo tag.
  * theo nguồn.

Frontend:

* Màn hình tệp khách hàng cơ bản.
* Danh sách khách sinh nhật.
* Danh sách khách lâu chưa mua.
* Danh sách khách còn nợ.

### Tiêu chí hoàn thành

* Lọc sinh nhật tháng này đúng.
* Lọc khách còn nợ đúng.
* Lọc khách lâu chưa mua đúng.
* Có thể mở hồ sơ khách từ danh sách.

---

# PHASE 8 — DASHBOARD / BÁO CÁO CƠ BẢN

## Sprint 8.1 — Dashboard tổng quan MVP

### Mục tiêu

Có màn hình tổng quan để chủ cửa hàng biết tình hình.

### Việc cần làm

Backend:

* API:

  * GET /dashboard/summary
* Trả về:

  * doanh thu.
  * tiền đã thu.
  * công nợ.
  * số đơn.
  * khách mới.
  * SKU sắp hết.
  * SKU hết hàng.
  * việc hôm nay.
  * việc quá hạn.

Frontend:

* Dashboard card.
* Bộ lọc thời gian:

  * hôm nay
  * 7 ngày
  * tháng này
  * tùy chọn
* Card có link đến danh sách chi tiết.

### Tiêu chí hoàn thành

* Doanh thu không tính đơn hủy.
* Tiền đã thu không tính payment cancelled.
* Công nợ khớp danh sách công nợ.
* SKU sắp hết khớp kho.
* Việc quá hạn khớp reminder.

---

## Sprint 8.2 — Báo cáo bán hàng và sản phẩm cơ bản

### Mục tiêu

Biết bán được gì, sản phẩm nào bán chạy.

### Việc cần làm

Backend:

* API:

  * GET /reports/sales
  * GET /reports/products

Frontend:

* Báo cáo doanh thu theo ngày.
* Báo cáo doanh thu theo nguồn.
* Báo cáo doanh thu theo nhân viên.
* Báo cáo sản phẩm/SKU bán chạy.

### Tiêu chí hoàn thành

* Sản phẩm bán chạy tính theo order_items.
* Không tính đơn cancelled.
* Có filter ngày.
* Có bảng dữ liệu rõ ràng.

---

## Sprint 8.3 — Báo cáo kho, thanh toán, công nợ cơ bản

### Mục tiêu

Chủ cửa hàng xem được kho và tiền.

### Việc cần làm

Backend:

* API:

  * GET /reports/inventory
  * GET /reports/payments
  * GET /reports/debts

Frontend:

* Báo cáo tồn kho thấp.
* Báo cáo tiền thu theo phương thức.
* Báo cáo khách/đơn còn nợ.

### Tiêu chí hoàn thành

* Tồn kho khớp inventory_items.
* Tiền thu khớp payments active.
* Công nợ khớp debt_total.
* Không lộ giá nhập nếu không có quyền.

---

# PHASE 9 — IMPORT / EXPORT CƠ BẢN

## Sprint 9.1 — Export dữ liệu quan trọng

### Mục tiêu

Cho người dùng xuất dữ liệu phục vụ kiểm tra, báo cáo.

### Việc cần làm

Backend:

* Export CSV hoặc XLSX cho:

  * khách hàng.
  * sản phẩm/SKU.
  * tồn kho.
  * công nợ.
* Export theo filter hiện tại.
* Kiểm tra quyền trước khi export.

Frontend:

* Nút export ở các màn hình:

  * Customers.
  * Products/SKU.
  * Inventory.
  * Debts.

### Tiêu chí hoàn thành

* Export đúng bộ lọc.
* Sale không export toàn bộ khách nếu không có quyền.
* User không có quyền xem giá nhập thì file không có giá nhập.
* File mở được và cột tiếng Việt rõ ràng.

---

## Sprint 9.2 — Import khách hàng

### Mục tiêu

Nhập dữ liệu khách hàng từ Excel/CSV.

### Việc cần làm

Backend:

* File mẫu import khách hàng.
* Upload file.
* Validate.
* Preview.
* Confirm import.
* Chống trùng số điện thoại.

Frontend:

* Màn hình import.
* Tải file mẫu.
* Upload.
* Xem lỗi theo dòng/cột.
* Xác nhận import.

### Tiêu chí hoàn thành

* Import khách hợp lệ thành công.
* Trùng số điện thoại bị báo lỗi.
* Thiếu họ tên và số điện thoại bị báo lỗi.
* Có preview trước khi ghi database.
* Có rollback nếu lỗi nghiêm trọng.

---

## Sprint 9.3 — Import sản phẩm/SKU và tồn kho

### Mục tiêu

Nhập sản phẩm/SKU/tồn kho ban đầu từ file.

### Việc cần làm

Backend:

* File mẫu sản phẩm/SKU.
* File mẫu tồn kho.
* Import Product.
* Import ProductVariant.
* Tạo InventoryItem.
* Tạo InventoryTransaction initial.
* Import tồn kho tạo transaction.

Frontend:

* Import sản phẩm/SKU.
* Import tồn kho.
* Báo lỗi dòng/cột.

### Tiêu chí hoàn thành

* Import SKU không trùng.
* SKU trống được tự sinh.
* Tồn kho ban đầu import đúng.
* Import tồn kho không làm tồn âm.
* Mọi thay đổi kho có transaction.

---

# PHASE 10 — AUDIT LOG NÂNG CAO

## Sprint 10.1 — Audit log nền tảng

### Mục tiêu

Ghi lại thao tác nhạy cảm.

### Việc cần làm

Backend:

* Tạo bảng audit_logs.
* Tạo audit service.
* Ghi log cho:

  * sửa khách hàng.
  * đổi số điện thoại.
  * sửa giá sản phẩm/SKU.
  * điều chỉnh kho.
  * hủy đơn.
  * hủy payment.
  * đổi role user.
  * import/export dữ liệu nhạy cảm.

Frontend:

* Admin xem danh sách audit log cơ bản.

### Tiêu chí hoàn thành

* Điều chỉnh kho có audit log.
* Hủy đơn có audit log.
* Hủy payment có audit log.
* Đổi role user có audit log.
* Log có user, action, entity, time, old/new value nếu có.

---

## Sprint 10.2 — Audit log theo từng đối tượng

### Mục tiêu

Xem lịch sử ngay trong chi tiết khách/đơn/SKU.

### Việc cần làm

Backend:

* API:

  * GET /audit-logs/entity/{entity_type}/{entity_id}

Frontend:

* Tab Lịch sử trong:

  * chi tiết khách hàng.
  * chi tiết đơn hàng.
  * chi tiết SKU hoặc kho.

### Tiêu chí hoàn thành

* Mở đơn hàng thấy lịch sử tạo/xác nhận/hủy/thanh toán.
* Mở SKU thấy lịch sử điều chỉnh kho/đổi giá.
* Mở khách thấy lịch sử sửa thông tin quan trọng.

---

# PHASE 11 — PHÂN QUYỀN HOÀN CHỈNH VÀ BẢO VỆ DỮ LIỆU NHẠY CẢM

## Sprint 11.1 — Permission matrix hoàn chỉnh

### Mục tiêu

Backend kiểm tra quyền đầy đủ hơn.

### Việc cần làm

* Định nghĩa permission codes:

  * customer.*
  * product.*
  * inventory.*
  * order.*
  * payment.*
  * debt.*
  * report.*
  * import.*
  * export.*
  * audit.*
  * config.*
* Gán quyền mặc định cho 5 role.
* Kiểm tra API quan trọng.

### Tiêu chí hoàn thành

* Sales không xem khách ngoài quyền.
* Warehouse không ghi payment.
* Accountant không chỉnh kho.
* User không có quyền không export được.
* Backend trả 403 khi không đủ quyền.

---

## Sprint 11.2 — Ẩn dữ liệu nhạy cảm

### Mục tiêu

Không lộ giá nhập/lãi/công nợ/báo cáo cho người không có quyền.

### Việc cần làm

Backend:

* Response filtering:

  * import_price.
  * inventory_value.
  * estimated_profit.
  * full revenue.
  * full debt.
* Export filtering.

Frontend:

* Ẩn cột/nút tương ứng.

### Tiêu chí hoàn thành

* User không có quyền xem giá nhập không thấy giá nhập ở UI/API/export.
* User không có quyền xem lãi không thấy lãi gộp.
* Sale không thấy báo cáo toàn hệ thống nếu không được quyền.

---

# PHASE 12 — KIỂM THỬ TỔNG THỂ VÀ ỔN ĐỊNH MVP

## Sprint 12.1 — Test luồng nghiệp vụ chính end-to-end

### Mục tiêu

Đảm bảo phần mềm dùng được theo luồng thật.

### Test case bắt buộc

Luồng 1: Khách hàng

* Tạo khách.
* Chống trùng số.
* Sửa khách.
* Gắn tag.
* Tạo activity.
* Tạo reminder.

Luồng 2: Sản phẩm/SKU/Kho

* Tạo sản phẩm không biến thể.
* Tạo sản phẩm có 2 biến thể.
* Sinh SKU.
* Tồn kho ban đầu đúng.
* Nhập kho.
* Điều chỉnh kho.
* Xem lịch sử kho.

Luồng 3: Đơn hàng

* Tạo đơn nháp.
* Chọn khách.
* Chọn SKU.
* Xác nhận đơn.
* Trừ kho đúng.
* Hủy đơn.
* Hoàn kho đúng.
* Không trừ/hoàn 2 lần.

Luồng 4: Thanh toán/Công nợ

* Tạo đơn có cọc.
* Ghi thêm payment.
* Công nợ giảm đúng.
* Hủy payment.
* Công nợ tăng lại đúng.
* Xem công nợ theo khách.

Luồng 5: Dashboard

* Doanh thu đúng.
* Tiền thu đúng.
* Công nợ đúng.
* SKU sắp hết đúng.
* Việc quá hạn đúng.

### Tiêu chí hoàn thành

* Các luồng chính chạy ổn.
* Không lỗi dữ liệu kho.
* Không lỗi công nợ.
* Không lỗi SKU.
* Không lỗi quyền cơ bản.

---

## Sprint 12.2 — Sửa lỗi, tối ưu UX và chuẩn bị bản MVP

### Mục tiêu

Dọn lỗi, làm UI dễ dùng, chuẩn bị bản MVP.

### Việc cần làm

* Sửa bug theo test.
* Tối ưu form.
* Tối ưu thông báo lỗi tiếng Việt.
* Kiểm tra mobile/responsive nếu cần.
* Seed dữ liệu mẫu hợp lý.
* Viết hướng dẫn sử dụng cơ bản.
* Cập nhật README.
* Cập nhật API docs.
* Cập nhật database schema docs.

### Tiêu chí hoàn thành

* Người dùng mới có thể đăng nhập và thao tác.
* Có dữ liệu mẫu để demo.
* Có hướng dẫn chạy project.
* Có hướng dẫn test nghiệp vụ chính.
* Không còn lỗi nghiêm trọng.

---

# 3. Các tính năng KHÔNG làm trong MVP

Để tránh code lan man, các phần sau không làm trong MVP:

1. Gửi SMS tự động.
2. Tích hợp Zalo OA.
3. Tích hợp Facebook Messenger.
4. Tích hợp Shopee/Lazada/TikTok Shop.
5. Mobile app.
6. POS nâng cao.
7. In hóa đơn chuyên nghiệp.
8. Barcode scanner thật.
9. Quản lý nhiều kho phức tạp.
10. Quản lý nhà cung cấp chi tiết.
11. Công nợ nhà cung cấp.
12. Kế toán sổ cái.
13. Thuế/hóa đơn điện tử.
14. AI gợi ý chăm sóc.
15. Marketing automation nhiều bước.
16. Workflow approval phức tạp.
17. Phân tích LTV/CAC/cohort nâng cao.
18. Dự báo tồn kho.
19. Quản lý lô/hạn sử dụng.
20. Hoàn hàng từng phần phức tạp.

Các phần này chỉ làm sau khi MVP lõi ổn định.

---

# 4. Quy tắc bắt buộc cho Goose/Codex khi triển khai

## 4.1. Không được code lan man

Chỉ làm đúng sprint hiện tại.

Không tự ý nhảy sang:

* dashboard nâng cao.
* AI.
* SMS/Zalo.
* giao diện quá cầu kỳ.
* tính năng marketplace.
* automation phức tạp.

## 4.2. Không được phá dữ liệu/kho/tiền

Các lỗi sau là blocker:

* Tồn kho ban đầu nhập 10 nhưng lưu thành 0.
* Đơn confirm trừ kho 2 lần.
* Đơn cancel hoàn kho 2 lần.
* Payment hủy nhưng công nợ không cập nhật.
* SKU trùng vẫn lưu.
* Khách trùng số điện thoại vẫn lưu.
* Export lộ giá nhập cho user không có quyền.

## 4.3. Backend phải là nguồn tính toán chính

Frontend có thể tính để hiển thị, nhưng backend phải tính lại:

* subtotal.
* grand_total.
* paid_total.
* debt_total.
* inventory quantity.
* stock status.
* permission.

Không tin hoàn toàn dữ liệu frontend gửi lên.

## 4.4. Mọi thay đổi kho phải có transaction

Không được update inventory_items.quantity trực tiếp mà không tạo inventory_transactions.

## 4.5. Mọi thao tác tiền phải có payment record

Không được sửa paid_total bằng tay mà không có Payment.

## 4.6. Không xóa cứng dữ liệu quan trọng

Không xóa cứng:

* khách đã có đơn.
* SKU đã có kho/đơn.
* đơn hàng.
* payment.
* user đã có lịch sử.
* tag/danh mục đang được dùng.

Ưu tiên:

* inactive.
* cancelled.
* soft delete.

---

# 5. Thứ tự sprint khuyến nghị triển khai thực tế

Nếu cần gom gọn thành roadmap thực thi, làm theo thứ tự này:

1. Sprint 0.1 — Chuẩn hóa project.
2. Sprint 1.1 — Auth cơ bản.
3. Sprint 1.2 — Role cơ bản.
4. Sprint 2.1 — Customer CRUD đầy đủ.
5. Sprint 2.2 — Chống trùng và tìm kiếm khách.
6. Sprint 2.3 — Tag/nguồn/trạng thái khách.
7. Sprint 3.1 — Product + SKU mặc định.
8. Sprint 3.2 — Variant + sinh tổ hợp SKU.
9. Sprint 3.3 — Bulk SKU + search SKU.
10. Sprint 4.1 — Inventory views.
11. Sprint 4.2 — Nhập kho.
12. Sprint 4.3 — Điều chỉnh kho + lịch sử.
13. Sprint 5.1 — Draft order.
14. Sprint 5.2 — Stock validation.
15. Sprint 5.3 — Confirm order + trừ kho.
16. Sprint 5.4 — Cancel order + hoàn kho.
17. Sprint 5.5 — Complete order + lịch sử mua.
18. Sprint 6.1 — Payment cơ bản.
19. Sprint 6.2 — Payment khi tạo đơn.
20. Sprint 6.3 — Debt theo đơn/khách.
21. Sprint 6.4 — Sửa/hủy payment.
22. Sprint 7.1 — Customer activity.
23. Sprint 7.2 — Reminder/task.
24. Sprint 7.3 — Activity + reminder liên kết.
25. Sprint 7.4 — Birthday/remarketing cơ bản.
26. Sprint 8.1 — Dashboard summary.
27. Sprint 8.2 — Sales/product reports.
28. Sprint 8.3 — Inventory/payment/debt reports.
29. Sprint 9.1 — Export cơ bản.
30. Sprint 9.2 — Import customer.
31. Sprint 9.3 — Import product/SKU/inventory.
32. Sprint 10.1 — Audit log nền tảng.
33. Sprint 10.2 — Audit theo đối tượng.
34. Sprint 11.1 — Permission matrix hoàn chỉnh.
35. Sprint 11.2 — Ẩn dữ liệu nhạy cảm.
36. Sprint 12.1 — E2E test.
37. Sprint 12.2 — Fix bug, docs, seed data, ổn định MVP.

---

# 6. MVP được coi là hoàn thành khi nào?

MVP được coi là hoàn thành khi cửa hàng có thể dùng phần mềm để làm các việc sau:

1. Đăng nhập bằng tài khoản riêng.
2. Tạo khách hàng đầy đủ.
3. Không tạo trùng khách theo số điện thoại.
4. Tạo sản phẩm không biến thể.
5. Tạo sản phẩm có biến thể.
6. Tự sinh SKU.
7. Theo dõi tồn kho từng SKU.
8. Nhập kho.
9. Điều chỉnh kho có lịch sử.
10. Tạo đơn hàng chọn đúng SKU.
11. Xác nhận đơn trừ kho đúng.
12. Hủy đơn hoàn kho đúng.
13. Ghi nhận thanh toán nhiều lần.
14. Theo dõi công nợ theo đơn.
15. Theo dõi công nợ theo khách.
16. Ghi lịch sử chăm sóc khách.
17. Tạo nhắc việc chăm sóc.
18. Lọc khách sinh nhật/lâu chưa mua/còn nợ.
19. Xem dashboard doanh thu, tiền thu, công nợ, kho, việc cần làm.
20. Export dữ liệu cơ bản.
21. Import khách/sản phẩm/kho cơ bản.
22. Có phân quyền cơ bản.
23. Có audit log cho thao tác nhạy cảm.
24. Các lỗi kho/tiền/SKU/công nợ nghiêm trọng không còn.

---

# 7. Kết luận

Kế hoạch MVP này ưu tiên đúng thứ tự:

Khách hàng → Sản phẩm/SKU → Kho → Đơn hàng → Thanh toán/Công nợ → Chăm sóc → Báo cáo → Import/Export → Audit/Phân quyền hoàn chỉnh.

Đây là thứ tự an toàn nhất vì mỗi module sau phụ thuộc vào dữ liệu của module trước.

Không nên làm dashboard, báo cáo, import/export nâng cao hoặc automation khi các phần lõi như SKU, kho, đơn hàng, thanh toán chưa đúng.

MVP phải đơn giản trong thao tác, nhưng không được hời hợt trong dữ liệu lõi.
