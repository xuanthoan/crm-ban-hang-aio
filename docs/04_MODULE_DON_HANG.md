# ĐẶC TẢ MODULE CHI TIẾT

# Module Bán hàng / Đơn hàng

# Dự án: CRM_Ban_Hang

## 1. Mục tiêu của module Bán hàng / Đơn hàng

Module Bán hàng / Đơn hàng là trung tâm vận hành của phần mềm CRM_Ban_Hang.

Mục tiêu của module này là giúp người dùng tạo, quản lý và theo dõi toàn bộ quá trình bán hàng:

* Chọn đúng khách hàng.
* Tạo khách hàng mới nếu khách chưa tồn tại.
* Tìm và chọn đúng SKU sản phẩm.
* Kiểm tra tồn kho.
* Thêm nhiều sản phẩm vào đơn.
* Tự tính tổng tiền.
* Áp dụng giảm giá.
* Ghi nhận phí giao hàng.
* Ghi nhận thanh toán.
* Theo dõi công nợ.
* Quản lý trạng thái đơn hàng.
* Tự động trừ kho khi đơn được xác nhận.
* Hoàn kho khi đơn bị hủy hoặc hoàn hàng.
* Cập nhật lịch sử mua hàng của khách.
* Tạo dữ liệu phục vụ báo cáo và remarketing.

Nguyên tắc quan trọng nhất:

**Đơn hàng phải bán theo SKU/ProductVariant, không bán theo sản phẩm cha.**

Ví dụ đúng:

* Áo thun nữ 2027 / Đen / S / SKU: AO-THUN-NU-2027-DEN-S / Số lượng: 2.

Ví dụ sai:

* Áo thun nữ 2027 / Số lượng: 2.

Nếu đơn hàng không chọn SKU cụ thể, hệ thống không thể trừ kho chính xác, báo cáo SKU bán chạy sẽ sai, remarketing theo sản phẩm/biến thể cũng kém chính xác.

---

## 2. Vai trò của module Đơn hàng trong toàn hệ thống

Module Đơn hàng liên kết trực tiếp với:

* Khách hàng.
* Sản phẩm/SKU.
* Kho hàng.
* Thanh toán/Công nợ.
* Chăm sóc khách hàng.
* Báo cáo.
* Remarketing.
* Nhật ký thao tác.

Quan hệ nghiệp vụ:

* Một khách hàng có nhiều đơn hàng.
* Một đơn hàng có nhiều dòng sản phẩm.
* Mỗi dòng sản phẩm là một SKU cụ thể.
* Một đơn hàng có thể có nhiều lần thanh toán.
* Một đơn hàng có thể còn nợ.
* Một đơn hàng có thể tạo biến động kho.
* Một đơn hàng hoàn thành sẽ trở thành lịch sử mua hàng của khách.
* Dữ liệu đơn hàng dùng để xác định khách đã mua sản phẩm nào, danh mục nào, SKU nào.

Nếu module Đơn hàng làm sai, các phần sau sẽ sai theo:

* Kho.
* Công nợ.
* Báo cáo doanh thu.
* Báo cáo sản phẩm bán chạy.
* Lịch sử mua hàng khách hàng.
* Remarketing.

---

## 3. Người dùng của module Bán hàng / Đơn hàng

### 3.1. Chủ cửa hàng / Admin

Nhu cầu:

* Xem toàn bộ đơn hàng.
* Biết hôm nay bán được bao nhiêu.
* Biết đơn nào đang xử lý.
* Biết đơn nào bị hủy.
* Biết đơn nào còn nợ.
* Biết nhân viên nào bán tốt.
* Biết nguồn khách nào tạo đơn.
* Kiểm tra đơn có sai giá, sai kho, sai thanh toán không.

Quyền:

* Xem toàn bộ đơn.
* Tạo/sửa/hủy đơn.
* Xem doanh thu.
* Xem công nợ.
* Ghi nhận thanh toán.
* Duyệt hoặc xử lý đơn nếu cần.
* Xem lịch sử thao tác.

---

### 3.2. Quản lý bán hàng

Nhu cầu:

* Theo dõi đơn hàng của đội sale.
* Kiểm tra trạng thái đơn.
* Hỗ trợ xử lý đơn hủy/hoàn.
* Kiểm tra khách còn nợ.
* Kiểm tra doanh thu theo nhân viên.
* Kiểm tra đơn chưa xác nhận, đơn đang giao, đơn cần xử lý.

Quyền:

* Xem đơn trong phạm vi được phân quyền.
* Tạo/sửa đơn nếu được phép.
* Chuyển trạng thái đơn.
* Ghi nhận hoặc xem thanh toán nếu được phép.
* Xem công nợ theo quyền.

---

### 3.3. Nhân viên bán hàng / Sale

Nhu cầu:

* Tạo đơn nhanh.
* Tìm khách theo số điện thoại.
* Tạo khách mới nếu chưa có.
* Tìm SKU nhanh.
* Xem giá bán/tồn kho.
* Thêm sản phẩm vào đơn.
* Ghi chú đơn hàng.
* Theo dõi đơn của khách mình phụ trách.
* Ghi nhận khách đã thanh toán hoặc còn nợ nếu được phân quyền.

Quyền:

* Tạo đơn hàng.
* Xem đơn do mình tạo hoặc khách mình phụ trách.
* Sửa đơn ở trạng thái nháp.
* Chuyển đơn từ nháp sang đã xác nhận nếu được phép.
* Không hủy đơn đã xác nhận nếu không có quyền.
* Không sửa kho trực tiếp.

---

### 3.4. Nhân viên kho

Nhu cầu:

* Xem đơn cần đóng gói/xuất hàng.
* Xem SKU trong đơn.
* Kiểm tra tồn kho.
* Xử lý đơn đang đóng gói/giao hàng nếu quy trình cần.
* Không cần xem toàn bộ thông tin giá/lợi nhuận nếu không được phân quyền.

Quyền:

* Xem đơn liên quan đến xử lý kho.
* Xem SKU và số lượng cần xuất.
* Cập nhật trạng thái đóng gói/giao hàng nếu được phép.
* Không sửa giá, giảm giá, thanh toán nếu không được phân quyền.

---

