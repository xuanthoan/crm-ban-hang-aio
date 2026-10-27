# ĐẶC TẢ MODULE CHI TIẾT

# Module Import / Export Excel và Nhật ký thao tác nâng cao

# Dự án: CRM_Ban_Hang

## 1. Mục tiêu của module

Module Import / Export Excel và Nhật ký thao tác nâng cao dùng để giải quyết 2 nhu cầu thực tế:

1. Đưa dữ liệu từ bên ngoài vào hệ thống nhanh chóng.
2. Xuất dữ liệu từ hệ thống ra file để kiểm tra, báo cáo, lưu trữ hoặc xử lý bên ngoài.
3. Ghi lại lịch sử các thao tác quan trọng để biết ai đã làm gì, khi nào, thay đổi nội dung gì.

Trong thực tế, rất nhiều cửa hàng đã có sẵn dữ liệu trong Excel:

* Danh sách khách hàng.
* Danh sách sản phẩm.
* Danh sách SKU.
* Tồn kho ban đầu.
* Công nợ.
* Đơn hàng cũ.
* Danh sách khách remarketing.

Nếu phần mềm không hỗ trợ import/export tốt, người dùng sẽ phải nhập thủ công rất mất thời gian.

Ngược lại, nếu import làm ẩu, dữ liệu sẽ bị loạn:

* Trùng khách hàng.
* Trùng SKU.
* Sai số điện thoại.
* Sai tồn kho.
* Sai giá.
* Sai công nợ.
* Sai ngày tháng.
* Mất dữ liệu cũ.

Vì vậy module này phải được thiết kế cẩn thận.

Nguyên tắc quan trọng:

**Import phải kiểm tra kỹ trước khi ghi dữ liệu. Export phải đúng bộ lọc và đúng quyền. Nhật ký thao tác phải giúp truy vết các thay đổi quan trọng.**

---

## 2. Vai trò của module trong toàn hệ thống

Module này liên kết với hầu hết các module:

* Khách hàng / CRM.
* Sản phẩm / SKU.
* Kho hàng.
* Đơn hàng.
* Thanh toán / Công nợ.
* Chăm sóc / Remarketing.
* Báo cáo.
* Người dùng / Phân quyền.
* Audit log.

Import giúp tạo dữ liệu hàng loạt.

Export giúp đưa dữ liệu ra ngoài.

Audit log giúp kiểm soát các thay đổi nhạy cảm.

Ví dụ:

* Import khách hàng từ file Excel.
* Import sản phẩm và SKU.
* Import tồn kho ban đầu.
* Export danh sách công nợ.
* Export danh sách SKU sắp hết hàng.
* Export khách hàng sinh nhật tháng này.
* Xem ai đã điều chỉnh kho.
* Xem ai đã hủy payment.
* Xem ai đã sửa số điện thoại khách hàng.
* Xem ai đã thay đổi giá bán sản phẩm.

---

## 3. Phạm vi của module

Module gồm 3 phần lớn:

1. Import Excel / CSV.
2. Export Excel / CSV.
3. Nhật ký thao tác nâng cao / Audit log.

MVP nên ưu tiên:

* Import khách hàng.
* Import sản phẩm/SKU.
* Import tồn kho ban đầu.
* Export khách hàng.
* Export sản phẩm/SKU.
* Export tồn kho.
* Export công nợ.
* Export báo cáo bán hàng cơ bản.
* Audit log cho thao tác nhạy cảm.

---

## 4. Người dùng chính

### 4.1. Admin / Chủ cửa hàng

Nhu cầu:

* Import dữ liệu ban đầu.
* Export dữ liệu để lưu trữ.
* Export báo cáo.
* Kiểm tra ai đã thay đổi dữ liệu.
* Xem lịch sử thao tác nhạy cảm.
* Khôi phục hoặc xử lý lỗi dữ liệu nếu có import sai.

Quyền:

* Toàn quyền import/export.
* Xem toàn bộ audit log.
* Export dữ liệu nhạy cảm nếu được phép.

---

### 4.2. Quản lý

Nhu cầu:

* Export danh sách khách hàng trong phạm vi quản lý.
* Export đơn hàng.
* Export công nợ.
* Export báo cáo sale.
* Kiểm tra lịch sử chăm sóc hoặc thay đổi dữ liệu của đội.

Quyền:

* Import/export theo phân quyền.
* Xem audit log trong phạm vi nếu được phép.

---

### 4.3. Sale

Nhu cầu:

* Export khách hàng được phân công.
* Export danh sách khách cần chăm sóc.
* Export khách sinh nhật.
* Export khách lâu chưa mua lại.

Quyền:

* Không được export toàn bộ khách hàng nếu không có quyền.
* Không được import dữ liệu lớn nếu không có quyền.
* Không được xem audit log toàn hệ thống.

---

### 4.4. Nhân viên kho

Nhu cầu:

* Import tồn kho ban đầu hoặc cập nhật tồn kho nếu được phép.
* Export danh sách tồn kho.
* Export SKU sắp hết hàng.
* Xem lịch sử kho.

