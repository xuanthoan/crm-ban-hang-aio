# ĐẶC TẢ MODULE CHI TIẾT

# Module Thanh toán / Công nợ

# Dự án: CRM_Ban_Hang

## 1. Mục tiêu của module Thanh toán / Công nợ

Module Thanh toán / Công nợ dùng để quản lý toàn bộ việc thu tiền, theo dõi tiền đã thanh toán, tiền còn nợ, lịch sử thanh toán và tình trạng công nợ của khách hàng.

Mục tiêu của module này không chỉ là lưu trạng thái “đã thanh toán” hay “chưa thanh toán”, mà phải giúp người dùng biết rõ:

* Đơn hàng này tổng tiền bao nhiêu.
* Khách đã thanh toán bao nhiêu.
* Khách còn nợ bao nhiêu.
* Khách thanh toán bằng phương thức nào.
* Thanh toán vào thời điểm nào.
* Ai ghi nhận thanh toán.
* Khách nào còn nợ.
* Khách nào nợ lâu.
* Tổng công nợ hiện tại là bao nhiêu.
* Công nợ thuộc đơn hàng nào.
* Có lịch sử thanh toán rõ ràng hay không.
* Có trường hợp hoàn tiền, hủy đơn, hoàn hàng hay không.

Nguyên tắc quan trọng nhất:

**Không sửa trực tiếp số “đã thanh toán” bằng tay.**
Số đã thanh toán phải được tính từ các bản ghi Payment.

Ví dụ:

Đơn hàng 1.000.000

* Thanh toán lần 1: 300.000 tiền mặt.
* Thanh toán lần 2: 500.000 chuyển khoản.
* Tổng đã thanh toán: 800.000.
* Còn nợ: 200.000.

Nếu chỉ có một trường `paid_total` rồi sửa tay, sau này sẽ không biết khách thanh toán lúc nào, bằng cách nào, ai ghi nhận, có sai sót không.

---

## 2. Vai trò của module Thanh toán / Công nợ trong toàn hệ thống

Module Thanh toán / Công nợ liên kết trực tiếp với:

* Đơn hàng.
* Khách hàng.
* Báo cáo doanh thu.
* Báo cáo công nợ.
* Chăm sóc khách hàng.
* Nhắc việc.
* Nhật ký thao tác.
* Quyền người dùng.

Quan hệ nghiệp vụ:

* Một Order có thể có nhiều Payment.
* Một Payment thuộc về một Order.
* Một Payment cũng liên kết với Customer thông qua Order.
* Tổng đã thanh toán của đơn được tính từ tổng Payment hợp lệ.
* Công nợ của đơn = tổng phải thu - tổng đã thanh toán.
* Công nợ của khách = tổng công nợ các đơn của khách.
* Khách còn nợ có thể tạo nhắc việc chăm sóc/nhắc thanh toán.
* Công nợ là dữ liệu quan trọng cho báo cáo và CRM.

Nếu module này làm sơ sài, phần mềm sẽ không kiểm soát được tiền và nợ. Đây là lỗi nghiêm trọng với phần mềm bán hàng.

---

## 3. Tư duy thiết kế thanh toán và công nợ

### 3.1. Một đơn hàng có thể thanh toán nhiều lần

Không nên thiết kế đơn hàng chỉ có một trạng thái “đã thanh toán/chưa thanh toán”.

Thực tế thường gặp:

Ví dụ 1: Khách cọc trước

* Đơn hàng: 2.000.000.
* Khách cọc: 500.000.
* Còn nợ: 1.500.000.
* Khi giao hàng, khách thanh toán tiếp 1.500.000.

Ví dụ 2: Khách thanh toán một phần

* Đơn hàng: 1.000.000.
* Khách trả 300.000.
* Còn nợ 700.000.
* Một tuần sau trả tiếp 500.000.
* Còn nợ 200.000.

Ví dụ 3: COD

* Đơn hàng: 800.000.
* Trạng thái thanh toán ban đầu: chưa thanh toán hoặc chờ COD.
* Khi nhận tiền COD, kế toán ghi nhận thanh toán.

Vì vậy, cần bảng Payment riêng.

---

### 3.2. Công nợ phải tính được theo đơn và theo khách

Cần xem được công nợ ở hai cấp:

1. Công nợ theo đơn hàng.
2. Công nợ tổng theo khách hàng.

Ví dụ:

Khách Nguyễn Văn A có 3 đơn:

* Đơn 1: còn nợ 200.000.
* Đơn 2: đã thanh toán đủ.
* Đơn 3: còn nợ 500.000.

Tổng công nợ khách A = 700.000.

Trong hồ sơ khách hàng cần thấy rõ:

* Tổng công nợ.
* Danh sách đơn còn nợ.
* Ngày phát sinh nợ.
* Nợ đã bao lâu.
* Nhân viên phụ trách.
* Ghi chú nhắc nợ.

