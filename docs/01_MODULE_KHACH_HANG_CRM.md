# ĐẶC TẢ MODULE CHI TIẾT

# Module Khách hàng / CRM

# Dự án: CRM_Ban_Hang

## 1. Mục tiêu của module Khách hàng / CRM

Module Khách hàng / CRM là trung tâm dữ liệu của toàn bộ phần mềm.

Mục tiêu không chỉ là lưu tên và số điện thoại khách hàng, mà phải tạo ra một “hồ sơ khách hàng” đầy đủ, giúp cửa hàng biết rõ:

* Khách hàng là ai.
* Khách liên hệ qua kênh nào.
* Khách đến từ nguồn nào.
* Khách đã mua gì.
* Khách còn nợ không.
* Khách đã được chăm sóc ra sao.
* Khi nào cần chăm sóc lại.
* Khách thuộc nhóm/tag nào.
* Khách có tiềm năng mua lại không.
* Khách có bị trùng với dữ liệu cũ không.

Module này phải phục vụ trực tiếp cho các nghiệp vụ sau:

1. Bán hàng.
2. Chăm sóc khách hàng.
3. Remarketing.
4. Theo dõi công nợ.
5. Phân tích nguồn khách.
6. Đánh giá hiệu quả nhân viên bán hàng.
7. Xây dựng tệp khách hàng lâu dài.

Nguyên tắc thiết kế:

* Không làm “thêm nhanh khách hàng” sơ sài.
* Khi thêm khách hàng, form đầy đủ phải hiện ngay.
* Các trường quan trọng được chia nhóm rõ ràng để không rối.
* Chỉ một số trường là bắt buộc.
* Người dùng có thể nhập ít trước, bổ sung sau, nhưng không phải đi qua nhiều màn hình rườm rà.
* Sau khi tạo khách hàng, luôn có thể xem/sửa chi tiết, tạo đơn, ghi chú chăm sóc, tạo lịch nhắc.

---

## 2. Vai trò của khách hàng trong toàn hệ thống

Khách hàng liên kết với nhiều module khác:

* Khách hàng có nhiều đơn hàng.
* Khách hàng có nhiều hoạt động chăm sóc.
* Khách hàng có nhiều lịch nhắc.
* Khách hàng có nhiều thanh toán.
* Khách hàng có thể có công nợ.
* Khách hàng có thể thuộc nhiều tag.
* Khách hàng có thể nằm trong nhiều tệp remarketing.
* Khách hàng có thể được phân công cho một nhân viên phụ trách.
* Khách hàng có lịch sử mua nhiều sản phẩm/SKU khác nhau.

Vì vậy, dữ liệu khách hàng phải được thiết kế chuẩn ngay từ đầu. Nếu module khách hàng làm sơ sài, các module sau như đơn hàng, công nợ, chăm sóc và remarketing đều bị yếu theo.

---

## 3. Người dùng của module Khách hàng

### 3.1. Chủ cửa hàng / Admin

Nhu cầu:

* Xem toàn bộ danh sách khách hàng.
* Biết khách nào mua nhiều.
* Biết khách nào còn nợ.
* Biết khách nào lâu chưa mua lại.
* Biết nguồn khách nào tạo doanh thu tốt.
* Kiểm tra nhân viên nào chăm sóc khách tốt.
* Xuất danh sách khách hàng để remarketing.

Quyền:

* Xem tất cả khách hàng.
* Thêm/sửa/xóa/ngừng hoạt động khách hàng.
* Gán nhân viên phụ trách.
* Xem lịch sử mua hàng.
* Xem công nợ.
* Xem lịch sử chăm sóc.
* Import/export khách hàng.
* Gộp khách hàng trùng nếu sau này có tính năng merge.

---

### 3.2. Quản lý bán hàng

Nhu cầu:

* Theo dõi khách hàng của đội sale.
* Phân công khách hàng.
* Kiểm tra khách chưa được chăm sóc.
* Kiểm tra khách tiềm năng.
* Theo dõi khách theo nguồn.
* Theo dõi lịch sử chăm sóc của nhân viên.

Quyền:

* Xem khách hàng trong phạm vi được phân quyền.
* Gán khách cho nhân viên.
* Sửa thông tin khách nếu được phép.
* Xem hoạt động chăm sóc.
* Xem đơn hàng/công nợ theo quyền.

---

### 3.3. Nhân viên bán hàng

Nhu cầu:

* Thêm khách hàng mới.
* Tìm khách theo số điện thoại.
* Xem hồ sơ khách trước khi tư vấn.
* Tạo đơn hàng cho khách.
* Ghi chú chăm sóc.
* Tạo lịch nhắc gọi lại.
* Xem khách mình cần chăm sóc hôm nay.

Quyền:

* Tạo khách hàng.
* Sửa khách hàng do mình phụ trách hoặc được phân công.
* Ghi chú chăm sóc.
* Tạo lịch nhắc.
* Tạo đơn hàng.
* Xem lịch sử mua hàng của khách mình phụ trách.
* Không nhất thiết xem toàn bộ khách hàng của hệ thống nếu chưa được phân quyền.

---

## 4. Cấu trúc màn hình module Khách hàng

Module Khách hàng nên có các màn hình chính:

1. Danh sách khách hàng.
2. Thêm khách hàng.
3. Chi tiết khách hàng.
4. Sửa khách hàng.
5. Lịch sử chăm sóc của khách.
6. Lịch nhắc liên quan đến khách.
7. Lịch sử mua hàng của khách.
8. Công nợ của khách.
9. Import/export khách hàng, có thể để sau MVP.

---

## 5. Màn hình Danh sách khách hàng

### 5.1. Mục tiêu

Màn hình danh sách giúp người dùng tìm nhanh khách hàng, lọc khách theo tiêu chí và thực hiện hành động nhanh.