Quyền:

* Import/export kho theo quyền.
* Không export dữ liệu khách hàng nếu không cần.
* Không xem giá nhập/giá trị tồn nếu không có quyền.

---

### 4.5. Kế toán / Thu ngân

Nhu cầu:

* Export thanh toán.
* Export công nợ.
* Export danh sách đơn chưa thanh toán.
* Kiểm tra ai đã ghi nhận/hủy/sửa payment.

Quyền:

* Export payment/debt theo quyền.
* Xem audit log thanh toán nếu được phép.
* Không export dữ liệu kho/khách hàng toàn hệ thống nếu không có quyền.

---

## 5. Nguyên tắc thiết kế Import

### 5.1. Không ghi dữ liệu ngay khi vừa upload

Luồng import đúng nên có 4 bước:

1. Upload file.
2. Đọc file và preview dữ liệu.
3. Validate dữ liệu và hiển thị lỗi/cảnh báo.
4. Người dùng xác nhận mới ghi vào database.

Không được upload xong là ghi thẳng vào hệ thống, vì nếu file sai sẽ gây loạn dữ liệu.

---

### 5.2. Phải có file mẫu

Mỗi loại import cần có file mẫu để người dùng điền đúng cột.

Các file mẫu:

* Mẫu import khách hàng.
* Mẫu import sản phẩm/SKU.
* Mẫu import tồn kho.
* Mẫu import công nợ, có thể sau MVP.
* Mẫu import đơn hàng cũ, có thể sau MVP.

File mẫu cần có:

* Tên cột rõ bằng tiếng Việt.
* Cột bắt buộc được đánh dấu.
* Ví dụ dữ liệu.
* Ghi chú định dạng.

---

### 5.3. Validate trước khi import

Import phải kiểm tra:

* Cột bắt buộc có tồn tại không.
* Dữ liệu bắt buộc có bị trống không.
* Định dạng số điện thoại.
* Định dạng ngày tháng.
* Định dạng số tiền.
* SKU có trùng không.
* Số điện thoại khách có trùng không.
* Giá có âm không.
* Tồn kho có âm không.
* Danh mục có tồn tại không.
* Tag có tồn tại không.
* Nhân viên phụ trách có tồn tại không.
* Dòng nào lỗi, lỗi gì.

---

### 5.4. Không nên dừng toàn bộ chỉ vì một dòng lỗi

Có 2 cách xử lý:

Cách 1: Nếu có lỗi thì không import gì cả.

* An toàn hơn.
* Dữ liệu nhất quán hơn.
* Người dùng sửa file rồi import lại.

Cách 2: Import dòng hợp lệ, bỏ qua dòng lỗi.

* Linh hoạt hơn.
* Nhưng dễ khiến người dùng không biết thiếu dữ liệu.

Đề xuất MVP:

**Nếu có lỗi nghiêm trọng, không import toàn bộ. Hiển thị danh sách lỗi để người dùng sửa file.**

Lý do:

* Dữ liệu ban đầu cần sạch.
* Dễ giải thích.
* Tránh import nửa vời.

Sau này có thể hỗ trợ “import dòng hợp lệ, bỏ qua dòng lỗi”.

---

### 5.5. Import phải tạo audit log

Mỗi lần import cần lưu:

* Ai import.
* Import loại gì.
* File tên gì.
* Thời gian import.
* Bao nhiêu dòng.
* Bao nhiêu dòng thành công.
* Bao nhiêu dòng lỗi.
* Kết quả import.
* Có tạo/cập nhật/xóa gì không.

Nếu import gây lỗi dữ liệu, audit log giúp truy lại.

---

## 6. Import khách hàng

### 6.1. Mục tiêu

Cho phép nhập hàng loạt khách hàng từ Excel.

### 6.2. Cột đề xuất trong file mẫu

Cột bắt buộc hoặc khuyến nghị:

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
* Trạng thái khách.
* Mức độ tiềm năng.
* Tag.
* Nhân viên phụ trách.
* Ghi chú nội bộ.

### 6.3. Quy tắc bắt buộc

Ít nhất phải có:

* Họ tên hoặc số điện thoại.

Nếu cả họ tên và số điện thoại đều trống:

* Báo lỗi.

Nếu có số điện thoại:

* Chuẩn hóa số điện thoại.
* Kiểm tra trùng trong file.
* Kiểm tra trùng với database.

### 6.4. Xử lý trùng số điện thoại

Các tình huống:

1. Số điện thoại trùng trong chính file import.
2. Số điện thoại trùng với khách đã có trong hệ thống.
3. SĐT 1 trùng SĐT 2 của khách khác.
4. SĐT 2 trùng SĐT 1 của khách khác.

MVP đề xuất:

* Nếu trùng chính xác, báo lỗi và không import.
* Chưa tự động merge.
* Chưa tự động update khách cũ nếu chưa có tính năng rõ.

Sau này có thể thêm lựa chọn:

* Bỏ qua khách trùng.
* Cập nhật khách đã có.
* Tạo mới nếu xác nhận.