### 3.5. Kế toán / Thu ngân

Nhu cầu:

* Xem đơn hàng.
* Ghi nhận thanh toán.
* Theo dõi đơn còn nợ.
* Xem lịch sử thanh toán.
* Kiểm tra công nợ khách hàng.

Quyền:

* Xem đơn hàng.
* Ghi nhận thanh toán.
* Sửa/xóa thanh toán nếu được phân quyền.
* Xem công nợ.
* Không nhất thiết được sửa sản phẩm/kho.

---

## 4. Cấu trúc module Đơn hàng

Module Đơn hàng nên có các màn hình chính:

1. Danh sách đơn hàng.
2. Tạo đơn hàng.
3. Chi tiết đơn hàng.
4. Sửa đơn hàng, trong phạm vi cho phép.
5. Xử lý trạng thái đơn hàng.
6. Hủy đơn hàng.
7. Hoàn hàng, có thể để sau MVP hoặc làm đơn giản.
8. Ghi nhận thanh toán, liên kết với module Thanh toán/Công nợ.
9. Lịch sử thao tác đơn hàng.

---

## 5. Màn hình Danh sách đơn hàng

### 5.1. Mục tiêu

Màn hình này giúp người dùng theo dõi và tìm kiếm đơn hàng nhanh.

Câu hỏi cần trả lời:

* Hôm nay có bao nhiêu đơn?
* Đơn nào đang xử lý?
* Đơn nào chưa thanh toán?
* Đơn nào còn nợ?
* Đơn nào bị hủy?
* Đơn nào của khách A?
* Đơn nào do nhân viên B tạo?
* Đơn nào từ nguồn Facebook/Zalo/TikTok?
* Đơn nào cần đóng gói/giao hàng?

### 5.2. Thành phần màn hình

* Tiêu đề: Đơn hàng.
* Nút “Tạo đơn hàng”.
* Ô tìm kiếm.
* Bộ lọc.
* Bảng danh sách đơn hàng.
* Tổng số đơn.
* Tổng doanh thu theo bộ lọc, nếu có quyền.
* Tổng công nợ theo bộ lọc, nếu có quyền.
* Phân trang.
* Export, có thể làm sau MVP.

### 5.3. Tìm kiếm đơn hàng

Tìm theo:

* Mã đơn hàng.
* Tên khách hàng.
* Số điện thoại khách hàng.
* SKU trong đơn.
* Tên sản phẩm trong đơn.
* Ghi chú đơn hàng.

MVP nên hỗ trợ ít nhất:

* Mã đơn.
* Tên khách.
* Số điện thoại.
* SKU hoặc tên sản phẩm.

### 5.4. Bộ lọc đơn hàng

Bộ lọc:

* Trạng thái đơn.
* Trạng thái thanh toán.
* Nguồn đơn.
* Nhân viên bán hàng.
* Khách hàng.
* Khoảng ngày tạo.
* Khoảng ngày hoàn thành.
* Đơn còn nợ.
* Đơn đã hủy.
* Đơn có sản phẩm/SKU cụ thể.
* Đơn theo danh mục sản phẩm, có thể để sau.

MVP nên có:

* Trạng thái đơn.
* Trạng thái thanh toán.
* Nhân viên bán hàng.
* Khoảng ngày.
* Nguồn đơn.
* Đơn còn nợ.

### 5.5. Cột trong bảng đơn hàng

Cột đề xuất:

* Mã đơn.
* Ngày tạo.
* Khách hàng.
* Số điện thoại.
* Tổng tiền.
* Đã thanh toán.
* Còn nợ.
* Trạng thái đơn.
* Trạng thái thanh toán.
* Nguồn đơn.
* Nhân viên bán hàng.
* Hành động.

Hành động:

* Xem chi tiết.
* Sửa, nếu được phép.
* Ghi nhận thanh toán.
* Chuyển trạng thái.
* Hủy đơn.
* In/xuất đơn, để sau MVP.

---

## 6. Màn hình Tạo đơn hàng

### 6.1. Mục tiêu

Tạo đơn hàng phải nhanh, rõ ràng, ít nhầm lẫn.

Luồng chính:

1. Chọn khách hàng.
2. Thêm SKU vào đơn.
3. Nhập số lượng.
4. Kiểm tra tồn kho.
5. Tính tiền.
6. Ghi thanh toán.
7. Lưu đơn.

### 6.2. Bố cục màn hình tạo đơn

Màn hình nên chia thành các khối:

1. Thông tin khách hàng.
2. Thông tin giao hàng.
3. Danh sách sản phẩm/SKU trong đơn.
4. Tổng tiền và giảm giá.
5. Thanh toán.
6. Ghi chú.
7. Nút lưu.

---

## 7. Khối chọn khách hàng

### 7.1. Tìm khách hàng

Người dùng tìm khách theo:

* Số điện thoại.
* Họ tên.
* Email.
* Zalo.

Kết quả tìm kiếm hiển thị:

* Tên khách.
* Số điện thoại.
* Địa chỉ.
* Tag.
* Công nợ hiện tại.
* Lần mua gần nhất.
* Nhân viên phụ trách.

### 7.2. Chọn khách đã có

Khi chọn khách, hệ thống tự điền:

* Tên khách.
* Số điện thoại.
* Địa chỉ giao hàng.
* Ghi chú giao hàng nếu có.
* Công nợ hiện tại, nếu có.
* Lịch sử mua gần nhất, có thể hiển thị tóm tắt.

### 7.3. Khách chưa có

Nếu khách chưa tồn tại, người dùng có thể bấm “Thêm khách hàng”.

Theo định hướng đã chốt, form thêm khách hàng nên là form đầy đủ, nhưng có thể mở dưới dạng modal hoặc chuyển sang màn hình khách hàng.

Trong luồng tạo đơn, để thao tác không bị đứt đoạn, có thể dùng modal đầy đủ nhưng chia nhóm rõ ràng.

Sau khi tạo khách xong:

* Quay lại đơn hàng.
* Tự chọn khách vừa tạo.
* Không mất sản phẩm đã nhập trong đơn.

### 7.4. Khách lẻ

Có nên hỗ trợ khách lẻ không?

Đề xuất:

* MVP nên hỗ trợ khách lẻ đơn giản, nhưng khuyến khích tạo khách hàng nếu có số điện thoại.

Khách lẻ dùng khi:

* Bán tại cửa hàng.
* Khách không cung cấp thông tin.
* Không cần chăm sóc lại.

Tuy nhiên, nếu quá lạm dụng khách lẻ, CRM mất giá trị.

Có thể có một khách hệ thống tên:

* Khách lẻ.

Nhưng nếu nhập số điện thoại, nên tạo khách thật.

---

## 8. Khối thông tin giao hàng

Trường:

* Tên người nhận.
* Số điện thoại nhận hàng.
* Địa chỉ giao hàng.
* Tỉnh/thành.
* Quận/huyện.
* Phường/xã.
* Ghi chú giao hàng.
* Đơn vị vận chuyển, có thể để sau MVP.
* Mã vận đơn, để sau MVP.

Quy tắc:

* Nếu chọn khách hàng có địa chỉ, tự điền địa chỉ.
* Người dùng có thể sửa địa chỉ giao hàng riêng cho đơn.
* Địa chỉ đơn hàng nên lưu snapshot riêng, không phụ thuộc hoàn toàn vào hồ sơ khách, vì khách có thể giao tới địa chỉ khác.

---

## 9. Khối thêm sản phẩm/SKU vào đơn

### 9.1. Nguyên tắc

Đơn hàng phải chọn SKU cụ thể.

Không cho chọn sản phẩm cha nếu sản phẩm có biến thể.

### 9.2. Tìm SKU

Người dùng tìm SKU theo:

* Tên sản phẩm.
* SKU.
* Barcode.
* Màu sắc.
* Size.
* Giá trị biến thể.
* Danh mục.
* Thương hiệu.

Ví dụ tìm:

* “áo thun nữ đen s”.
* “den s”.
* “AO-THUN-NU-2027-DEN-S”.
* “balo xanh 20l”.

Kết quả tìm kiếm nên hiển thị:

* Ảnh nhỏ.
* Tên sản phẩm.
* Biến thể.
* SKU.
* Giá bán.
* Tồn kho hiện tại.
* Trạng thái tồn.
* Trạng thái SKU.

Ví dụ:

Áo thun nữ 2027
Đen / S
SKU: AO-THUN-NU-2027-DEN-S
Giá: 129.000
Tồn: 20

### 9.3. Chọn SKU

Khi chọn SKU, thêm vào bảng sản phẩm trong đơn.

Nếu SKU đã có trong đơn:

* Có thể tăng số lượng thay vì thêm dòng mới.
* Hoặc cảnh báo “SKU này đã có trong đơn”.

Đề xuất MVP:

* Nếu SKU đã có, tự tăng số lượng thêm 1.

### 9.4. Dòng sản phẩm trong đơn

Mỗi dòng gồm:

* SKU.
* Tên sản phẩm.
* Biến thể.
* Số lượng.
* Tồn kho hiện tại.
* Giá bán.
* Giảm giá dòng.
* Thành tiền.
* Hành động xóa dòng.

### 9.5. Kiểm tra tồn kho khi thêm sản phẩm

Khi thêm SKU:

* Nếu SKU inactive: không cho thêm.
* Nếu sản phẩm cha inactive: không cho thêm.
* Nếu tồn = 0: cảnh báo hoặc chặn.
* Nếu tồn thấp: cảnh báo.
* Nếu số lượng vượt tồn: chặn trong MVP.

Thông báo:

“SKU này đã ngừng bán.”
“Sản phẩm này đã ngừng bán.”
“SKU này đã hết hàng.”
“Tồn kho không đủ. Hiện chỉ còn 3.”

### 9.6. Kiểm tra tồn kho khi thay đổi số lượng

Nếu người dùng tăng số lượng:

* Kiểm tra số lượng <= tồn khả dụng.
* Nếu vượt, chặn và báo lỗi.

MVP nên dùng tồn hiện tại làm tồn khả dụng.

Sau này có thể có tồn khả dụng = tồn hiện tại - số lượng đã giữ cho đơn khác.

---

## 10. Giá bán và giảm giá

### 10.1. Giá mặc định

Khi thêm SKU vào đơn:

* Nếu SKU có sale_price thì dùng sale_price.
* Nếu không có sale_price thì dùng retail_price.

Người dùng có thể sửa giá bán trên dòng đơn nếu có quyền.

### 10.2. Giảm giá dòng

Mỗi dòng có thể có giảm giá:

* Giảm số tiền.
* Hoặc giảm phần trăm, làm sau nếu muốn.

MVP nên làm đơn giản:

* discount_amount trên từng dòng.

Thành tiền dòng:

* line_total = quantity × unit_price - discount_amount.

Không cho line_total âm.

### 10.3. Giảm giá toàn đơn

Đơn hàng có thể có giảm giá tổng:

* order_discount_amount.

Tổng tiền:

* subtotal = tổng line_total trước giảm toàn đơn.
* grand_total = subtotal - order_discount_amount + shipping_fee.

Không cho grand_total âm.

### 10.4. Quyền sửa giá/giảm giá

Không phải ai cũng được sửa giá hoặc giảm giá.

Gợi ý:

* Admin: được sửa.
* Quản lý: được sửa.
* Sale: có thể được sửa trong giới hạn.
* Kho: không được sửa.
* Kế toán: tùy quyền.

MVP có thể cho sale sửa giá, nhưng sau này nên phân quyền.

---

## 11. Tổng tiền đơn hàng

Các trường tiền cần có:

* subtotal: tổng tiền hàng sau giảm dòng.
* order_discount_amount: giảm giá toàn đơn.
* shipping_fee: phí ship.
* grand_total: tổng thanh toán.
* paid_total: đã thanh toán.
* debt_total: còn nợ.

Công thức:

* subtotal = tổng các dòng sản phẩm.
* grand_total = subtotal - order_discount_amount + shipping_fee.
* debt_total = grand_total - paid_total.

Quy tắc:

* subtotal >= 0.
* order_discount_amount >= 0.
* shipping_fee >= 0.
* grand_total >= 0.
* paid_total >= 0.
* paid_total không nên lớn hơn grand_total trong MVP, trừ khi hỗ trợ trả thừa.
* debt_total >= 0.