Không nên chỉ là bảng đơn giản. Đây phải là trung tâm tra cứu CRM.

### 5.2. Thành phần chính

Màn hình gồm:

* Tiêu đề: Khách hàng.
* Nút “Thêm khách hàng”.
* Ô tìm kiếm nhanh.
* Bộ lọc.
* Bảng danh sách khách hàng.
* Hành động nhanh trên từng khách.
* Phân trang.
* Tổng số khách hàng.
* Có thể có nút export nếu được phân quyền.

### 5.3. Tìm kiếm nhanh

Ô tìm kiếm cần hỗ trợ tìm theo:

* Họ tên.
* Số điện thoại 1.
* Số điện thoại 2.
* Email.
* Zalo.
* Facebook.
* Mã khách hàng nếu có.
* Ghi chú nếu cần mở rộng sau.

Tìm kiếm nên không phân biệt dấu tiếng Việt nếu làm được.

Ví dụ:

* Tìm “thoan” vẫn ra “Thoán”.
* Tìm “0987” ra khách có số điện thoại chứa 0987.

### 5.4. Bộ lọc khách hàng

Các bộ lọc nên có:

* Nguồn khách hàng.
* Trạng thái khách hàng.
* Mức độ tiềm năng.
* Tag khách hàng.
* Nhân viên phụ trách.
* Tỉnh/thành phố.
* Khách có công nợ.
* Khách có sinh nhật trong tháng.
* Khách lâu chưa mua.
* Khách lâu chưa chăm sóc.
* Khách mới tạo trong khoảng ngày.
* Khách có đơn hàng trong khoảng ngày.

MVP có thể làm trước các bộ lọc:

* Nguồn.
* Trạng thái.
* Tag.
* Nhân viên phụ trách.
* Khách có công nợ.
* Sinh nhật tháng này.

### 5.5. Cột trong bảng danh sách khách hàng

Các cột đề xuất:

* Tên khách hàng.
* Số điện thoại.
* Nguồn khách.
* Tag.
* Trạng thái.
* Mức độ tiềm năng.
* Nhân viên phụ trách.
* Lần mua gần nhất.
* Lần chăm sóc gần nhất.
* Công nợ.
* Hành động.

Không nên hiển thị quá nhiều cột cùng lúc làm rối. Có thể cho phép ẩn/hiện cột sau này.

### 5.6. Hành động trên từng khách

Mỗi dòng khách hàng cần có:

* Xem chi tiết.
* Sửa.
* Tạo đơn hàng.
* Thêm ghi chú chăm sóc.
* Tạo lịch nhắc.
* Ngừng hoạt động hoặc xóa, tùy quyền.

Đây là điểm bắt buộc. Sau khi thêm khách hàng xong mà không có nút sửa/xem chi tiết là lỗi thiết kế nghiêm trọng.

---

## 6. Màn hình Thêm khách hàng

### 6.1. Nguyên tắc

Không tách “thêm nhanh” và “thêm chi tiết”.

Khi bấm “Thêm khách hàng”, hệ thống mở form đầy đủ, chia nhóm rõ ràng. Người dùng có thể nhập đầy đủ ngay hoặc chỉ nhập các thông tin cơ bản trước.

### 6.2. Bố cục form

Form thêm khách hàng nên chia thành các khối:

1. Thông tin cơ bản.
2. Thông tin liên hệ.
3. Địa chỉ.
4. Phân loại khách hàng.
5. Thông tin phụ trách.
6. Ghi chú và chăm sóc.
7. Thông tin mở rộng, có thể thu gọn.

### 6.3. Nhóm thông tin cơ bản

Trường:

* Họ tên.
* Giới tính.
* Ngày sinh.
* Mã khách hàng, tự sinh nếu cần.
* Trạng thái khách hàng.
* Mức độ tiềm năng.

Quy tắc:

* Họ tên nên bắt buộc nếu không có số điện thoại.
* Nếu có số điện thoại thì họ tên có thể tạm để trống trong trường hợp khách chưa cung cấp tên, nhưng nên khuyến khích nhập.
* Ngày sinh dùng cho chăm sóc sinh nhật.
* Giới tính dùng cho tư vấn sản phẩm, nếu phù hợp ngành hàng.
* Trạng thái mặc định: Mới.
* Mức độ tiềm năng mặc định: Ấm hoặc chưa xác định.

### 6.4. Nhóm thông tin liên hệ

Trường:

* Số điện thoại 1.
* Số điện thoại 2.
* Zalo.
* Facebook.
* Email.

Quy tắc:

* Số điện thoại 1 nên là trường quan trọng nhất.
* Hệ thống phải kiểm tra trùng số điện thoại.
* Zalo có thể mặc định giống số điện thoại 1 nếu người dùng chọn.
* Email cần kiểm tra đúng định dạng nếu có nhập.
* Facebook có thể lưu dạng link hoặc tên tài khoản.

### 6.5. Nhóm địa chỉ

Trường:

* Địa chỉ chi tiết.
* Tỉnh/thành phố.
* Quận/huyện.
* Phường/xã.
* Ghi chú giao hàng.

Mục đích:

* Phục vụ giao hàng.
* Phân tích khách theo khu vực.
* Tạo đơn nhanh hơn vì có sẵn địa chỉ.

MVP có thể nhập text tự do trước. Sau này có thể chuẩn hóa tỉnh/huyện/xã.

### 6.6. Nhóm phân loại khách hàng

Trường:

* Nguồn khách hàng.
* Tag khách hàng.
* Nhóm khách hàng.
* Mức độ tiềm năng.
* Trạng thái khách hàng.

Nguồn khách hàng gợi ý:

* Facebook.
* Zalo.
* TikTok.
* Website.
* Shopee.
* Giới thiệu.
* Khách cũ.
* Offline.
* Khác.

