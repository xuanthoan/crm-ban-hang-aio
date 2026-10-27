# ĐẶC TẢ MODULE CHI TIẾT

# Module Sản phẩm + Biến thể/SKU

# Dự án: CRM_Ban_Hang

## 1. Mục tiêu của module Sản phẩm + Biến thể/SKU

Module Sản phẩm + Biến thể/SKU là nền tảng thứ hai của phần mềm, sau module Khách hàng/CRM.

Mục tiêu của module này không chỉ là lưu danh sách sản phẩm, mà phải giúp cửa hàng quản lý được đầy đủ:

* Sản phẩm cha.
* Sản phẩm không có biến thể.
* Sản phẩm có nhiều biến thể.
* Tự sinh tổ hợp SKU.
* Tự sinh mã SKU nếu người dùng không nhập.
* Giá nhập theo từng SKU.
* Giá bán lẻ theo từng SKU.
* Giá khuyến mãi/giá hiện tại theo từng SKU.
* Ảnh riêng theo từng SKU.
* Trạng thái bán theo từng SKU.
* Ngưỡng cảnh báo tồn thấp theo từng SKU.
* Tồn kho ban đầu theo từng SKU.
* Thao tác hàng loạt trên nhiều SKU cùng một sản phẩm cha.
* Tìm kiếm sản phẩm/SKU nhanh để bán hàng.

Nguyên tắc quan trọng nhất:

Product = sản phẩm cha.
ProductVariant/SKU = đơn vị bán hàng cụ thể.

Ví dụ:

Sản phẩm cha:

* Áo thun nữ 2027.

SKU con:

* Áo thun nữ 2027 / Đen / S.
* Áo thun nữ 2027 / Đen / M.
* Áo thun nữ 2027 / Trắng / XL.

Kho, giá, ảnh riêng và trạng thái bán phải gắn với SKU con, không gắn mơ hồ với sản phẩm cha.

---

## 2. Vai trò của module Sản phẩm trong toàn hệ thống

Module Sản phẩm liên kết trực tiếp với các module:

* Kho hàng.
* Đơn hàng.
* Báo cáo.
* Remarketing.
* Lợi nhuận.
* Import/export.
* Cấu hình danh mục, thương hiệu, đơn vị tính.

Quan hệ với các module khác:

* Một Product có nhiều ProductVariant/SKU.
* Một ProductVariant có một InventoryItem.
* Một ProductVariant có nhiều InventoryTransaction.
* Một OrderItem phải chọn một ProductVariant cụ thể.
* Báo cáo sản phẩm bán chạy dựa trên ProductVariant và Product.
* Remarketing có thể lọc khách đã mua Product, Category hoặc ProductVariant.
* Lợi nhuận cơ bản được tính từ giá bán và giá nhập của ProductVariant.

Nếu module sản phẩm làm sai, các module Kho, Đơn hàng, Báo cáo, Remarketing đều bị sai theo.

---

## 3. Tư duy thiết kế sản phẩm

### 3.1. Sản phẩm cha là gì?

Sản phẩm cha là dòng sản phẩm hoặc mẫu sản phẩm chung.

Ví dụ:

* Áo thun nữ 2027.
* Balo học sinh chống gù.
* Sách thiếu nhi tập 1.
* Kinh A Di Đà bản phổ thông.
* Bột chống thấm đa dụng 1kg.
* Dép sục nữ quai ngọc.
* Sữa rửa mặt dưỡng ẩm.

Sản phẩm cha dùng để gom nhóm thông tin chung:

* Tên sản phẩm.
* Danh mục.
* Thương hiệu.
* Mô tả chung.
* Ảnh đại diện chung.
* Tag sản phẩm.
* Ghi chú nội bộ.
* Trạng thái sản phẩm.

Sản phẩm cha không nhất thiết là thứ trực tiếp bán ra nếu sản phẩm có biến thể. Thứ bán ra cụ thể là SKU.

---

### 3.2. SKU / Biến thể là gì?

SKU là phiên bản bán hàng cụ thể của sản phẩm.

Ví dụ:

Sản phẩm cha: Áo thun nữ 2027.

SKU:

* AO-THUN-NU-2027-DEN-S.
* AO-THUN-NU-2027-DEN-M.
* AO-THUN-NU-2027-TRANG-XL.

Mỗi SKU có thể có:

* Mã SKU riêng.
* Tên biến thể riêng.
* Màu sắc.
* Size.
* Chất liệu.
* Giá nhập.
* Giá bán.
* Giá khuyến mãi.
* Ảnh riêng.
* Tồn kho riêng.
* Trạng thái riêng.

Vì vậy, SKU là đơn vị để:

* Bán hàng.
* Trừ kho.
* Nhập kho.
* Báo cáo bán chạy.
* Cảnh báo tồn thấp.
* Tính lợi nhuận.

---

### 3.3. Sản phẩm không có biến thể

Không phải sản phẩm nào cũng có màu/size.

Ví dụ:

* Sách thiếu nhi tập 1.
* Kinh A Di Đà bản phổ thông.
* Bột chống thấm 1kg.
* Một món đồ chơi chỉ có một phiên bản.
* Một sản phẩm gia dụng đơn mẫu.

Với sản phẩm không có biến thể, hệ thống vẫn phải tạo một SKU mặc định.

Ví dụ:

Product:

* Sách thiếu nhi tập 1.

ProductVariant mặc định:

* SKU: SACH-THIEU-NHI-TAP-1.
* Variant name: Mặc định.
* Tồn kho: 20.
* Giá bán: 50.000.

Lý do vẫn cần SKU mặc định:

* Đơn hàng luôn chọn SKU.
* Kho luôn theo SKU.
* Báo cáo luôn theo SKU.
* Sau này nếu sản phẩm phát sinh biến thể thì mô hình vẫn thống nhất.

---

### 3.4. Sản phẩm có biến thể

Sản phẩm có biến thể là sản phẩm có nhiều phiên bản khác nhau.

Ví dụ:

Áo thun nữ 2027:

* Màu sắc: Đen, Trắng, Xanh.
* Size: XS, S, M, L, XL, XXL.

Balo học sinh:

* Màu sắc: Xanh, Hồng, Đen.
* Dung tích: 15L, 20L.

Mỹ phẩm:

* Dung tích: 100ml, 200ml.
* Loại da: Da dầu, Da khô, Da nhạy cảm.

Đồ chơi:

* Mẫu mã: Robot, Xe, Máy bay.
* Kích thước: Nhỏ, Vừa, Lớn.

Hệ thống phải cho người dùng tự định nghĩa tên biến thể, không hard-code chỉ là màu sắc/size.

---

## 4. Người dùng của module Sản phẩm

### 4.1. Chủ cửa hàng / Admin

Nhu cầu:

* Quản lý toàn bộ sản phẩm.
* Tạo sản phẩm mới.
* Quản lý giá nhập, giá bán.
* Xem sản phẩm đang bán/ngừng bán.
* Xem sản phẩm bán chạy.
* Xem SKU tồn kho thấp.
* Import/export sản phẩm.
* Kiểm soát dữ liệu sản phẩm sạch, không trùng SKU.

Quyền:

* Toàn quyền tạo/sửa/xóa/ngừng bán sản phẩm.
* Quản lý SKU.
* Sửa giá.
* Xem giá nhập.
* Import/export.

---

### 4.2. Quản lý bán hàng

Nhu cầu:

* Xem danh sách sản phẩm.
* Tìm SKU để tư vấn.
* Kiểm tra giá bán.
* Kiểm tra tồn kho.
* Cập nhật một số thông tin sản phẩm nếu được phép.
* Xem sản phẩm sắp hết hàng.

Quyền:

* Xem sản phẩm/SKU.
* Có thể sửa thông tin bán hàng nếu được phân quyền.
* Có thể không được sửa giá nhập nếu chủ cửa hàng muốn giới hạn.

---

### 4.3. Nhân viên bán hàng

Nhu cầu:

* Tìm sản phẩm nhanh.
* Tìm SKU theo tên, mã, màu, size.
* Xem giá bán.
* Xem tồn kho.
* Chọn đúng SKU khi tạo đơn.

Quyền:

* Xem sản phẩm đang bán.
* Xem SKU đang bán.
* Xem tồn kho khả dụng.
* Thông thường không được sửa sản phẩm, giá nhập hoặc kho.

---

### 4.4. Nhân viên kho

Nhu cầu:

* Xem SKU.
* Xem tồn kho.
* Nhập kho theo SKU.
* Điều chỉnh kho.
* Kiểm tra sản phẩm sắp hết hàng.

Quyền:

* Xem sản phẩm/SKU.
* Xem tồn kho.
* Có thể không được sửa giá bán/giá nhập.
* Có quyền thao tác kho nếu được phân quyền.

---

## 5. Cấu trúc module Sản phẩm

Module Sản phẩm nên có các màn hình chính:

1. Danh sách sản phẩm cha.
2. Thêm sản phẩm.
3. Chi tiết sản phẩm cha.
4. Quản lý SKU/biến thể của sản phẩm.
5. Sửa hàng loạt SKU.
6. Danh sách toàn bộ SKU.
7. Import/export sản phẩm/SKU, có thể để sau MVP.

---

## 6. Màn hình Danh sách sản phẩm cha

### 6.1. Mục tiêu

Màn hình này giúp người dùng quản lý sản phẩm ở cấp tổng quan.

Nó không nên chỉ hiển thị từng SKU rời rạc. Trước hết cần hiển thị sản phẩm cha, sau đó có thể mở rộng để xem SKU con.

### 6.2. Thành phần màn hình

* Tiêu đề: Sản phẩm.
* Nút “Thêm sản phẩm”.
* Ô tìm kiếm.
* Bộ lọc.
* Bảng danh sách sản phẩm cha.
* Tổng số sản phẩm.
* Hành động nhanh.

### 6.3. Tìm kiếm sản phẩm cha

Tìm theo:

* Tên sản phẩm.
* Danh mục.
* Thương hiệu.
* Tag sản phẩm.
* Ghi chú nếu cần.

### 6.4. Bộ lọc sản phẩm cha

Bộ lọc:

* Danh mục.
* Thương hiệu.
* Trạng thái.
* Có biến thể / không có biến thể.
* Có SKU sắp hết hàng.
* Có SKU hết hàng.
* Ngày tạo.
* Người tạo, nếu cần.

### 6.5. Cột trong bảng sản phẩm cha

Cột đề xuất:

* Tên sản phẩm.
* Danh mục.
* Thương hiệu.
* Số SKU.
* Tổng tồn kho.
* Số SKU sắp hết.
* Trạng thái.
* Hành động.

Hành động:

* Xem chi tiết.
* Sửa.
* Quản lý SKU.
* Ngừng bán.
* Xóa, nếu được phép và chưa có dữ liệu liên quan.

### 6.6. Hiển thị cha-con

Nên có cách hiển thị rõ quan hệ cha-con:

Cách 1: Bấm vào sản phẩm cha để mở trang chi tiết.

Cách 2: Bảng có nút mở rộng để xem SKU con ngay trong danh sách.

Ví dụ:

Áo thun nữ 2027
Tổng tồn: 150 | SKU: 18 | Sắp hết: 3

Mở rộng:

* Đen / S | SKU: AO-THUN-NU-2027-DEN-S | Tồn: 20.
* Đen / M | SKU: AO-THUN-NU-2027-DEN-M | Tồn: 12.
* Trắng / XL | SKU: AO-THUN-NU-2027-TRANG-XL | Tồn: 0.

MVP nên ưu tiên trang chi tiết sản phẩm cha để giao diện gọn hơn.

---

## 7. Màn hình Thêm sản phẩm

### 7.1. Nguyên tắc

Khi thêm sản phẩm, người dùng không nên phải hiểu database. Giao diện phải dẫn dắt theo nghiệp vụ:

1. Nhập thông tin sản phẩm cha.
2. Chọn sản phẩm có biến thể hay không.
3. Nếu không có biến thể, nhập SKU mặc định.
4. Nếu có biến thể, khai báo nhóm biến thể và giá trị.
5. Hệ thống tự sinh bảng SKU.
6. Người dùng chỉnh thông tin từng SKU hoặc áp dụng hàng loạt.
7. Lưu sản phẩm.

### 7.2. Bố cục màn hình thêm sản phẩm

Màn hình gồm các khối:

1. Thông tin sản phẩm cha.
2. Cấu hình biến thể.
3. Thông tin SKU mặc định hoặc bảng SKU biến thể.
4. Thiết lập giá/tồn kho hàng loạt.
5. Nút lưu.

---

## 8. Khối thông tin sản phẩm cha

Trường:

* Tên sản phẩm.
* Danh mục.
* Thương hiệu.
* Mô tả chung.
* Ảnh đại diện.
* Tag sản phẩm.
* Ghi chú nội bộ.
* Trạng thái.

Quy tắc:

* Tên sản phẩm bắt buộc.
* Danh mục nên có nhưng MVP có thể chưa bắt buộc.
* Trạng thái mặc định: Đang bán hoặc Nháp tùy thiết kế.
* Ảnh đại diện là ảnh chung, SKU có thể dùng ảnh riêng.
* Nếu SKU không có ảnh riêng, có thể dùng ảnh đại diện của sản phẩm cha.

Trạng thái sản phẩm cha:

* draft: Nháp.
* active: Đang bán.
* inactive: Ngừng bán.

---

## 9. Sản phẩm không có biến thể

### 9.1. Giao diện

Mặc định, sản phẩm là “không có biến thể”.

Hiển thị khối “Thông tin SKU mặc định”.

Trường:

* SKU.
* Đơn vị tính.
* Giá nhập.
* Giá bán lẻ.
* Giá khuyến mãi / giá hiện tại.
* Tồn kho ban đầu.
* Ngưỡng cảnh báo tồn thấp.
* Ảnh SKU.
* Barcode.
* Trạng thái SKU.

Quy tắc:

* SKU có thể để trống để hệ thống tự sinh.
* Đơn vị tính mặc định có thể là “cái”, “cuốn”, “bộ” hoặc theo cấu hình.
* Giá nhập không được âm.
* Giá bán lẻ không được âm.
* Giá khuyến mãi nếu nhập thì không được âm.
* Tồn kho ban đầu không được âm.
* Ngưỡng tồn thấp mặc định 5.
* Trạng thái SKU mặc định là đang bán.

### 9.2. Logic khi lưu

Khi lưu sản phẩm không có biến thể:

1. Tạo Product.
2. Tạo ProductVariant mặc định.
3. Nếu SKU trống, tự sinh SKU.
4. Tạo InventoryItem cho ProductVariant.
5. InventoryItem.quantity = tồn kho ban đầu.
6. Nếu tồn kho ban đầu > 0, tạo InventoryTransaction loại initial.
7. Hiển thị SKU trong danh sách SKU và kho hàng.

### 9.3. Lỗi không được phép có

Nếu người dùng nhập tồn kho ban đầu là 10, sau khi lưu kho không được hiển thị 0.

Đây là lỗi nghiêm trọng vì làm sai dữ liệu kho.

---

## 10. Sản phẩm có biến thể

### 10.1. Nguyên tắc UI

Mặc định không hiển thị sẵn biến thể 1, 2, 3.

Chỉ hiển thị tùy chọn:

“Sản phẩm có biến thể”.

Nếu người dùng bật, mới hiển thị biến thể 1.

Sau khi biến thể 1 có dữ liệu, mới hiện tùy chọn thêm biến thể 2.

Sau khi biến thể 2 có dữ liệu, mới hiện tùy chọn thêm biến thể 3.

Không hiển thị cả 3 biến thể từ đầu, vì nhiều sản phẩm chỉ có 1 biến thể hoặc không có biến thể.

### 10.2. Biến thể 1

Trường:

* Tên thuộc tính biến thể.
* Danh sách giá trị.

Ví dụ:

Tên thuộc tính:

* Màu sắc.

Giá trị:

* Đen.
* Trắng.
* Xanh.

Cách nhập giá trị nên hỗ trợ:

* Nhập một giá trị rồi bấm Enter.
* Hoặc ô input + nút “Thêm giá trị”.
* Hiển thị giá trị dưới dạng tag/chip.
* Có thể xóa từng giá trị.

### 10.3. Biến thể 2

Chỉ hiện khi biến thể 1 đã có ít nhất một giá trị.

Ví dụ:

Tên thuộc tính:

* Size.

Giá trị:

* S.
* M.
* L.
* XL.

### 10.4. Biến thể 3

Chỉ hiện khi biến thể 2 đã có ít nhất một giá trị.

Ví dụ:

Tên thuộc tính:

* Chất liệu.

Giá trị:

* Cotton.
* Thun lạnh.

MVP chỉ cần hỗ trợ tối đa 3 nhóm biến thể. Không nên làm vô hạn ngay vì sẽ làm UI và dữ liệu phức tạp hơn.

---

## 11. Tự sinh tổ hợp SKU

### 11.1. Nguyên tắc

Sau khi người dùng nhập giá trị biến thể, hệ thống tự sinh tổ hợp SKU từ các nhóm biến thể.

Người dùng không phải tự tạo từng biến thể thủ công.

### 11.2. Ví dụ 1 biến thể

Biến thể:

* Kích thước: Nhỏ, Vừa, Lớn.

Hệ thống sinh:

* Nhỏ.
* Vừa.
* Lớn.

### 11.3. Ví dụ 2 biến thể

Biến thể 1:

* Màu sắc: Đen, Trắng, Xanh.

Biến thể 2:

* Size: S, M, L.

Hệ thống sinh:

* Đen / S.
* Đen / M.
* Đen / L.
* Trắng / S.
* Trắng / M.
* Trắng / L.
* Xanh / S.
* Xanh / M.
* Xanh / L.

### 11.4. Ví dụ 3 biến thể

Biến thể 1:

* Màu sắc: Đen, Trắng.

Biến thể 2:

* Size: S, M.

Biến thể 3:

* Chất liệu: Cotton, Thun lạnh.

Hệ thống sinh:

* Đen / S / Cotton.
* Đen / S / Thun lạnh.
* Đen / M / Cotton.
* Đen / M / Thun lạnh.
* Trắng / S / Cotton.
* Trắng / S / Thun lạnh.
* Trắng / M / Cotton.
* Trắng / M / Thun lạnh.

### 11.5. Giới hạn tổ hợp

Cần có giới hạn để tránh người dùng tạo quá nhiều SKU ngoài ý muốn.

Ví dụ:

* Nếu số tổ hợp vượt 200 SKU, cảnh báo.
* Nếu vượt 500 SKU, chặn hoặc yêu cầu xác nhận đặc biệt.

Thông báo:

“Sản phẩm này sẽ tạo 360 SKU. Số lượng SKU lớn có thể gây khó quản lý. Bạn có chắc chắn muốn tiếp tục không?”

MVP có thể đặt giới hạn đơn giản, ví dụ tối đa 200 SKU mỗi sản phẩm.

---

## 12. Bảng SKU sau khi sinh tổ hợp

### 12.1. Mục tiêu

Sau khi sinh tổ hợp, người dùng cần chỉnh thông tin từng SKU.

Bảng này là phần quan trọng nhất của sản phẩm có biến thể.

### 12.2. Cột trong bảng SKU

Cột đề xuất:

* Tên biến thể.
* SKU.
* Đơn vị tính.
* Giá nhập.
* Giá bán lẻ.
* Giá khuyến mãi / giá hiện tại.
* Tồn kho ban đầu.
* Ngưỡng tồn thấp.
* Ảnh riêng SKU.
* Barcode.
* Trạng thái.
* Hành động.

### 12.3. Hành động từng dòng

Mỗi dòng SKU có thể:

* Sửa SKU.
* Sửa giá.
* Sửa tồn kho ban đầu trước khi lưu.
* Sửa ảnh.
* Sửa trạng thái.
* Xóa dòng khỏi danh sách nếu cửa hàng không bán tổ hợp đó.

Ví dụ:

Có tổ hợp Đen / XXL nhưng cửa hàng không bán size XXL màu Đen, người dùng có thể xóa dòng này trước khi lưu.

### 12.4. Giữ dữ liệu đã nhập khi thay đổi biến thể

Nếu người dùng đã nhập giá/tồn cho một số SKU, sau đó thêm giá trị biến thể mới, hệ thống nên giữ lại dữ liệu cũ cho các tổ hợp vẫn còn tồn tại.

Ví dụ:

Ban đầu:

* Đen / S, giá 150.000.

Sau đó thêm màu Trắng.

Bảng sinh thêm:

* Trắng / S.

Nhưng dòng Đen / S vẫn giữ giá 150.000.

Không được làm mất dữ liệu người dùng đã nhập nếu tổ hợp chưa bị xóa.

---

## 13. Thao tác hàng loạt SKU

### 13.1. Mục tiêu

Người dùng không thể nhập thủ công giá/tồn/trạng thái cho hàng chục SKU một cách chậm chạp.

Cần có chức năng áp dụng hàng loạt.

### 13.2. Áp dụng cho tất cả SKU

Nên có khối “Áp dụng nhanh cho tất cả SKU”.

Trường:

* Đơn vị tính.
* Giá nhập.
* Giá bán lẻ.
* Giá khuyến mãi.
* Tồn kho ban đầu.
* Ngưỡng tồn thấp.
* Trạng thái.

Nút:

* Áp dụng cho tất cả SKU.

### 13.3. Áp dụng cho SKU được chọn

Trong bảng SKU, người dùng có thể tick chọn một số dòng.

Hành động hàng loạt:

* Cập nhật giá nhập.
* Cập nhật giá bán lẻ.
* Cập nhật giá khuyến mãi.
* Cập nhật tồn kho ban đầu, chỉ khi sản phẩm chưa lưu hoặc đang nhập kho ban đầu.
* Cập nhật ngưỡng tồn thấp.
* Cập nhật trạng thái.
* Xóa khỏi danh sách.
* Ngừng bán.

### 13.4. Áp dụng theo điều kiện

Có thể phát triển sau MVP:

* Áp dụng cho tất cả màu Đen.
* Áp dụng cho tất cả size S.
* Áp dụng cho tất cả SKU đang hết hàng.
* Áp dụng cho tất cả SKU thuộc trạng thái đang bán.

MVP chỉ cần áp dụng tất cả và áp dụng cho dòng được chọn.

---

## 14. Tự sinh mã SKU

### 14.1. Mục tiêu

Người dùng có thể không muốn tự đặt mã SKU. Hệ thống phải tự sinh SKU dễ đọc, ít trùng, có logic.

### 14.2. Quy tắc sinh SKU cơ bản

SKU có thể sinh từ:

* Tên sản phẩm cha.
* Giá trị biến thể.
* Số thứ tự nếu cần.

Ví dụ:

Sản phẩm:

* Áo thun nữ 2027.

Biến thể:

* Đen / S.

SKU:

* AO-THUN-NU-2027-DEN-S.

Ví dụ khác:

Sản phẩm:

* Balo học sinh chống gù.

Biến thể:

* Xanh / 20L.

SKU:

* BALO-HOC-SINH-CHONG-GU-XANH-20L.

### 14.3. Chuẩn hóa SKU

Khi sinh SKU:

* Chuyển tiếng Việt có dấu thành không dấu.
* Chuyển chữ thường thành chữ hoa.
* Thay khoảng trắng bằng dấu gạch ngang.
* Loại bỏ ký tự đặc biệt không cần thiết.
* Giới hạn độ dài nếu quá dài.
* Có thể bỏ bớt từ phổ biến nếu cần, nhưng MVP chưa cần.

Ví dụ:

“Áo thun nữ 2027” → “AO-THUN-NU-2027”.

“Đỏ đô” → “DO-DO”.

“Trắng” → “TRANG”.

### 14.4. Xử lý SKU trùng

Nếu SKU tự sinh bị trùng, hệ thống tự thêm hậu tố:

* AO-THUN-NU-2027-DEN-S.
* AO-THUN-NU-2027-DEN-S-002.
* AO-THUN-NU-2027-DEN-S-003.

Nếu người dùng tự nhập SKU và SKU bị trùng, nên báo lỗi thay vì tự sửa.

Thông báo:

“Mã SKU này đã tồn tại. Vui lòng nhập mã khác.”

Lý do:

* SKU tự sinh thì hệ thống có thể tự thêm hậu tố.
* SKU người dùng tự nhập có thể mang ý nghĩa riêng, không nên tự ý đổi.

---

## 15. Trạng thái sản phẩm và SKU

### 15.1. Trạng thái sản phẩm cha

Trạng thái:

* draft: Nháp.
* active: Đang bán.
* inactive: Ngừng bán.

Ý nghĩa:

* Nháp: sản phẩm chưa sẵn sàng bán.
* Đang bán: sản phẩm có thể hiển thị và bán.
* Ngừng bán: sản phẩm không bán nữa nhưng giữ dữ liệu lịch sử.

### 15.2. Trạng thái SKU

Trạng thái:

* active: Đang bán.
* inactive: Ngừng bán.
* out_of_stock: Hết hàng, có thể tự suy ra từ tồn kho nhưng vẫn nên có trạng thái hiển thị.
* hidden: Ẩn, nếu cần sau này.

MVP có thể chỉ cần:

* active.
* inactive.

Tình trạng hết hàng nên tính từ tồn kho.

### 15.3. Quy tắc trạng thái

Nếu sản phẩm cha inactive, tất cả SKU con không nên được bán.

Nếu SKU inactive, SKU đó không được chọn khi tạo đơn mới.

Nếu SKU hết hàng, hệ thống cảnh báo khi tạo đơn.

Tùy cấu hình, có thể:

* Chặn bán khi tồn kho không đủ.
* Cho phép bán âm, nhưng MVP nên chặn bán âm.

---

## 16. Giá sản phẩm

### 16.1. Các loại giá

Mỗi SKU cần có:

* Giá nhập.
* Giá bán lẻ.
* Giá khuyến mãi / giá hiện tại.

Giải thích:

Giá nhập:

* Dùng để tính lãi gộp cơ bản.
* Không phải ai cũng được xem.

Giá bán lẻ:

* Giá gốc/giá niêm yết.

Giá khuyến mãi / giá hiện tại:

* Giá đang bán thực tế nếu có khuyến mãi.
* Nếu không có, có thể dùng giá bán lẻ.

### 16.2. Quy tắc giá

* Giá nhập không được âm.
* Giá bán lẻ không được âm.
* Giá khuyến mãi không được âm.
* Giá khuyến mãi có thể thấp hơn giá bán lẻ.
* Giá khuyến mãi có thể để trống.
* Nếu giá khuyến mãi trống, khi bán dùng giá bán lẻ.
* Nếu giá khuyến mãi có giá trị, khi bán có thể gợi ý dùng giá khuyến mãi.

### 16.3. Quyền xem giá nhập

Không phải người dùng nào cũng nên xem giá nhập.

Gợi ý:

* Admin: xem/sửa giá nhập.
* Quản lý: xem/sửa nếu được phân quyền.
* Sale: chỉ xem giá bán.
* Kho: có thể không xem giá nhập tùy cấu hình.
* Kế toán: có thể xem giá nhập nếu cần.

