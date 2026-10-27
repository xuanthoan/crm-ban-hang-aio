# CRM_Ban_Hang

# TÀI LIỆU TỔNG HỢP ĐẶC TẢ LÕI

# Bản cập nhật: có bổ sung thông tin con cái của khách hàng

## 1. Mục tiêu phần mềm

CRM_Ban_Hang là phần mềm quản lý bán hàng, khách hàng, sản phẩm, kho hàng, đơn hàng, thanh toán, công nợ, chăm sóc khách hàng và báo cáo.

Phần mềm được thiết kế cho các cửa hàng bán sản phẩm vật lý có thể thay đổi ngành hàng theo thời gian, ví dụ:

* Sách thiếu nhi.
* Đồ chơi trẻ em.
* Kinh sách Phật giáo.
* Cặp sách, balo.
* Quần áo.
* Mỹ phẩm.
* Đồ gia dụng.
* Sữa.
* Đồ dùng học tập.
* Sản phẩm vật lý khác.

Nguyên tắc thiết kế:

**Đơn giản trong thao tác, chuẩn/chặt ở dữ liệu lõi.**

MVP không cần quá nhiều tính năng nâng cao, nhưng các nghiệp vụ cốt lõi không được làm hời hợt.

---

## 2. Luồng nghiệp vụ tổng thể

Luồng chính của phần mềm:

1. Có khách hàng.
2. Ghi nhận thông tin khách hàng.
3. Ghi nhận thông tin con cái của khách nếu có.
4. Chăm sóc/tư vấn khách hàng.
5. Tạo sản phẩm cha.
6. Tạo SKU/biến thể cụ thể.
7. Quản lý tồn kho theo SKU.
8. Tạo đơn hàng.
9. Chọn đúng khách hàng.
10. Chọn đúng SKU.
11. Kiểm tra tồn kho.
12. Xác nhận đơn và trừ kho.
13. Ghi nhận thanh toán.
14. Theo dõi công nợ.
15. Hoàn thành/hủy/hoàn hàng.
16. Chăm sóc lại khách hàng.
17. Lọc khách để remarketing.
18. Xem báo cáo/dashboard.
19. Import/export dữ liệu.
20. Truy vết thao tác quan trọng bằng audit log.

---

## 3. Module Khách hàng / CRM

### 3.1. Mục tiêu

Quản lý đầy đủ hồ sơ khách hàng, tránh trùng lặp, hỗ trợ chăm sóc lại, bán lại và remarketing.

### 3.2. Thông tin khách hàng chính

Bảng `customers` nên có:

* id
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
* created_at
* updated_at
* deleted_at

### 3.3. Chống trùng số điện thoại

Phải kiểm tra trùng:

* phone_1 mới với phone_1 cũ.
* phone_1 mới với phone_2 cũ.
* phone_2 mới với phone_1 cũ.
* phone_2 mới với phone_2 cũ.

Số điện thoại cần được chuẩn hóa trước khi so sánh.

Không được tạo khách trùng số điện thoại mà không cảnh báo/chặn.

### 3.4. Tag, nguồn, trạng thái

Khách hàng có thể có:

* Nguồn khách: Facebook, Zalo, TikTok, Website, Shopee, Giới thiệu, Offline, Khác.
* Trạng thái: Mới, Đang tư vấn, Đã mua, Cần chăm sóc lại, Tạm ngưng, Không tiềm năng, VIP.
* Mức độ tiềm năng: Nóng, Ấm, Lạnh, Chưa xác định.
* Tag: VIP, Mua nhiều, Có con nhỏ, Quan tâm balo, Quan tâm sữa, Khách mua buôn...

### 3.5. Thông tin con cái của khách hàng

Bổ sung bảng riêng:

`customer_children`

Trường:

* id
* customer_id
* full_name
* birthday
* gender
* note
* sort_order
* status
* created_by
* updated_by
* created_at
* updated_at
* deleted_at

Nguyên tắc:

* Một khách hàng có thể có nhiều con.
* Không giới hạn cứng số lượng con trong database.
* Không lưu kiểu child_1_name, child_2_name trực tiếp trong bảng customers.
* Giao diện dùng nút “+ Thêm con”.
* Mỗi lần bấm thêm một khối thông tin bé.
* Có thể sửa/xóa mềm từng bé.
* Ngày sinh bé không được ở tương lai.
* Thông tin bé không bắt buộc, nhưng nếu có sẽ phục vụ chăm sóc và remarketing.

Thông tin mỗi bé:

* Họ tên con.
* Ngày sinh.
* Giới tính.
* Ghi chú.

Mục đích sử dụng:

* Tặng quà sinh nhật bé.
* Giảm giá đúng tháng sinh nhật bé.
* Lọc khách có con trong độ tuổi 0–1, 1–3, 3–6, 6–10.
* Lọc khách có con sắp vào lớp 1.
* Bán lại sữa, đồ chơi, sách thiếu nhi, balo, đồ dùng học tập.
* Tạo reminder “Chúc mừng sinh nhật bé”.

---

## 4. Module Sản phẩm / SKU

### 4.1. Nguyên tắc

Sản phẩm cha không phải là đơn vị bán/kho cụ thể.

Đơn vị bán thật là SKU/ProductVariant.

Ví dụ:

Sản phẩm cha: Áo thun nữ 2027

SKU:

* Đen / S
* Đen / M
* Trắng / S
* Trắng / M

Đơn hàng và kho phải dùng SKU, không dùng sản phẩm cha chung chung.

### 4.2. Bảng products

Trường:

* id
* product_code
* name
* category_id
* category_name
* brand
* description
* default_image_url
* status
* internal_note
* created_by
* updated_by
* created_at
* updated_at
* deleted_at

### 4.3. Bảng product_variants

Trường:

* id
* product_id
* sku
* variant_name
* option_1_name
* option_1_value
* option_2_name
* option_2_value
* option_3_name
* option_3_value
* unit
* import_price
* retail_price
* sale_price
* image_url
* barcode
* low_stock_threshold
* status
* created_by
* updated_by
* created_at
* updated_at
* deleted_at

### 4.4. Sản phẩm không biến thể

Nếu sản phẩm không có biến thể, hệ thống vẫn phải tạo một SKU mặc định.

Không được có sản phẩm không có SKU.

### 4.5. Sản phẩm có biến thể

Giao diện:

* Mặc định không có biến thể.
* Có checkbox “Sản phẩm có biến thể”.
* Bật lên mới hiện Biến thể 1.
* Sau khi nhập Biến thể 1 mới hiện Biến thể 2.
* Sau khi nhập Biến thể 2 mới hiện Biến thể 3.
* Không hiện sẵn cả 3 biến thể gây rối.

Hệ thống tự sinh tổ hợp SKU từ các giá trị biến thể.

Ví dụ:

Màu: Đen, Trắng
Size: S, M

Sinh ra:

* Đen / S
* Đen / M
* Trắng / S
* Trắng / M

### 4.6. Auto SKU

Nếu người dùng để trống SKU, hệ thống tự sinh.

Ví dụ:

Áo thun nữ 2027 + Đen + S
→ `AO-THUN-NU-2027-DEN-S`

Nếu trùng, thêm hậu tố:

* `AO-THUN-NU-2027-DEN-S-002`

Không cho SKU trùng.

---

## 5. Module Kho hàng

### 5.1. Nguyên tắc

Kho quản lý theo SKU, không quản lý theo sản phẩm cha.

Mỗi SKU có một `inventory_item`.

Mọi thay đổi tồn kho phải có `inventory_transaction`.

Không được sửa quantity trực tiếp mà không có lịch sử.

### 5.2. Bảng inventory_items

Trường:

* id
* product_variant_id
* quantity
* created_at
* updated_at

### 5.3. Bảng inventory_transactions

Trường:

* id
* product_variant_id
* transaction_type
* quantity_before
* quantity_changed
* quantity_after
* reason
* note
* reference_type
* reference_id
* created_by
* created_at

Loại giao dịch:

* initial
* import
* export
* adjustment_increase
* adjustment_decrease
* set
* order_confirmed
* order_cancelled
* return

### 5.4. Quy tắc kho

* Không cho tồn kho âm trong MVP.
* Tồn ban đầu khi tạo SKU phải lưu đúng.
* Nhập kho phải tạo transaction.
* Điều chỉnh kho phải tạo transaction.
* Xác nhận đơn trừ kho phải tạo transaction.
* Hủy đơn hoàn kho phải tạo transaction.
* Không trừ kho nhiều lần cho cùng một đơn.
* Không hoàn kho nhiều lần cho cùng một đơn.

---

## 6. Module Bán hàng / Đơn hàng

### 6.1. Nguyên tắc

Đơn hàng phải chọn SKU cụ thể.

Không được chọn sản phẩm cha nếu sản phẩm có biến thể.

### 6.2. Bảng orders

Trường:

* id
* order_code
* customer_id
* customer_name_snapshot
* customer_phone_snapshot
* shipping_name
* shipping_phone
* shipping_address
* province
* district
* ward
* source
* sales_user_id
* status
* payment_status
* subtotal
* order_discount_amount
* shipping_fee
* grand_total
* paid_total
* debt_total
* internal_note
* shipping_note
* cancel_reason
* return_reason
* inventory_deducted
* inventory_deducted_at
* inventory_restored
* inventory_restored_at
* confirmed_at
* completed_at
* cancelled_at
* returned_at
* created_by
* updated_by
* created_at
* updated_at
* deleted_at

### 6.3. Bảng order_items

Trường:

* id
* order_id
* product_variant_id
* sku_snapshot
* product_name_snapshot
* variant_name_snapshot
* unit
* quantity
* unit_price
* discount_amount
* line_total
* created_at
* updated_at

### 6.4. Trạng thái đơn

* draft
* confirmed
* packing
* shipping
* completed
* cancelled
* returned

MVP có thể dùng trước:

* draft
* confirmed
* completed
* cancelled

### 6.5. Quy tắc trừ kho

Trừ kho khi đơn chuyển sang confirmed.

Khi confirm:

1. Kiểm tra tồn từng SKU.
2. Nếu thiếu tồn, không confirm.
3. Nếu đủ tồn, trừ kho.
4. Tạo inventory_transaction `order_confirmed`.
5. Set `inventory_deducted = true`.

Nếu `inventory_deducted = true`, không được trừ lần nữa.

### 6.6. Quy tắc hủy đơn

Khi hủy:

* Nếu đơn chưa trừ kho: chỉ đổi trạng thái.
* Nếu đơn đã trừ kho: hoàn kho.
* Tạo transaction `order_cancelled`.
* Set `inventory_restored = true`.

Nếu `inventory_restored = true`, không hoàn kho lần nữa.

---

## 7. Module Thanh toán / Công nợ

### 7.1. Nguyên tắc

Một đơn hàng có thể thanh toán nhiều lần.

Không sửa trực tiếp `paid_total` bằng tay.

`paid_total` phải tính từ các payment active.

### 7.2. Bảng payments

Trường:

* id
* order_id
* customer_id
* amount
* payment_method
* paid_at
* note
* status
* cancelled_reason
* cancelled_at
* cancelled_by
* created_by
* updated_by
* created_at
* updated_at

Status:

* active
* cancelled

### 7.3. Trạng thái thanh toán

* unpaid
* partial
* paid

Cách tính:

* paid_total = 0 → unpaid.
* 0 < paid_total < grand_total → partial.
* paid_total = grand_total → paid.

Không cho paid_total > grand_total trong MVP.

### 7.4. Công nợ

Công nợ đơn:

* debt_total = grand_total - paid_total.

Công nợ khách:

* tổng debt_total của các đơn còn nợ của khách.

Cần có:

* Công nợ theo đơn.
* Công nợ theo khách.
* Công nợ trong hồ sơ khách hàng.
* Nhắc thanh toán nếu khách còn nợ.

---

## 8. Module Chăm sóc / Nhắc việc / Remarketing

### 8.1. Customer activities

Bảng `customer_activities`:

* id
* customer_id
* order_id
* activity_type
* content
* result
* next_follow_up_at
* created_by
* created_at
* updated_at

Dùng để lưu:

* Gọi điện.
* Nhắn Zalo.
* Nhắn Facebook.
* Tư vấn.
* Báo giá.
* Chốt đơn.
* Chăm sóc sau mua.
* Nhắc thanh toán.
* Ghi chú nội bộ.

### 8.2. Reminders / Tasks

Bảng `reminders`:

* id
* customer_id
* order_id
* title
* content
* reminder_type
* due_at
* status
* assigned_to
* created_by
* completed_by
* completed_at
* cancelled_at
* created_at
* updated_at

Loại reminder:

* follow_up
* birthday
* child_birthday
* payment_reminder
* after_sale
* complaint
* delivery
* other

### 8.3. Remarketing cơ bản

Cần lọc được:

* Khách sinh nhật hôm nay/tháng này.
* Bé sinh nhật hôm nay/tháng này.
* Khách có con trong độ tuổi X.
* Khách lâu chưa mua lại.
* Khách còn nợ.
* Khách theo tag.
* Khách theo nguồn.
* Khách từng mua sản phẩm/danh mục cụ thể.
* Khách chưa từng mua.
* Khách VIP.
* Khách mua nhiều.

MVP chưa cần gửi SMS/Zalo tự động. Chỉ cần lọc đúng tệp và hỗ trợ chăm sóc thủ công.

---

## 9. Module Báo cáo / Dashboard

### 9.1. Dashboard cần có

* Doanh thu.
* Tiền đã thu.
* Công nợ.
* Số đơn hàng.
* Khách hàng mới.
* SKU sắp hết.
* SKU hết hàng.
* Việc hôm nay.
* Việc quá hạn.
* Khách sinh nhật.
* Bé sinh nhật.
* Khách lâu chưa mua.

### 9.2. Quy tắc báo cáo

* Doanh thu không tính đơn draft/cancelled.
* Tiền đã thu chỉ tính payment active.
* Công nợ phải khớp danh sách công nợ.
* Tồn kho phải khớp inventory_items.
* Dữ liệu nhạy cảm phải theo quyền.

### 9.3. Báo cáo cơ bản

* Báo cáo bán hàng.
* Báo cáo sản phẩm/SKU bán chạy.
* Báo cáo tồn kho.
* Báo cáo thanh toán.
* Báo cáo công nợ.
* Báo cáo khách hàng.
* Báo cáo chăm sóc.
* Báo cáo nguồn khách.
* Báo cáo nhân viên.

---

## 10. Module Người dùng / Phân quyền / Cấu hình

### 10.1. Vai trò mặc định

* Admin
* Manager
* Sales
* Warehouse
* Accountant

### 10.2. Nguyên tắc phân quyền

Backend phải kiểm tra quyền, không chỉ ẩn nút frontend.

Các dữ liệu nhạy cảm:

* giá nhập
* lãi gộp
* giá trị tồn kho
* công nợ toàn hệ thống
* doanh thu toàn hệ thống
* export toàn bộ khách hàng

### 10.3. Cấu hình hệ thống

Cần cấu hình:

* Nguồn khách.
* Tag khách hàng.
* Danh mục sản phẩm.
* Đơn vị tính.
* Phương thức thanh toán.
* Trạng thái khách.
* Trạng thái đơn.
* Mã SKU.
* Mã đơn hàng.
* Ngưỡng tồn thấp.
* Chính sách trừ kho.

---

## 11. Module Import / Export Excel

### 11.1. Import