Thông báo:

“Số tiền giảm giá không hợp lệ.”
“Phí ship không được âm.”
“Số tiền thanh toán không được lớn hơn tổng đơn.”

---

## 12. Thanh toán trong đơn hàng

### 12.1. Mục tiêu

Khi tạo đơn, người dùng có thể ghi nhận thanh toán ngay.

Ví dụ:

* Khách thanh toán đủ.
* Khách cọc một phần.
* Khách chưa thanh toán.
* Khách COD.

### 12.2. Phương thức thanh toán

Gợi ý:

* Tiền mặt.
* Chuyển khoản.
* COD.
* Ví điện tử.
* Khác.

### 12.3. Trạng thái thanh toán

Tự tính từ grand_total và paid_total:

* unpaid: chưa thanh toán.
* partial: thanh toán một phần.
* paid: đã thanh toán.

Nếu paid_total = 0:

* Chưa thanh toán.

Nếu 0 < paid_total < grand_total:

* Thanh toán một phần.

Nếu paid_total = grand_total:

* Đã thanh toán.

### 12.4. Tạo payment khi tạo đơn

Nếu người dùng nhập paid_amount > 0 khi tạo đơn:

* Tạo order.
* Tạo payment.
* Cập nhật paid_total.
* Cập nhật debt_total.

Nếu không nhập thanh toán:

* paid_total = 0.
* debt_total = grand_total.

Chi tiết thanh toán đầy đủ sẽ nằm trong module Thanh toán/Công nợ.

---

## 13. Trạng thái đơn hàng

### 13.1. Trạng thái đề xuất

MVP nên có các trạng thái:

* draft: Nháp.
* confirmed: Đã xác nhận.
* packing: Đang đóng gói.
* shipping: Đang giao.
* completed: Hoàn thành.
* cancelled: Hủy.
* returned: Hoàn hàng.

### 13.2. Ý nghĩa trạng thái

Draft / Nháp:

* Đơn mới tạo nhưng chưa xác nhận.
* Chưa trừ kho.
* Có thể sửa thoải mái.

Confirmed / Đã xác nhận:

* Đơn đã chốt.
* Hệ thống trừ kho.
* Không nên sửa dòng sản phẩm tùy tiện.

Packing / Đang đóng gói:

* Kho đang xử lý.

Shipping / Đang giao:

* Đơn đang giao khách.

Completed / Hoàn thành:

* Đơn đã hoàn tất.

Cancelled / Hủy:

* Đơn bị hủy.
* Nếu đã trừ kho thì hoàn kho.

Returned / Hoàn hàng:

* Khách hoàn hàng.
* Hoàn kho theo số lượng hoàn.
* MVP có thể làm đơn giản bằng hoàn toàn bộ đơn.

### 13.3. Luồng trạng thái đơn

Luồng cơ bản:

Draft → Confirmed → Packing → Shipping → Completed

Các nhánh:

Draft → Cancelled
Confirmed → Cancelled
Packing → Cancelled
Shipping → Returned
Completed → Returned, nếu hỗ trợ hoàn hàng sau hoàn thành.

MVP có thể đơn giản:

Draft → Confirmed → Completed
Draft/Confirmed → Cancelled

Packing/Shipping có thể có nhưng chưa cần xử lý phức tạp.

---

## 14. Quy tắc trừ kho

### 14.1. Khi nào trừ kho?

Đề xuất MVP:

**Trừ kho khi đơn chuyển sang trạng thái Đã xác nhận.**

Lý do:

* Đơn nháp có thể sửa nhiều lần, chưa nên trừ kho.
* Khi đã xác nhận, đơn được coi là chốt, cần giữ/trừ hàng.

### 14.2. Quy tắc trừ kho

Khi chuyển sang confirmed:

1. Kiểm tra tất cả SKU trong đơn.
2. Nếu bất kỳ SKU nào không đủ tồn, không xác nhận đơn.
3. Nếu tất cả đủ tồn, trừ kho từng SKU.
4. Tạo inventory_transaction loại order_confirmed cho từng SKU.
5. Gắn reference_type = order.
6. Gắn reference_id = order_id.
7. Đánh dấu order.inventory_deducted = true.
8. Lưu inventory_deducted_at.

### 14.3. Chặn trừ kho nhiều lần

Đây là quy tắc cực kỳ quan trọng.

Nếu order.inventory_deducted = true:

* Không được trừ kho lần nữa.
* Chuyển trạng thái qua lại không được tạo transaction trừ kho thêm.

Nếu không kiểm soát, cùng một đơn có thể trừ kho 2-3 lần, gây sai kho nghiêm trọng.

---

## 15. Quy tắc hoàn kho khi hủy đơn

### 15.1. Khi nào hoàn kho?

Nếu đơn đã trừ kho và sau đó bị hủy:

* Hệ thống phải hoàn lại đúng số lượng đã trừ.

### 15.2. Quy tắc hoàn kho

Khi chuyển sang cancelled:

1. Kiểm tra đơn đã trừ kho chưa.
2. Nếu chưa trừ kho, chỉ đổi trạng thái hủy.
3. Nếu đã trừ kho:

   * Cộng lại tồn kho từng SKU.
   * Tạo inventory_transaction loại order_cancelled.
   * Gắn reference_type = order.
   * Gắn reference_id = order_id.
   * Đánh dấu order.inventory_restored = true.
   * Lưu inventory_restored_at.
4. Không được hoàn kho nhiều lần cho cùng một đơn.

### 15.3. Chặn hoàn kho nhiều lần

Nếu order.inventory_restored = true:

* Không được hoàn kho lần nữa.

Đây là lỗi nghiêm trọng cần tránh.

---

## 16. Sửa đơn hàng

### 16.1. Sửa đơn nháp

Đơn draft có thể sửa:

* Khách hàng.
* Địa chỉ.
* SKU.
* Số lượng.
* Giá bán.
* Giảm giá.
* Phí ship.
* Thanh toán ban đầu.
* Ghi chú.

Vì chưa trừ kho nên dễ xử lý.

### 16.2. Sửa đơn đã xác nhận

Đơn confirmed đã trừ kho, nên không nên sửa tự do.

MVP đề xuất:

* Không cho sửa dòng sản phẩm trong đơn đã xác nhận.
* Nếu sai, hủy đơn và tạo đơn mới.
* Có thể cho sửa ghi chú, trạng thái, thanh toán.

Lý do:

* Sửa SKU/số lượng sau khi trừ kho rất phức tạp.
* Cần xử lý hoàn/trừ chênh lệch.
* Dễ gây sai kho.

Sau này có thể hỗ trợ sửa nâng cao.

### 16.3. Sửa thanh toán

Thanh toán nên xử lý qua module Payment.

Không nên sửa trực tiếp paid_total bằng tay.

paid_total phải được tính từ danh sách Payment.

---

## 17. Hủy đơn hàng

### 17.1. Quy tắc

Người dùng có thể hủy đơn nếu có quyền.

Khi hủy cần nhập:

* Lý do hủy.
* Ghi chú hủy.

Nếu đơn đã trừ kho:

* Hoàn kho.

Nếu đơn chưa trừ kho:

* Chỉ đổi trạng thái.

### 17.2. Lý do hủy gợi ý

* Khách đổi ý.
* Hết hàng.
* Sai thông tin đơn.
* Tạo nhầm.
* Không liên hệ được khách.
* Giao hàng thất bại.
* Lý do khác.

### 17.3. Không xóa đơn

Không nên xóa đơn hàng đã tạo, đặc biệt nếu đã có thanh toán/kho.

Chỉ nên chuyển trạng thái hủy.

---

## 18. Hoàn hàng

### 18.1. MVP nên làm đến đâu?

Hoàn hàng có thể phức tạp nếu hỗ trợ hoàn từng phần.

Đề xuất MVP:

* Hỗ trợ trạng thái returned cho hoàn toàn bộ đơn.
* Hoàn kho toàn bộ các SKU trong đơn.
* Ghi lý do hoàn hàng.

Hoàn hàng từng phần để sau MVP.

### 18.2. Quy tắc hoàn hàng toàn bộ

Nếu đơn completed hoặc shipping bị returned:

* Cộng lại toàn bộ số lượng SKU vào kho.
* Tạo transaction loại return.
* Đánh dấu order.returned_at.
* Cập nhật trạng thái đơn.

Nếu có thanh toán, việc hoàn tiền nên xử lý ở module Thanh toán/Công nợ sau.

---

## 19. Chi tiết đơn hàng

### 19.1. Mục tiêu

Màn hình chi tiết đơn hàng giúp xem toàn bộ thông tin và thao tác với đơn.

### 19.2. Thành phần

1. Header đơn hàng.
2. Thông tin khách hàng.
3. Thông tin giao hàng.
4. Danh sách sản phẩm/SKU.
5. Tổng tiền.
6. Thanh toán.
7. Trạng thái đơn.
8. Lịch sử trạng thái.
9. Lịch sử kho liên quan.
10. Ghi chú.
11. Hành động.

### 19.3. Header đơn hàng

Hiển thị:

* Mã đơn.
* Trạng thái đơn.
* Trạng thái thanh toán.
* Ngày tạo.
* Nhân viên bán hàng.
* Nguồn đơn.

Nút hành động:

* Sửa đơn, nếu được phép.
* Xác nhận đơn.
* Ghi nhận thanh toán.
* Hủy đơn.
* Hoàn hàng.
* In đơn, sau MVP.
* Xuất PDF, sau MVP.

### 19.4. Thông tin khách hàng

Hiển thị:

* Tên khách.
* Số điện thoại.
* Địa chỉ.
* Công nợ hiện tại.
* Link mở hồ sơ khách hàng.

### 19.5. Danh sách sản phẩm/SKU

Cột:

* SKU.
* Tên sản phẩm.
* Biến thể.
* Số lượng.
* Giá bán.
* Giảm giá.
* Thành tiền.

### 19.6. Tổng tiền

Hiển thị:

* Tiền hàng.
* Giảm giá toàn đơn.
* Phí ship.
* Tổng thanh toán.
* Đã thanh toán.
* Còn nợ.

---

## 20. Mã đơn hàng

### 20.1. Tự sinh mã đơn

Hệ thống nên tự sinh mã đơn.

Gợi ý format:

* DH20260620-0001
* ORD-20260620-0001

Với tiếng Việt, có thể dùng:

* DH-20260620-0001

### 20.2. Quy tắc

* Mã đơn unique.
* Không cho trùng.
* Người dùng không cần nhập.
* Có thể cho chỉnh mã đơn sau này nếu cần, nhưng MVP không cần.

---

## 21. Nguồn đơn hàng

Đơn hàng nên lưu nguồn.

Nguồn đơn gợi ý:

* Facebook.
* Zalo.
* TikTok.
* Website.
* Shopee.
* Offline.
* Khách cũ.
* Giới thiệu.
* Khác.

Nguồn đơn có thể mặc định từ nguồn khách hàng, nhưng người dùng có thể sửa.

Ví dụ:

Khách ban đầu đến từ Facebook, nhưng đơn mới phát sinh từ Zalo. Nên lưu source riêng ở đơn hàng.

---

## 22. Ghi chú đơn hàng

Nên có hai loại ghi chú:

### 22.1. Ghi chú nội bộ

Dành cho nhân viên:

* Khách muốn giảm giá.
* Khách khó tính.
* Gọi trước khi giao.
* Sale đã hứa tặng quà.

### 22.2. Ghi chú giao hàng

Dành cho xử lý giao:

* Giao giờ hành chính.
* Giao buổi tối.
* Không gọi sau 21h.
* Địa chỉ khó tìm.
* Gọi trước 30 phút.

---

## 23. Dữ liệu lõi

### 23.1. Bảng orders

Mục đích:

Lưu đơn hàng.

Trường đề xuất:

* id.
* order_code.
* customer_id.
* customer_name_snapshot.
* customer_phone_snapshot.
* shipping_name.
* shipping_phone.
* shipping_address.
* province.
* district.
* ward.
* source.
* sales_user_id.
* status.
* payment_status.
* subtotal.
* order_discount_amount.
* shipping_fee.
* grand_total.
* paid_total.
* debt_total.
* internal_note.
* shipping_note.
* cancel_reason.
* return_reason.
* inventory_deducted.
* inventory_deducted_at.
* inventory_restored.
* inventory_restored_at.
* confirmed_at.
* completed_at.
* cancelled_at.
* returned_at.
* created_by.
* updated_by.
* created_at.
* updated_at.
* deleted_at, nếu dùng soft delete.