MVP có thể chưa làm quyền chi tiết, nhưng cần thiết kế sẵn.

---

## 17. Ảnh sản phẩm

### 17.1. Ảnh sản phẩm cha

Ảnh sản phẩm cha là ảnh đại diện chung.

Ví dụ:

* Ảnh tổng thể áo thun.
* Ảnh bìa sách.
* Ảnh balo mẫu.

### 17.2. Ảnh SKU

SKU có thể có ảnh riêng.

Ví dụ:

* Áo màu Đen có ảnh riêng.
* Áo màu Trắng có ảnh riêng.
* Balo màu Xanh có ảnh riêng.

Nếu SKU không có ảnh riêng, dùng ảnh sản phẩm cha.

### 17.3. MVP xử lý ảnh thế nào?

MVP có thể bắt đầu với:

* image_url dạng text/link.
* Chưa cần upload file thật.

Sau này nâng cấp:

* Upload ảnh lên server.
* Quản lý thư viện ảnh.
* Ảnh chính/ảnh phụ.
* Nhiều ảnh cho mỗi SKU.

---

## 18. Danh mục, thương hiệu, đơn vị tính

### 18.1. Danh mục sản phẩm

Danh mục giúp phân loại sản phẩm.

Ví dụ:

* Sách thiếu nhi.
* Đồ chơi.
* Kinh sách Phật giáo.
* Balo.
* Cặp sách.
* Quần áo.
* Mỹ phẩm.
* Đồ gia dụng.
* Vật liệu xây dựng.

MVP có thể lưu category dạng text, nhưng tốt hơn nên có bảng categories.

Trường:

* id.
* name.
* parent_id, nếu muốn danh mục cha-con.
* status.
* created_at.
* updated_at.

MVP có thể chưa cần danh mục nhiều cấp. Một cấp là đủ.

### 18.2. Thương hiệu

Thương hiệu có thể lưu text hoặc bảng riêng.

MVP có thể lưu brand dạng text.

Sau này có thể tách bảng brands.

### 18.3. Đơn vị tính

Ví dụ:

* Cái.
* Chiếc.
* Bộ.
* Cuốn.
* Hộp.
* Túi.
* Kg.
* Gói.
* Chai.
* Lọ.
* Mét.
* Lít.

MVP có thể lưu unit dạng text.

Sau này có bảng units để chuẩn hóa.

---

## 19. Tìm kiếm SKU để bán hàng

### 19.1. Tầm quan trọng

Khi tạo đơn hàng, nhân viên phải tìm được đúng SKU thật nhanh.

Nếu sản phẩm có nhiều biến thể mà tìm kiếm yếu, việc bán hàng sẽ rất mệt và dễ nhầm.

### 19.2. Tìm kiếm cần hỗ trợ

Tìm theo:

* Tên sản phẩm cha.
* SKU.
* Mã barcode.
* Danh mục.
* Thương hiệu.
* Giá trị biến thể, ví dụ Đen, Trắng, S, XL, 20L.
* Tên biến thể đầy đủ, ví dụ Đen / S.

Ví dụ tìm:

* “áo thun nữ đen s”.
* “ao thun nu den s”.
* “AO-THUN-NU-2027-DEN-S”.
* “đen s”.
* “balo xanh 20l”.

### 19.3. Kết quả tìm kiếm

Khi tìm SKU để bán, kết quả nên hiển thị:

* Tên sản phẩm cha.
* Tên biến thể.
* SKU.
* Giá bán.
* Tồn kho.
* Trạng thái.
* Ảnh nhỏ nếu có.

Ví dụ:

Áo thun nữ 2027
Đen / S
SKU: AO-THUN-NU-2027-DEN-S
Giá: 129.000
Tồn: 20

---

## 20. Màn hình Chi tiết sản phẩm cha

### 20.1. Mục tiêu

Đây là nơi quản lý một sản phẩm đầy đủ.

### 20.2. Thành phần

Màn hình gồm:

1. Thông tin sản phẩm cha.
2. Chỉ số tóm tắt.
3. Danh sách SKU con.
4. Hành động hàng loạt.
5. Lịch sử kho liên quan.
6. Lịch sử bán hàng, sau khi có đơn hàng.
7. Ghi chú nội bộ.

### 20.3. Header sản phẩm

Hiển thị:

* Tên sản phẩm.
* Danh mục.
* Thương hiệu.
* Trạng thái.
* Ảnh đại diện.
* Số SKU.
* Tổng tồn.
* Số SKU sắp hết.
* Số SKU hết hàng.

Nút:

* Sửa sản phẩm.
* Thêm SKU/biến thể.
* Sửa hàng loạt SKU.
* Nhập kho hàng loạt.
* Ngừng bán.

### 20.4. Danh sách SKU con

Cột:

* SKU.
* Biến thể.
* Giá nhập.
* Giá bán lẻ.
* Giá khuyến mãi.
* Tồn kho.
* Ngưỡng thấp.
* Cảnh báo.
* Trạng thái.
* Hành động.

Hành động từng SKU:

* Sửa SKU.
* Ngừng bán.
* Xem lịch sử kho.
* Điều chỉnh kho.
* Xóa nếu chưa có dữ liệu liên quan.

---

## 21. Sửa sản phẩm và SKU

### 21.1. Sửa sản phẩm cha

Có thể sửa:

* Tên sản phẩm.
* Danh mục.
* Thương hiệu.
* Mô tả.
* Ảnh đại diện.
* Tag.
* Ghi chú.
* Trạng thái.

Không nên xóa sản phẩm cha nếu đã có SKU có đơn hàng.

### 21.2. Sửa SKU

Có thể sửa:

* SKU, nếu chưa có ràng buộc lịch sử hoặc vẫn cho sửa nhưng lưu audit.
* Variant name.
* Giá nhập.
* Giá bán.
* Giá khuyến mãi.
* Ảnh.
* Barcode.
* Ngưỡng tồn thấp.
* Trạng thái.

Không nên sửa trực tiếp tồn kho trong màn hình SKU nếu đã có kho. Tồn kho nên sửa qua module Kho để có lịch sử.

Ngoại lệ:

* Tồn kho ban đầu chỉ nhập khi tạo SKU mới.
* Sau khi SKU đã tạo, mọi thay đổi tồn kho phải qua InventoryTransaction.

---

## 22. Xóa / Ngừng bán sản phẩm và SKU

### 22.1. Nguyên tắc

Không nên xóa cứng dữ liệu đã phát sinh đơn hàng/kho.

Ưu tiên:

* Ngừng bán.
* Ẩn.
* Soft delete.

### 22.2. Xóa sản phẩm cha

Chỉ cho xóa nếu:

* Không có SKU con.
* Hoặc SKU con chưa có đơn hàng, chưa có lịch sử kho quan trọng.
* Người dùng có quyền Admin.

Nếu đã có dữ liệu, chỉ cho ngừng bán.

Thông báo:

“Sản phẩm đã có dữ liệu liên quan, không thể xóa. Bạn có thể chuyển trạng thái sang Ngừng bán.”

### 22.3. Xóa SKU

Chỉ cho xóa nếu:

* SKU chưa có đơn hàng.
* SKU chưa có lịch sử kho quan trọng ngoài tồn kho ban đầu.
* Người dùng có quyền.

Nếu đã có dữ liệu, chỉ cho ngừng bán.

---

## 23. Dữ liệu lõi

### 23.1. Bảng products

Mục đích:

Lưu sản phẩm cha.

Trường đề xuất:

* id.
* product_code.
* name.
* category_id.
* category_name, nếu MVP chưa dùng category_id.
* brand.
* description.
* default_image_url.
* status.
* internal_note.
* created_by.
* updated_by.
* created_at.
* updated_at.
* deleted_at, nếu dùng soft delete.

Ghi chú:

* product_code có thể tự sinh, ví dụ SP000001.
* name bắt buộc.
* status mặc định active hoặc draft.

---

### 23.2. Bảng product_variants

Mục đích:

Lưu từng SKU cụ thể.

Trường đề xuất:

* id.
* product_id.
* sku.
* variant_name.
* option_1_name.
* option_1_value.
* option_2_name.
* option_2_value.
* option_3_name.
* option_3_value.
* unit.
* import_price.
* retail_price.
* sale_price.
* image_url.
* barcode.
* low_stock_threshold.
* status.
* created_by.
* updated_by.
* created_at.
* updated_at.
* deleted_at, nếu dùng soft delete.

Ghi chú:

* sku unique.
* product_id liên kết products.
* variant_name ví dụ “Đen / S”.
* Nếu sản phẩm không có biến thể, variant_name = “Mặc định”.
* option_1/2/3 có thể null nếu không dùng.

---

### 23.3. Bảng product_variant_options, tùy chọn nâng cao

MVP có thể chưa cần bảng này nếu dùng option_1_name/value trực tiếp trong product_variants.

Nhưng nếu muốn thiết kế chuẩn hơn, có thể có:

product_option_groups:

* id.
* product_id.
* name.
* position.

product_option_values:

* id.
* option_group_id.
* value.
* position.

Cách này chuẩn hơn cho quản lý biến thể động, nhưng phức tạp hơn.

Đề xuất MVP:

* Dùng option_1_name/value, option_2_name/value, option_3_name/value trong product_variants để đơn giản.
* Nhưng trong tài liệu cần biết rằng sau này có thể nâng cấp sang bảng option riêng.

---

### 23.4. Bảng inventory_items

Mục đích:

Lưu tồn kho hiện tại theo SKU.

Trường đề xuất:

* id.
* product_variant_id.
* quantity.
* updated_at.

Quy tắc:

* Mỗi product_variant có một inventory_item.
* quantity không được âm.

---

### 23.5. Bảng inventory_transactions

Mục đích:

Lưu lịch sử biến động kho.

Trường đề xuất:

* id.
* product_variant_id.
* transaction_type.
* quantity_before.
* quantity_changed.
* quantity_after.
* reason.
* reference_type.
* reference_id.
* created_by.
* created_at.

Loại transaction:

* initial.
* import.
* export.
* adjustment_increase.
* adjustment_decrease.
* set.
* order_confirmed.
* order_cancelled.
* return.

Module sản phẩm cần tạo initial transaction khi tạo SKU có tồn kho ban đầu.

---

## 24. API đề xuất

### 24.1. Product API

GET /products

Mục đích:

Lấy danh sách sản phẩm cha.

Query:

* search.
* category_id.
* brand.
* status.
* has_variants.
* low_stock.
* page.
* page_size.

Response mỗi sản phẩm nên có:

* id.
* name.
* category.
* brand.
* status.
* variant_count.
* total_stock.
* low_stock_variant_count.
* out_of_stock_variant_count.
* default_image_url.

---

POST /products

Mục đích:

Tạo sản phẩm cha đơn lẻ.

Có thể dùng trong trường hợp tạo product trước, tạo SKU sau.

Body:

* name.
* category_id/category_name.
* brand.
* description.
* default_image_url.
* status.
* internal_note.

---

GET /products/{id}

Mục đích:

Lấy chi tiết sản phẩm cha.

Response gồm:

* Thông tin product.
* Danh sách variants.
* Tổng tồn.
* Số SKU.
* Số SKU sắp hết.
* Số SKU hết hàng.

---

PUT /products/{id}

Mục đích:

Cập nhật sản phẩm cha.

---

DELETE /products/{id}

Mục đích:

Xóa hoặc ngừng bán sản phẩm cha.

Quy tắc:

* Nếu có SKU/đơn hàng/kho thì không xóa cứng.
* Ưu tiên soft delete hoặc chuyển inactive.

---

### 24.2. API tạo sản phẩm kèm SKU

POST /products/with-variants

Mục đích:

Tạo sản phẩm cha kèm SKU trong một lần lưu.

Đây là API quan trọng nhất cho màn hình thêm sản phẩm.

Body đề xuất:

product:

* name.
* category_id/category_name.
* brand.
* description.
* default_image_url.
* status.
* internal_note.

has_variants:

* true/false.

variant_options:

* name.
* values.

variants:

* sku.
* variant_name.
* option_1_name.
* option_1_value.
* option_2_name.
* option_2_value.
* option_3_name.
* option_3_value.
* unit.
* import_price.
* retail_price.
* sale_price.
* image_url.
* barcode.
* low_stock_threshold.
* status.
* initial_quantity.

Quy tắc:

1. Tạo product.
2. Tạo từng product_variant.
3. Nếu SKU trống, tự sinh SKU.
4. Nếu SKU tự sinh trùng, tự thêm hậu tố.
5. Nếu SKU người dùng tự nhập bị trùng, trả lỗi.
6. Tạo inventory_item cho từng SKU.
7. quantity = initial_quantity.
8. Nếu initial_quantity > 0, tạo inventory_transaction loại initial.
9. Nếu bất kỳ SKU nào lỗi, rollback toàn bộ, không tạo dở dang.

---

### 24.3. Variant API

GET /variants

Mục đích:

Lấy danh sách toàn bộ SKU.

Query:

* search.
* product_id.
* category_id.
* status.
* low_stock.
* page.
* page_size.

Tìm kiếm cần hỗ trợ:

* SKU.
* Tên sản phẩm.
* Tên biến thể.
* Giá trị biến thể.
* Barcode.

Response:

* variant_id.
* product_id.
* product_name.
* sku.
* variant_name.
* option values.
* unit.
* import_price, nếu có quyền.
* retail_price.
* sale_price.
* current_quantity.
* low_stock_threshold.
* is_low_stock.
* status.
* image_url.

---

GET /products/{product_id}/variants

Lấy SKU thuộc một sản phẩm cha.

---

GET /variants/{id}

Lấy chi tiết một SKU.