Tag khách hàng gợi ý:

* VIP.
* Khách mua nhiều.
* Khách mua buôn.
* Khách có con nhỏ.
* Khách quan tâm balo.
* Khách quan tâm sách.
* Khách quan tâm đồ chơi.
* Khách cần chăm sóc lại.
* Khách nhạy cảm giá.
* Khách dễ chốt.

Trạng thái khách hàng gợi ý:

* Mới.
* Đang tư vấn.
* Đã mua.
* Cần chăm sóc lại.
* Tạm ngưng.
* Không tiềm năng.
* VIP.

Mức độ tiềm năng:

* Nóng.
* Ấm.
* Lạnh.
* Chưa xác định.

### 6.7. Nhóm thông tin phụ trách

Trường:

* Nhân viên phụ trách.
* Người tạo khách.
* Ngày tạo.
* Người cập nhật gần nhất.
* Ngày cập nhật gần nhất.

Trong form thêm mới, người dùng chỉ cần chọn nhân viên phụ trách nếu có quyền. Các trường người tạo, ngày tạo, người cập nhật được hệ thống tự lưu.

### 6.8. Nhóm ghi chú và chăm sóc

Trường:

* Ghi chú nội bộ.
* Nội dung chăm sóc đầu tiên, tùy chọn.
* Ngày cần chăm sóc tiếp theo, tùy chọn.
* Kết quả tư vấn ban đầu, tùy chọn.

Nếu người dùng nhập “ngày cần chăm sóc tiếp theo”, hệ thống tạo luôn một Reminder/Task.

Nếu người dùng nhập “nội dung chăm sóc đầu tiên”, hệ thống tạo luôn một CustomerActivity.

Điều này giúp người dùng không phải nhập lại ở màn hình khác.

---

## 7. Kiểm tra trùng khách hàng

### 7.1. Mục tiêu

Tránh tạo nhiều hồ sơ cho cùng một khách.

Nếu không chống trùng, phần mềm CRM sẽ nhanh chóng bị loạn:

* Một khách có nhiều hồ sơ.
* Lịch sử mua hàng bị chia nhỏ.
* Công nợ khó theo dõi.
* Remarketing sai.
* Nhân viên chăm sóc trùng.

### 7.2. Quy tắc kiểm tra trùng

Khi thêm hoặc sửa khách hàng, hệ thống kiểm tra:

* phone_1 của khách mới trùng phone_1 của khách khác.
* phone_1 của khách mới trùng phone_2 của khách khác.
* phone_2 của khách mới trùng phone_1 của khách khác.
* phone_2 của khách mới trùng phone_2 của khách khác.

Cần chuẩn hóa số điện thoại trước khi so sánh:

* Loại bỏ khoảng trắng.
* Loại bỏ dấu chấm, dấu gạch ngang nếu có.
* Có thể chuẩn hóa đầu số Việt Nam ở mức cơ bản, ví dụ +84 và 0 nếu sau này cần.

Ví dụ:

* 0987 884 244
* 0987884244
* 098-788-4244

Nên được coi là một số.

### 7.3. Cách xử lý khi trùng

Có hai mức xử lý:

Mức 1: Cảnh báo mềm

Nếu hệ thống nghi ngờ trùng nhưng chưa chắc, hiển thị:

“Có thể khách hàng này đã tồn tại”.

Cho người dùng lựa chọn:

* Mở hồ sơ khách đã tồn tại.
* Vẫn tạo mới, nếu có quyền.
* Hủy thao tác.

Mức 2: Chặn cứng

Nếu số điện thoại trùng chính xác, MVP nên chặn tạo mới để giữ dữ liệu sạch.

Thông báo:

“Số điện thoại này đã tồn tại ở khách hàng Nguyễn Văn A. Vui lòng mở hồ sơ khách hàng hiện có hoặc kiểm tra lại.”

### 7.4. Trùng khi sửa khách hàng

Khi sửa khách, nếu đổi số điện thoại thành số đã thuộc khách khác, hệ thống phải chặn hoặc cảnh báo.

Không được tự động merge khách trong MVP.

---

## 8. Màn hình Chi tiết khách hàng

### 8.1. Mục tiêu

Màn hình chi tiết khách hàng là nơi người dùng hiểu toàn bộ lịch sử và giá trị của một khách hàng.

Không nên chỉ là form thông tin. Đây phải là “hồ sơ 360 độ” của khách.

### 8.2. Bố cục đề xuất

Màn hình chi tiết gồm:

1. Header khách hàng.
2. Thông tin liên hệ.
3. Tag/trạng thái/phụ trách.
4. Chỉ số tóm tắt.
5. Lịch sử mua hàng.
6. Lịch sử chăm sóc.
7. Lịch nhắc việc.
8. Công nợ.
9. Ghi chú nội bộ.
10. Hành động nhanh.

### 8.3. Header khách hàng

Hiển thị:

* Họ tên.
* Số điện thoại chính.
* Trạng thái.
* Mức độ tiềm năng.
* Tag.
* Nhân viên phụ trách.

Nút hành động:

* Sửa thông tin.
* Tạo đơn hàng.
* Thêm hoạt động chăm sóc.
* Tạo lịch nhắc.
* Ngừng hoạt động.
* Xóa nếu được phép và chưa có dữ liệu liên quan.

### 8.4. Chỉ số tóm tắt

Nên có các chỉ số:

* Tổng số đơn hàng.
* Tổng tiền đã mua.
* Tổng đã thanh toán.
* Tổng công nợ.
* Lần mua gần nhất.
* Lần chăm sóc gần nhất.
* Lịch nhắc sắp tới.

Những chỉ số này giúp sale/chủ cửa hàng hiểu nhanh giá trị khách hàng.