---

### 3.3. Thanh toán và doanh thu không hoàn toàn giống nhau

Trong MVP có thể đơn giản hóa, nhưng cần hiểu:

* Doanh thu bán hàng thường phát sinh từ đơn hàng hoàn thành/xác nhận.
* Dòng tiền thực thu phát sinh từ Payment.
* Công nợ là phần doanh thu chưa thu tiền.

Ví dụ:

Hôm nay tạo đơn 10.000.000 nhưng mới thu 6.000.000.

* Doanh thu đơn hàng: 10.000.000.
* Tiền thực thu: 6.000.000.
* Công nợ phát sinh: 4.000.000.

Báo cáo sau này cần phân biệt:

* Doanh thu theo đơn.
* Tiền đã thu.
* Công nợ còn lại.

---

### 3.4. Không xóa thanh toán tùy tiện

Payment liên quan đến tiền, nên không nên xóa cứng tùy tiện.

Nếu ghi nhận sai, có các hướng:

1. Cho sửa payment nếu mới tạo và người dùng có quyền.
2. Cho hủy payment bằng trạng thái `cancelled`.
3. Tạo payment âm hoặc refund transaction trong trường hợp hoàn tiền, có thể làm sau.

MVP nên ưu tiên:

* Cho Admin/Quản lý/Kế toán có quyền sửa hoặc hủy payment.
* Lưu lý do khi hủy/sửa.
* Không xóa cứng nếu đã có lịch sử quan trọng.

---

## 4. Người dùng của module Thanh toán / Công nợ

### 4.1. Chủ cửa hàng / Admin

Nhu cầu:

* Xem tổng tiền đã thu.
* Xem tổng công nợ.
* Xem khách nào còn nợ.
* Xem đơn nào chưa thanh toán.
* Xem lịch sử thanh toán.
* Kiểm tra nhân viên/kế toán ghi nhận thanh toán.
* Xem báo cáo dòng tiền cơ bản.
* Kiểm soát sai sót thanh toán.

Quyền:

* Xem toàn bộ thanh toán.
* Ghi nhận thanh toán.
* Sửa/hủy thanh toán.
* Xem công nợ toàn hệ thống.
* Xuất báo cáo công nợ.
* Xem báo cáo tiền thu.

---

### 4.2. Quản lý bán hàng

Nhu cầu:

* Xem đơn còn nợ trong đội.
* Nhắc sale chăm sóc khách còn nợ.
* Theo dõi khách đã thanh toán chưa.
* Kiểm tra tình trạng thanh toán của đơn hàng.

Quyền:

* Xem công nợ theo phạm vi.
* Ghi nhận thanh toán nếu được phân quyền.
* Không nhất thiết được hủy/sửa payment nếu không có quyền.

---

### 4.3. Nhân viên bán hàng

Nhu cầu:

* Biết khách còn nợ không.
* Ghi nhận khách cọc/đã trả nếu được phép.
* Nhắc khách thanh toán.
* Xem công nợ của khách mình phụ trách.
* Tạo lịch nhắc thanh toán.

Quyền:

* Xem công nợ của khách mình phụ trách.
* Có thể tạo payment nếu được phân quyền.
* Không được sửa/hủy payment nếu không có quyền.
* Không xem công nợ toàn hệ thống nếu không được phép.

---

### 4.4. Kế toán / Thu ngân

Nhu cầu:

* Ghi nhận thanh toán.
* Xem thanh toán theo ngày.
* Xem tiền mặt/chuyển khoản/COD.
* Xem đơn còn nợ.
* Xuất danh sách công nợ.
* Sửa/hủy thanh toán sai nếu có quyền.
* Ghi chú thanh toán.

Quyền:

* Tạo payment.
* Xem danh sách payment.
* Xem công nợ.
* Sửa/hủy payment theo quyền.
* Không cần sửa sản phẩm/kho.

---

## 5. Cấu trúc module Thanh toán / Công nợ

Module nên có các màn hình chính:

1. Ghi nhận thanh toán từ chi tiết đơn hàng.
2. Lịch sử thanh toán của đơn hàng.
3. Danh sách thanh toán.
4. Công nợ theo đơn hàng.
5. Công nợ theo khách hàng.
6. Chi tiết công nợ khách hàng.
7. Nhắc thanh toán, liên kết với CRM/Reminder.
8. Báo cáo thu tiền cơ bản.
9. Hoàn tiền, có thể để sau MVP.

---

## 6. Trạng thái thanh toán

### 6.1. Trạng thái đề xuất

Mỗi đơn hàng cần có `payment_status`:

* unpaid: Chưa thanh toán.
* partial: Thanh toán một phần.
* paid: Đã thanh toán.
* refunded: Đã hoàn tiền, để sau.
* overpaid: Thanh toán dư, có thể để sau.