Nhưng MVP nên ưu tiên dữ liệu sạch.

---

### 6.5. Xử lý tag

Nếu cột tag có nhiều tag, có thể phân tách bằng dấu phẩy.

Ví dụ:

VIP, Khách mua balo, Có con nhỏ

Quy tắc:

* Nếu tag đã tồn tại, gắn vào khách.
* Nếu tag chưa tồn tại:

  * Có thể tự tạo nếu user có quyền.
  * Hoặc báo lỗi.

Đề xuất MVP:

* Cho phép tự tạo tag mới nếu người import có quyền cấu hình tag.
* Nếu không có quyền, báo lỗi.

---

### 6.6. Xử lý nguồn khách

Nếu nguồn khách chưa tồn tại:

* Có thể tự tạo nếu người import có quyền.
* Hoặc báo lỗi.

MVP nên cho cấu hình:

* Tự tạo nguồn mới khi import: bật/tắt.

Mặc định nên báo lỗi để tránh tạo quá nhiều nguồn sai chính tả.

Ví dụ:

* “Facebok”
* “facebook”
* “FB”
* “Facebook”

Nếu tự tạo bừa, báo cáo nguồn sẽ loạn.

---

## 7. Import sản phẩm / SKU

### 7.1. Mục tiêu

Cho phép nhập hàng loạt sản phẩm và SKU.

### 7.2. Cột đề xuất

* Tên sản phẩm.
* Mã sản phẩm, tùy chọn.
* Danh mục.
* Thương hiệu.
* Mô tả.
* Trạng thái sản phẩm.
* SKU.
* Tên biến thể.
* Biến thể 1 - Tên thuộc tính.
* Biến thể 1 - Giá trị.
* Biến thể 2 - Tên thuộc tính.
* Biến thể 2 - Giá trị.
* Biến thể 3 - Tên thuộc tính.
* Biến thể 3 - Giá trị.
* Đơn vị tính.
* Giá nhập.
* Giá bán lẻ.
* Giá khuyến mãi.
* Tồn kho ban đầu.
* Ngưỡng tồn thấp.
* Barcode.
* Ảnh URL.
* Trạng thái SKU.

### 7.3. Cách hiểu file

Mỗi dòng trong file tương ứng với một SKU.

Nếu sản phẩm không có biến thể:

* Tên sản phẩm có 1 dòng SKU mặc định.

Nếu sản phẩm có biến thể:

* Nhiều dòng cùng tên sản phẩm, mỗi dòng là một SKU/biến thể.

Ví dụ:

Áo thun nữ 2027 / Đen / S
Áo thun nữ 2027 / Đen / M
Áo thun nữ 2027 / Trắng / S

### 7.4. Quy tắc validation

* Tên sản phẩm bắt buộc.
* SKU nếu trống thì hệ thống tự sinh.
* SKU nếu có thì không được trùng.
* Giá nhập >= 0.
* Giá bán >= 0.
* Giá khuyến mãi >= 0 nếu có.
* Tồn kho ban đầu >= 0.
* Ngưỡng tồn thấp >= 0.
* Danh mục nếu chưa tồn tại phải xử lý theo cấu hình.
* Đơn vị tính nếu chưa tồn tại phải xử lý theo cấu hình.
* Không cho tồn kho âm.
* Không cho SKU trùng trong file.
* Không cho SKU trùng với database.

### 7.5. Khi import thành công

Hệ thống cần:

1. Tạo Product nếu chưa có.
2. Tạo ProductVariant/SKU.
3. Tạo InventoryItem cho từng SKU.
4. Nếu tồn kho ban đầu > 0, tạo InventoryTransaction loại initial.
5. Tạo audit log import.
6. Báo kết quả cho người dùng.

### 7.6. Lỗi nghiêm trọng cần tránh

Nếu file có tồn kho ban đầu 10, sau import kho không được thành 0.

Đây là lỗi nghiêm trọng giống khi tạo sản phẩm thủ công.

---

## 8. Import tồn kho

### 8.1. Mục tiêu

Cho phép cập nhật tồn kho hàng loạt từ Excel.

### 8.2. Cột đề xuất

* SKU.
* Số lượng.
* Kiểu thao tác.
* Lý do.
* Ghi chú.

Kiểu thao tác:

* import: nhập thêm.
* set: đặt lại tồn kho.
* adjustment_increase: điều chỉnh tăng.
* adjustment_decrease: điều chỉnh giảm.

### 8.3. Quy tắc

* SKU bắt buộc.
* SKU phải tồn tại.
* Số lượng phải >= 0.
* Lý do bắt buộc.
* Nếu adjustment_decrease làm tồn âm thì báo lỗi.
* Nếu set thì số lượng là tồn sau cùng.
* Nếu import thì số lượng là nhập thêm.

### 8.4. Xử lý import tồn kho

Mỗi dòng hợp lệ phải tạo InventoryTransaction.

Không được chỉ cập nhật InventoryItem.quantity mà không tạo lịch sử.