---

PUT /variants/{id}

Cập nhật SKU.

Không nên cập nhật tồn kho qua API này, trừ initial khi tạo. Tồn kho nên qua Inventory API.

---

DELETE /variants/{id}

Xóa hoặc ngừng bán SKU.

---

### 24.4. SKU generation API, tùy chọn

POST /sku/generate-preview

Mục đích:

Cho frontend preview SKU tự sinh trước khi lưu.

Body:

* product_name.
* variant_values.
* existing_skus, nếu cần.

Response:

* suggested_sku.

MVP có thể không cần API riêng. Frontend có thể gợi ý SKU, backend vẫn là nơi quyết định cuối.

---

## 25. Validation

### 25.1. Product

Tên sản phẩm:

* Bắt buộc.
* Không quá dài.
* Không chỉ chứa khoảng trắng.

Thông báo:

“Vui lòng nhập tên sản phẩm.”

Trạng thái:

* Chỉ nhận draft, active, inactive.

### 25.2. SKU

SKU:

* Nếu trống, hệ thống tự sinh.
* Nếu nhập, không được trùng.
* Không nên chứa ký tự quá đặc biệt.
* Nên tự trim khoảng trắng.
* Nên chuyển thành uppercase hoặc giữ nguyên tùy cấu hình. Đề xuất uppercase.

Thông báo:

“Mã SKU đã tồn tại.”

### 25.3. Giá

* import_price >= 0.
* retail_price >= 0.
* sale_price >= 0 nếu có.
* Nếu sale_price > retail_price vẫn có thể cho phép, nhưng có thể cảnh báo.

Thông báo:

“Giá nhập không được âm.”
“Giá bán lẻ không được âm.”
“Giá khuyến mãi không được âm.”

### 25.4. Tồn kho ban đầu

* initial_quantity >= 0.
* Phải là số nguyên nếu quản lý theo đơn vị rời.
* Sau này nếu bán theo kg/lít có thể hỗ trợ số thập phân, nhưng MVP nên dùng số nguyên.

Thông báo:

“Tồn kho ban đầu không được âm.”

### 25.5. Biến thể

Nếu bật sản phẩm có biến thể:

* Biến thể 1 phải có tên.
* Biến thể 1 phải có ít nhất một giá trị.
* Nếu bật biến thể 2, biến thể 2 phải có tên và giá trị.
* Nếu bật biến thể 3, biến thể 3 phải có tên và giá trị.
* Không cho tên biến thể trùng nhau trong cùng sản phẩm.
* Không cho giá trị trùng trong cùng một nhóm biến thể.

Thông báo:

“Vui lòng nhập tên biến thể.”
“Vui lòng thêm ít nhất một giá trị cho biến thể.”
“Giá trị biến thể bị trùng.”
“Tên biến thể bị trùng.”

### 25.6. Số lượng SKU sinh ra

Nếu số tổ hợp bằng 0:

“Chưa có biến thể nào để tạo SKU.”

Nếu số tổ hợp quá lớn:

“Số lượng SKU quá lớn, vui lòng kiểm tra lại danh sách biến thể.”

---

## 26. Quy tắc phân quyền

### 26.1. Admin

* Tạo/sửa/xóa/ngừng bán sản phẩm.
* Tạo/sửa SKU.
* Xem/sửa giá nhập.
* Xem/sửa giá bán.
* Import/export.
* Xem toàn bộ thông tin sản phẩm.

### 26.2. Quản lý

* Xem sản phẩm/SKU.
* Tạo/sửa sản phẩm nếu được phân quyền.
* Xem giá nhập nếu được phân quyền.
* Cập nhật giá bán nếu được phân quyền.

### 26.3. Sale

* Xem sản phẩm đang bán.
* Tìm SKU.
* Xem giá bán.
* Xem tồn kho khả dụng.
* Không sửa sản phẩm/SKU nếu không có quyền.
* Không xem giá nhập nếu không có quyền.

### 26.4. Kho

* Xem sản phẩm/SKU.
* Xem tồn kho.
* Không sửa giá nếu không có quyền.
* Điều chỉnh kho qua module Kho.

---

## 27. UX/UI chi tiết

### 27.1. Nguyên tắc UI

* Không hiển thị quá nhiều trường không cần thiết ngay từ đầu.
* Sản phẩm mặc định là không có biến thể.
* Biến thể 2 chỉ xuất hiện khi cần.
* Biến thể 3 chỉ xuất hiện khi cần.
* Bảng SKU sinh tự động phải dễ chỉnh hàng loạt.
* Không bắt người dùng nhập từng SKU thủ công.
* Không để người dùng nhập tồn kho ban đầu rồi lưu xong thành 0.
* Luôn thể hiện rõ sản phẩm cha và SKU con.

### 27.2. Màn hình thêm sản phẩm nên có thứ tự

1. Thông tin sản phẩm.
2. Sản phẩm có biến thể hay không.
3. Nếu không có biến thể: SKU mặc định.
4. Nếu có biến thể: khai báo biến thể.
5. Bảng SKU tự sinh.
6. Áp dụng hàng loạt.
7. Lưu sản phẩm.

### 27.3. Nút hành động

Nút chính:

* Lưu sản phẩm.
* Lưu và thêm sản phẩm khác.
* Hủy.

Nút phụ:

* Thêm giá trị.
* Thêm biến thể 2.
* Thêm biến thể 3.
* Áp dụng cho tất cả SKU.
* Xóa dòng SKU.
* Tạo lại tổ hợp SKU.

### 27.4. Sau khi lưu thành công

Sau khi lưu sản phẩm:

* Hiển thị thông báo “Đã lưu sản phẩm”.
* Chuyển đến trang chi tiết sản phẩm hoặc danh sách sản phẩm.
* Trang chi tiết phải hiển thị đúng SKU vừa tạo.
* Kho phải hiển thị đúng tồn kho ban đầu.

---

## 28. Import / Export sản phẩm

### 28.1. Import sản phẩm

MVP có thể chưa làm ngay, nhưng cần thiết kế.

Import cần hỗ trợ:

* Product name.
* Category.
* Brand.
* Description.
* SKU.
* Variant values.
* Unit.
* Import price.
* Retail price.
* Sale price.
* Initial quantity.
* Low stock threshold.
* Image URL.
* Barcode.

Cần kiểm tra:

* Thiếu tên sản phẩm.
* Trùng SKU.
* Giá âm.
* Tồn kho âm.
* Sai cấu trúc biến thể.
* Dòng nào lỗi phải báo rõ.

### 28.2. Export sản phẩm

Export:

* Danh sách sản phẩm cha.
* Danh sách SKU.
* Danh sách tồn kho.
* Danh sách sản phẩm sắp hết hàng.
* Danh sách sản phẩm ngừng bán.

---

## 29. Báo cáo liên quan đến sản phẩm

Module sản phẩm cần cung cấp dữ liệu cho báo cáo:

* Sản phẩm bán chạy.
* SKU bán chạy.
* Sản phẩm có doanh thu cao.
* SKU tồn kho thấp.
* SKU hết hàng.
* Sản phẩm lâu chưa bán.
* Giá trị tồn kho.
* Lãi gộp theo SKU nếu có giá nhập.
* Doanh thu theo danh mục.
* Doanh thu theo thương hiệu.

MVP có thể làm sau khi module đơn hàng hoàn thành.

---

## 30. Lỗi/bug không được phép tồn tại

Các lỗi sau phải coi là nghiêm trọng:

1. Tạo sản phẩm xong không tạo SKU mặc định.
2. Tạo sản phẩm không biến thể nhưng không quản lý được kho.
3. Tạo sản phẩm có biến thể nhưng bắt người dùng nhập từng SKU thủ công.
4. Nhập tồn kho ban đầu nhưng sau khi lưu tồn kho thành 0.
5. SKU bị trùng mà hệ thống không báo.
6. Giá âm vẫn lưu được.
7. Xóa SKU đã có đơn hàng mà không cảnh báo.
8. Tìm kiếm SKU không ra theo tên sản phẩm hoặc giá trị biến thể.
9. Không phân biệt được sản phẩm cha và SKU con.
10. Không có thao tác hàng loạt cho nhiều SKU.
11. Tồn kho bị sửa trực tiếp mà không có lịch sử.
12. Sản phẩm ngừng bán nhưng vẫn chọn được trong đơn hàng.
13. SKU ngừng bán nhưng vẫn chọn được trong đơn hàng.
14. Sản phẩm có nhiều biến thể nhưng hiển thị rối, không biết SKU thuộc sản phẩm nào.
15. Sinh tổ hợp SKU làm mất dữ liệu giá/tồn người dùng đã nhập trước đó.

---

## 31. Tiêu chí hoàn thành MVP cho module Sản phẩm + SKU

Module này được coi là dùng được thật khi đạt các tiêu chí:

1. Tạo được sản phẩm cha.
2. Tạo được sản phẩm không có biến thể và tự tạo SKU mặc định.
3. Tạo được sản phẩm có 1 biến thể.
4. Tạo được sản phẩm có 2 biến thể.
5. Tạo được sản phẩm có 3 biến thể.
6. Hệ thống tự sinh đúng tổ hợp SKU.
7. Người dùng có thể xóa bớt tổ hợp không bán.
8. Người dùng có thể sửa thông tin từng SKU.
9. Người dùng có thể áp dụng giá/tồn/trạng thái hàng loạt.
10. SKU tự sinh nếu người dùng để trống.
11. SKU không được trùng.
12. Tồn kho ban đầu lưu đúng.
13. Mỗi SKU có inventory_item riêng.
14. Mỗi tồn kho ban đầu tạo inventory_transaction loại initial.
15. Tìm kiếm SKU theo tên sản phẩm, SKU, màu, size.
16. Trang sản phẩm thể hiện rõ sản phẩm cha và SKU con.
17. Trang chi tiết sản phẩm có danh sách SKU con.
18. Không xóa cứng sản phẩm/SKU đã có dữ liệu liên quan.
19. Dữ liệu sẵn sàng cho module Kho và Đơn hàng.

---

## 32. Roadmap triển khai module Sản phẩm + SKU

### Sprint PRODUCT-1: Nền tảng sản phẩm cha

Mục tiêu:

* Bảng products.
* Danh sách sản phẩm cha.
* Thêm/sửa sản phẩm cha.
* Trang chi tiết sản phẩm cha cơ bản.

Phạm vi:

* Product API.
* Product list UI.
* Product form UI.
* Product detail UI.

---

### Sprint PRODUCT-2: SKU mặc định cho sản phẩm không biến thể

Mục tiêu:

* Tạo sản phẩm không biến thể.
* Tự tạo SKU mặc định.
* Tự sinh SKU nếu để trống.
* Tạo inventory_item.
* Lưu tồn kho ban đầu đúng.

Phạm vi:

* ProductVariant.
* InventoryItem.
* InventoryTransaction initial.
* Form SKU mặc định.

---

### Sprint PRODUCT-3: Biến thể và tự sinh tổ hợp SKU

Mục tiêu:

* Bật sản phẩm có biến thể.
* Nhập biến thể 1, 2, 3.
* Sinh tổ hợp SKU.
* Bảng SKU tự sinh.
* Xóa dòng SKU không bán.

Phạm vi:

* Variant option UI.
* Combination generator.
* Batch create variants.

---

### Sprint PRODUCT-4: Thao tác hàng loạt SKU

Mục tiêu:

* Áp dụng giá cho tất cả SKU.
* Áp dụng tồn kho ban đầu cho tất cả SKU.
* Áp dụng ngưỡng tồn thấp cho tất cả SKU.
* Áp dụng trạng thái cho tất cả SKU.
* Chọn nhiều SKU và cập nhật hàng loạt.

Phạm vi:

* Bulk update UI.
* Bulk update API nếu cần.

---

### Sprint PRODUCT-5: Tìm kiếm SKU và trang chi tiết sản phẩm hoàn chỉnh

Mục tiêu:

* Tìm SKU theo tên sản phẩm, SKU, giá trị biến thể.
* Trang chi tiết sản phẩm có SKU con.
* Bộ lọc theo trạng thái, tồn thấp, danh mục.
* Chuẩn bị cho module Đơn hàng.

Phạm vi:

* GET /variants search.
* Product detail improvements.
* SKU search component.

---

### Sprint PRODUCT-6: Import/export sản phẩm, có thể làm sau MVP

Mục tiêu:

* Import sản phẩm/SKU từ Excel.
* Export sản phẩm/SKU.
* Báo lỗi từng dòng.

Phạm vi:

* Import parser.
* Export CSV/XLSX.
* Validation report.

---

## 33. Kết luận

Module Sản phẩm + Biến thể/SKU là nền tảng bắt buộc để phần mềm CRM_Ban_Hang dùng được thật.

Điểm quan trọng nhất:

* Không quản lý bán hàng trực tiếp bằng sản phẩm cha nếu sản phẩm có biến thể.
* Mọi hoạt động bán hàng, kho hàng, báo cáo phải dựa trên SKU cụ thể.
* Giao diện phải giúp người dùng tạo biến thể nhanh, không nhập thủ công từng SKU.
* Hệ thống phải tự sinh tổ hợp SKU, tự sinh mã SKU, chống trùng SKU.
* Mỗi SKU phải có giá, ảnh, tồn kho, trạng thái riêng.
* Tồn kho ban đầu phải được lưu đúng ngay khi tạo SKU.
* Cần có thao tác hàng loạt để người dùng không mất thời gian chỉnh từng biến thể.

Nếu module này làm tốt, các module Kho hàng, Đơn hàng, Báo cáo và Remarketing sẽ có nền tảng dữ liệu đúng để phát triển tiếp.