MVP chỉ cần:

* unpaid.
* partial.
* paid.

### 6.2. Cách tính trạng thái

Dựa trên `grand_total` và tổng payment hợp lệ.

Nếu paid_total = 0:

* unpaid.

Nếu 0 < paid_total < grand_total:

* partial.

Nếu paid_total = grand_total:

* paid.

Nếu paid_total > grand_total:

* MVP không cho phép, nên không có overpaid.

### 6.3. Cập nhật payment_status

Khi có thay đổi:

* Tạo payment.
* Sửa payment.
* Hủy payment.
* Hủy đơn.
* Hoàn hàng.

Hệ thống phải tính lại:

* paid_total.
* debt_total.
* payment_status.

Không được để payment_status lệch với số tiền thực tế.

---

## 7. Phương thức thanh toán

### 7.1. Phương thức mặc định

MVP nên hỗ trợ:

* Tiền mặt.
* Chuyển khoản.
* COD.
* Ví điện tử.
* Khác.

### 7.2. Thông tin theo phương thức

MVP có thể dùng chung các trường:

* payment_method.
* amount.
* note.
* paid_at.

Sau này có thể thêm:

* Mã giao dịch ngân hàng.
* Tài khoản nhận tiền.
* Đơn vị COD.
* Mã vận đơn COD.
* Ảnh bằng chứng chuyển khoản.

### 7.3. COD

COD nên được hiểu là “sẽ thu khi giao hàng” hoặc “đã ghi nhận tiền COD” tùy quy trình.

MVP nên đơn giản:

* Nếu chọn COD và đã thu tiền, tạo Payment method COD.
* Nếu chưa thu tiền COD, đơn vẫn là chưa thanh toán hoặc thanh toán một phần.

Không nên tự coi COD là đã thanh toán nếu thực tế chưa thu được tiền.

---

## 8. Ghi nhận thanh toán

### 8.1. Ghi nhận thanh toán từ đơn hàng

Trong chi tiết đơn hàng có nút:

* “Ghi nhận thanh toán”.

Form gồm:

* Số tiền thanh toán.
* Phương thức thanh toán.
* Ngày thanh toán.
* Ghi chú.
* Người ghi nhận, hệ thống tự lưu.

Hiển thị trong form:

* Tổng đơn hàng.
* Đã thanh toán.
* Còn nợ.
* Số tiền thanh toán lần này.
* Còn nợ sau thanh toán dự kiến.

Ví dụ:

Tổng đơn: 1.000.000
Đã thanh toán: 300.000
Còn nợ: 700.000
Thanh toán lần này: 500.000
Còn nợ sau thanh toán: 200.000

### 8.2. Quy tắc

* amount > 0.
* amount <= debt_total trong MVP.
* payment_method bắt buộc.
* paid_at không được quá vô lý, ví dụ quá xa tương lai.
* Nếu đơn đã hủy, không cho ghi nhận thanh toán mới, trừ khi có quyền đặc biệt.
* Nếu đơn đã thanh toán đủ, không cho ghi thêm payment trong MVP.

Thông báo:

“Số tiền thanh toán phải lớn hơn 0.”
“Số tiền thanh toán không được lớn hơn số tiền còn nợ.”
“Vui lòng chọn phương thức thanh toán.”
“Đơn hàng đã thanh toán đủ.”
“Không thể ghi nhận thanh toán cho đơn đã hủy.”

---

## 9. Thanh toán khi tạo đơn

Khi tạo đơn hàng, người dùng có thể nhập thanh toán ban đầu.

Trường:

* paid_amount.
* payment_method.
* payment_note.

Quy tắc:

* Nếu paid_amount = 0 hoặc trống: không tạo Payment.
* Nếu paid_amount > 0: payment_method bắt buộc.
* Sau khi tạo đơn:

  * Tạo Payment.
  * Tính paid_total.
  * Tính debt_total.
  * Cập nhật payment_status.

Ví dụ:

Đơn 1.000.000
Khách cọc 300.000 tiền mặt

Kết quả:

* grand_total = 1.000.000.
* paid_total = 300.000.
* debt_total = 700.000.
* payment_status = partial.
* payments có 1 record 300.000.

---

## 10. Sửa / Hủy thanh toán

### 10.1. Sửa thanh toán

MVP có thể cho phép sửa Payment nếu:

* Người dùng có quyền.
* Payment chưa bị hủy.
* Đơn chưa bị khóa sổ, nếu sau này có khóa sổ.
* Ghi rõ lý do sửa, nếu có thể.

Có thể sửa:

* amount.
* payment_method.
* paid_at.
* note.

Sau khi sửa:

* Tính lại paid_total.
* Tính lại debt_total.
* Tính lại payment_status.
* Ghi audit log.

