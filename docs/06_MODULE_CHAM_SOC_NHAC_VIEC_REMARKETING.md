# ĐẶC TẢ MODULE CHI TIẾT

# Module Chăm sóc khách hàng / Nhắc việc / Remarketing cơ bản

# Dự án: CRM_Ban_Hang

## 1. Mục tiêu của module

Module Chăm sóc khách hàng / Nhắc việc / Remarketing cơ bản dùng để quản lý toàn bộ hoạt động chăm sóc, theo dõi việc cần làm và khai thác lại dữ liệu khách hàng cũ.

Mục tiêu của module này là giúp người dùng biết:

* Hôm nay cần chăm sóc khách nào.
* Khách nào đã lâu chưa được chăm sóc.
* Khách nào đã lâu chưa mua lại.
* Khách nào sắp sinh nhật.
* Khách nào còn nợ cần nhắc thanh toán.
* Khách nào từng mua sản phẩm/danh mục cụ thể.
* Khách nào thuộc tag/nhóm cụ thể.
* Sale đã gọi/nhắn/tư vấn khách chưa.
* Kết quả chăm sóc là gì.
* Khi nào cần chăm sóc tiếp.
* Có thể lọc tệp khách hàng nào để bán lại.

Nguyên tắc quan trọng:

**CRM không chỉ là lưu thông tin khách hàng. CRM phải giúp người bán hành động đúng lúc với đúng khách hàng.**

Nếu phần mềm chỉ lưu khách hàng, đơn hàng, sản phẩm mà không có chăm sóc lại, thì phần mềm sẽ giống công cụ quản lý dữ liệu hơn là CRM.

---

## 2. Vai trò của module trong toàn hệ thống

Module này liên kết trực tiếp với:

* Khách hàng.
* Đơn hàng.
* Công nợ.
* Sản phẩm/SKU.
* Báo cáo.
* Người dùng/phân quyền.
* Remarketing.
* Dashboard.

Quan hệ nghiệp vụ:

* Một Customer có nhiều CustomerActivity.
* Một Customer có nhiều Reminder/Task.
* Một Reminder có thể liên kết với Customer.
* Một Reminder có thể liên kết với Order nếu là nhắc thanh toán/giao hàng.
* Một CustomerActivity có thể tạo Reminder tiếp theo.
* Đơn hàng hoàn thành có thể tạo lịch chăm sóc sau mua.
* Công nợ có thể tạo lịch nhắc thanh toán.
* Ngày sinh khách hàng có thể tạo danh sách chăm sóc sinh nhật.
* Lịch sử mua hàng dùng để tạo tệp remarketing.

Module này giúp trả lời các câu hỏi:

* Sale hôm nay cần làm gì?
* Khách nào cần gọi lại?
* Khách nào sắp sinh nhật?
* Khách nào mua balo 6 tháng trước nhưng chưa quay lại?
* Khách nào còn nợ?
* Khách nào từng mua sản phẩm X?
* Khách nào có tag “VIP”?
* Khách nào từ Facebook nhưng chưa mua?
* Khách nào đã mua nhưng 60 ngày chưa mua lại?

---

## 3. Phạm vi của module

Module này gồm 3 phần lớn:

1. **Chăm sóc khách hàng**

   * Lưu lịch sử gọi điện, nhắn tin, tư vấn, báo giá, chăm sóc sau mua, nhắc thanh toán, khiếu nại.
   * Tạo timeline chăm sóc trong hồ sơ khách hàng.

2. **Nhắc việc / Task**

   * Gọi lại khách.
   * Chăm sóc sau mua.
   * Nhắc sinh nhật.
   * Nhắc thanh toán.
   * Nhắc xử lý khiếu nại.
   * Danh sách việc hôm nay/quá hạn/sắp tới.

3. **Remarketing cơ bản / Tệp khách hàng**

   * Lọc khách theo tag.
   * Lọc khách theo nguồn.
   * Lọc khách theo sản phẩm/danh mục đã mua.
   * Lọc khách lâu chưa mua.
   * Lọc khách sinh nhật.
   * Lọc khách còn nợ.
   * Xuất danh sách khách hàng để chăm sóc thủ công hoặc chạy quảng cáo sau này.

MVP chưa cần tích hợp gửi SMS/Zalo/Facebook tự động. Trước mắt chỉ cần **lọc đúng tệp và hỗ trợ thao tác chăm sóc thủ công**.

---

## 4. Người dùng của module

### 4.1. Chủ cửa hàng / Admin

Nhu cầu:

* Xem hôm nay sale cần chăm sóc bao nhiêu khách.
* Xem khách nào bị bỏ quên.
* Xem khách nào lâu chưa mua lại.
* Xem khách sinh nhật tháng này.
* Xem khách còn nợ.
* Xem hiệu quả chăm sóc của nhân viên.
* Xem khách VIP, khách mua nhiều.
* Xuất tệp khách hàng để remarketing.

Quyền:

* Xem toàn bộ hoạt động chăm sóc.
* Xem toàn bộ nhắc việc.
* Tạo/sửa/xóa hoạt động và nhắc việc.
* Xem/export tệp khách hàng.
* Xem báo cáo chăm sóc.

---

### 4.2. Quản lý bán hàng

Nhu cầu:

* Theo dõi việc chăm sóc của đội sale.
* Kiểm tra việc quá hạn.
* Phân công khách hàng/nhắc việc.
* Xem khách chưa được chăm sóc.
* Xem khách tiềm năng cần ưu tiên.
* Kiểm tra sale có ghi chú chăm sóc đầy đủ không.

Quyền:

* Xem hoạt động của đội.
* Giao việc cho sale.
* Tạo/sửa nhắc việc trong phạm vi.
* Xem tệp khách hàng theo quyền.
* Xem báo cáo chăm sóc của đội.

---

### 4.3. Nhân viên bán hàng / Sale

Nhu cầu:

* Biết hôm nay cần gọi/nhắn khách nào.
* Ghi chú sau mỗi lần chăm sóc.
* Đặt lịch gọi lại.
* Xem khách lâu chưa chăm sóc.
* Xem khách sắp sinh nhật.
* Xem khách từng mua sản phẩm nào để tư vấn tiếp.
* Tạo nhắc việc cho chính mình.

Quyền:

* Xem khách mình phụ trách.
* Xem hoạt động chăm sóc của khách mình phụ trách.
* Tạo hoạt động chăm sóc.
* Tạo lịch nhắc.
* Đánh dấu việc hoàn thành.
* Không xem toàn bộ khách hàng nếu không được phân quyền.

---

### 4.4. Kế toán / Thu ngân

Nhu cầu:

* Tạo nhắc thanh toán cho khách còn nợ.
* Ghi chú việc đã nhắc khách thanh toán.
* Xem khách còn nợ và lịch sử nhắc nợ.

Quyền:

* Xem công nợ theo quyền.
* Tạo hoạt động loại nhắc thanh toán.
* Tạo reminder thanh toán.
* Không nhất thiết xem toàn bộ hoạt động bán hàng nếu không được phân quyền.

---

## 5. Chăm sóc khách hàng

### 5.1. Mục tiêu

Lưu lại toàn bộ các lần tương tác giữa cửa hàng/nhân viên và khách hàng.

Một khách hàng có thể có nhiều hoạt động chăm sóc theo thời gian.

Ví dụ:

* 20/06: Gọi tư vấn balo học sinh.
* 21/06: Nhắn Zalo báo giá.
* 22/06: Khách hẹn cuối tuần mua.
* 25/06: Chốt đơn.
* 30/06: Chăm sóc sau mua.
* 20/07: Gọi lại giới thiệu sản phẩm mới.

Nếu không lưu lịch sử này, nhân viên sẽ không nhớ đã trao đổi gì, chủ cửa hàng không biết sale đã làm gì, và CRM mất giá trị.

---

### 5.2. Loại hoạt động chăm sóc

Các loại hoạt động đề xuất:

* Gọi điện.
* Nhắn Zalo.
* Nhắn Facebook.
* Gửi email.
* Gặp trực tiếp.
* Tư vấn sản phẩm.
* Báo giá.
* Chốt đơn.
* Khách hẹn lại.
* Khách từ chối.
* Chăm sóc sau mua.
* Nhắc thanh toán.
* Xử lý khiếu nại.
* Ghi chú nội bộ.
* Khác.

MVP nên có danh sách mặc định, sau này cho cấu hình thêm.

---

### 5.3. Kết quả hoạt động

Một hoạt động nên có kết quả để sau này phân tích.

Kết quả gợi ý:

* Đã liên hệ được.
* Không nghe máy.
* Sai số.
* Khách quan tâm.
* Khách chưa có nhu cầu.
* Khách hẹn gọi lại.
* Đã báo giá.
* Đã chốt đơn.
* Từ chối mua.
* Cần chăm sóc tiếp.
* Đã nhắc thanh toán.
* Đã xử lý xong.

MVP có thể lưu result dạng text hoặc enum đơn giản.

---

### 5.4. Form thêm hoạt động chăm sóc

Form gồm:

* Khách hàng.
* Loại hoạt động.
* Nội dung.
* Kết quả.
* Ngày/giờ thực hiện, mặc định hiện tại.
* Có cần chăm sóc tiếp không.
* Ngày chăm sóc tiếp theo.
* Người phụ trách tiếp theo, mặc định người đang thao tác.

Nếu nhập ngày chăm sóc tiếp theo, hệ thống tự tạo Reminder.

Ví dụ:

Loại hoạt động: Gọi điện
Nội dung: Tư vấn balo học sinh màu xanh, khách quan tâm loại 20L.
Kết quả: Khách hẹn gọi lại.
Ngày chăm sóc tiếp theo: 22/06/2026 09:00

Hệ thống tạo reminder:

* Gọi lại khách Nguyễn Văn A về balo học sinh 20L.

---

### 5.5. Timeline chăm sóc trong hồ sơ khách hàng

Trong chi tiết khách hàng cần có tab “Chăm sóc”.

Hiển thị timeline:

* Thời gian.
* Loại hoạt động.
* Nội dung.
* Kết quả.
* Người thực hiện.
* Lịch hẹn tiếp theo nếu có.

Ví dụ:

20/06/2026 09:30
Nguyễn Sale — Gọi điện
Nội dung: Khách quan tâm balo học sinh màu xanh.
Kết quả: Hẹn gọi lại ngày mai.

Timeline cần dễ đọc, vì đây là nơi sale xem lại lịch sử trước khi tư vấn tiếp.

---

## 6. Nhắc việc / Task

### 6.1. Mục tiêu