Ghi chú:

* customer_name_snapshot và phone_snapshot giúp giữ thông tin tại thời điểm bán, kể cả sau này hồ sơ khách bị sửa.
* paid_total và debt_total có thể lưu cache, nhưng nên được tính từ payments để đảm bảo đúng.

---

### 23.2. Bảng order_items

Mục đích:

Lưu dòng sản phẩm trong đơn.

Trường đề xuất:

* id.
* order_id.
* product_variant_id.
* sku_snapshot.
* product_name_snapshot.
* variant_name_snapshot.
* unit.
* quantity.
* unit_price.
* discount_amount.
* line_total.
* created_at.
* updated_at.

Ghi chú:

Dùng snapshot để nếu sau này đổi tên sản phẩm/SKU, đơn cũ vẫn giữ đúng dữ liệu tại thời điểm bán.

---

### 23.3. Bảng order_status_history

Mục đích:

Lưu lịch sử đổi trạng thái đơn.

Trường đề xuất:

* id.
* order_id.
* old_status.
* new_status.
* reason.
* note.
* changed_by.
* changed_at.

MVP nên có bảng này nếu có thể, vì rất hữu ích để kiểm soát đơn hàng.

---

### 23.4. Bảng payments

Mục đích:

Lưu thanh toán của đơn hàng.

Chi tiết sẽ nằm trong module Thanh toán/Công nợ, nhưng order cần liên kết.

Trường đề xuất:

* id.
* order_id.
* customer_id.
* amount.
* payment_method.
* note.
* created_by.
* created_at.

---

### 23.5. Liên kết với inventory_transactions

Khi đơn trừ kho hoặc hoàn kho, inventory_transactions cần lưu:

* reference_type = order.
* reference_id = order_id.

Như vậy từ đơn hàng có thể xem lịch sử kho liên quan.

---

## 24. API đề xuất

### 24.1. Order API

GET /orders

Mục đích:

Lấy danh sách đơn hàng.

Query:

* search.
* status.
* payment_status.
* customer_id.
* sales_user_id.
* source.
* has_debt.
* created_from.
* created_to.
* page.
* page_size.

Response mỗi đơn:

* id.
* order_code.
* customer_name.
* customer_phone.
* status.
* payment_status.
* grand_total.
* paid_total.
* debt_total.
* source.
* sales_user_name.
* created_at.

---

POST /orders

Mục đích:

Tạo đơn hàng.

Body:

* customer_id.
* shipping_name.
* shipping_phone.
* shipping_address.
* province.
* district.
* ward.
* source.
* sales_user_id.
* status, thường draft hoặc confirmed.
* items:

  * product_variant_id.
  * quantity.
  * unit_price.
  * discount_amount.
* order_discount_amount.
* shipping_fee.
* paid_amount, tùy chọn.
* payment_method, nếu paid_amount > 0.
* internal_note.
* shipping_note.

Quy tắc:

* Kiểm tra khách hàng tồn tại, trừ trường hợp khách lẻ.
* Kiểm tra items không rỗng.
* Kiểm tra SKU tồn tại và đang bán.
* Kiểm tra tồn kho nếu status = confirmed.
* Tính tiền ở backend, không tin hoàn toàn frontend.
* Nếu status = confirmed, trừ kho.
* Nếu paid_amount > 0, tạo payment.
* Tạo order_status_history.

---

GET /orders/{id}

Mục đích:

Lấy chi tiết đơn hàng.

Response gồm:

* Thông tin đơn.
* Khách hàng.
* Items.
* Payments.
* Status history.
* Inventory transactions liên quan.
* Tổng tiền.
* Công nợ.

---

PUT /orders/{id}

Mục đích:

Cập nhật đơn hàng.

MVP chỉ cho cập nhật nếu đơn còn draft.

Có thể sửa:

* customer_id.
* shipping info.
* items.
* discount.
* shipping_fee.
* notes.

Nếu đơn đã confirmed:

* Không cho sửa items.
* Chỉ cho sửa ghi chú hoặc trạng thái qua API riêng.

---

### 24.2. Order Status API

POST /orders/{id}/confirm

Mục đích:

Xác nhận đơn và trừ kho.

Quy tắc:

* Chỉ cho confirm nếu status = draft.
* Kiểm tra tồn.
* Trừ kho.
* Tạo transaction.
* Set inventory_deducted = true.
* Cập nhật status = confirmed.
* Tạo status history.

---

POST /orders/{id}/cancel

Mục đích:

Hủy đơn.

Body:

* reason.
* note.

Quy tắc:

* Nếu đã trừ kho và chưa hoàn kho, hoàn kho.
* Set status = cancelled.
* Lưu cancel_reason.
* Tạo status history.
* Không cho hủy nếu đã completed, trừ khi quyền đặc biệt hoặc quy trình cho phép.

---

POST /orders/{id}/complete

Mục đích:

Hoàn thành đơn.

Quy tắc:

* Đơn phải confirmed hoặc shipping/packing nếu dùng đủ trạng thái.
* Set status = completed.
* completed_at.
* Tạo status history.

---

POST /orders/{id}/return

Mục đích:

Hoàn hàng toàn bộ đơn, MVP đơn giản.

Body:

* reason.
* note.

Quy tắc:

* Nếu đơn đã trừ kho, hoàn kho nếu chưa hoàn.
* Set status = returned.
* Tạo transaction return.
* Tạo status history.

---

### 24.3. Order Payment API

POST /orders/{id}/payments

Mục đích:

Ghi nhận thanh toán cho đơn.

Body:

* amount.
* payment_method.
* note.

Quy tắc:

* amount > 0.
* amount không vượt quá debt_total trong MVP.
* Tạo payment.
* Cập nhật paid_total, debt_total, payment_status.

Chi tiết hơn sẽ nằm trong module Thanh toán/Công nợ.

---

### 24.4. SKU Search API cho tạo đơn

GET /sales/sku-search