### 8.5. Lịch sử mua hàng

Hiển thị danh sách đơn hàng của khách:

* Mã đơn.
* Ngày tạo.
* Trạng thái đơn.
* Tổng tiền.
* Đã thanh toán.
* Còn nợ.
* Sản phẩm chính.
* Nút xem đơn hàng.

Trong MVP, khi module đơn hàng chưa có, khu vực này có thể để trống với thông báo:

“Chưa có đơn hàng”.

Nhưng giao diện nên thiết kế sẵn.

### 8.6. Lịch sử chăm sóc

Hiển thị các hoạt động:

* Thời gian.
* Loại hoạt động.
* Nội dung.
* Kết quả.
* Người thực hiện.
* Ngày hẹn chăm sóc tiếp theo nếu có.

Có nút:

* Thêm hoạt động.
* Lọc theo loại hoạt động.
* Xem toàn bộ.

### 8.7. Lịch nhắc việc

Hiển thị:

* Việc cần làm.
* Ngày đến hạn.
* Người phụ trách.
* Trạng thái.
* Nút hoàn thành.
* Nút sửa lịch nhắc.
* Nút hủy.

Trạng thái nhắc việc:

* Chưa làm.
* Đã hoàn thành.
* Quá hạn.
* Đã hủy.

### 8.8. Công nợ

Hiển thị:

* Tổng công nợ.
* Danh sách đơn còn nợ.
* Ngày phát sinh.
* Số tiền còn nợ.
* Trạng thái nhắc nợ.

Trong MVP nếu module công nợ chưa xong, có thể hiển thị placeholder. Nhưng data model cần chuẩn bị sẵn liên kết.

### 8.9. Ghi chú nội bộ

Ghi chú nội bộ là thông tin tổng quan về khách.

Ví dụ:

* Khách thích gọi buổi tối.
* Khách hay hỏi giảm giá.
* Khách mua cho con học cấp 1.
* Khách quan tâm sách Phật giáo.
* Khách khó tính về giao hàng.

Ghi chú nội bộ khác với lịch sử chăm sóc. Ghi chú nội bộ là thông tin tổng quát, còn lịch sử chăm sóc là từng lần tương tác cụ thể.

---

## 9. Sửa khách hàng

### 9.1. Yêu cầu bắt buộc

Mọi khách hàng sau khi tạo phải có thể sửa thông tin.

Danh sách khách hàng phải có nút “Sửa” hoặc “Xem chi tiết”, từ đó sửa được.

Đây là yêu cầu bắt buộc, không được thiếu.

### 9.2. Các trường có thể sửa

* Họ tên.
* Số điện thoại 1.
* Số điện thoại 2.
* Giới tính.
* Ngày sinh.
* Email.
* Zalo.
* Facebook.
* Địa chỉ.
* Tỉnh/thành phố.
* Quận/huyện.
* Phường/xã.
* Nguồn khách.
* Trạng thái.
* Mức độ tiềm năng.
* Tag.
* Nhân viên phụ trách.
* Ghi chú nội bộ.

### 9.3. Lưu lịch sử chỉnh sửa

MVP có thể chưa cần giao diện audit log đầy đủ, nhưng nên lưu các thao tác quan trọng:

* Ai sửa.
* Sửa lúc nào.
* Sửa trường gì.
* Giá trị cũ.
* Giá trị mới.

Tối thiểu nên lưu:

* updated_at.
* updated_by.

Sau này mở rộng AuditLog.

---

## 10. Xóa / Ngừng hoạt động khách hàng

Không nên xóa cứng khách hàng nếu đã có dữ liệu liên quan.

### 10.1. Trạng thái khách hàng

Nên dùng trạng thái:

* active: đang hoạt động.
* inactive: ngừng hoạt động.

Hoặc trong trạng thái nghiệp vụ có:

* Tạm ngưng.
* Không tiềm năng.

### 10.2. Quy tắc xóa

MVP nên ưu tiên “ngừng hoạt động” thay vì xóa.

Chỉ cho xóa cứng nếu:

* Khách chưa có đơn hàng.
* Chưa có thanh toán.
* Chưa có lịch sử chăm sóc quan trọng.
* Người dùng có quyền Admin.

Nếu khách đã có lịch sử, chỉ cho “ngừng hoạt động”.

Thông báo:

“Khách hàng đã có lịch sử giao dịch/chăm sóc, không thể xóa. Bạn có thể chuyển trạng thái sang Ngừng hoạt động.”

---

## 11. Hoạt động chăm sóc khách hàng

### 11.1. Mục tiêu

Lưu mọi lần tương tác giữa nhân viên và khách hàng.

### 11.2. Loại hoạt động

Gợi ý:

* Gọi điện.
* Nhắn Zalo.
* Nhắn Facebook.
* Gửi email.
* Gặp trực tiếp.
* Tư vấn.
* Báo giá.
* Chốt đơn.
* Hẹn gọi lại.
* Khách từ chối.
* Khiếu nại.
* Chăm sóc sau mua.
* Nhắc thanh toán.
* Ghi chú khác.

### 11.3. Trường dữ liệu

CustomerActivity:

* id.
* customer_id.
* activity_type.
* content.
* result.
* next_follow_up_at.
* created_by.
* created_at.

### 11.4. Tạo hoạt động

Người dùng có thể tạo hoạt động từ:

* Màn hình chi tiết khách hàng.
* Danh sách khách hàng.
* Màn hình chăm sóc/nhắc việc.
* Sau khi tạo đơn hàng, nếu cần.

Form tạo hoạt động gồm:

* Loại hoạt động.
* Nội dung.
* Kết quả.
* Có cần chăm sóc tiếp không.
* Ngày chăm sóc tiếp theo.