Nhắc việc giúp nhân viên không bỏ quên khách.

Các loại nhắc việc thường gặp:

* Gọi lại khách.
* Nhắn lại khách.
* Chăm sóc sau mua.
* Nhắc sinh nhật.
* Nhắc thanh toán.
* Nhắc xử lý khiếu nại.
* Nhắc giao hàng.
* Nhắc kiểm tra đơn.
* Nhắc khác.

---

### 6.2. Trường dữ liệu của nhắc việc

Mỗi Reminder/Task gồm:

* Tiêu đề.
* Nội dung.
* Khách hàng liên quan.
* Đơn hàng liên quan, nếu có.
* Loại nhắc việc.
* Ngày/giờ đến hạn.
* Người phụ trách.
* Trạng thái.
* Người tạo.
* Ngày tạo.
* Ngày hoàn thành.
* Ghi chú hoàn thành.

Trạng thái:

* pending: Chưa làm.
* done: Đã hoàn thành.
* overdue: Quá hạn, có thể tính tự động.
* cancelled: Đã hủy.

Lưu ý:

Không nhất thiết phải lưu trạng thái overdue trong database. Có thể tính nếu due_at < hiện tại và status = pending.

---

### 6.3. Danh sách nhắc việc

Màn hình Nhắc việc nên có các tab:

1. Việc hôm nay.
2. Việc quá hạn.
3. Việc sắp tới.
4. Việc đã hoàn thành.
5. Tất cả.

Cột hiển thị:

* Tiêu đề.
* Khách hàng.
* Số điện thoại.
* Loại việc.
* Hạn xử lý.
* Người phụ trách.
* Trạng thái.
* Hành động.

Hành động:

* Mở khách hàng.
* Gọi/nhắn thủ công, nếu có thông tin.
* Thêm hoạt động chăm sóc.
* Đánh dấu hoàn thành.
* Dời lịch.
* Hủy.

---

### 6.4. Tạo nhắc việc

Có thể tạo reminder từ:

* Hồ sơ khách hàng.
* Sau khi thêm hoạt động chăm sóc.
* Chi tiết đơn hàng.
* Danh sách công nợ.
* Danh sách khách sinh nhật.
* Màn hình nhắc việc.

Form tạo gồm:

* Khách hàng.
* Loại việc.
* Tiêu đề.
* Nội dung.
* Ngày/giờ đến hạn.
* Người phụ trách.
* Đơn hàng liên quan, nếu có.

---

### 6.5. Hoàn thành nhắc việc

Khi đánh dấu hoàn thành, nên có tùy chọn:

* Thêm ghi chú kết quả.
* Tạo hoạt động chăm sóc tương ứng.

Ví dụ:

Task: Gọi lại khách A
Khi hoàn thành, form hỏi:

* Kết quả cuộc gọi?
* Có cần hẹn tiếp không?

Nếu nhập hẹn tiếp, hệ thống tạo reminder mới.

---

### 6.6. Dời lịch nhắc

Người dùng có thể dời lịch:

* Dời sang ngày mai.
* Dời 3 ngày.
* Chọn ngày cụ thể.

Khi dời lịch, nên lưu note:

* Lý do dời lịch, tùy chọn.

MVP có thể chỉ cập nhật due_at.

---

## 7. Chăm sóc sau mua

### 7.1. Mục tiêu

Sau khi khách mua hàng, hệ thống nên giúp người bán chăm sóc lại.

Ví dụ:

* Sau 3 ngày: hỏi khách đã nhận hàng chưa.
* Sau 7 ngày: hỏi khách dùng sản phẩm có hài lòng không.
* Sau 30 ngày: gợi ý mua lại hoặc mua sản phẩm liên quan.

MVP chưa cần tự động phức tạp, nhưng nên có khả năng tạo nhắc việc sau mua.

---

### 7.2. Luồng gợi ý MVP

Khi đơn hàng chuyển sang completed:

Hệ thống có thể hỏi hoặc tự tạo reminder theo cấu hình:

* “Chăm sóc sau mua đơn DH-xxx”
* Hạn: sau 3 ngày hoặc 7 ngày.
* Người phụ trách: sale của đơn.

MVP có thể để người dùng tạo thủ công trước, sau này tự động hóa.

---

### 7.3. Dữ liệu cần hỗ trợ

Để chăm sóc sau mua tốt, hệ thống cần biết:

* Khách mua đơn nào.
* Mua sản phẩm/SKU nào.
* Ngày mua.
* Sale phụ trách.
* Đã chăm sóc sau mua chưa.
* Kết quả chăm sóc.

---

## 8. Nhắc sinh nhật khách hàng

### 8.1. Mục tiêu

Sinh nhật là cơ hội chăm sóc lại khách.

Hệ thống cần có danh sách:

* Khách sinh nhật hôm nay.
* Khách sinh nhật trong 7 ngày tới.
* Khách sinh nhật trong tháng.

### 8.2. Dữ liệu cần có

Từ bảng customers:

* birthday.

Có thể hỗ trợ:

* Ngày/tháng/năm.
* Sau này có thể hỗ trợ chỉ ngày/tháng nếu không biết năm sinh.

MVP dùng ngày sinh đầy đủ trước.

---

### 8.3. Màn hình sinh nhật

Cột:

* Tên khách.
* Số điện thoại.
* Ngày sinh.
* Tuổi, nếu có năm sinh.
* Tag.
* Lần mua gần nhất.
* Tổng đã mua.
* Nhân viên phụ trách.
* Hành động.