Cần hỗ trợ:

* Import khách hàng.
* Import sản phẩm/SKU.
* Import tồn kho.
* Import thông tin con cái, có thể nằm trong file khách hàng hoặc file riêng.

Nguyên tắc:

* Upload file.
* Preview.
* Validate.
* Hiển thị lỗi theo dòng/cột.
* Người dùng xác nhận mới ghi database.
* Nếu lỗi nghiêm trọng, rollback toàn bộ.

### 11.2. Import thông tin con cái

Có 2 hướng:

Cách đơn giản trong MVP:

File khách hàng có thêm cột:

* Con 1 - Họ tên
* Con 1 - Ngày sinh
* Con 1 - Giới tính
* Con 1 - Ghi chú
* Con 2 - Họ tên
* Con 2 - Ngày sinh
* Con 2 - Giới tính
* Con 2 - Ghi chú

File mẫu có thể hỗ trợ một số nhóm cột phổ biến, ví dụ 5 hoặc 10 con.

Nhưng database không giới hạn số lượng con.

Cách mở rộng sau:

Tạo file import riêng `customer_children`:

* customer_code
* customer_phone
* child_full_name
* child_birthday
* child_gender
* child_note

Cách này tốt hơn nếu khách có nhiều con.

### 11.3. Export

Cần hỗ trợ:

* Export khách hàng.
* Export sản phẩm/SKU.
* Export tồn kho.
* Export đơn hàng.
* Export thanh toán.
* Export công nợ.
* Export remarketing.
* Export danh sách bé sinh nhật.

Export phải theo quyền.

Không được export giá nhập/lãi gộp/công nợ nếu user không có quyền.

---

## 12. Audit log

### 12.1. Mục tiêu

Biết ai đã làm gì, khi nào, thay đổi gì.

### 12.2. Bảng audit_logs

Trường:

* id
* user_id
* action
* entity_type
* entity_id
* old_value
* new_value
* reason
* metadata
* ip_address
* user_agent
* created_at

### 12.3. Cần log các thao tác

* Tạo/sửa/xóa khách.
* Thêm/sửa/xóa thông tin con cái.
* Đổi số điện thoại khách.
* Tạo/sửa sản phẩm.
* Đổi giá nhập/giá bán.
* Nhập kho.
* Điều chỉnh kho.
* Tạo/xác nhận/hủy đơn.
* Tạo/sửa/hủy payment.
* Đổi role/quyền user.
* Import/export dữ liệu nhạy cảm.

---

## 13. Kế hoạch MVP theo sprint cập nhật

Thứ tự sprint:

1. Sprint 0.1 — Chuẩn hóa project.
2. Sprint 1.1 — Auth cơ bản.
3. Sprint 1.2 — Role cơ bản.
4. Sprint 2.1 — Customer CRUD đầy đủ.
5. Sprint 2.2 — Chống trùng và tìm kiếm khách.
6. Sprint 2.3 — Tag/nguồn/trạng thái khách.
7. Sprint 2.4 — Thông tin con cái của khách hàng.
8. Sprint 3.1 — Product + SKU mặc định.
9. Sprint 3.2 — Variant + sinh tổ hợp SKU.
10. Sprint 3.3 — Bulk SKU + search SKU.
11. Sprint 4.1 — Inventory views.
12. Sprint 4.2 — Nhập kho.
13. Sprint 4.3 — Điều chỉnh kho + lịch sử.
14. Sprint 5.1 — Draft order.
15. Sprint 5.2 — Stock validation.
16. Sprint 5.3 — Confirm order + trừ kho.
17. Sprint 5.4 — Cancel order + hoàn kho.
18. Sprint 5.5 — Complete order + lịch sử mua.
19. Sprint 6.1 — Payment cơ bản.
20. Sprint 6.2 — Payment khi tạo đơn.
21. Sprint 6.3 — Debt theo đơn/khách.
22. Sprint 6.4 — Sửa/hủy payment.
23. Sprint 7.1 — Customer activity.
24. Sprint 7.2 — Reminder/task.
25. Sprint 7.3 — Activity + reminder liên kết.
26. Sprint 7.4 — Birthday/child birthday/remarketing cơ bản.
27. Sprint 8.1 — Dashboard summary.
28. Sprint 8.2 — Sales/product reports.
29. Sprint 8.3 — Inventory/payment/debt reports.
30. Sprint 9.1 — Export cơ bản.
31. Sprint 9.2 — Import customer.
32. Sprint 9.3 — Import product/SKU/inventory.
33. Sprint 9.4 — Import/export customer children, nếu cần tách riêng.
34. Sprint 10.1 — Audit log nền tảng.
35. Sprint 10.2 — Audit theo đối tượng.
36. Sprint 11.1 — Permission matrix hoàn chỉnh.
37. Sprint 11.2 — Ẩn dữ liệu nhạy cảm.
38. Sprint 12.1 — E2E test.
39. Sprint 12.2 — Fix bug, docs, seed data, ổn định MVP.