Nếu có ngày chăm sóc tiếp theo, hệ thống tự tạo Reminder.

---

## 12. Lịch nhắc / Task chăm sóc

### 12.1. Mục tiêu

Giúp người dùng không quên chăm sóc khách.

### 12.2. Loại nhắc việc

* Gọi lại khách.
* Nhắn tin khách.
* Chăm sóc sau mua.
* Nhắc sinh nhật.
* Nhắc thanh toán.
* Nhắc xử lý khiếu nại.
* Nhắc giao hàng.
* Nhắc khác.

### 12.3. Trường dữ liệu

Reminder/Task:

* id.
* customer_id.
* title.
* content.
* due_at.
* status.
* assigned_to.
* created_by.
* created_at.
* completed_at.

Trạng thái:

* pending: chưa làm.
* done: đã hoàn thành.
* overdue: quá hạn.
* cancelled: đã hủy.

### 12.4. Danh sách nhắc việc

Cần có danh sách:

* Việc hôm nay.
* Việc quá hạn.
* Việc sắp tới.
* Việc đã hoàn thành.

MVP có thể nằm trong module Chăm sóc hoặc trong chi tiết khách hàng trước.

---

## 13. Tag và nhóm khách hàng

### 13.1. Mục tiêu

Tag giúp phân loại và remarketing.

Một khách hàng có thể có nhiều tag.

Ví dụ:

* VIP.
* Mua nhiều.
* Mua buôn.
* Có con nhỏ.
* Quan tâm balo.
* Quan tâm sách thiếu nhi.
* Quan tâm kinh sách.
* Hay săn khuyến mãi.
* Cần chăm sóc lại.
* Khách khó tính.
* Khách tiềm năng cao.

### 13.2. Cách dùng

Tag được dùng để:

* Lọc khách hàng.
* Tạo tệp remarketing.
* Ưu tiên chăm sóc.
* Phân tích nhóm khách.

### 13.3. Quản lý tag

MVP có thể cho nhập tag tự do hoặc chọn từ danh sách.

Tốt hơn là có bảng CustomerTag:

* id.
* name.
* color.
* description.
* created_at.

Quan hệ nhiều-nhiều giữa Customer và CustomerTag.

---

## 14. Nguồn khách hàng

### 14.1. Mục tiêu

Biết khách đến từ đâu để đánh giá hiệu quả bán hàng/marketing.

Nguồn khách gợi ý:

* Facebook.
* Zalo.
* TikTok.
* Website.
* Shopee.
* Lazada.
* TikTok Shop.
* Giới thiệu.
* Khách cũ.
* Offline.
* Hội chợ.
* Khác.

### 14.2. Cách sử dụng

Nguồn khách dùng để:

* Lọc khách.
* Báo cáo doanh thu theo nguồn.
* Đánh giá kênh nào hiệu quả.
* Remarketing theo nguồn.

MVP có thể lưu source dạng text hoặc enum. Tốt hơn là có cấu hình nguồn khách để người dùng tự thêm/sửa.

---

## 15. Trạng thái khách hàng

Trạng thái khách hàng giúp biết khách đang ở giai đoạn nào.

Gợi ý trạng thái:

* Mới.
* Đang tư vấn.
* Đã mua.
* Cần chăm sóc lại.
* Tạm ngưng.
* Không tiềm năng.
* VIP.

Ý nghĩa:

* Mới: vừa tạo, chưa chăm sóc nhiều.
* Đang tư vấn: đang có khả năng mua.
* Đã mua: đã có đơn hoàn thành.
* Cần chăm sóc lại: nên gọi/nhắn lại.
* Tạm ngưng: chưa cần chăm sóc.
* Không tiềm năng: ít khả năng mua.
* VIP: khách giá trị cao.

Trạng thái có thể tự cập nhật một phần:

* Khi khách có đơn hoàn thành đầu tiên, có thể chuyển thành “Đã mua”.
* Khi khách lâu chưa mua, có thể gợi ý “Cần chăm sóc lại”.
* Nhưng MVP chưa cần tự động quá nhiều, có thể cho người dùng chọn.

---

## 16. Mức độ tiềm năng

Mức độ tiềm năng giúp sale ưu tiên.

Gợi ý:

* Nóng.
* Ấm.
* Lạnh.
* Chưa xác định.

Ý nghĩa:

* Nóng: có nhu cầu rõ, nên chăm sóc ngay.
* Ấm: có quan tâm nhưng chưa chốt.
* Lạnh: ít quan tâm hoặc chưa có nhu cầu.
* Chưa xác định: chưa đủ dữ liệu.

Mức độ này có thể dùng trong danh sách việc cần làm và lọc khách.

---

## 17. Dữ liệu lõi của module Khách hàng

### 17.1. Bảng customers

Mục đích:

Lưu hồ sơ khách hàng chính.

Trường đề xuất:

* id.
* customer_code.
* full_name.
* phone_1.
* phone_2.
* phone_normalized_1.
* phone_normalized_2.
* gender.
* birthday.
* email.
* zalo.
* facebook.
* address.
* province.
* district.
* ward.
* shipping_note.
* source.
* status.
* potential_level.
* assigned_to.
* internal_note.
* created_by.
* updated_by.
* created_at.
* updated_at.
* deleted_at, nếu dùng soft delete.

Ghi chú:

* phone_normalized_1 và phone_normalized_2 dùng để chống trùng.
* customer_code có thể tự sinh, ví dụ KH000001.
* deleted_at dùng cho soft delete nếu cần.

---

### 17.2. Bảng customer_tags

Mục đích:

Lưu danh sách tag.

Trường đề xuất:

* id.
* name.
* color.
* description.
* created_at.
* updated_at.

---

### 17.3. Bảng customer_tag_links

Mục đích:

Liên kết nhiều-nhiều giữa customers và customer_tags.