Hoặc dùng lại:

GET /variants/search

Query:

* search.
* include_stock=true.
* active_only=true.

Response:

* product_variant_id.
* sku.
* product_name.
* variant_name.
* image_url.
* retail_price.
* sale_price.
* effective_price.
* current_quantity.
* stock_status.
* product_status.
* variant_status.

---

## 25. Validation

### 25.1. Khách hàng

* Đơn cần có customer_id hoặc đánh dấu khách lẻ.
* Nếu tạo khách mới trong luồng đơn, phải kiểm tra trùng số điện thoại.

Thông báo:

“Vui lòng chọn khách hàng hoặc sử dụng khách lẻ.”

### 25.2. Items

* Đơn phải có ít nhất một sản phẩm.
* product_variant_id bắt buộc.
* quantity > 0.
* unit_price >= 0.
* discount_amount >= 0.
* line_total không âm.

Thông báo:

“Đơn hàng cần có ít nhất một sản phẩm.”
“Số lượng sản phẩm phải lớn hơn 0.”
“Giá bán không được âm.”

### 25.3. Tồn kho

* Nếu xác nhận đơn, kiểm tra tồn từng SKU.
* Nếu thiếu tồn, không xác nhận.

Thông báo:

“Tồn kho không đủ cho SKU AO-THUN-NU-2027-DEN-S. Hiện chỉ còn 3.”

### 25.4. Thanh toán

* paid_amount >= 0.
* paid_amount không lớn hơn grand_total trong MVP.
* Nếu paid_amount > 0 thì payment_method bắt buộc.

Thông báo:

“Số tiền thanh toán không hợp lệ.”
“Vui lòng chọn phương thức thanh toán.”

### 25.5. Trạng thái

* Không cho chuyển trạng thái sai luồng.
* Không cho confirm đơn đã cancelled.
* Không cho cancel đơn đã returned.
* Không cho trừ kho nhiều lần.
* Không cho hoàn kho nhiều lần.

Thông báo:

“Không thể xác nhận đơn hàng ở trạng thái hiện tại.”
“Đơn hàng đã được trừ kho trước đó.”
“Đơn hàng đã được hoàn kho trước đó.”

---

## 26. Quy tắc phân quyền

### 26.1. Admin

* Xem tất cả đơn.
* Tạo/sửa/hủy đơn.
* Xác nhận đơn.
* Hoàn thành đơn.
* Hoàn hàng.
* Ghi nhận thanh toán.
* Xem toàn bộ tiền, công nợ, lợi nhuận nếu có.

### 26.2. Quản lý

* Xem đơn trong đội hoặc toàn bộ.
* Tạo/sửa đơn.
* Xác nhận/hủy đơn nếu được phép.
* Xem báo cáo đơn hàng.
* Ghi nhận thanh toán nếu được phân quyền.

### 26.3. Sale

* Tạo đơn.
* Xem đơn của mình.
* Sửa đơn nháp của mình.
* Xác nhận đơn nếu được phép.
* Không hủy đơn đã xác nhận nếu không có quyền.
* Không sửa giá nếu không có quyền.

### 26.4. Kho

* Xem đơn cần xử lý.
* Cập nhật đóng gói/giao hàng nếu được phép.
* Không sửa giá/thanh toán.

### 26.5. Kế toán

* Xem đơn.
* Ghi nhận thanh toán.
* Xem công nợ.
* Không sửa sản phẩm trong đơn nếu không được quyền.

---

## 27. UX/UI chi tiết

### 27.1. Nguyên tắc UI

* Tạo đơn phải nhanh.
* Tìm khách và SKU phải dễ.
* Tồn kho phải hiển thị ngay khi chọn SKU.
* Tổng tiền phải tự tính rõ ràng.
* Lỗi phải hiển thị ngay, không đợi lưu mới biết hết.
* Không để người dùng chọn nhầm sản phẩm cha thay vì SKU.
* Không làm mất dữ liệu đơn khi chuyển sang tạo khách mới.

### 27.2. Bố cục tạo đơn đề xuất

Cột trái hoặc phần trên:

* Chọn khách hàng.
* Thông tin giao hàng.

Phần chính:

* Tìm SKU.
* Bảng sản phẩm trong đơn.

Cột phải hoặc phần cuối:

* Tổng tiền.
* Thanh toán.
* Ghi chú.
* Nút lưu.

### 27.3. Hành động chính

Nút:

* Lưu nháp.
* Lưu và xác nhận.
* Hủy.
* Ghi nhận thanh toán, nếu đơn đã tạo.
* Hoàn thành đơn.
* Hủy đơn.

### 27.4. Cảnh báo khi xác nhận đơn

Trước khi xác nhận đơn, nếu có trừ kho, nên hiển thị tóm tắt:

“Đơn hàng này sẽ trừ kho các SKU sau:

* AO-THUN-NU-2027-DEN-S: 2
* BALO-XANH-20L: 1”

Sau đó người dùng xác nhận.

MVP có thể bỏ popup nếu muốn nhanh, nhưng vẫn phải kiểm tra backend.

---

## 28. Lịch sử thao tác đơn hàng

### 28.1. Mục tiêu

Biết ai đã làm gì với đơn.

Lưu lịch sử:

* Tạo đơn.
* Sửa đơn.
* Xác nhận đơn.
* Hủy đơn.
* Hoàn hàng.
* Hoàn thành đơn.
* Ghi nhận thanh toán.
* Trừ kho.
* Hoàn kho.

### 28.2. Màn hình lịch sử

Trong chi tiết đơn hàng có tab “Lịch sử”.

Hiển thị:

* Thời gian.
* Người thực hiện.
* Hành động.
* Trạng thái cũ.
* Trạng thái mới.
* Ghi chú/lý do.

MVP nên có order_status_history trước. Audit log nâng cao có thể làm sau.

---

## 29. Báo cáo liên quan đến đơn hàng

Module Đơn hàng cung cấp dữ liệu cho:

* Doanh thu theo ngày/tháng.
* Doanh thu theo nhân viên.
* Doanh thu theo nguồn.
* Số đơn hàng.
* Tỷ lệ đơn hủy.
* Giá trị đơn trung bình.
* Sản phẩm/SKU bán chạy.
* Khách hàng mua nhiều.
* Khách hàng quay lại.
* Công nợ.
* Lãi gộp cơ bản nếu có giá nhập.