Hành động:

* Mở hồ sơ khách.
* Thêm hoạt động chăm sóc.
* Tạo lịch nhắc.
* Đánh dấu đã chăm sóc sinh nhật.
* Xuất danh sách.

---

### 8.4. Kịch bản chăm sóc sinh nhật

MVP chưa cần gửi SMS/Zalo tự động, nhưng có thể hỗ trợ text mẫu để nhân viên copy.

Ví dụ mẫu:

“Chúc mừng sinh nhật anh/chị [Tên khách]. Cửa hàng gửi anh/chị lời chúc sức khỏe, may mắn và có một ngày thật vui vẻ.”

Sau này có thể thêm mẫu tin nhắn tùy chỉnh.

---

## 9. Khách lâu chưa mua lại

### 9.1. Mục tiêu

Đây là phần rất quan trọng cho remarketing.

Hệ thống cần lọc được khách đã từng mua nhưng lâu chưa mua lại.

Ví dụ:

* Khách đã mua nhưng 30 ngày chưa mua lại.
* Khách đã mua nhưng 60 ngày chưa mua lại.
* Khách đã mua balo nhưng 6 tháng chưa quay lại.
* Khách VIP 90 ngày chưa mua lại.

### 9.2. Dữ liệu cần có

Từ đơn hàng:

* last_order_at.
* order_count.
* total_spent.
* purchased_products.
* purchased_categories.

Từ khách hàng:

* tags.
* assigned_to.
* source.

### 9.3. Bộ lọc

* Số ngày chưa mua lại: 30/60/90/tùy chọn.
* Theo tag.
* Theo nguồn.
* Theo sản phẩm đã mua.
* Theo danh mục đã mua.
* Theo nhân viên phụ trách.
* Theo tổng tiền đã mua.

MVP nên có:

* Khách đã mua nhưng X ngày chưa mua lại.
* Lọc theo tag.
* Lọc theo nguồn.
* Lọc theo nhân viên.

Sau khi module đơn hàng có dữ liệu sản phẩm, mở rộng lọc theo sản phẩm/danh mục.

---

## 10. Remarketing cơ bản / Tệp khách hàng

### 10.1. Mục tiêu

Remarketing cơ bản giúp người dùng tạo danh sách khách hàng có cùng đặc điểm để chăm sóc hoặc bán lại.

MVP chưa cần chạy chiến dịch tự động. Chỉ cần:

* Lọc đúng tệp.
* Lưu tệp nếu cần.
* Xuất danh sách.
* Tạo nhắc việc/chăm sóc thủ công.

---

### 10.2. Các tệp khách hàng mặc định

Nên có các tệp gợi ý:

1. Khách sinh nhật tháng này.
2. Khách lâu chưa mua lại.
3. Khách đã mua nhưng 30 ngày chưa mua.
4. Khách đã mua nhưng 60 ngày chưa mua.
5. Khách VIP.
6. Khách mua nhiều.
7. Khách còn nợ.
8. Khách từ Facebook.
9. Khách từ Zalo.
10. Khách chưa mua đơn nào.
11. Khách đã mua danh mục X.
12. Khách đã mua sản phẩm X.
13. Khách có tag X.
14. Khách được phụ trách bởi sale X.

---

### 10.3. Bộ lọc tạo tệp khách hàng

Bộ lọc theo thông tin khách:

* Nguồn khách.
* Tag.
* Trạng thái khách.
* Mức độ tiềm năng.
* Tỉnh/thành.
* Nhân viên phụ trách.
* Sinh nhật trong khoảng ngày/tháng.

Bộ lọc theo mua hàng:

* Đã mua.
* Chưa mua.
* Số đơn hàng.
* Tổng tiền đã mua.
* Lần mua gần nhất.
* Đã mua sản phẩm.
* Đã mua SKU.
* Đã mua danh mục.
* Đã mua thương hiệu.

Bộ lọc theo công nợ:

* Có công nợ.
* Công nợ lớn hơn X.
* Quá hạn thanh toán.

Bộ lọc theo chăm sóc:

* Lâu chưa chăm sóc.
* Có việc quá hạn.
* Đã từng được chăm sóc loại X.
* Chưa từng được chăm sóc.

MVP không cần làm toàn bộ ngay, nhưng data model và API nên có định hướng.

---

### 10.4. Lưu tệp khách hàng

Có thể có CustomerSegment.

Một segment gồm:

* Tên tệp.
* Mô tả.
* Điều kiện lọc.
* Người tạo.
* Ngày tạo.
* Ngày cập nhật.

Ví dụ:

Tên tệp: Khách mua balo 6 tháng chưa mua lại
Điều kiện:

* Đã mua danh mục Balo.
* Lần mua gần nhất > 180 ngày.

MVP có thể chưa cần lưu segment phức tạp. Có thể chỉ làm các bộ lọc trước. Nhưng nếu làm được lưu tệp thì tốt.

---

### 10.5. Hành động trên tệp khách hàng

Với danh sách khách sau khi lọc, người dùng có thể:

* Xuất Excel/CSV.
* Tạo nhắc việc hàng loạt.
* Gắn tag hàng loạt.
* Thêm ghi chú hàng loạt.
* Phân công cho sale.
* Sau này: gửi SMS/Zalo/email.