---

## 14. Các lỗi nghiêm trọng không được phép có

1. Tạo khách trùng số điện thoại.
2. Sửa số điện thoại thành số đã có của khách khác.
3. Tạo sản phẩm nhưng không có SKU.
4. SKU trùng vẫn lưu.
5. Tồn kho ban đầu nhập 10 nhưng lưu thành 0.
6. Sửa tồn kho không có transaction.
7. Cho tồn kho âm trong MVP.
8. Đơn hàng chọn sản phẩm cha thay vì SKU.
9. Xác nhận đơn trừ kho nhiều lần.
10. Hủy đơn hoàn kho nhiều lần.
11. Hủy đơn đã trừ kho nhưng không hoàn kho.
12. Payment bị hủy nhưng công nợ không cập nhật.
13. paid_total không khớp tổng payment active.
14. debt_total không đúng.
15. Sale xem được giá nhập/lãi gộp khi không có quyền.
16. Export lộ dữ liệu nhạy cảm.
17. Import không validate lỗi dòng/cột.
18. Dashboard tính doanh thu gồm đơn hủy.
19. Tiền đã thu tính cả payment cancelled.
20. Audit log không ghi thao tác kho/tiền/đơn hàng/quyền.
21. Thông tin con cái không hiển thị trong hồ sơ khách sau khi lưu.
22. Lọc sinh nhật bé sai ngày/tháng.
23. Ngày sinh bé ở tương lai vẫn lưu được.

---

## 15. Tính năng chưa làm trong MVP

Không làm trong MVP:

* SMS tự động.
* Zalo OA.
* Facebook Messenger.
* Shopee/Lazada/TikTok Shop integration.
* Mobile app.
* POS nâng cao.
* Barcode scanner thật.
* Nhiều kho phức tạp.
* Nhà cung cấp chi tiết.
* Công nợ nhà cung cấp.
* Kế toán sổ cái.
* Thuế/hóa đơn điện tử.
* AI gợi ý chăm sóc.
* Marketing automation nhiều bước.
* Quản lý lô/hạn sử dụng.
* Hoàn hàng từng phần phức tạp.
* Dự báo tồn kho.

---

## 16. Kết luận

CRM_Ban_Hang cần được triển khai theo thứ tự:

Khách hàng → Con cái khách hàng → Sản phẩm/SKU → Kho → Đơn hàng → Thanh toán/Công nợ → Chăm sóc/Remarketing → Dashboard → Import/Export → Audit/Phân quyền hoàn chỉnh.

Phần bổ sung thông tin con cái của khách hàng là hợp lý và nên được đưa vào CRM lõi, vì nó giúp phần mềm phù hợp hơn với các ngành hàng như sữa, đồ chơi, sách thiếu nhi, balo, đồ dùng học tập và các sản phẩm dành cho trẻ em.

MVP cần đơn giản trong thao tác, nhưng phải chặt ở dữ liệu lõi.