MVP có thể làm báo cáo sau, nhưng dữ liệu đơn hàng phải chuẩn để báo cáo được.

---

## 30. Những lỗi/bug không được phép tồn tại

Các lỗi sau phải coi là nghiêm trọng:

1. Đơn hàng chọn sản phẩm cha thay vì SKU.
2. Tạo đơn không kiểm tra tồn kho.
3. Cho bán vượt tồn kho trong MVP.
4. Xác nhận đơn trừ kho nhiều lần.
5. Hủy đơn hoàn kho nhiều lần.
6. Hủy đơn đã trừ kho nhưng không hoàn kho.
7. Nhập thanh toán nhưng paid_total/debt_total sai.
8. Sửa đơn đã xác nhận làm sai kho.
9. Xóa đơn đã có thanh toán/kho mà không lưu lịch sử.
10. SKU inactive vẫn bán được.
11. Sản phẩm inactive vẫn bán được.
12. Tính tổng tiền sai khi có giảm giá/phí ship.
13. paid_total lớn hơn grand_total mà không cảnh báo.
14. Tạo đơn xong không xuất hiện trong lịch sử mua hàng của khách.
15. Không lưu snapshot tên sản phẩm/SKU khiến đơn cũ bị thay đổi khi sản phẩm đổi tên.

---

## 31. Tiêu chí hoàn thành MVP cho module Đơn hàng

Module Đơn hàng được coi là dùng được thật khi đạt các tiêu chí:

1. Có danh sách đơn hàng.
2. Có màn hình tạo đơn hàng.
3. Tìm và chọn được khách hàng.
4. Tạo được khách hàng từ luồng tạo đơn mà không mất dữ liệu đơn.
5. Tìm được SKU theo tên, SKU, biến thể.
6. Chỉ chọn SKU cụ thể, không chọn sản phẩm cha.
7. Thêm nhiều SKU vào đơn.
8. Kiểm tra tồn kho khi thêm/chỉnh số lượng.
9. Chặn bán vượt tồn trong MVP.
10. Tự tính subtotal, discount, shipping_fee, grand_total.
11. Ghi nhận thanh toán ban đầu.
12. Tính paid_total và debt_total đúng.
13. Lưu đơn nháp.
14. Xác nhận đơn và trừ kho đúng.
15. Hủy đơn và hoàn kho đúng nếu đã trừ kho.
16. Chặn trừ kho nhiều lần.
17. Chặn hoàn kho nhiều lần.
18. Xem chi tiết đơn hàng.
19. Xem đơn hàng trong hồ sơ khách hàng.
20. Có lịch sử trạng thái đơn.

---

## 32. Roadmap triển khai module Đơn hàng

### Sprint ORDER-1: Nền tảng đơn hàng nháp

Mục tiêu:

* Bảng orders.
* Bảng order_items.
* Tạo đơn nháp.
* Danh sách đơn hàng.
* Chi tiết đơn hàng.
* Tính tổng tiền cơ bản.

Phạm vi:

* CRUD draft order.
* Chọn khách.
* Chọn SKU.
* Tính subtotal/grand_total.

---

### Sprint ORDER-2: Tìm SKU và kiểm tra tồn kho

Mục tiêu:

* Tìm SKU tốt khi tạo đơn.
* Hiển thị tồn kho.
* Chặn số lượng vượt tồn.
* Không cho chọn SKU inactive.

Phạm vi:

* SKU search component.
* Stock validation.
* Active/inactive validation.

---

### Sprint ORDER-3: Xác nhận đơn và trừ kho

Mục tiêu:

* Chuyển draft → confirmed.
* Trừ kho theo SKU.
* Tạo inventory_transaction.
* Chống trừ kho nhiều lần.

Phạm vi:

* confirm API.
* inventory deduction service.
* order_status_history.

---

### Sprint ORDER-4: Hủy đơn và hoàn kho

Mục tiêu:

* Hủy đơn.
* Nhập lý do hủy.
* Hoàn kho nếu đã trừ.
* Chống hoàn kho nhiều lần.

Phạm vi:

* cancel API.
* inventory restore service.
* cancel reason UI.

---

### Sprint ORDER-5: Thanh toán ban đầu và công nợ cơ bản

Mục tiêu:

* Ghi paid_amount khi tạo đơn.
* Tạo payment.
* Tính paid_total/debt_total.
* Hiển thị trạng thái thanh toán.

Phạm vi:

* payments table basic.
* payment status.
* debt calculation.

---

### Sprint ORDER-6: Hoàn thành đơn và lịch sử mua hàng

Mục tiêu:

* Chuyển đơn sang completed.
* Hiển thị đơn trong hồ sơ khách hàng.
* Lịch sử trạng thái.
* Dữ liệu sẵn sàng cho báo cáo/remarketing.

Phạm vi:

* complete API.
* customer order history.
* status timeline.

---

### Sprint ORDER-7: Hoàn hàng đơn giản, có thể sau MVP

Mục tiêu:

* Hoàn hàng toàn bộ đơn.
* Hoàn kho.
* Ghi lý do hoàn hàng.

Phạm vi:

* return API.
* return inventory transaction.
* returned status.

---

## 33. Kết luận

Module Bán hàng / Đơn hàng là trung tâm kết nối tất cả dữ liệu trong phần mềm.

Điểm cốt lõi:

* Đơn hàng phải chọn SKU cụ thể.
* Tồn kho phải được kiểm tra trước khi xác nhận.
* Trừ kho phải diễn ra đúng một lần.
* Hủy/hoàn phải hoàn kho đúng một lần.
* Tổng tiền, thanh toán và công nợ phải tính chính xác.
* Đơn hàng phải lưu snapshot thông tin sản phẩm/khách tại thời điểm bán.
* Lịch sử đơn hàng phải rõ ràng.
* Đơn hàng hoàn thành phải trở thành dữ liệu cho CRM, báo cáo và remarketing.

Nếu module này làm tốt, phần mềm sẽ bắt đầu chuyển từ “quản lý dữ liệu” sang “vận hành bán hàng thật”.