### 10.2. Hủy thanh toán

Thay vì xóa cứng, nên dùng status của Payment:

* active.
* cancelled.

Khi hủy payment:

* Nhập lý do hủy.
* Set status = cancelled.
* Không tính payment này vào paid_total.
* Tính lại công nợ.
* Ghi audit log.

Thông báo:

“Thanh toán đã được hủy và công nợ đã được cập nhật lại.”

### 10.3. Không xóa cứng

Không nên xóa cứng Payment trong MVP, trừ khi dữ liệu test hoặc Admin có quyền đặc biệt.

Tiền là dữ liệu nhạy cảm, cần có lịch sử.

---

## 11. Công nợ theo đơn hàng

### 11.1. Mục tiêu

Biết đơn nào còn nợ, nợ bao nhiêu.

### 11.2. Dữ liệu cần hiển thị

Mỗi đơn còn nợ cần có:

* Mã đơn.
* Khách hàng.
* Số điện thoại.
* Ngày tạo đơn.
* Tổng tiền.
* Đã thanh toán.
* Còn nợ.
* Trạng thái đơn.
* Nhân viên bán hàng.
* Ngày thanh toán gần nhất.
* Số ngày còn nợ.
* Hành động: ghi nhận thanh toán, mở đơn, tạo nhắc việc.

### 11.3. Bộ lọc

* Khách hàng.
* Nhân viên bán hàng.
* Nguồn đơn.
* Khoảng ngày tạo.
* Trạng thái đơn.
* Số ngày nợ.
* Số tiền nợ từ/đến.
* Đơn quá hạn thanh toán, nếu có due date.

MVP nên có:

* Khách hàng.
* Nhân viên bán hàng.
* Khoảng ngày.
* Số tiền nợ.
* Trạng thái đơn.

---

## 12. Công nợ theo khách hàng

### 12.1. Mục tiêu

Biết khách nào còn nợ tổng cộng bao nhiêu.

### 12.2. Dữ liệu cần hiển thị

Mỗi khách hàng có công nợ:

* Tên khách.
* Số điện thoại.
* Nhân viên phụ trách.
* Tổng số đơn còn nợ.
* Tổng công nợ.
* Ngày phát sinh nợ gần nhất.
* Ngày thanh toán gần nhất.
* Số ngày nợ lâu nhất.
* Hành động: xem chi tiết, ghi nhận thanh toán cho đơn, tạo nhắc việc.

### 12.3. Chi tiết công nợ khách hàng

Khi mở khách hàng, tab Công nợ hiển thị:

* Tổng công nợ.
* Danh sách đơn còn nợ.
* Lịch sử thanh toán.
* Lịch sử nhắc thanh toán.
* Nút tạo lịch nhắc.
* Nút ghi nhận thanh toán cho từng đơn.

---

## 13. Ngày hẹn thanh toán / quá hạn

### 13.1. Có cần trong MVP không?

Nên có trường đơn giản:

* payment_due_date.

Nếu có ngày hẹn thanh toán, hệ thống có thể biết đơn nào quá hạn.

### 13.2. Cách dùng

Khi tạo đơn hoặc sau khi tạo đơn, người dùng có thể nhập:

* Ngày hẹn thanh toán.

Nếu debt_total > 0 và payment_due_date < hôm nay:

* Đơn được coi là quá hạn thanh toán.

### 13.3. Nhắc thanh toán

Có thể tạo Reminder cho khách:

* Nhắc khách thanh toán đơn DH-xxx.
* Ngày đến hạn.
* Người phụ trách.

MVP có thể tích hợp đơn giản với module Reminder.

---

## 14. Hoàn tiền

### 14.1. MVP có cần làm không?

Hoàn tiền có thể phức tạp. MVP chưa cần làm hoàn tiền chi tiết.

Tuy nhiên cần thiết kế sẵn.

Các trường hợp hoàn tiền:

* Hủy đơn sau khi khách đã thanh toán.
* Hoàn hàng.
* Khách trả thừa.
* Điều chỉnh sai thanh toán.

### 14.2. Cách xử lý sau MVP

Có thể tạo bảng Refund hoặc dùng Payment với type:

* payment: thu tiền.
* refund: hoàn tiền.

Nếu hoàn tiền, amount có thể được lưu dương nhưng type = refund, khi tính paid_total thì trừ ra.

MVP có thể ghi chú thủ công, nhưng không nên làm phức tạp ngay.

---

## 15. Dữ liệu lõi

### 15.1. Bảng payments

Mục đích:

Lưu mọi lần thanh toán của đơn hàng.

Trường đề xuất:

* id.
* order_id.
* customer_id.
* amount.
* payment_method.
* paid_at.
* note.
* status.
* cancelled_reason.
* cancelled_at.
* cancelled_by.
* created_by.
* updated_by.
* created_at.
* updated_at.