Trường đề xuất:

* id.
* customer_id.
* tag_id.
* created_at.

---

### 17.4. Bảng customer_activities

Mục đích:

Lưu lịch sử chăm sóc.

Trường đề xuất:

* id.
* customer_id.
* activity_type.
* content.
* result.
* next_follow_up_at.
* created_by.
* created_at.

---

### 17.5. Bảng reminders / tasks

Mục đích:

Lưu lịch nhắc.

Trường đề xuất:

* id.
* customer_id.
* title.
* content.
* due_at.
* status.
* assigned_to.
* created_by.
* created_at.
* completed_at.
* cancelled_at.

---

### 17.6. Bảng audit_logs, mở rộng sau

Mục đích:

Lưu lịch sử thao tác quan trọng.

Trường đề xuất:

* id.
* user_id.
* action.
* entity_type.
* entity_id.
* old_value.
* new_value.
* created_at.

MVP có thể chuẩn bị bảng nhưng chưa cần giao diện đầy đủ.

---

## 18. API đề xuất cho module Khách hàng

### 18.1. Customers API

GET /customers

Mục đích:

Lấy danh sách khách hàng.

Query hỗ trợ:

* search.
* source.
* status.
* potential_level.
* tag_id.
* assigned_to.
* province.
* has_debt.
* birthday_month.
* created_from.
* created_to.
* page.
* page_size.

Response cần có:

* Danh sách khách.
* Tổng số bản ghi.
* Thông tin phân trang.

---

POST /customers

Mục đích:

Tạo khách hàng mới.

Body gồm:

* full_name.
* phone_1.
* phone_2.
* gender.
* birthday.
* email.
* zalo.
* facebook.
* address.
* province.
* district.
* ward.
* shipping_note.
* source.
* status.
* potential_level.
* assigned_to.
* internal_note.
* tag_ids.
* first_activity, tùy chọn.
* first_reminder, tùy chọn.

Quy tắc:

* Kiểm tra trùng số điện thoại.
* Chuẩn hóa số điện thoại.
* Tạo khách hàng.
* Gắn tag nếu có.
* Nếu có first_activity thì tạo customer_activity.
* Nếu có first_reminder thì tạo reminder.

---

GET /customers/{id}

Mục đích:

Lấy chi tiết khách hàng.

Response cần gồm:

* Thông tin khách.
* Tags.
* Chỉ số tóm tắt:

  * total_orders.
  * total_spent.
  * total_paid.
  * total_debt.
  * last_order_at.
  * last_activity_at.
  * next_reminder_at.
* Lịch sử chăm sóc gần nhất.
* Lịch nhắc gần nhất.
* Đơn hàng gần nhất nếu module đơn hàng đã có.

---

PUT /customers/{id}

Mục đích:

Cập nhật khách hàng.

Quy tắc:

* Kiểm tra trùng số điện thoại nếu thay đổi.
* Cập nhật tags.
* Lưu updated_by, updated_at.
* Ghi audit log nếu có.

---

DELETE /customers/{id}

Mục đích:

Xóa hoặc ngừng hoạt động khách hàng.

Quy tắc MVP đề xuất:

* Nếu khách chưa có đơn hàng/chăm sóc/thanh toán quan trọng, có thể xóa mềm.
* Nếu đã có dữ liệu liên quan, không xóa cứng, chỉ chuyển trạng thái inactive.

Có thể thay bằng endpoint:

PATCH /customers/{id}/status

Body:

* status.

---

### 18.2. Customer Activities API

GET /customers/{id}/activities

Lấy lịch sử chăm sóc của khách.

POST /customers/{id}/activities

Tạo hoạt động chăm sóc.

Body:

* activity_type.
* content.
* result.
* next_follow_up_at.

Nếu có next_follow_up_at, hệ thống có thể tạo Reminder.

---

### 18.3. Reminders API

GET /reminders

Query:

* assigned_to.
* status.
* due_from.
* due_to.
* customer_id.

POST /customers/{id}/reminders

Tạo lịch nhắc cho khách.

PUT /reminders/{id}

Cập nhật lịch nhắc.

PATCH /reminders/{id}/complete

Đánh dấu hoàn thành.

PATCH /reminders/{id}/cancel

Hủy lịch nhắc.

---

### 18.4. Tags API

GET /customer-tags

Lấy danh sách tag.

POST /customer-tags

Tạo tag mới.

PUT /customer-tags/{id}

Sửa tag.

DELETE /customer-tags/{id}

Xóa tag nếu chưa dùng hoặc ngừng hoạt động tag.

---

### 18.5. Duplicate Check API

POST /customers/check-duplicate

Body:

* phone_1.
* phone_2.
* exclude_customer_id, dùng khi sửa.

Response:

* is_duplicate.
* matched_customers.
* matched_fields.

Mục đích:

Cho frontend kiểm tra trùng trước khi lưu hoặc hiển thị cảnh báo khi nhập số điện thoại.

---

## 19. Quy tắc validation

### 19.1. Họ tên

* Không nên để quá dài.
* Có thể cho phép trống nếu có số điện thoại.
* Nếu cả họ tên và số điện thoại đều trống thì không cho lưu.

Thông báo:

“Vui lòng nhập họ tên hoặc số điện thoại khách hàng.”

### 19.2. Số điện thoại

* Chuẩn hóa trước khi lưu.
* Nếu nhập, phải có độ dài hợp lý.
* Không cho trùng với khách khác.
* Cho phép phone_2 trống.
* Nếu phone_1 và phone_2 giống nhau thì cảnh báo.

Thông báo:

“Số điện thoại này đã tồn tại ở khách hàng khác.”

### 19.3. Email

* Nếu nhập thì kiểm tra định dạng email.
* Không bắt buộc.