Ví dụ:

SKU A tồn 5. File import thêm 10.

* quantity_before = 5.
* quantity_changed = +10.
* quantity_after = 15.
* transaction_type = import.

---

## 9. Import công nợ

### 9.1. MVP có cần không?

Import công nợ có thể phức tạp vì công nợ thường gắn với đơn hàng.

MVP chưa bắt buộc.

Nếu cần nhập dữ liệu cũ, có thể làm sau khi module đơn hàng và payment ổn định.

### 9.2. Hướng thiết kế sau MVP

Có 2 cách:

1. Import đơn hàng cũ kèm công nợ.
2. Import công nợ đầu kỳ theo khách hàng.

Cách 1 chuẩn hơn nhưng phức tạp.

Cách 2 dễ hơn:

* Khách hàng.
* Số điện thoại.
* Công nợ đầu kỳ.
* Ghi chú.

Hệ thống tạo một bản ghi công nợ đầu kỳ hoặc đơn hàng đầu kỳ đặc biệt.

MVP nên để sau.

---

## 10. Import đơn hàng cũ

### 10.1. MVP có cần không?

Chưa cần trong MVP.

Import đơn hàng cũ phức tạp vì liên quan:

* Khách hàng.
* SKU.
* Tồn kho.
* Thanh toán.
* Công nợ.
* Trạng thái đơn.

Nên làm sau khi hệ thống ổn định.

---

## 11. Màn hình Import

### 11.1. Cấu trúc màn hình

Màn hình Import nên có:

* Chọn loại import.
* Tải file mẫu.
* Upload file.
* Preview dữ liệu.
* Kết quả validate.
* Nút xác nhận import.
* Lịch sử import.

Loại import:

* Khách hàng.
* Sản phẩm/SKU.
* Tồn kho.
* Công nợ, sau MVP.
* Đơn hàng, sau MVP.

### 11.2. Preview dữ liệu

Sau khi upload, hiển thị bảng preview:

* Số dòng.
* Các cột nhận diện được.
* Một số dòng đầu.
* Trạng thái từng dòng: hợp lệ/lỗi/cảnh báo.
* Danh sách lỗi.

### 11.3. Báo lỗi import

Lỗi cần rõ ràng theo dòng và cột.

Ví dụ:

* Dòng 5, cột Số điện thoại 1: Số điện thoại đã tồn tại.
* Dòng 8, cột SKU: SKU bị trùng trong file.
* Dòng 12, cột Giá bán: Giá bán không được âm.
* Dòng 20, cột Ngày sinh: Ngày sinh không đúng định dạng.

### 11.4. Kết quả import

Sau khi import thành công:

* Tổng số dòng.
* Số dòng thành công.
* Số dòng lỗi.
* Số khách/sản phẩm/SKU được tạo.
* Số bản ghi tồn kho được tạo.
* Nút tải file lỗi nếu có.
* Nút xem dữ liệu vừa import.

---

## 12. Export dữ liệu

### 12.1. Nguyên tắc Export

Export phải đảm bảo:

* Xuất đúng dữ liệu theo bộ lọc hiện tại.
* Tôn trọng phân quyền.
* Không xuất trường nhạy cảm nếu user không có quyền.
* File dễ đọc.
* Tên cột bằng tiếng Việt.
* Có ngày giờ export.
* Có thông tin người export nếu cần.

---

### 12.2. Export khách hàng

Các trường:

* Mã khách hàng.
* Họ tên.
* Số điện thoại 1.
* Số điện thoại 2.
* Email.
* Zalo.
* Facebook.
* Ngày sinh.
* Địa chỉ.
* Nguồn khách.
* Trạng thái.
* Mức độ tiềm năng.
* Tag.
* Nhân viên phụ trách.
* Tổng số đơn.
* Tổng đã mua.
* Tổng công nợ.
* Lần mua gần nhất.
* Lần chăm sóc gần nhất.
* Ghi chú nội bộ, nếu có quyền.

Các trường nhạy cảm như công nợ, tổng mua có thể bị ẩn tùy quyền.

---

### 12.3. Export sản phẩm / SKU

Các trường:

* Tên sản phẩm.
* Danh mục.
* Thương hiệu.
* SKU.
* Tên biến thể.
* Biến thể 1.
* Biến thể 2.
* Biến thể 3.
* Đơn vị tính.
* Giá nhập, nếu có quyền.
* Giá bán lẻ.
* Giá khuyến mãi.
* Tồn hiện tại.
* Ngưỡng tồn thấp.
* Trạng thái SKU.
* Barcode.
* Ảnh URL.

Nếu user không có quyền xem giá nhập:

* Không xuất cột Giá nhập.
* Không xuất giá trị tồn kho theo giá nhập.

---

### 12.4. Export tồn kho

Các trường:

* SKU.
* Tên sản phẩm.
* Biến thể.
* Danh mục.
* Thương hiệu.
* Tồn hiện tại.
* Ngưỡng tồn thấp.
* Trạng thái tồn.
* Giá nhập, nếu có quyền.
* Giá trị tồn, nếu có quyền.
* Trạng thái SKU.