Giải thích:

* order_id: đơn hàng được thanh toán.
* customer_id: lưu để truy vấn nhanh công nợ theo khách.
* amount: số tiền thanh toán.
* payment_method: tiền mặt, chuyển khoản, COD...
* paid_at: ngày thực tế thanh toán.
* status: active/cancelled.
* cancelled_reason: lý do hủy payment.
* created_by: người ghi nhận.

MVP status:

* active.
* cancelled.

---

### 15.2. Trường liên quan trong bảng orders

Bảng orders nên có các trường cache để truy vấn nhanh:

* grand_total.
* paid_total.
* debt_total.
* payment_status.
* payment_due_date.

Quy tắc:

* paid_total = tổng payments active.
* debt_total = grand_total - paid_total.
* payment_status tính từ paid_total và grand_total.

Các trường này có thể được lưu cache nhưng phải được cập nhật lại mỗi khi Payment thay đổi.

Không nên để frontend tự tính và gửi lên rồi tin luôn.

---

### 15.3. Bảng payment_audit_logs, có thể dùng AuditLog chung

Nếu có AuditLog chung:

* user_id.
* action.
* entity_type = payment.
* entity_id.
* old_value.
* new_value.
* reason.
* created_at.

Dùng để lưu:

* Tạo payment.
* Sửa payment.
* Hủy payment.

MVP có thể chuẩn bị AuditLog chung nhưng chưa cần giao diện đầy đủ.

---

### 15.4. Bảng debt_reminders, có thể dùng reminders chung

Không nhất thiết cần bảng riêng.

Có thể dùng bảng reminders/tasks với:

* customer_id.
* order_id, nếu thêm được.
* title.
* due_at.
* type = payment_reminder.
* status.

Nếu bảng Reminder ban đầu chưa có order_id, nên cân nhắc thêm để nhắc thanh toán theo đơn.

---

## 16. API đề xuất

### 16.1. Payment API

GET /payments

Mục đích:

Lấy danh sách thanh toán.

Query:

* search.
* order_id.
* customer_id.
* payment_method.
* status.
* created_by.
* paid_from.
* paid_to.
* page.
* page_size.

Response:

* id.
* order_id.
* order_code.
* customer_id.
* customer_name.
* amount.
* payment_method.
* paid_at.
* status.
* created_by_name.
* note.

---

POST /orders/{order_id}/payments

Mục đích:

Ghi nhận thanh toán cho một đơn hàng.

Body:

* amount.
* payment_method.
* paid_at.
* note.

Quy tắc:

* order tồn tại.
* amount > 0.
* amount <= debt_total trong MVP.
* payment_method bắt buộc.
* Tạo payment.
* Tính lại order paid_total/debt_total/payment_status.
* Ghi audit log.

---

GET /orders/{order_id}/payments

Mục đích:

Lấy lịch sử thanh toán của một đơn.

---

PUT /payments/{payment_id}

Mục đích:

Sửa payment.

Quy tắc:

* Người dùng có quyền.
* Payment chưa cancelled.
* amount hợp lệ.
* Sau khi sửa, tính lại order.
* Ghi audit log.

---

POST /payments/{payment_id}/cancel

Mục đích:

Hủy payment.

Body:

* reason.

Quy tắc:

* Người dùng có quyền.
* Payment đang active.
* reason bắt buộc.
* Set status = cancelled.
* Tính lại order.
* Ghi audit log.

---

### 16.2. Debt API

GET /debts/orders

Mục đích:

Lấy danh sách đơn hàng còn nợ.

Query:

* search.
* customer_id.
* sales_user_id.
* source.
* created_from.
* created_to.
* overdue_only.
* min_debt.
* max_debt.
* page.
* page_size.

Response mỗi dòng:

* order_id.
* order_code.
* customer_id.
* customer_name.
* customer_phone.
* sales_user_name.
* grand_total.
* paid_total.
* debt_total.
* payment_status.
* payment_due_date.
* days_overdue.
* created_at.

---

GET /debts/customers

Mục đích:

Lấy công nợ tổng hợp theo khách hàng.

Query:

* search.
* assigned_to.
* source.
* min_debt.
* max_debt.
* overdue_only.
* page.
* page_size.

Response mỗi dòng:

* customer_id.
* customer_name.
* customer_phone.
* assigned_to_name.
* debt_order_count.
* total_debt.
* oldest_debt_days.
* latest_payment_at.
* latest_order_at.

---

GET /customers/{customer_id}/debts

Mục đích:

Lấy chi tiết công nợ của một khách.

Response:

* customer info.
* total_debt.
* debt_orders.
* payment_history.
* reminders.

---

### 16.3. Payment Summary API

GET /payments/summary

Mục đích:

Lấy tổng quan thanh toán/công nợ.

Query:

* date_from.
* date_to.
* sales_user_id.
* payment_method.

Response:

* total_order_amount.
* total_paid_amount.
* total_debt_amount.
* payment_by_method.
* unpaid_order_count.
* partial_order_count.
* paid_order_count.
* overdue_debt_amount, nếu có due date.

---

## 17. Validation

### 17.1. Amount

* Bắt buộc.
* Phải > 0.
* Không được vượt debt_total trong MVP.
* Không được là chuỗi không hợp lệ.

Thông báo:

“Số tiền thanh toán phải lớn hơn 0.”
“Số tiền thanh toán không được lớn hơn số tiền còn nợ.”

### 17.2. Payment method

* Bắt buộc nếu amount > 0.

Thông báo:

“Vui lòng chọn phương thức thanh toán.”

### 17.3. Paid at

* Không bắt buộc, mặc định hiện tại.
* Nếu nhập, không nên nằm quá xa tương lai.
* Có thể cho phép nhập ngày quá khứ.

Thông báo:

“Ngày thanh toán không hợp lệ.”

### 17.4. Order status

Không cho ghi nhận thanh toán mới nếu:

* Đơn đã cancelled.
* Đơn đã returned và không có logic hoàn tiền rõ.
* Đơn đã paid.

MVP có thể cho Admin ghi nhận đặc biệt, nhưng mặc định nên chặn.

### 17.5. Cancel payment

* Payment phải active.
* Lý do hủy bắt buộc.
* Người dùng phải có quyền.

Thông báo:

“Vui lòng nhập lý do hủy thanh toán.”
“Thanh toán này đã bị hủy trước đó.”

---

## 18. Quy tắc phân quyền

### 18.1. Admin

* Xem toàn bộ payment.
* Tạo payment.
* Sửa payment.
* Hủy payment.
* Xem toàn bộ công nợ.
* Xuất báo cáo công nợ.
* Xem báo cáo tiền thu.

### 18.2. Quản lý

* Xem payment/công nợ trong phạm vi.
* Tạo payment nếu được phân quyền.
* Sửa/hủy payment nếu được phân quyền.
* Xem báo cáo công nợ đội nhóm.

### 18.3. Sale

* Xem công nợ khách mình phụ trách.
* Có thể ghi nhận thanh toán nếu được phép.
* Không sửa/hủy payment nếu không được phân quyền.
* Không xem toàn bộ công nợ hệ thống nếu không được phép.

### 18.4. Kế toán / Thu ngân

* Xem payment.
* Tạo payment.
* Sửa/hủy payment theo quyền.
* Xem công nợ.
* Xuất công nợ nếu được quyền.

### 18.5. Kho

* Không cần quyền thanh toán/công nợ.
* Có thể xem trạng thái thanh toán của đơn nếu phục vụ giao hàng, tùy cấu hình.

---

## 19. UX/UI chi tiết

### 19.1. Nguyên tắc UI

* Tiền phải hiển thị rõ ràng.
* Công nợ phải dễ nhìn.
* Không nhập thanh toán mơ hồ.
* Phải thấy ngay “đã thanh toán” và “còn nợ”.
* Mọi lần thanh toán phải có lịch sử.
* Hủy/sửa thanh toán phải có xác nhận.
* Dữ liệu tiền không được tự động mất hoặc bị ghi đè.

### 19.2. Trong chi tiết đơn hàng

Khu vực thanh toán nên hiển thị:

* Tổng đơn.
* Đã thanh toán.
* Còn nợ.
* Trạng thái thanh toán.
* Nút ghi nhận thanh toán.
* Danh sách lịch sử thanh toán.

Ví dụ:

Tổng đơn: 1.000.000
Đã thanh toán: 300.000
Còn nợ: 700.000
Trạng thái: Thanh toán một phần

Lịch sử:

* 20/06/2026 | Tiền mặt | 300.000 | Nguyễn A ghi nhận

### 19.3. Form ghi nhận thanh toán

Hiển thị:

* Mã đơn.
* Khách hàng.
* Tổng đơn.
* Đã thanh toán.
* Còn nợ hiện tại.
* Số tiền thanh toán lần này.
* Còn nợ sau thanh toán.
* Phương thức.
* Ngày thanh toán.
* Ghi chú.

Khi người dùng nhập số tiền, tự tính “còn nợ sau thanh toán”.

### 19.4. Màn hình công nợ

Nên có 2 tab:

1. Theo đơn hàng.
2. Theo khách hàng.

Tab Theo đơn hàng:

* Mã đơn.
* Khách.
* Tổng đơn.
* Đã thanh toán.
* Còn nợ.
* Ngày tạo.
* Ngày hẹn thanh toán.
* Số ngày nợ.
* Hành động.

Tab Theo khách hàng:

* Khách.
* Số điện thoại.
* Tổng nợ.
* Số đơn còn nợ.
* Nợ lâu nhất.
* Nhân viên phụ trách.
* Hành động.

### 19.5. Hành động nhanh

* Ghi nhận thanh toán.
* Mở đơn hàng.
* Mở hồ sơ khách hàng.
* Tạo lịch nhắc thanh toán.
* Gọi/nhắn khách, nếu sau này tích hợp.

---

## 20. Tích hợp với CRM / Chăm sóc khách hàng

### 20.1. Công nợ trong hồ sơ khách hàng

Trong chi tiết khách hàng, tab Công nợ hiển thị:

* Tổng công nợ.
* Đơn còn nợ.
* Lịch sử thanh toán.
* Lịch nhắc thanh toán.

### 20.2. Nhắc thanh toán

Khi khách còn nợ, người dùng có thể tạo Reminder:

* Tiêu đề: Nhắc thanh toán đơn DH-xxx.
* Khách hàng.
* Đơn hàng.
* Ngày hẹn.
* Người phụ trách.

Nếu quá hạn, xuất hiện trong danh sách việc cần làm.

### 20.3. Hoạt động chăm sóc

Khi nhắc khách thanh toán, người dùng có thể ghi CustomerActivity:

* Loại: Nhắc thanh toán.
* Nội dung: Đã gọi khách nhắc thanh toán 500.000 còn nợ.
* Kết quả: Khách hẹn chuyển khoản ngày mai.
* Ngày follow-up tiếp theo.

Nhờ vậy CRM lưu được lịch sử nhắc nợ.

---

## 21. Báo cáo liên quan

Module Thanh toán / Công nợ cung cấp dữ liệu cho báo cáo:

### 21.1. Báo cáo tiền thu

* Tổng tiền thu hôm nay.
* Tổng tiền thu theo khoảng ngày.
* Tiền thu theo phương thức.
* Tiền thu theo nhân viên ghi nhận.
* Tiền thu theo nguồn đơn.
* Tiền thu theo khách hàng.

### 21.2. Báo cáo công nợ

* Tổng công nợ hiện tại.
* Công nợ theo khách.
* Công nợ theo nhân viên phụ trách.
* Công nợ theo nguồn khách.
* Đơn nợ lâu nhất.
* Khách nợ nhiều nhất.
* Công nợ quá hạn.

### 21.3. Báo cáo thanh toán đơn hàng

* Đơn chưa thanh toán.
* Đơn thanh toán một phần.
* Đơn đã thanh toán.
* Tỷ lệ đơn còn nợ.
* Giá trị đơn còn nợ.

MVP nên có:

* Tổng công nợ.
* Danh sách đơn còn nợ.
* Danh sách khách còn nợ.
* Tiền thu theo ngày.
* Tiền thu theo phương thức.

---

## 22. Import / Export

### 22.1. Export công nợ

Cần hỗ trợ xuất:

* Danh sách đơn còn nợ.
* Danh sách khách còn nợ.
* Lịch sử thanh toán.

Cột export đơn còn nợ:

* Mã đơn.
* Khách hàng.
* Số điện thoại.
* Ngày tạo.
* Tổng đơn.
* Đã thanh toán.
* Còn nợ.
* Ngày hẹn thanh toán.
* Nhân viên phụ trách.

### 22.2. Import payment

MVP chưa cần import payment.

Sau này có thể import thanh toán từ file ngân hàng hoặc COD, nhưng phức tạp hơn.

---

## 23. Những lỗi/bug không được phép tồn tại

Các lỗi sau phải coi là nghiêm trọng:

1. Ghi nhận thanh toán nhưng paid_total không cập nhật.
2. paid_total cập nhật nhưng không có Payment history.
3. debt_total tính sai.
4. payment_status không khớp với paid_total/debt_total.
5. Cho nhập thanh toán lớn hơn số còn nợ trong MVP.
6. Hủy payment nhưng công nợ không tính lại.
7. Sửa payment nhưng không cập nhật order.
8. Xóa payment không có lịch sử.
9. Đơn đã hủy vẫn cho ghi nhận thanh toán mà không cảnh báo.
10. Khách còn nợ nhưng hồ sơ khách không hiển thị.
11. Công nợ theo khách không khớp tổng công nợ các đơn.
12. Thanh toán bị ghi nhận hai lần do bấm nút nhiều lần.
13. Không lưu người ghi nhận thanh toán.
14. Không lưu thời gian thanh toán.
15. Không có phương thức thanh toán nhưng vẫn ghi nhận payment.

---

## 24. Tiêu chí hoàn thành MVP cho module Thanh toán / Công nợ

Module Thanh toán / Công nợ được coi là dùng được thật khi đạt các tiêu chí:

1. Một đơn hàng có thể có nhiều payment.
2. Tạo payment từ chi tiết đơn hàng.
3. Ghi nhận thanh toán ban đầu khi tạo đơn.
4. Tính paid_total đúng từ payment active.
5. Tính debt_total đúng.
6. Tự cập nhật payment_status: unpaid, partial, paid.
7. Không cho thanh toán vượt số còn nợ trong MVP.
8. Có lịch sử thanh toán của từng đơn.
9. Có danh sách thanh toán toàn hệ thống.
10. Có danh sách đơn còn nợ.
11. Có danh sách khách còn nợ.
12. Hồ sơ khách hàng hiển thị công nợ.
13. Có thể tạo nhắc thanh toán cho khách.
14. Hủy payment phải cập nhật lại công nợ.
15. Sửa payment phải cập nhật lại công nợ.
16. Có phân quyền cơ bản cho ghi nhận/sửa/hủy payment.
17. Có báo cáo cơ bản: tổng đã thu, tổng công nợ.
18. Không xóa cứng payment quan trọng.
19. Giao diện hiển thị rõ tổng tiền, đã thanh toán, còn nợ.

---

## 25. Roadmap triển khai module Thanh toán / Công nợ

### Sprint PAYMENT-1: Nền tảng Payment

Mục tiêu:

* Tạo bảng payments.
* Ghi nhận thanh toán cho đơn hàng.
* Lịch sử thanh toán của đơn.
* Cập nhật paid_total/debt_total/payment_status.

Phạm vi:

* POST /orders/{id}/payments.
* GET /orders/{id}/payments.
* Payment form trong chi tiết đơn.
* Payment calculation service.

---

### Sprint PAYMENT-2: Thanh toán khi tạo đơn

Mục tiêu:

* Cho nhập paid_amount khi tạo đơn.
* Tạo payment ban đầu.
* Cập nhật trạng thái thanh toán.

Phạm vi:

* Update order create API.
* Payment block trong form tạo đơn.
* Validation paid_amount.

---

### Sprint PAYMENT-3: Danh sách công nợ theo đơn

Mục tiêu:

* Màn hình công nợ theo đơn hàng.
* Lọc đơn còn nợ.
* Ghi nhận thanh toán nhanh từ danh sách nợ.

Phạm vi:

* GET /debts/orders.
* Debt order list UI.
* Quick payment action.

---

### Sprint PAYMENT-4: Công nợ theo khách hàng

Mục tiêu:

* Tổng hợp công nợ theo khách.
* Hiển thị công nợ trong hồ sơ khách.
* Danh sách khách còn nợ.

Phạm vi:

* GET /debts/customers.
* GET /customers/{id}/debts.
* Customer debt tab.

---

### Sprint PAYMENT-5: Sửa/hủy Payment

Mục tiêu:

* Sửa payment nếu có quyền.
* Hủy payment có lý do.
* Tính lại công nợ.
* Audit log.

Phạm vi:

* PUT /payments/{id}.
* POST /payments/{id}/cancel.
* Payment audit.

---

### Sprint PAYMENT-6: Nhắc thanh toán

Mục tiêu:

* Tạo reminder nhắc thanh toán.
* Hiển thị khách/đơn quá hạn.
* Ghi activity nhắc nợ.

Phạm vi:

* payment_due_date.
* reminder type payment_reminder.
* debt overdue filter.

---

### Sprint PAYMENT-7: Báo cáo tiền thu và công nợ cơ bản

Mục tiêu:

* Tổng tiền thu theo ngày.
* Tiền thu theo phương thức.
* Tổng công nợ.
* Đơn/khách nợ nhiều.

Phạm vi:

* GET /payments/summary.
* Basic dashboard cards.
* Export công nợ nếu kịp.

---

## 26. Kết luận

Module Thanh toán / Công nợ là phần kiểm soát tiền của hệ thống. Nó phải được thiết kế chắc chắn, rõ ràng và có lịch sử.

Điểm cốt lõi:

* Một đơn có thể thanh toán nhiều lần.
* Payment phải là bản ghi riêng, không chỉ là một con số trên đơn.
* paid_total và debt_total phải được tính lại từ Payment.
* Công nợ phải xem được theo đơn và theo khách hàng.
* Hủy/sửa Payment phải có quyền và có lịch sử.
* Khách còn nợ phải hiển thị trong CRM để nhắc chăm sóc.
* Không được để số tiền đã thanh toán, công nợ và trạng thái thanh toán lệch nhau.
* MVP chưa cần kế toán phức tạp, nhưng phải quản lý được tiền đã thu và tiền còn nợ thật chính xác.

Nếu module này làm tốt, phần mềm sẽ giúp chủ cửa hàng kiểm soát dòng tiền và công nợ tốt hơn rất nhiều, thay vì chỉ biết “có đơn hàng” nhưng không biết đã thu đủ tiền hay chưa.