MVP nên có:

* Xuất danh sách.
* Tạo nhắc việc cho từng khách hoặc hàng loạt đơn giản.
* Gắn tag hàng loạt, nếu đã có tag.

---

## 11. Dashboard chăm sóc

### 11.1. Mục tiêu

Giúp sale/quản lý biết ngay việc cần làm.

### 11.2. Chỉ số nên có

* Việc cần làm hôm nay.
* Việc quá hạn.
* Khách sinh nhật hôm nay.
* Khách sinh nhật tháng này.
* Khách lâu chưa mua lại.
* Khách còn nợ cần nhắc.
* Hoạt động chăm sóc hôm nay.
* Hoạt động chăm sóc theo nhân viên.

### 11.3. Danh sách nhanh

* Top việc quá hạn.
* Khách cần gọi lại hôm nay.
* Khách sinh nhật hôm nay.
* Khách công nợ quá hạn.
* Khách lâu chưa mua.

MVP có thể đặt các thẻ này ở Dashboard chính hoặc màn hình Chăm sóc.

---

## 12. Dữ liệu lõi

### 12.1. Bảng customer_activities

Mục đích:

Lưu lịch sử chăm sóc khách hàng.

Trường đề xuất:

* id.
* customer_id.
* order_id, tùy chọn.
* activity_type.
* content.
* result.
* next_follow_up_at.
* created_by.
* created_at.
* updated_at.

Giải thích:

* customer_id bắt buộc.
* order_id dùng khi hoạt động liên quan đến đơn/công nợ.
* activity_type: gọi điện, nhắn Zalo, báo giá...
* content: nội dung chăm sóc.
* result: kết quả.
* next_follow_up_at: nếu cần chăm sóc tiếp.

---

### 12.2. Bảng reminders / tasks

Mục đích:

Lưu việc cần làm.

Trường đề xuất:

* id.
* customer_id.
* order_id, tùy chọn.
* title.
* content.
* reminder_type.
* due_at.
* status.
* assigned_to.
* created_by.
* completed_by.
* completed_at.
* cancelled_at.
* created_at.
* updated_at.

reminder_type gợi ý:

* follow_up.
* birthday.
* payment_reminder.
* after_sale.
* complaint.
* delivery.
* other.

status:

* pending.
* done.
* cancelled.

Trạng thái overdue có thể tính bằng due_at < now và status = pending.

---

### 12.3. Bảng customer_segments

Mục đích:

Lưu tệp khách hàng remarketing.

Trường đề xuất:

* id.
* name.
* description.
* filter_rules.
* created_by.
* created_at.
* updated_at.

filter_rules có thể lưu JSON.

Ví dụ:

{
"tag_ids": [1, 2],
"last_order_days_greater_than": 60,
"source": "Facebook"
}

MVP có thể chưa cần bảng này nếu chỉ làm bộ lọc trực tiếp.

---

### 12.4. Bảng campaign_actions, để sau MVP

Sau này nếu muốn quản lý chiến dịch chăm sóc, có thể có:

* campaign_id.
* customer_id.
* action_type.
* status.
* result.
* assigned_to.

MVP chưa cần.

---

## 13. API đề xuất

### 13.1. Customer Activity API

GET /customers/{customer_id}/activities

Mục đích:

Lấy lịch sử chăm sóc của một khách.

Query:

* activity_type.
* date_from.
* date_to.
* page.
* page_size.

---

POST /customers/{customer_id}/activities

Mục đích:

Tạo hoạt động chăm sóc.

Body:

* order_id, optional.
* activity_type.
* content.
* result.
* next_follow_up_at.
* create_reminder, true/false.
* assigned_to, nếu tạo reminder.

Quy tắc:

* customer_id phải tồn tại.
* activity_type bắt buộc.
* content bắt buộc hoặc nên bắt buộc.
* Nếu next_follow_up_at có giá trị và create_reminder = true, tạo reminder.

---

PUT /customer-activities/{id}

Mục đích:

Sửa hoạt động chăm sóc.

MVP có thể cho sửa nếu người tạo hoặc quản lý.

---

DELETE /customer-activities/{id}

MVP nên hạn chế xóa. Có thể soft delete hoặc chỉ Admin được xóa.

---

### 13.2. Reminder API

GET /reminders

Query:

* status.
* assigned_to.
* customer_id.
* reminder_type.
* due_from.
* due_to.
* overdue_only.
* today_only.
* page.
* page_size.

Response:

* id.
* title.
* customer_name.
* customer_phone.
* reminder_type.
* due_at.
* status.
* assigned_to_name.
* is_overdue.

---

POST /reminders

Body:

* customer_id.
* order_id, optional.
* title.
* content.
* reminder_type.
* due_at.
* assigned_to.

Quy tắc:

* title bắt buộc.
* due_at bắt buộc.
* assigned_to bắt buộc hoặc mặc định người tạo.
* customer_id nên bắt buộc trong CRM context.

---

PUT /reminders/{id}

Mục đích:

Sửa reminder.

---

POST /reminders/{id}/complete

Body:

* result_note.
* create_activity: true/false.
* next_follow_up_at, optional.

Quy tắc:

* Set status = done.
* completed_by.
* completed_at.
* Nếu create_activity = true, tạo customer_activity.

---

POST /reminders/{id}/cancel

Body:

* reason.

Quy tắc:

* Set status = cancelled.
* cancelled_at.

---

POST /reminders/{id}/reschedule

Body:

* new_due_at.
* reason, optional.

Quy tắc:

* Cập nhật due_at.
* Giữ status pending.

---

### 13.3. Birthday API

GET /customers/birthdays

Query:

* scope: today | next_7_days | this_month | custom.
* from_date.
* to_date.
* assigned_to.
* page.
* page_size.

Response:

* customer_id.
* customer_name.
* phone.
* birthday.
* age.
* tags.
* assigned_to_name.
* last_order_at.
* total_spent.

---

### 13.4. Remarketing / Segment API

GET /marketing/customers

Mục đích:

Lọc khách hàng theo điều kiện remarketing.

Query gợi ý:

* tag_id.
* source.
* status.
* assigned_to.
* birthday_month.
* has_debt.
* no_order_yet.
* last_order_days_greater_than.
* purchased_product_id.
* purchased_category_id.
* min_total_spent.
* min_order_count.
* page.
* page_size.

Response:

* customer_id.
* customer_name.
* phone.
* tags.
* source.
* assigned_to_name.
* order_count.
* total_spent.
* last_order_at.
* total_debt.

---

POST /marketing/segments

Mục đích:

Lưu tệp khách hàng.

Body:

* name.
* description.
* filter_rules.

MVP có thể để sau.

---

GET /marketing/segments/{id}/customers

Mục đích:

Lấy danh sách khách thuộc segment đã lưu.

MVP có thể để sau.

---

### 13.5. Bulk Action API, có thể sau MVP

POST /customers/bulk-create-reminders

Mục đích:

Tạo nhắc việc hàng loạt cho danh sách khách.

Body:

* customer_ids.
* title.
* content.
* reminder_type.
* due_at.
* assigned_to.

POST /customers/bulk-add-tags

Mục đích:

Gắn tag hàng loạt.

Body:

* customer_ids.
* tag_ids.

MVP có thể làm sau nếu chưa đủ thời gian.

---

## 14. Validation

### 14.1. CustomerActivity

* customer_id bắt buộc.
* activity_type bắt buộc.
* content nên bắt buộc.
* next_follow_up_at không nên nằm trong quá khứ nếu tạo reminder mới.

Thông báo:

“Vui lòng chọn loại hoạt động.”
“Vui lòng nhập nội dung chăm sóc.”
“Ngày chăm sóc tiếp theo không hợp lệ.”

---

### 14.2. Reminder

* title bắt buộc.
* due_at bắt buộc.
* assigned_to bắt buộc hoặc tự mặc định.
* Không cho hoàn thành reminder đã hủy.
* Không cho hủy reminder đã hoàn thành nếu không có quyền.

Thông báo:

“Vui lòng nhập tiêu đề nhắc việc.”
“Vui lòng chọn thời gian nhắc việc.”
“Không thể hoàn thành việc đã hủy.”

---

### 14.3. Segment / Remarketing filter

* Điều kiện lọc phải hợp lệ.
* Nếu lọc theo sản phẩm/danh mục, ID phải tồn tại.
* Nếu lọc số ngày chưa mua, giá trị phải >= 0.
* Nếu lọc tổng tiền, giá trị phải >= 0.

Thông báo:

“Điều kiện lọc không hợp lệ.”

---

## 15. Quy tắc phân quyền

### 15.1. Admin

* Xem toàn bộ hoạt động chăm sóc.
* Xem toàn bộ reminder.
* Tạo/sửa/xóa hoạt động.
* Tạo/sửa/hủy reminder.
* Xem/export tệp khách hàng.
* Gắn tag hàng loạt.
* Phân công reminder cho nhân viên.

### 15.2. Quản lý

* Xem hoạt động của đội.
* Xem reminder của đội.
* Tạo reminder cho nhân viên trong đội.
* Kiểm tra việc quá hạn.
* Xem tệp khách hàng theo phạm vi.

### 15.3. Sale

* Xem hoạt động của khách mình phụ trách.
* Tạo hoạt động chăm sóc.
* Tạo reminder cho chính mình hoặc khách mình phụ trách.
* Hoàn thành reminder của mình.
* Xem danh sách khách cần chăm sóc của mình.
* Không xem toàn bộ khách nếu không được phân quyền.

### 15.4. Kế toán

* Tạo hoạt động nhắc thanh toán.
* Tạo reminder thanh toán.
* Xem khách/đơn còn nợ theo quyền.
* Không cần xem toàn bộ remarketing nếu không được phân quyền.

---

## 16. UX/UI chi tiết

### 16.1. Nguyên tắc UI

* Người dùng phải biết ngay hôm nay cần làm gì.
* Tạo hoạt động chăm sóc phải nhanh.
* Tạo nhắc việc phải đơn giản.
* Timeline khách hàng phải dễ đọc.
* Các tệp khách hàng phải dễ lọc.
* Không làm màn hình remarketing quá phức tạp như phần mềm marketing automation chuyên sâu.

---

### 16.2. Màn hình Chăm sóc

Nên có các tab:

1. Việc hôm nay.
2. Việc quá hạn.
3. Khách sinh nhật.
4. Khách lâu chưa mua.
5. Tất cả hoạt động.

Hoặc chia thành 2 menu:

* Chăm sóc.
* Remarketing.

MVP có thể gom chung trong một module “Chăm sóc”.

---