Thông báo:

“Email không đúng định dạng.”

### 19.4. Ngày sinh

* Không được lớn hơn ngày hiện tại.
* Có thể chỉ nhập ngày/tháng nếu người dùng không biết năm sinh, nhưng MVP có thể dùng ngày đầy đủ trước.

Thông báo:

“Ngày sinh không hợp lệ.”

### 19.5. Tag

* Một khách có thể có nhiều tag.
* Không tạo tag trùng tên nếu dùng danh sách tag chuẩn.

### 19.6. Nhân viên phụ trách

* Nếu người dùng hiện tại là sale, mặc định assigned_to là chính sale đó.
* Admin/Quản lý có thể chọn người phụ trách.
* Sale thường không được tự gán khách cho người khác nếu không có quyền.

---

## 20. Quy tắc phân quyền

### 20.1. Admin

* Xem tất cả khách.
* Tạo/sửa/xóa/ngừng hoạt động khách.
* Gán nhân viên phụ trách.
* Import/export.
* Xem toàn bộ lịch sử chăm sóc, đơn hàng, công nợ.

### 20.2. Quản lý

* Xem khách trong đội hoặc tất cả, tùy cấu hình.
* Sửa khách.
* Gán khách cho nhân viên.
* Xem hoạt động chăm sóc.
* Xem báo cáo khách hàng.

### 20.3. Sale

* Tạo khách.
* Xem khách do mình phụ trách hoặc được phân quyền.
* Sửa khách do mình phụ trách.
* Ghi chú chăm sóc.
* Tạo lịch nhắc.
* Tạo đơn hàng.
* Không xóa khách nếu không được quyền.

### 20.4. Kho

* Thông thường không cần sửa khách hàng.
* Có thể xem thông tin giao hàng trong đơn, nhưng không nhất thiết xem toàn bộ CRM.

### 20.5. Kế toán

* Xem khách liên quan đến công nợ/thanh toán.
* Không nhất thiết sửa thông tin CRM nếu không được quyền.

---

## 21. UX/UI chi tiết

### 21.1. Nguyên tắc giao diện

* Không làm form quá dài một cột gây mệt.
* Chia thông tin thành các khối rõ ràng.
* Những trường quan trọng đặt lên đầu.
* Nút hành động phải rõ.
* Sau khi thêm khách, người dùng phải thấy khách trong danh sách và có thể sửa ngay.
* Lỗi validation hiển thị ngay gần trường nhập.
* Các thông báo phải bằng tiếng Việt.

### 21.2. Form thêm/sửa khách hàng

Bố cục đề xuất:

Cột trái:

* Thông tin cơ bản.
* Thông tin liên hệ.
* Địa chỉ.

Cột phải:

* Phân loại khách hàng.
* Tag.
* Nhân viên phụ trách.
* Ghi chú nội bộ.
* Chăm sóc ban đầu / lịch nhắc.

Nút:

* Lưu khách hàng.
* Lưu và tạo đơn.
* Hủy.

Sau khi lưu thành công:

* Hiển thị thông báo “Đã lưu khách hàng”.
* Chuyển về chi tiết khách hàng hoặc giữ ở màn hình hiện tại tùy thiết kế.
* Không được làm mất dữ liệu vừa nhập nếu lỗi.

### 21.3. Danh sách khách hàng

Bảng cần dễ đọc.

Hành động nhanh nên rõ:

* Xem.
* Sửa.
* Tạo đơn.
* Chăm sóc.
* Nhắc việc.

Nếu giao diện hẹp, có thể gom vào menu “...” nhưng không được thiếu hành động.

### 21.4. Chi tiết khách hàng

Nên dùng tab:

* Tổng quan.
* Thông tin.
* Đơn hàng.
* Chăm sóc.
* Nhắc việc.
* Công nợ.
* Ghi chú.

Tab Tổng quan hiển thị thông tin quan trọng nhất.

---

## 22. Tìm kiếm và lọc nâng cao

### 22.1. Tìm kiếm cơ bản

* Tên.
* Số điện thoại.
* Email.
* Zalo.
* Facebook.

### 22.2. Lọc CRM

* Trạng thái.
* Tiềm năng.
* Nguồn khách.
* Tag.
* Nhân viên phụ trách.
* Tỉnh/thành.
* Có công nợ.
* Sinh nhật tháng này.
* Lâu chưa mua.
* Lâu chưa chăm sóc.

### 22.3. Lọc phục vụ remarketing

Sau khi có đơn hàng, cần hỗ trợ:

* Đã mua sản phẩm X.
* Đã mua danh mục X.
* Đã mua SKU X.
* Tổng mua trên X tiền.
* Số đơn hàng lớn hơn X.
* Lần mua gần nhất trước/sau ngày X.
* Chưa mua lại sau X ngày.

MVP có thể để các bộ lọc này sang module Remarketing, nhưng dữ liệu khách hàng phải chuẩn bị để hỗ trợ.

---

## 23. Import / Export khách hàng

### 23.1. Import

MVP có thể chưa làm ngay, nhưng nên thiết kế.

Import khách hàng từ Excel cần hỗ trợ các cột:

* Họ tên.
* SĐT 1.
* SĐT 2.
* Email.
* Zalo.
* Facebook.
* Ngày sinh.
* Giới tính.
* Địa chỉ.
* Tỉnh/thành.
* Quận/huyện.
* Phường/xã.
* Nguồn khách.
* Tag.
* Ghi chú.
* Nhân viên phụ trách.

Khi import cần kiểm tra:

* Trùng số điện thoại trong file.
* Trùng số điện thoại với dữ liệu hiện có.
* Email sai định dạng.
* Ngày sinh sai định dạng.
* Tag chưa có thì tạo mới hoặc báo.
* Nhân viên phụ trách không tồn tại thì báo.