---

### 12.5. Export lịch sử kho

Các trường:

* Thời gian.
* SKU.
* Tên sản phẩm.
* Biến thể.
* Loại giao dịch.
* Số lượng trước.
* Số lượng thay đổi.
* Số lượng sau.
* Lý do.
* Ghi chú.
* Người thao tác.
* Tham chiếu đơn hàng nếu có.

---

### 12.6. Export đơn hàng

Các trường:

* Mã đơn.
* Ngày tạo.
* Khách hàng.
* Số điện thoại.
* Nguồn đơn.
* Nhân viên bán hàng.
* Trạng thái đơn.
* Trạng thái thanh toán.
* Tổng tiền hàng.
* Giảm giá.
* Phí ship.
* Tổng thanh toán.
* Đã thanh toán.
* Còn nợ.
* Ghi chú.

Có thể có export chi tiết order items riêng:

* Mã đơn.
* SKU.
* Sản phẩm.
* Biến thể.
* Số lượng.
* Giá bán.
* Giảm giá.
* Thành tiền.

---

### 12.7. Export thanh toán

Các trường:

* Mã đơn.
* Khách hàng.
* Số tiền thanh toán.
* Phương thức.
* Ngày thanh toán.
* Người ghi nhận.
* Ghi chú.
* Trạng thái payment.

---

### 12.8. Export công nợ

Các trường theo đơn:

* Mã đơn.
* Khách hàng.
* Số điện thoại.
* Ngày tạo đơn.
* Tổng đơn.
* Đã thanh toán.
* Còn nợ.
* Ngày hẹn thanh toán.
* Số ngày nợ.
* Nhân viên phụ trách.

Các trường theo khách:

* Khách hàng.
* Số điện thoại.
* Tổng công nợ.
* Số đơn còn nợ.
* Nợ lâu nhất.
* Nhân viên phụ trách.

---

### 12.9. Export remarketing

Các trường:

* Họ tên.
* Số điện thoại.
* Email.
* Zalo.
* Facebook.
* Tag.
* Nguồn khách.
* Sản phẩm/danh mục đã mua.
* Lần mua gần nhất.
* Tổng đã mua.
* Công nợ.
* Nhân viên phụ trách.
* Ghi chú.

Dùng để:

* Chăm sóc thủ công.
* Chạy quảng cáo.
* Gửi cho sale.
* Lọc lại bên ngoài.

---

## 13. Lịch sử import/export

### 13.1. Mục tiêu

Cần biết ai đã import/export dữ liệu.

### 13.2. Lịch sử import

Lưu:

* id.
* import_type.
* file_name.
* total_rows.
* success_rows.
* error_rows.
* status.
* error_file_url, nếu có.
* created_by.
* created_at.

status:

* pending.
* validating.
* failed.
* completed.

### 13.3. Lịch sử export

Lưu:

* id.
* export_type.
* file_name.
* filters.
* row_count.
* created_by.
* created_at.

Tùy mức độ bảo mật, export dữ liệu nhạy cảm nên lưu log.

---

## 14. Nhật ký thao tác nâng cao / Audit log

### 14.1. Mục tiêu

Audit log giúp trả lời:

* Ai đã tạo dữ liệu này?
* Ai đã sửa?
* Sửa lúc nào?
* Sửa trường nào?
* Giá trị cũ là gì?
* Giá trị mới là gì?
* Ai đã xóa/ngừng hoạt động?
* Ai đã hủy đơn?
* Ai đã điều chỉnh kho?
* Ai đã hủy thanh toán?
* Ai đã export dữ liệu?

Audit log không chỉ để xem, mà còn để kiểm soát rủi ro.

---

### 14.2. Các thao tác cần ghi audit log

Nhóm khách hàng:

* Tạo khách hàng.
* Sửa khách hàng.
* Đổi số điện thoại.
* Đổi nhân viên phụ trách.
* Xóa/ngừng hoạt động khách.
* Import khách hàng.
* Export khách hàng.

Nhóm sản phẩm/SKU:

* Tạo sản phẩm.
* Sửa sản phẩm.
* Tạo SKU.
* Sửa SKU.
* Đổi giá nhập.
* Đổi giá bán.
* Ngừng bán SKU.
* Import sản phẩm/SKU.
* Export sản phẩm/SKU.

Nhóm kho:

* Nhập kho.
* Điều chỉnh kho.
* Đặt lại tồn.
* Import tồn kho.
* Export tồn kho.

Nhóm đơn hàng:

* Tạo đơn.
* Sửa đơn.
* Xác nhận đơn.
* Hủy đơn.
* Hoàn hàng.
* Hoàn thành đơn.
* Sửa giảm giá.
* Sửa giá bán trên đơn.

Nhóm thanh toán:

* Tạo payment.
* Sửa payment.
* Hủy payment.
* Export công nợ.
* Export thanh toán.

Nhóm người dùng/phân quyền:

* Tạo user.
* Khóa user.
* Mở user.
* Đổi role.
* Đổi quyền.
* Đặt lại mật khẩu.

Nhóm cấu hình:

* Thêm/sửa/xóa danh mục.
* Thêm/sửa/xóa nguồn khách.
* Thêm/sửa/xóa phương thức thanh toán.
* Thay đổi cấu hình mã SKU.
* Thay đổi cấu hình trừ kho.

---

### 14.3. Dữ liệu audit log

Bảng audit_logs gồm:

* id.
* user_id.
* action.
* entity_type.
* entity_id.
* old_value.
* new_value.
* reason.
* metadata.
* ip_address.
* user_agent.
* created_at.

Giải thích:

* action: tên hành động, ví dụ customer.update, inventory.adjust.
* entity_type: customer, product, order, payment...
* entity_id: id bản ghi bị tác động.
* old_value: dữ liệu cũ, có thể JSON.
* new_value: dữ liệu mới, có thể JSON.
* reason: lý do thao tác nếu có.
* metadata: dữ liệu bổ sung.
* ip_address/user_agent: có thể làm sau MVP.

---

### 14.4. Cách hiển thị audit log

Màn hình Audit Log nên có:

* Bộ lọc theo người dùng.
* Bộ lọc theo module.
* Bộ lọc theo hành động.
* Bộ lọc theo loại dữ liệu.
* Bộ lọc theo khoảng ngày.
* Tìm theo mã đơn/SKU/khách hàng.
* Bảng log.

Cột:

* Thời gian.
* Người thao tác.
* Hành động.
* Đối tượng.
* Mô tả.
* Lý do.
* Nút xem chi tiết.

Chi tiết log hiển thị:

* Giá trị cũ.
* Giá trị mới.
* Metadata.
* Thời gian.
* Người thao tác.

---

### 14.5. Audit log trong chi tiết từng đối tượng

Ngoài màn hình log chung, một số màn hình nên có tab “Lịch sử”:

* Chi tiết khách hàng.
* Chi tiết sản phẩm.
* Chi tiết SKU.
* Chi tiết đơn hàng.
* Chi tiết payment, nếu cần.
* Chi tiết kho/SKU.

Ví dụ trong chi tiết đơn hàng:

* 20/06 09:00: Nguyễn A tạo đơn.
* 20/06 09:05: Nguyễn A xác nhận đơn.
* 20/06 09:05: Hệ thống trừ kho 2 SKU.
* 20/06 10:00: Kế toán ghi nhận thanh toán 500.000.
* 20/06 11:00: Quản lý hủy đơn, lý do khách đổi ý.

---

## 15. Quy tắc bảo mật với Import/Export/Audit

### 15.1. Import

Chỉ người có quyền mới được import.

Ví dụ:

* Import khách hàng: customer.import.
* Import sản phẩm/SKU: product.import.
* Import tồn kho: inventory.import_stock.
* Import công nợ: debt.import, nếu có.

### 15.2. Export

Export phải theo quyền.

Ví dụ:

* Sale chỉ export khách của mình.
* Người không có quyền không export toàn bộ khách.
* Người không có quyền xem giá nhập thì export không có giá nhập.
* Người không có quyền công nợ thì export không có công nợ.
* Export dữ liệu nhạy cảm phải ghi log.

### 15.3. Audit log

Không phải ai cũng xem audit log.

Quyền:

* audit.view_all.
* audit.view_own.
* audit.view_sensitive.

MVP có thể chỉ Admin xem audit log đầy đủ.

---

## 16. API đề xuất

### 16.1. Import API

POST /imports/upload

Mục đích:

Upload file import.

Body:

* import_type.
* file.

Response:

* import_job_id.
* status.

---

POST /imports/{job_id}/validate

Mục đích:

Validate file trước khi import.

Response:

* total_rows.
* valid_rows.
* error_rows.
* warnings.
* preview_rows.
* errors:

  * row_number.
  * column_name.
  * message.

---

POST /imports/{job_id}/confirm

Mục đích:

Xác nhận ghi dữ liệu vào database.

Quy tắc:

* Chỉ cho confirm nếu validate thành công hoặc không có lỗi nghiêm trọng.
* Ghi dữ liệu trong transaction.
* Tạo audit log.

---

GET /imports/{job_id}

Mục đích:

Xem trạng thái import.

---

GET /imports/history

Mục đích:

Xem lịch sử import.

---

GET /imports/templates/{import_type}

Mục đích:

Tải file mẫu import.

---

### 16.2. Export API

POST /exports

Body:

* export_type.
* filters.
* format: csv | xlsx.

Response:

* export_job_id.
* status.

---

GET /exports/{job_id}

Mục đích:

Xem trạng thái export.

---

GET /exports/{job_id}/download

Mục đích:

Tải file export.

---

GET /exports/history

Mục đích:

Xem lịch sử export.

---

### 16.3. Audit Log API

GET /audit-logs

Query:

* user_id.
* action.
* entity_type.
* entity_id.
* date_from.
* date_to.
* page.
* page_size.