### 16.3. Danh sách việc hôm nay

Cột:

* Hạn xử lý.
* Khách hàng.
* Số điện thoại.
* Loại việc.
* Nội dung.
* Người phụ trách.
* Hành động.

Hành động:

* Mở khách.
* Thêm hoạt động.
* Hoàn thành.
* Dời lịch.
* Hủy.

---

### 16.4. Timeline trong hồ sơ khách

Hiển thị hoạt động theo thứ tự mới nhất trước.

Mỗi hoạt động là một card nhỏ:

* Icon loại hoạt động.
* Thời gian.
* Người thực hiện.
* Nội dung.
* Kết quả.
* Hẹn tiếp nếu có.

---

### 16.5. Màn hình Remarketing cơ bản

Nên có giao diện lọc đơn giản:

Khối điều kiện:

* Tag.
* Nguồn.
* Trạng thái khách.
* Nhân viên phụ trách.
* Sinh nhật.
* Lâu chưa mua.
* Đã mua sản phẩm/danh mục.
* Có công nợ.

Kết quả:

* Danh sách khách.
* Số lượng khách.
* Tổng số đơn.
* Tổng doanh thu.
* Tổng công nợ, nếu có.

Hành động:

* Xuất danh sách.
* Gắn tag.
* Tạo nhắc việc.
* Mở hồ sơ khách.

---

## 17. Tích hợp với các module khác

### 17.1. Tích hợp với Khách hàng

* Tab Chăm sóc trong chi tiết khách.
* Tab Nhắc việc trong chi tiết khách.
* Trường last_activity_at có thể tính từ activity gần nhất.
* Trường next_reminder_at có thể tính từ reminder sắp tới.

---

### 17.2. Tích hợp với Đơn hàng

Khi đơn hoàn thành:

* Có thể tạo nhắc chăm sóc sau mua.
* Lịch sử mua hàng phục vụ remarketing.
* Có thể lọc khách theo sản phẩm/danh mục đã mua.

---

### 17.3. Tích hợp với Công nợ

Nếu đơn còn nợ:

* Tạo reminder nhắc thanh toán.
* Ghi activity loại nhắc thanh toán.
* Lọc khách còn nợ trong remarketing.

---

### 17.4. Tích hợp với Dashboard

Dashboard cần hiển thị:

* Việc hôm nay.
* Việc quá hạn.
* Khách sinh nhật hôm nay.
* Khách lâu chưa mua.
* Khách còn nợ.

---

## 18. Báo cáo liên quan

Báo cáo chăm sóc có thể gồm:

* Số hoạt động chăm sóc theo ngày.
* Số hoạt động theo nhân viên.
* Số khách đã chăm sóc.
* Số việc quá hạn.
* Tỷ lệ hoàn thành nhắc việc.
* Khách lâu chưa chăm sóc.
* Khách lâu chưa mua lại.
* Kết quả hoạt động: đã liên hệ, không nghe máy, đã chốt đơn...

MVP có thể chỉ cần:

* Số việc hôm nay.
* Số việc quá hạn.
* Số hoạt động hôm nay.
* Khách sinh nhật tháng này.
* Khách lâu chưa mua.

---

## 19. Export

### 19.1. Export tệp khách hàng

Xuất danh sách khách theo bộ lọc.

Cột nên có:

* Tên khách.
* Số điện thoại.
* Email.
* Zalo.
* Facebook.
* Nguồn.
* Tag.
* Lần mua gần nhất.
* Tổng đã mua.
* Công nợ.
* Nhân viên phụ trách.
* Ghi chú.

### 19.2. Export nhắc việc

Xuất danh sách việc cần làm:

* Tiêu đề.
* Khách.
* Số điện thoại.
* Hạn xử lý.
* Người phụ trách.
* Trạng thái.
* Nội dung.

### 19.3. Export hoạt động chăm sóc

Xuất lịch sử chăm sóc:

* Thời gian.
* Khách.
* Loại hoạt động.
* Nội dung.
* Kết quả.
* Người thực hiện.

---

## 20. Những gì chưa làm trong MVP

MVP chưa cần:

* Gửi SMS tự động.
* Gửi Zalo OA tự động.
* Gửi Facebook Messenger tự động.
* Email marketing tự động.
* Workflow automation phức tạp.
* Lead scoring tự động.
* AI gợi ý nội dung chăm sóc.
* Chiến dịch marketing nhiều bước.
* Tracking mở tin nhắn/click link.
* Tự động phân bổ khách cho sale.
* Tổng đài gọi điện tích hợp.
* Ghi âm cuộc gọi.
* Chat đa kênh.

Lý do:

* Các phần này phức tạp.
* Cần API bên thứ ba.
* Cần tài khoản dịch vụ.
* Có thể làm sau khi dữ liệu lõi đã tốt.

---

## 21. Những lỗi/bug không được phép tồn tại

Các lỗi sau phải coi là nghiêm trọng:

1. Tạo hoạt động chăm sóc nhưng không hiển thị trong hồ sơ khách.
2. Tạo reminder nhưng không xuất hiện trong danh sách việc cần làm.
3. Reminder quá hạn nhưng không nhận biết được.
4. Hoàn thành reminder nhưng trạng thái không cập nhật.
5. Ghi next_follow_up_at nhưng không tạo reminder nếu người dùng chọn tạo.
6. Khách sinh nhật tháng này lọc sai.
7. Khách lâu chưa mua lại tính sai.
8. Sale thấy khách không thuộc quyền nếu hệ thống có phân quyền.
9. Không lưu người tạo hoạt động chăm sóc.
10. Không lưu thời gian hoạt động.
11. Tệp remarketing lọc sai khách.
12. Export sai dữ liệu so với bộ lọc.
13. Xóa activity/reminder quan trọng không có quyền.
14. Gắn tag hàng loạt sai khách.
15. Nhắc thanh toán không liên kết được với khách/đơn.

---

## 22. Tiêu chí hoàn thành MVP cho module Chăm sóc / Nhắc việc / Remarketing

Module này được coi là dùng được thật khi đạt các tiêu chí:

1. Tạo được hoạt động chăm sóc cho khách.
2. Xem được timeline chăm sóc trong hồ sơ khách.
3. Tạo được reminder cho khách.
4. Xem được việc hôm nay.
5. Xem được việc quá hạn.
6. Đánh dấu reminder hoàn thành.
7. Dời lịch reminder.
8. Tạo reminder từ hoạt động chăm sóc.
9. Tạo reminder nhắc thanh toán từ công nợ.
10. Lọc được khách sinh nhật tháng này.
11. Lọc được khách lâu chưa mua lại.
12. Lọc được khách theo tag.
13. Lọc được khách theo nguồn.
14. Lọc được khách còn nợ.
15. Sau khi có đơn hàng, lọc được khách theo sản phẩm/danh mục đã mua.
16. Xuất được danh sách khách theo bộ lọc, nếu MVP có export.
17. Phân quyền cơ bản: sale chỉ thấy việc/khách của mình nếu bật phân quyền.
18. Dashboard hiển thị việc cần làm và cảnh báo quá hạn cơ bản.

---

## 23. Roadmap triển khai module Chăm sóc / Nhắc việc / Remarketing

### Sprint CARE-1: Hoạt động chăm sóc

Mục tiêu:

* Tạo customer_activities.
* Ghi hoạt động từ hồ sơ khách.
* Timeline chăm sóc.
* Loại hoạt động và kết quả.

Phạm vi:

* API activities.
* Activity form.
* Customer activity tab.

---

### Sprint CARE-2: Reminder / Task

Mục tiêu:

* Tạo reminder.
* Danh sách việc hôm nay.
* Việc quá hạn.
* Hoàn thành/dời lịch/hủy reminder.

Phạm vi:

* reminders table.
* reminders API.
* reminder list UI.
* reminder actions.

---

### Sprint CARE-3: Kết nối hoạt động và reminder

Mục tiêu:

* Tạo reminder từ hoạt động chăm sóc.
* Khi hoàn thành reminder có thể tạo activity.
* next_follow_up_at tự tạo task.

Phạm vi:

* create activity + reminder flow.
* complete reminder + activity flow.

---

### Sprint CARE-4: Sinh nhật và chăm sóc sau mua

Mục tiêu:

* Danh sách khách sinh nhật hôm nay/tháng này.
* Gợi ý chăm sóc sau mua.
* Tạo reminder chăm sóc sau mua thủ công hoặc bán tự động.

Phạm vi:

* birthday filters.
* after-sale reminder.

---

### Sprint CARE-5: Remarketing cơ bản

Mục tiêu:

* Lọc khách theo tag.
* Lọc khách theo nguồn.
* Lọc khách lâu chưa mua.
* Lọc khách còn nợ.
* Lọc khách theo sản phẩm/danh mục đã mua, sau khi đơn hàng đủ dữ liệu.

Phạm vi:

* marketing customer filter.
* segment result UI.

---

### Sprint CARE-6: Hành động hàng loạt và export

Mục tiêu:

* Xuất danh sách khách.
* Tạo reminder hàng loạt.
* Gắn tag hàng loạt.
* Lưu segment, nếu cần.

Phạm vi:

* export CSV/XLSX.
* bulk reminder.
* bulk tag.
* saved segments.

---

### Sprint CARE-7: Báo cáo chăm sóc cơ bản

Mục tiêu:

* Số hoạt động theo ngày.
* Số việc quá hạn.
* Tỷ lệ hoàn thành reminder.
* Hoạt động theo nhân viên.

Phạm vi:

* care dashboard.
* simple reports.

---

## 24. Kết luận

Module Chăm sóc khách hàng / Nhắc việc / Remarketing cơ bản là phần giúp phần mềm CRM_Ban_Hang tạo ra giá trị dài hạn.

Điểm cốt lõi:

* Mỗi khách hàng phải có lịch sử chăm sóc.
* Mỗi việc cần làm phải có người phụ trách và ngày đến hạn.
* Hệ thống phải chỉ ra khách nào cần chăm sóc hôm nay.
* Hệ thống phải lọc được khách sinh nhật, khách lâu chưa mua, khách còn nợ.
* Remarketing MVP chưa cần tự động gửi tin nhắn, nhưng phải lọc đúng tệp khách hàng.
* Dữ liệu chăm sóc phải liên kết với khách hàng, đơn hàng và công nợ.
* Sale không chỉ nhập dữ liệu, mà phải được hệ thống nhắc hành động.

Nếu module này làm tốt, phần mềm sẽ không chỉ giúp quản lý bán hàng hiện tại, mà còn giúp tăng doanh thu từ khách hàng cũ.