Không nên import lỗi là dừng toàn bộ. Nên có báo cáo dòng lỗi.

### 23.2. Export

Export danh sách khách hàng theo bộ lọc hiện tại.

Các mục export:

* Danh sách khách hàng.
* Danh sách khách theo tag.
* Danh sách khách sinh nhật.
* Danh sách khách còn nợ.
* Danh sách khách lâu chưa mua.
* Danh sách khách theo nguồn.

---

## 24. Báo cáo liên quan đến khách hàng

Module khách hàng cần cung cấp dữ liệu cho báo cáo:

* Số khách mới theo ngày/tháng.
* Khách theo nguồn.
* Khách theo trạng thái.
* Khách theo nhân viên phụ trách.
* Khách mua nhiều.
* Khách có công nợ.
* Khách lâu chưa mua lại.
* Khách sinh nhật trong tháng.
* Tỷ lệ khách quay lại.
* Doanh thu theo nguồn khách.
* Doanh thu theo tag khách hàng.

MVP có thể làm một số báo cáo cơ bản trước:

* Khách mới.
* Khách theo nguồn.
* Khách sinh nhật tháng này.
* Khách cần chăm sóc.
* Khách còn nợ, sau khi có công nợ.

---

## 25. Lỗi/bug không được phép tồn tại

Các lỗi sau phải coi là nghiêm trọng:

1. Thêm khách xong không có cách sửa.
2. Thêm khách xong không xem được chi tiết.
3. Tạo được khách trùng số điện thoại mà không cảnh báo.
4. Sửa số điện thoại thành số trùng khách khác.
5. Không lưu được tag/nguồn/trạng thái.
6. Ghi chú chăm sóc bị mất.
7. Lịch nhắc không hiển thị khi đến hạn.
8. Sale xem được khách không thuộc quyền nếu hệ thống đã bật phân quyền.
9. Xóa khách đã có đơn hàng mà không cảnh báo.
10. Tìm kiếm số điện thoại không ra khách vì khác định dạng khoảng trắng/dấu gạch.

---

## 26. Tiêu chí hoàn thành MVP cho module Khách hàng

Module Khách hàng được coi là dùng được thật khi đạt các tiêu chí:

1. Tạo khách hàng bằng form đầy đủ.
2. Sửa được khách hàng sau khi tạo.
3. Xem được chi tiết khách hàng.
4. Danh sách khách hàng có tìm kiếm và lọc cơ bản.
5. Chống trùng số điện thoại.
6. Có tag khách hàng.
7. Có nguồn khách hàng.
8. Có trạng thái khách hàng.
9. Có nhân viên phụ trách.
10. Có ghi chú nội bộ.
11. Có lịch sử chăm sóc.
12. Có lịch nhắc chăm sóc.
13. Có hành động nhanh: xem, sửa, tạo đơn, chăm sóc, nhắc việc.
14. Có chuẩn bị khu vực lịch sử mua hàng và công nợ.
15. Dữ liệu đủ tốt để sau này làm remarketing.

---

## 27. Roadmap triển khai module Khách hàng

### Sprint CRM-1: Nền tảng khách hàng

Mục tiêu:

* Bảng customers.
* Form thêm/sửa đầy đủ.
* Danh sách khách.
* Tìm kiếm theo tên/số điện thoại.
* Chống trùng số điện thoại.
* Xem chi tiết khách.

Phạm vi:

* customers.
* customer detail page.
* create/update/list API.
* duplicate phone check.

---

### Sprint CRM-2: Tag, nguồn, trạng thái, phân loại

Mục tiêu:

* Tag khách hàng.
* Nguồn khách.
* Trạng thái khách.
* Mức độ tiềm năng.
* Lọc khách.

Phạm vi:

* customer_tags.
* customer_tag_links.
* filter UI.
* source/status/potential fields.

---

### Sprint CRM-3: Chăm sóc khách hàng

Mục tiêu:

* Ghi lịch sử chăm sóc.
* Xem timeline chăm sóc.
* Tạo hoạt động từ hồ sơ khách.
* Có loại hoạt động.

Phạm vi:

* customer_activities.
* activity form.
* activity timeline.

---

### Sprint CRM-4: Lịch nhắc

Mục tiêu:

* Tạo lịch nhắc.
* Danh sách việc hôm nay.
* Việc quá hạn.
* Đánh dấu hoàn thành.

Phạm vi:

* reminders/tasks.
* reminder list.
* due date logic.

---

### Sprint CRM-5: Chuẩn bị remarketing

Mục tiêu:

* Lọc khách theo sinh nhật.
* Lọc khách theo tag.
* Lọc khách theo nguồn.
* Lọc khách lâu chưa chăm sóc.
* Chuẩn bị export.

Phạm vi:

* advanced filters.
* customer segment basic.
* export placeholder hoặc export CSV nếu kịp.

---

## 28. Kết luận

Module Khách hàng / CRM phải được coi là nền móng của toàn bộ phần mềm.

Nếu module này chỉ có họ tên và số điện thoại thì phần mềm sẽ không thể trở thành CRM đúng nghĩa. Một CRM dùng được thật cần có:

* Hồ sơ khách hàng đầy đủ.
* Chống trùng.
* Tìm kiếm nhanh.
* Phân loại/tag.
* Nguồn khách.
* Trạng thái và mức độ tiềm năng.
* Nhân viên phụ trách.
* Lịch sử chăm sóc.
* Lịch nhắc.
* Lịch sử mua hàng.
* Công nợ.
* Dữ liệu phục vụ remarketing.

Mục tiêu cuối cùng là giúp người bán không chỉ “lưu khách”, mà còn hiểu khách, chăm sóc khách, bán lại cho khách và tăng doanh thu từ dữ liệu khách hàng.