---

GET /audit-logs/{id}

Mục đích:

Xem chi tiết một log.

---

GET /audit-logs/entity/{entity_type}/{entity_id}

Mục đích:

Xem lịch sử của một đối tượng cụ thể.

Ví dụ:

* /audit-logs/entity/order/123
* /audit-logs/entity/customer/456
* /audit-logs/entity/product_variant/789

---

## 17. Validation chi tiết

### 17.1. File upload

* Chỉ cho phép .xlsx, .csv.
* Giới hạn dung lượng file.
* Không cho file rỗng.
* Không cho file thiếu header.
* Không cho quá số dòng giới hạn.

MVP có thể giới hạn:

* Tối đa 5.000 hoặc 10.000 dòng mỗi lần import.

Thông báo:

“File không đúng định dạng.”
“File không có dữ liệu.”
“File vượt quá số dòng cho phép.”

---

### 17.2. Header file

* Cột bắt buộc phải có.
* Tên cột có thể hỗ trợ tiếng Việt theo file mẫu.
* Nếu thiếu cột bắt buộc, báo lỗi toàn file.

Ví dụ:

“Thiếu cột bắt buộc: Số điện thoại 1.”

---

### 17.3. Dữ liệu từng dòng

Mỗi dòng cần validate theo loại import.

Nếu lỗi:

* Ghi rõ dòng.
* Ghi rõ cột.
* Ghi rõ lý do.

---

### 17.4. Duplicate trong file

Cần kiểm tra:

* Trùng số điện thoại khách hàng.
* Trùng SKU.
* Trùng barcode nếu yêu cầu unique.

---

### 17.5. Duplicate với database

Cần kiểm tra:

* Số điện thoại đã tồn tại.
* SKU đã tồn tại.
* Danh mục đã tồn tại.
* Tag đã tồn tại.

Tùy chính sách mà báo lỗi, bỏ qua hoặc cập nhật.

MVP nên báo lỗi rõ và không tự merge dữ liệu quan trọng.

---

## 18. UX/UI chi tiết

### 18.1. Màn hình Import

Bố cục:

1. Chọn loại dữ liệu cần import.
2. Tải file mẫu.
3. Upload file.
4. Preview dữ liệu.
5. Xem lỗi/cảnh báo.
6. Xác nhận import.
7. Xem kết quả.

Cần có hướng dẫn ngắn:

* “Vui lòng tải file mẫu và điền đúng cột.”
* “Không đổi tên các cột bắt buộc.”
* “Kiểm tra dữ liệu trước khi xác nhận import.”

---

### 18.2. Màn hình Export

Có thể đặt nút export tại từng màn hình:

* Danh sách khách hàng.
* Sản phẩm/SKU.
* Kho.
* Đơn hàng.
* Công nợ.
* Báo cáo.
* Remarketing.

Khi bấm export:

* Hỏi định dạng: CSV/XLSX.
* Xác nhận export theo bộ lọc hiện tại.
* Nếu dữ liệu lớn, tạo job export và thông báo khi sẵn sàng.

MVP có thể export trực tiếp nếu dữ liệu nhỏ.

---

### 18.3. Màn hình Audit Log

Bộ lọc:

* Người thao tác.
* Module.
* Hành động.
* Đối tượng.
* Khoảng ngày.

Bảng:

* Thời gian.
* Người thao tác.
* Hành động.
* Đối tượng.
* Mô tả.
* Lý do.
* Chi tiết.

---

## 19. Những lỗi/bug không được phép tồn tại

Các lỗi sau phải coi là nghiêm trọng:

1. Import khách hàng tạo trùng số điện thoại mà không cảnh báo.
2. Import sản phẩm tạo trùng SKU.
3. Import tồn kho cập nhật quantity nhưng không tạo InventoryTransaction.
4. Import tồn kho làm tồn âm.
5. Import sản phẩm có tồn kho ban đầu nhưng sau import tồn kho thành 0.
6. Import lỗi một nửa nhưng hệ thống vẫn báo thành công.
7. Export không đúng bộ lọc đang xem.
8. Export lộ giá nhập cho user không có quyền.
9. Export lộ toàn bộ khách hàng cho sale không có quyền.
10. Audit log không ghi thao tác điều chỉnh kho.
11. Audit log không ghi thao tác hủy payment.
12. Audit log không ghi thao tác hủy đơn.
13. Sửa dữ liệu nhạy cảm nhưng không lưu người sửa.
14. Upload file sai định dạng làm hệ thống lỗi.
15. Import bị lỗi nhưng không chỉ rõ dòng/cột lỗi.
16. Xóa audit log tùy tiện.
17. Import không rollback khi có lỗi nghiêm trọng.
18. Export công nợ không khớp màn hình công nợ.
19. File mẫu không đúng với logic import thật.
20. Import tự tạo quá nhiều nguồn/tag sai chính tả mà không kiểm soát.

---

## 20. Tiêu chí hoàn thành MVP

Module này được coi là dùng được thật khi đạt các tiêu chí:

1. Có màn hình Import.
2. Có file mẫu import khách hàng.
3. Import khách hàng có validate số điện thoại, trùng dữ liệu, dòng lỗi.
4. Có file mẫu import sản phẩm/SKU.
5. Import sản phẩm/SKU tạo đúng Product, SKU, InventoryItem.
6. Import tồn kho ban đầu tạo InventoryTransaction.
7. Có file mẫu import tồn kho.
8. Import tồn kho không cho âm kho.
9. Import có preview trước khi xác nhận.
10. Import có báo lỗi theo dòng/cột.
11. Import có rollback nếu lỗi nghiêm trọng.
12. Có export khách hàng.
13. Có export sản phẩm/SKU.
14. Có export tồn kho.
15. Có export công nợ.
16. Export tuân thủ phân quyền.
17. Export không lộ giá nhập nếu user không có quyền.
18. Có lịch sử import.
19. Có lịch sử export dữ liệu nhạy cảm.
20. Có audit log cho thao tác nhạy cảm: kho, đơn hàng, payment, quyền user.
21. Có màn hình xem audit log cho Admin.
22. Có audit log theo từng đối tượng quan trọng nếu làm được.

---

## 21. Roadmap triển khai

### Sprint IMPORT-1: Import khách hàng

Mục tiêu:

* File mẫu khách hàng.
* Upload file.
* Preview.
* Validate.
* Import khách hàng.
* Chống trùng số điện thoại.

Phạm vi:

* /imports/templates/customers.
* /imports/upload.
* /imports/validate.
* /imports/confirm.
* Customer import service.

---

### Sprint IMPORT-2: Import sản phẩm/SKU

Mục tiêu:

* File mẫu sản phẩm/SKU.
* Import Product.
* Import ProductVariant/SKU.
* Tự sinh SKU nếu trống.
* Chống trùng SKU.
* Tạo InventoryItem.
* Tạo initial InventoryTransaction nếu có tồn đầu.

Phạm vi:

* Product/SKU import service.
* SKU validation.
* Inventory initialization.

---

### Sprint IMPORT-3: Import tồn kho

Mục tiêu:

* File mẫu tồn kho.
* Import điều chỉnh/nhập kho hàng loạt.
* Tạo InventoryTransaction.
* Không cho âm kho.

Phạm vi:

* Inventory import service.
* Stock validation.
* Transaction creation.

---

### Sprint EXPORT-1: Export cơ bản

Mục tiêu:

* Export khách hàng.
* Export sản phẩm/SKU.
* Export tồn kho.
* Export công nợ.

Phạm vi:

* Export service.
* CSV/XLSX generation.
* Permission filtering.

---

### Sprint EXPORT-2: Export báo cáo và remarketing

Mục tiêu:

* Export báo cáo bán hàng.
* Export thanh toán.
* Export khách hàng remarketing.
* Export theo bộ lọc hiện tại.

Phạm vi:

* Report export.
* Marketing export.
* Filter-aware export.

---

### Sprint AUDIT-1: Audit log nền tảng

Mục tiêu:

* Bảng audit_logs.
* Log service.
* Ghi log thao tác quan trọng.

Phạm vi:

* customer update log.
* product price update log.
* inventory adjust log.
* order cancel log.
* payment cancel log.

---

### Sprint AUDIT-2: Màn hình Audit log

Mục tiêu:

* Admin xem audit log.
* Lọc theo user/module/action/date.
* Xem chi tiết old/new value.

Phạm vi:

* Audit log API.
* Audit log UI.

---

### Sprint AUDIT-3: Audit theo từng đối tượng

Mục tiêu:

* Tab lịch sử trong chi tiết khách hàng.
* Tab lịch sử trong chi tiết đơn hàng.
* Tab lịch sử trong chi tiết SKU/kho.
* Tab lịch sử trong payment nếu cần.

Phạm vi:

* Entity audit endpoint.
* Entity history UI.

---

## 22. Kết luận

Module Import / Export Excel và Nhật ký thao tác nâng cao là phần giúp phần mềm dùng được trong thực tế lâu dài.

Điểm cốt lõi:

* Import phải có file mẫu, preview, validate, báo lỗi rõ ràng.
* Không được import dữ liệu sai vào hệ thống.
* Import khách hàng phải chống trùng số điện thoại.
* Import sản phẩm/SKU phải chống trùng SKU.
* Import tồn kho phải tạo lịch sử kho.
* Export phải đúng bộ lọc và đúng quyền.
* Không export dữ liệu nhạy cảm cho người không có quyền.
* Audit log phải ghi lại các thao tác quan trọng.
* Các thao tác liên quan đến tiền, kho, đơn hàng, quyền user phải truy vết được.
* Không xóa hoặc sửa dữ liệu quan trọng mà không có lịch sử.

Nếu module này làm tốt, phần mềm sẽ dễ triển khai cho cửa hàng có dữ liệu cũ, dễ kiểm soát sai sót và đáng tin cậy hơn khi sử dụng nhiều nhân viên.
