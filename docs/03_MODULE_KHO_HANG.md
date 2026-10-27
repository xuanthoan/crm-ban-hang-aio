# ĐẶC TẢ MODULE CHI TIẾT

# Module Kho hàng

# Dự án: CRM_Ban_Hang

## 1. Mục tiêu của module Kho hàng

Module Kho hàng dùng để quản lý toàn bộ số lượng tồn kho và lịch sử biến động hàng hóa trong hệ thống.

Mục tiêu không chỉ là hiển thị “còn bao nhiêu hàng”, mà phải giúp người dùng biết chính xác:

* SKU nào còn hàng.
* SKU nào hết hàng.
* SKU nào sắp hết hàng.
* Sản phẩm cha nào đang còn tổng bao nhiêu hàng.
* Màu/size/biến thể nào còn bao nhiêu.
* Ai đã nhập kho.
* Ai đã điều chỉnh kho.
* Vì sao tồn kho thay đổi.
* Đơn hàng nào đã trừ kho.
* Đơn hàng nào đã hoàn kho.
* Lịch sử nhập/xuất/điều chỉnh kho theo thời gian.

Nguyên tắc quan trọng nhất:

**Kho phải quản lý theo SKU/ProductVariant, không quản lý theo sản phẩm cha.**

Ví dụ:

Sản phẩm cha: Áo thun nữ 2027

SKU con:

* Đen / S: còn 20
* Đen / M: còn 0
* Trắng / S: còn 15
* Xanh / XL: còn 3

Không thể nói chung chung “Áo thun nữ 2027 còn 38 cái” rồi bỏ qua màu/size, vì khi bán hàng nhân viên cần biết chính xác biến thể nào còn.

---

## 2. Vai trò của module Kho hàng trong toàn hệ thống

Module Kho hàng liên kết trực tiếp với:

* Sản phẩm/SKU.
* Đơn hàng.
* Hoàn hàng.
* Báo cáo.
* Cảnh báo tồn thấp.
* Lợi nhuận/tồn kho.
* Nhật ký thao tác.
* Import/export.

Quan hệ nghiệp vụ:

* Mỗi ProductVariant/SKU có một InventoryItem.
* Mỗi InventoryItem lưu tồn hiện tại của một SKU.
* Mỗi lần tồn kho thay đổi phải tạo InventoryTransaction.
* Khi tạo SKU mới có tồn kho ban đầu, hệ thống tạo transaction loại initial.
* Khi nhập kho, hệ thống tăng tồn và tạo transaction loại import.
* Khi điều chỉnh kho, hệ thống tạo transaction loại adjustment.
* Khi đơn hàng được xác nhận, hệ thống trừ kho và tạo transaction loại order_confirmed.
* Khi đơn hàng bị hủy/hoàn, hệ thống hoàn kho và tạo transaction loại order_cancelled hoặc return.

Nếu module Kho làm sai, toàn bộ bán hàng, đơn hàng, báo cáo sản phẩm, công nợ và remarketing đều bị ảnh hưởng.

---

## 3. Tư duy thiết kế kho

### 3.1. Tồn kho hiện tại và lịch sử kho là hai thứ khác nhau

Hệ thống cần tách rõ:

1. **InventoryItem**
   Lưu số lượng tồn kho hiện tại của từng SKU.

2. **InventoryTransaction**
   Lưu lịch sử mọi lần thay đổi tồn kho.

Ví dụ:

SKU: AO-THUN-NU-2027-DEN-S

InventoryItem:

* quantity = 20

InventoryTransaction:

* Initial: +10, từ 0 lên 10
* Import: +15, từ 10 lên 25
* Order confirmed: -2, từ 25 xuống 23
* Adjustment decrease: -3, từ 23 xuống 20

Không được chỉ sửa quantity mà không lưu lịch sử. Nếu không có lịch sử, sau này không biết vì sao hàng bị lệch.

---

### 3.2. Tồn kho không được âm trong MVP

MVP nên chặn tồn kho âm.

Ví dụ:

SKU Đen / S còn 3.

Nếu nhân viên tạo đơn bán 5 cái, hệ thống phải cảnh báo:

“Tồn kho không đủ. SKU này chỉ còn 3.”

Nếu điều chỉnh giảm 5 trong khi tồn chỉ còn 3, hệ thống phải chặn:

“Không thể giảm tồn kho vì số lượng sau điều chỉnh sẽ âm.”

Sau này nếu muốn cho phép bán âm, có thể thêm cấu hình. Nhưng MVP nên ưu tiên dữ liệu sạch.

---

### 3.3. Mọi thay đổi kho phải có lý do

Các thao tác thủ công như nhập kho, xuất kho, điều chỉnh tăng/giảm/đặt lại tồn kho phải có lý do.

Ví dụ lý do:

* Nhập hàng mới.
* Kiểm kho thực tế.
* Hàng lỗi.
* Hàng mất.
* Hàng tặng khách.
* Nhập bù.
* Sai lệch dữ liệu.
* Hoàn hàng.
* Điều chỉnh tồn đầu kỳ.

Nếu không bắt buộc lý do, kho rất dễ mất kiểm soát.

---

### 3.4. Kho nên có hai góc nhìn

Một hệ thống kho dễ dùng cần có 2 góc nhìn:

1. **Góc nhìn theo sản phẩm cha**
   Dành cho quản lý tổng quan.

2. **Góc nhìn theo SKU**
   Dành cho thao tác chi tiết.

Ví dụ:

Góc nhìn sản phẩm cha:

* Áo thun nữ 2027: tổng tồn 150, 18 SKU, 3 SKU sắp hết, 1 SKU hết hàng.

Góc nhìn SKU:

* Áo thun nữ 2027 / Đen / S: tồn 20
* Áo thun nữ 2027 / Đen / M: tồn 0
* Áo thun nữ 2027 / Trắng / XL: tồn 5

Cả hai góc nhìn đều cần thiết.

---

## 4. Người dùng của module Kho hàng

### 4.1. Chủ cửa hàng / Admin

Nhu cầu:

* Biết tổng giá trị tồn kho.
* Biết sản phẩm nào sắp hết.
* Biết sản phẩm nào tồn quá nhiều.
* Xem lịch sử nhập/xuất/điều chỉnh.
* Kiểm soát ai điều chỉnh kho.
* Xem báo cáo tồn kho.

Quyền:

* Xem toàn bộ kho.
* Điều chỉnh kho.
* Nhập kho.
* Xuất kho thủ công.
* Xem lịch sử kho.
* Export tồn kho.
* Cấu hình ngưỡng tồn thấp.

---

### 4.2. Quản lý

Nhu cầu:

* Theo dõi hàng còn/hết.
* Kiểm tra hàng sắp hết để nhập thêm.
* Xem tồn theo sản phẩm/SKU.
* Xem lịch sử kho khi có sai lệch.
* Kiểm tra tồn trước khi bán hàng lớn.

Quyền:

* Xem kho.
* Có thể điều chỉnh kho nếu được phân quyền.
* Có thể nhập kho nếu được phân quyền.
* Xem lịch sử kho.

---

### 4.3. Nhân viên kho

Nhu cầu:

* Nhập kho.
* Điều chỉnh kho sau kiểm hàng.
* Xem danh sách SKU.
* Xem tồn thấp.
* Xem lịch sử biến động.
* Xử lý hàng hoàn/hàng lỗi.

Quyền:

* Xem sản phẩm/SKU.
* Xem tồn kho.
* Nhập kho.
* Điều chỉnh kho.
* Không cần xem doanh thu/lợi nhuận nếu không được phân quyền.

---

### 4.4. Nhân viên bán hàng

Nhu cầu:

* Xem SKU còn hay hết.
* Tìm SKU để bán.
* Biết tồn kho khả dụng.
* Không cần điều chỉnh kho.

Quyền:

* Xem tồn kho khả dụng.
* Không được điều chỉnh kho nếu không được phân quyền.
* Không được sửa lịch sử kho.

---

## 5. Cấu trúc module Kho hàng

Module Kho hàng nên có các màn hình chính:

1. Tổng quan kho.
2. Tồn kho theo sản phẩm cha.
3. Tồn kho theo SKU.
4. Nhập kho hàng loạt.
5. Điều chỉnh kho.
6. Lịch sử kho.
7. Cảnh báo tồn thấp.
8. Kiểm kho, có thể để sau MVP.
9. Import/export tồn kho, có thể để sau MVP.

---

## 6. Màn hình Tổng quan kho

### 6.1. Mục tiêu

Giúp người dùng nắm nhanh tình trạng kho.

### 6.2. Chỉ số nên hiển thị

* Tổng số sản phẩm cha.
* Tổng số SKU.
* Tổng số lượng tồn kho.
* Số SKU hết hàng.
* Số SKU sắp hết hàng.
* Số sản phẩm có SKU sắp hết.
* Số giao dịch kho hôm nay.
* Tổng giá trị tồn kho, nếu người dùng có quyền xem giá nhập.

### 6.3. Danh sách nhanh

Nên có các khu vực:

* SKU sắp hết hàng.
* SKU hết hàng.
* Biến động kho gần đây.
* Sản phẩm có tổng tồn thấp.
* Sản phẩm tồn nhiều, có thể làm sau.

MVP có thể đơn giản, nhưng nên có ít nhất:

* SKU sắp hết.
* SKU hết hàng.
* Giao dịch kho gần đây.

---

## 7. Màn hình Tồn kho theo sản phẩm cha

### 7.1. Mục tiêu

Giúp quản lý xem tổng quan tồn kho theo từng sản phẩm.

### 7.2. Cột hiển thị

* Tên sản phẩm.
* Danh mục.
* Thương hiệu.
* Số SKU.
* Tổng tồn.
* Số SKU hết hàng.
* Số SKU sắp hết.
* Trạng thái sản phẩm.
* Hành động.

### 7.3. Hành động

Mỗi sản phẩm cha có:

* Mở rộng xem SKU.
* Xem chi tiết sản phẩm.
* Nhập kho hàng loạt.
* Điều chỉnh hàng loạt.
* Xem lịch sử kho của sản phẩm.

### 7.4. Mở rộng SKU con

Khi mở rộng sản phẩm cha, hiển thị:

* SKU.
* Tên biến thể.
* Tồn hiện tại.
* Ngưỡng tồn thấp.
* Trạng thái cảnh báo.
* Hành động điều chỉnh.

Ví dụ:

Áo thun nữ 2027
Tổng tồn: 150 | SKU: 18 | Sắp hết: 3 | Hết hàng: 1

SKU con:

* Đen / S | AO-THUN-NU-2027-DEN-S | Tồn: 20 | Bình thường
* Đen / M | AO-THUN-NU-2027-DEN-M | Tồn: 0 | Hết hàng
* Trắng / XL | AO-THUN-NU-2027-TRANG-XL | Tồn: 3 | Sắp hết

---

## 8. Màn hình Tồn kho theo SKU

### 8.1. Mục tiêu

Giúp thao tác chính xác theo từng SKU.

### 8.2. Cột hiển thị

* SKU.
* Tên sản phẩm cha.
* Biến thể.
* Danh mục.
* Thương hiệu.
* Tồn hiện tại.
* Ngưỡng tồn thấp.
* Trạng thái tồn.
* Giá trị tồn, nếu có quyền.
* Trạng thái SKU.
* Hành động.

### 8.3. Trạng thái tồn

Trạng thái tồn nên tính tự động:

* Hết hàng: quantity = 0.
* Sắp hết: quantity > 0 và quantity <= low_stock_threshold.
* Bình thường: quantity > low_stock_threshold.

### 8.4. Hành động từng SKU

* Điều chỉnh kho.
* Nhập thêm.
* Đặt lại tồn.
* Xem lịch sử.
* Mở chi tiết sản phẩm.
* Mở chi tiết SKU.

### 8.5. Tìm kiếm và lọc

Tìm kiếm:

* SKU.
* Tên sản phẩm.
* Biến thể.
* Giá trị biến thể.
* Barcode.

Bộ lọc:

* Danh mục.
* Thương hiệu.
* Trạng thái tồn: hết hàng, sắp hết, bình thường.
* Trạng thái SKU: đang bán, ngừng bán.
* Sản phẩm cha.
* Kho, nếu sau này có nhiều kho.

MVP nên có:

* Tìm kiếm.
* Lọc tồn thấp.
* Lọc hết hàng.
* Lọc theo sản phẩm/danh mục.

---

## 9. Nhập kho

### 9.1. Mục tiêu

Nhập kho dùng khi cửa hàng nhập thêm hàng mới.

Nhập kho phải hỗ trợ cả:

* Nhập một SKU.
* Nhập hàng loạt nhiều SKU của cùng sản phẩm cha.

### 9.2. Nhập kho một SKU

Form gồm:

* SKU.
* Tên sản phẩm.
* Biến thể.
* Tồn hiện tại.
* Số lượng nhập thêm.
* Lý do.
* Ghi chú.
* Ngày nhập.
* Người nhập.

Quy tắc:

* Số lượng nhập thêm phải > 0.
* Lý do bắt buộc.
* Sau khi lưu:

  * Tăng InventoryItem.quantity.
  * Tạo InventoryTransaction loại import.
  * Ghi quantity_before, quantity_changed, quantity_after.

Ví dụ:

Tồn trước: 5
Nhập thêm: 10
Tồn sau: 15

---

### 9.3. Nhập kho hàng loạt theo sản phẩm cha

Đây là chức năng quan trọng để thao tác nhanh.

Luồng:

1. Người dùng vào Kho hàng.
2. Chọn “Nhập kho hàng loạt”.
3. Chọn sản phẩm cha.
4. Hệ thống hiển thị tất cả SKU con.
5. Người dùng nhập số lượng nhập thêm cho từng SKU.
6. Nhập lý do chung.
7. Nhập ghi chú nếu có.
8. Bấm lưu.
9. Hệ thống cập nhật từng SKU.
10. Hệ thống tạo transaction cho từng SKU có số lượng nhập > 0.

Bảng nhập kho hàng loạt:

* SKU.
* Biến thể.
* Tồn hiện tại.
* Số lượng nhập thêm.
* Tồn sau dự kiến.

Ví dụ:

* Đen / S | Tồn 5 | Nhập thêm 10 | Sau nhập 15
* Đen / M | Tồn 2 | Nhập thêm 20 | Sau nhập 22
* Trắng / L | Tồn 0 | Nhập thêm 5 | Sau nhập 5

Quy tắc:

* SKU nào nhập 0 thì có thể bỏ qua, không tạo transaction.
* Không cho số lượng âm.
* Cần ít nhất một SKU có số lượng nhập > 0.
* Lý do chung bắt buộc.
* Có thể có ghi chú riêng từng dòng sau này, MVP chưa cần.

Thông báo lỗi:

“Vui lòng nhập số lượng nhập kho cho ít nhất một SKU.”
“Số lượng nhập kho không được âm.”
“Vui lòng nhập lý do nhập kho.”

---

## 10. Điều chỉnh kho

### 10.1. Mục tiêu

Điều chỉnh kho dùng khi cần sửa số lượng tồn do kiểm kê, hàng lỗi, hàng mất, sai lệch dữ liệu.

Không nên chỉnh trực tiếp quantity trong bảng. Mọi thay đổi phải qua thao tác điều chỉnh để có lịch sử.

### 10.2. Các loại điều chỉnh

1. Tăng tồn.
2. Giảm tồn.
3. Đặt lại tồn.

### 10.3. Điều chỉnh một SKU

Form gồm:

* SKU.
* Tên sản phẩm.
* Biến thể.
* Tồn hiện tại.
* Loại điều chỉnh.
* Số lượng.
* Tồn sau dự kiến.
* Lý do.
* Ghi chú.

Quy tắc:

Nếu tăng tồn:

* quantity_after = quantity_before + quantity.

Nếu giảm tồn:

* quantity_after = quantity_before - quantity.
* Không cho quantity_after < 0.

Nếu đặt lại tồn:

* quantity_after = quantity nhập vào.
* quantity nhập vào phải >= 0.
* quantity_changed = quantity_after - quantity_before.

Ví dụ đặt lại:

Tồn trước: 12
Đặt lại: 8
quantity_changed = -4
Tồn sau: 8

### 10.4. Điều chỉnh kho hàng loạt

Điều chỉnh hàng loạt giúp xử lý nhiều SKU cùng lúc.

Luồng:

1. Chọn sản phẩm cha hoặc lọc danh sách SKU.
2. Chọn nhiều SKU.
3. Chọn loại điều chỉnh:

   * Tăng tồn.
   * Giảm tồn.
   * Đặt lại tồn.
4. Nhập số lượng từng dòng.
5. Nhập lý do chung.
6. Xem tồn sau dự kiến.
7. Lưu.
8. Hệ thống tạo transaction cho từng SKU.

Bảng điều chỉnh:

* SKU.
* Biến thể.
* Tồn hiện tại.
* Loại điều chỉnh.
* Số lượng.
* Tồn sau dự kiến.

MVP có thể làm trước batch theo một sản phẩm cha, vì đây là nhu cầu thực tế nhất.

---

## 11. Lịch sử kho

### 11.1. Mục tiêu

Lịch sử kho giúp truy vết mọi biến động tồn kho.

Câu hỏi cần trả lời được:

* Vì sao SKU này giảm tồn?
* Ai đã điều chỉnh?
* Điều chỉnh lúc nào?
* Tồn trước là bao nhiêu?
* Tồn sau là bao nhiêu?
* Có liên quan đến đơn hàng nào không?
* Có liên quan đến hoàn hàng không?

### 11.2. Màn hình lịch sử kho

Cột:

* Thời gian.
* SKU.
* Sản phẩm.
* Biến thể.
* Loại giao dịch.
* Số lượng trước.
* Số lượng thay đổi.
* Số lượng sau.
* Lý do.
* Người thực hiện.
* Tham chiếu, ví dụ mã đơn hàng.
* Ghi chú.

### 11.3. Bộ lọc lịch sử kho

* SKU.
* Sản phẩm cha.
* Loại giao dịch.
* Người thực hiện.
* Khoảng thời gian.
* Đơn hàng liên quan.
* Tăng tồn / giảm tồn.

### 11.4. Loại giao dịch kho

Các loại transaction:

* initial: tồn kho ban đầu khi tạo SKU.
* import: nhập kho.
* export: xuất kho thủ công.
* adjustment_increase: điều chỉnh tăng.
* adjustment_decrease: điều chỉnh giảm.
* set: đặt lại tồn.
* order_confirmed: trừ kho do xác nhận đơn.
* order_cancelled: hoàn kho do hủy đơn.
* return: hoàn kho do hoàn hàng.
* correction: sửa lỗi dữ liệu, nếu cần sau này.

MVP cần ít nhất:

* initial.
* import.
* adjustment_increase.
* adjustment_decrease.
* set.
* order_confirmed.
* order_cancelled.

---

## 12. Cảnh báo tồn thấp

### 12.1. Mục tiêu

Giúp người dùng biết SKU nào cần nhập thêm hàng.

### 12.2. Ngưỡng tồn thấp

Mỗi SKU có low_stock_threshold.

Ví dụ:

* Áo thun bán nhanh: ngưỡng 10.
* Sách bán chậm: ngưỡng 3.
* Sản phẩm đắt tiền: ngưỡng 1.

Nếu quantity <= low_stock_threshold và quantity > 0 thì là sắp hết.

Nếu quantity = 0 thì là hết hàng.

### 12.3. Màn hình cảnh báo

Hiển thị:

* SKU.
* Sản phẩm.
* Biến thể.
* Tồn hiện tại.
* Ngưỡng cảnh báo.
* Trạng thái: sắp hết/hết hàng.
* Nút nhập kho.

### 12.4. Cảnh báo trong sản phẩm và đơn hàng

Trong trang sản phẩm:

* SKU sắp hết cần có nhãn cảnh báo.

Trong tạo đơn hàng:

* Nếu SKU sắp hết, hiển thị cảnh báo nhẹ.
* Nếu SKU hết hàng hoặc không đủ số lượng, chặn hoặc cảnh báo theo cấu hình.

MVP nên chặn bán vượt tồn.

---

## 13. Kho và đơn hàng

### 13.1. Nguyên tắc

Đơn hàng không được tự ý sửa tồn kho trực tiếp. Phải thông qua transaction.

Khi đơn hàng được xác nhận:

* Hệ thống kiểm tra tồn kho từng SKU.
* Nếu đủ tồn, trừ kho.
* Tạo inventory_transaction loại order_confirmed cho từng SKU.
* Gắn reference_type = order.
* Gắn reference_id = order_id.

Khi đơn hàng bị hủy sau khi đã trừ kho:

* Hệ thống hoàn kho.
* Tạo transaction loại order_cancelled.
* Không hoàn kho lần 2 nếu đơn đã từng hoàn kho.

### 13.2. Chống trừ kho nhiều lần

Đơn hàng cần có trạng thái hoặc cờ để biết đã trừ kho chưa.

Ví dụ:

* inventory_deducted = true/false.
* inventory_deducted_at.
* inventory_restored_at.

Nếu đơn đã trừ kho rồi, chuyển trạng thái qua lại không được trừ lần nữa.

Đây là lỗi rất nguy hiểm cần phòng tránh.

### 13.3. Kiểm tra tồn khi sửa đơn

Sau này khi sửa đơn hàng đã xác nhận:

* Nếu tăng số lượng, cần kiểm tra tồn.
* Nếu giảm số lượng, cần hoàn lại phần chênh.
* Nếu đổi SKU, cần hoàn SKU cũ và trừ SKU mới.

MVP có thể giới hạn:

* Đơn đã xác nhận không cho sửa dòng sản phẩm, chỉ cho hủy/hoàn.
* Sửa đơn nâng cao để sau.

---

## 14. Kiểm kho

### 14.1. Mục tiêu

Kiểm kho dùng để so sánh tồn thực tế với tồn hệ thống.

MVP chưa bắt buộc, nhưng nên thiết kế trước.

### 14.2. Luồng kiểm kho tương lai

1. Tạo phiên kiểm kho.
2. Chọn phạm vi: toàn bộ kho, danh mục, sản phẩm cha, SKU.
3. Nhập số lượng thực tế.
4. Hệ thống so sánh với tồn hệ thống.
5. Hiển thị chênh lệch.
6. Người dùng xác nhận điều chỉnh.
7. Hệ thống tạo transaction loại stocktake_adjustment.

### 14.3. MVP

MVP có thể chưa làm kiểm kho riêng, vì điều chỉnh kho đã đủ cho giai đoạn đầu.

---

## 15. Nhiều kho / nhiều chi nhánh

### 15.1. MVP chỉ cần một kho mặc định

Để đơn giản, MVP nên có một kho mặc định.

Tên có thể là:

* Kho mặc định.
* Kho chính.

### 15.2. Chuẩn bị mở rộng nhiều kho

Dữ liệu nên cân nhắc khả năng mở rộng sau này:

* warehouses.
* inventory_items có warehouse_id.
* inventory_transactions có warehouse_id.
* chuyển kho.

Nhưng nếu làm ngay từ đầu sẽ phức tạp hơn.

Đề xuất:

MVP có thể chưa hiển thị nhiều kho, nhưng trong database có thể thiết kế sẵn warehouse_id nullable hoặc default warehouse nếu muốn mở rộng.

Nếu muốn giữ MVP cực gọn, có thể bỏ warehouse_id trước, sau này migrate. Tuy nhiên với phần mềm bán hàng lâu dài, nên cân nhắc thêm warehouse_id mặc định ngay từ đầu để dễ mở rộng.

---

## 16. Dữ liệu lõi

### 16.1. Bảng inventory_items

Mục đích:

Lưu tồn kho hiện tại của mỗi SKU.

Trường đề xuất:

* id.
* product_variant_id.
* warehouse_id, tùy chọn cho tương lai.
* quantity.
* created_at.
* updated_at.

Quy tắc:

* product_variant_id là bắt buộc.
* Mỗi product_variant_id có một inventory_item trong MVP một kho.
* quantity >= 0.
* Không được có tồn âm.
* Không sửa quantity trực tiếp ngoài service kho.

---

### 16.2. Bảng inventory_transactions

Mục đích:

Lưu lịch sử thay đổi kho.

Trường đề xuất:

* id.
* product_variant_id.
* warehouse_id, tùy chọn.
* transaction_type.
* quantity_before.
* quantity_changed.
* quantity_after.
* reason.
* note.
* reference_type.
* reference_id.
* created_by.
* created_at.

Giải thích:

* quantity_before: tồn trước giao dịch.
* quantity_changed: số lượng thay đổi, có thể dương hoặc âm.
* quantity_after: tồn sau giao dịch.
* reference_type: ví dụ order, manual, stocktake.
* reference_id: id tham chiếu nếu có.
* reason: lý do nghiệp vụ.
* note: ghi chú thêm.

---

### 16.3. Bảng warehouses, tùy chọn

Nếu chuẩn bị nhiều kho:

* id.
* name.
* code.
* address.
* status.
* created_at.
* updated_at.

MVP có thể tạo một record:

* Kho mặc định.

Nếu chưa muốn làm nhiều kho, có thể để sau.

---

### 16.4. Liên kết với product_variants

InventoryItem liên kết với ProductVariant.

ProductVariant gồm:

* sku.
* product_id.
* variant_name.
* low_stock_threshold.
* status.

InventoryItem không nên lưu lại tên sản phẩm/SKU, vì có thể lấy qua join. Tuy nhiên API response có thể trả kèm để frontend dễ dùng.

---

## 17. API đề xuất

### 17.1. Inventory Summary API

GET /inventory/summary

Mục đích:

Lấy chỉ số tổng quan kho.

Response:

* total_products.
* total_variants.
* total_quantity.
* low_stock_variant_count.
* out_of_stock_variant_count.
* today_transaction_count.
* total_inventory_value, nếu có quyền.

---

### 17.2. Inventory by Product API

GET /inventory/products

Mục đích:

Lấy tồn kho tổng hợp theo sản phẩm cha.

Query:

* search.
* category_id.
* brand.
* stock_status.
* page.
* page_size.

Response mỗi dòng:

* product_id.
* product_name.
* category.
* brand.
* variant_count.
* total_quantity.
* low_stock_variant_count.
* out_of_stock_variant_count.
* status.

---

### 17.3. Inventory by SKU API

GET /inventory/variants

Mục đích:

Lấy tồn kho chi tiết theo SKU.

Query:

* search.
* product_id.
* category_id.
* brand.
* stock_status.
* status.
* page.
* page_size.

Response mỗi dòng:

* product_variant_id.
* sku.
* product_name.
* variant_name.
* option values.
* current_quantity.
* low_stock_threshold.
* stock_status.
* retail_price.
* sale_price.
* inventory_value, nếu có quyền.
* product_status.
* variant_status.

---

### 17.4. Inventory Detail API

GET /inventory/variants/{variant_id}

Mục đích:

Lấy chi tiết tồn kho của một SKU.

Response:

* SKU info.
* Product info.
* current_quantity.
* low_stock_threshold.
* stock_status.
* recent_transactions.

---

### 17.5. Adjust Inventory API

POST /inventory/variants/{variant_id}/adjust

Mục đích:

Điều chỉnh tồn kho một SKU.

Body:

* adjustment_type: increase | decrease | set.
* quantity.
* reason.
* note.

Quy tắc:

* increase: quantity > 0.
* decrease: quantity > 0 và không làm tồn âm.
* set: quantity >= 0.
* reason bắt buộc.
* Tạo transaction.

---

### 17.6. Bulk Import Inventory API

POST /inventory/products/{product_id}/bulk-import

Mục đích:

Nhập kho hàng loạt cho nhiều SKU của một sản phẩm cha.

Body:

* reason.
* note.
* items:

  * product_variant_id.
  * quantity.

Quy tắc:

* reason bắt buộc.
* Mỗi quantity >= 0.
* Chỉ xử lý item có quantity > 0.
* Cần ít nhất một item quantity > 0.
* Tất cả product_variant_id phải thuộc product_id.
* Tạo transaction import cho từng SKU.
* Nếu lỗi, rollback toàn bộ hoặc báo lỗi từng dòng tùy thiết kế. MVP nên rollback toàn bộ để dữ liệu nhất quán.

---

### 17.7. Bulk Adjust Inventory API

POST /inventory/bulk-adjust

Mục đích:

Điều chỉnh nhiều SKU cùng lúc.

Body:

* adjustment_type: increase | decrease | set.
* reason.
* note.
* items:

  * product_variant_id.
  * quantity.

Quy tắc:

* reason bắt buộc.
* quantity hợp lệ theo adjustment_type.
* Không cho SKU nào bị âm.
* Nếu bất kỳ dòng nào lỗi, không lưu toàn bộ để tránh sai lệch.
* Trả lỗi rõ SKU nào gây lỗi.

---

### 17.8. Inventory Transactions API

GET /inventory/transactions

Query:

* product_variant_id.
* product_id.
* transaction_type.
* created_by.
* date_from.
* date_to.
* reference_type.
* reference_id.
* page.
* page_size.

Response:

* transaction_id.
* created_at.
* sku.
* product_name.
* variant_name.
* transaction_type.
* quantity_before.
* quantity_changed.
* quantity_after.
* reason.
* note.
* created_by_name.
* reference_type.
* reference_id.

---

### 17.9. Low Stock API

GET /inventory/low-stock

Mục đích:

Lấy danh sách SKU sắp hết hoặc hết hàng.

Query:

* include_out_of_stock: true/false.
* category_id.
* brand.
* page.
* page_size.

Response:

* SKU.
* product_name.
* variant_name.
* current_quantity.
* low_stock_threshold.
* stock_status.

---

## 18. Validation

### 18.1. Quantity

* Không được là số âm.
* Với MVP, quantity nên là số nguyên.
* Không cho null.
* Không cho chuỗi không phải số.

Thông báo:

“Số lượng không hợp lệ.”
“Số lượng không được âm.”

### 18.2. Giảm tồn

Nếu giảm tồn làm quantity_after < 0:

Thông báo:

“Không thể giảm tồn kho vì số lượng sau điều chỉnh sẽ âm.”

### 18.3. Đặt lại tồn

* Số lượng đặt lại phải >= 0.

Thông báo:

“Tồn kho đặt lại không được âm.”

### 18.4. Lý do

Với thao tác thủ công:

* import.
* adjustment_increase.
* adjustment_decrease.
* set.
* export thủ công.

Lý do bắt buộc.

Thông báo:

“Vui lòng nhập lý do điều chỉnh kho.”

### 18.5. SKU không tồn tại

Nếu product_variant_id không tồn tại:

“Không tìm thấy SKU.”

### 18.6. SKU ngừng bán

Nếu SKU inactive, vẫn có thể điều chỉnh kho nhưng cần hiển thị cảnh báo.

Ví dụ:

“SKU này đang ngừng bán. Bạn vẫn muốn điều chỉnh kho?”

MVP có thể cho điều chỉnh, vì kho vẫn cần xử lý hàng tồn của SKU ngừng bán.

---

## 19. Quy tắc phân quyền

### 19.1. Admin

* Xem toàn bộ kho.
* Nhập kho.
* Điều chỉnh kho.
* Xem lịch sử.
* Export kho.
* Xem giá trị tồn kho.

### 19.2. Quản lý

* Xem toàn bộ kho.
* Nhập/điều chỉnh kho nếu được phân quyền.
* Xem lịch sử.
* Có thể xem giá trị tồn nếu được phép.

### 19.3. Nhân viên kho

* Xem kho.
* Nhập kho.
* Điều chỉnh kho.
* Xem lịch sử.
* Không cần xem giá trị tồn theo giá nhập nếu không được quyền.

### 19.4. Sale

* Chỉ xem tồn khả dụng.
* Không điều chỉnh kho.
* Không xem lịch sử kho chi tiết nếu không cần.

### 19.5. Kế toán

* Có thể xem tồn và giá trị tồn nếu được phân quyền.
* Không nhất thiết điều chỉnh kho.

---

## 20. UX/UI chi tiết

### 20.1. Nguyên tắc UI

* Tồn kho phải dễ nhìn.
* Cảnh báo hết hàng/sắp hết phải nổi bật.
* Không bắt người dùng sửa từng SKU nếu có thể sửa hàng loạt.
* Khi nhập số lượng, phải hiển thị tồn sau dự kiến.
* Mọi thao tác thay đổi kho cần xác nhận rõ.
* Không để người dùng chỉnh thẳng vào ô quantity rồi mất lịch sử.
* Hành động nguy hiểm cần xác nhận.

### 20.2. Màu/nhãn trạng thái tồn

Gợi ý:

* Bình thường.
* Sắp hết.
* Hết hàng.

Không cần quá nhiều màu, nhưng phải dễ nhận biết.

### 20.3. Form điều chỉnh kho

Form phải hiển thị rõ:

* Tồn hiện tại.
* Thay đổi bao nhiêu.
* Tồn sau sẽ là bao nhiêu.

Ví dụ:

Tồn hiện tại: 12
Giảm: 5
Tồn sau: 7

Nếu tồn sau âm, hiển thị lỗi ngay trước khi bấm lưu.

### 20.4. Nhập kho hàng loạt

Bảng nhập kho hàng loạt cần thao tác nhanh:

* Có thể tab qua các ô số lượng.
* Có nút áp dụng cùng số lượng cho tất cả SKU nếu cần.
* Có nút xóa nhanh các dòng nhập 0, hoặc tự bỏ qua dòng 0.
* Có tổng số lượng sẽ nhập.

Ví dụ:

Tổng số SKU nhập: 8
Tổng số lượng nhập thêm: 120

### 20.5. Sau khi lưu

Sau khi nhập/điều chỉnh kho:

* Hiển thị thông báo thành công.
* Cập nhật ngay tồn kho trên màn hình.
* Có link/nút xem lịch sử giao dịch vừa tạo.
* Không cần reload toàn trang nếu có thể.

---

## 21. Import / Export kho

### 21.1. Import tồn kho

MVP có thể chưa cần, nhưng nên thiết kế.

Import tồn kho từ Excel gồm:

* SKU.
* Số lượng.
* Kiểu thao tác: set/import.
* Lý do.
* Ghi chú.

Cần kiểm tra:

* SKU không tồn tại.
* Số lượng âm.
* Số lượng không phải số.
* Trùng SKU trong file.
* Thiếu lý do.

### 21.2. Export tồn kho

Export danh sách tồn kho gồm:

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

### 21.3. Export lịch sử kho

Export lịch sử giao dịch kho theo bộ lọc.

---

## 22. Báo cáo liên quan đến kho

Module Kho cần cung cấp dữ liệu cho báo cáo:

* Tồn kho hiện tại.
* SKU hết hàng.
* SKU sắp hết hàng.
* Giá trị tồn kho.
* Lịch sử nhập kho theo thời gian.
* Lịch sử xuất kho theo thời gian.
* Điều chỉnh kho theo người thực hiện.
* Sản phẩm tồn nhiều.
* Sản phẩm lâu chưa bán, sau khi có đơn hàng.
* Vòng quay tồn kho, làm sau MVP.

MVP nên có:

* Tồn kho thấp.
* Tồn kho hết.
* Lịch sử giao dịch.
* Tổng tồn theo sản phẩm.

---

## 23. Những lỗi/bug không được phép tồn tại

Các lỗi sau phải coi là nghiêm trọng:

1. Tạo SKU có tồn kho ban đầu nhưng kho hiển thị 0.
2. Điều chỉnh kho mà không tạo lịch sử.
3. Cho phép tồn kho âm trong MVP.
4. Nhập kho hàng loạt nhưng chỉ cập nhật một phần mà không báo lỗi.
5. Không kiểm tra SKU có thuộc sản phẩm cha khi nhập kho hàng loạt.
6. Trừ kho do đơn hàng nhiều lần cho cùng một đơn.
7. Hủy đơn hoàn kho nhiều lần.
8. Xóa SKU nhưng vẫn còn inventory_item không xử lý rõ.
9. Sửa trực tiếp quantity mà không có transaction.
10. Lịch sử kho không lưu quantity_before/after.
11. Lịch sử kho không lưu người thao tác.
12. Cảnh báo tồn thấp tính sai.
13. SKU inactive vẫn được bán mà không kiểm tra ở đơn hàng.
14. Tìm kiếm kho không ra SKU theo tên sản phẩm/biến thể.
15. Nhập số âm hoặc chữ vào số lượng mà vẫn lưu.

---

## 24. Tiêu chí hoàn thành MVP cho module Kho hàng

Module Kho hàng được coi là dùng được thật khi đạt các tiêu chí:

1. Mỗi SKU có một inventory_item.
2. Tồn kho ban đầu khi tạo SKU được lưu đúng.
3. Mọi thay đổi tồn kho tạo inventory_transaction.
4. Xem được kho theo sản phẩm cha.
5. Xem được kho theo SKU.
6. Tìm kiếm SKU trong kho.
7. Lọc SKU hết hàng.
8. Lọc SKU sắp hết hàng.
9. Nhập kho một SKU.
10. Nhập kho hàng loạt theo sản phẩm cha.
11. Điều chỉnh tăng tồn.
12. Điều chỉnh giảm tồn.
13. Đặt lại tồn.
14. Chặn tồn kho âm.
15. Xem lịch sử kho.
16. Lịch sử kho có số lượng trước/sau, lý do, người thao tác.
17. Cảnh báo tồn thấp đúng.
18. Chuẩn bị sẵn logic để đơn hàng trừ kho và hoàn kho.

---

## 25. Roadmap triển khai module Kho hàng

### Sprint INVENTORY-1: Nền tảng tồn kho theo SKU

Mục tiêu:

* Mỗi SKU có inventory_item.
* Tồn kho ban đầu khi tạo SKU lưu đúng.
* API xem tồn kho theo SKU.
* API xem tồn kho theo sản phẩm cha.

Phạm vi:

* inventory_items.
* inventory summary.
* inventory list by product.
* inventory list by SKU.

---

### Sprint INVENTORY-2: Lịch sử kho

Mục tiêu:

* Tạo inventory_transactions.
* Lưu quantity_before/changed/after.
* Lưu reason, note, created_by.
* Xem lịch sử kho.

Phạm vi:

* transaction model.
* transaction service.
* transaction list UI.

---

### Sprint INVENTORY-3: Nhập kho

Mục tiêu:

* Nhập kho một SKU.
* Nhập kho hàng loạt theo sản phẩm cha.
* Cập nhật tồn đúng.
* Tạo transaction import.

Phạm vi:

* import form.
* bulk import UI.
* bulk import API.

---

### Sprint INVENTORY-4: Điều chỉnh kho

Mục tiêu:

* Tăng tồn.
* Giảm tồn.
* Đặt lại tồn.
* Chặn tồn âm.
* Điều chỉnh hàng loạt.

Phạm vi:

* adjust API.
* bulk adjust API.
* adjust UI.

---

### Sprint INVENTORY-5: Cảnh báo tồn thấp

Mục tiêu:

* Tính stock_status.
* Lọc sắp hết/hết hàng.
* Màn hình tồn thấp.
* Cảnh báo trong sản phẩm/SKU.

Phạm vi:

* low stock query.
* low stock UI.
* badges/warnings.

---

### Sprint INVENTORY-6: Chuẩn bị tích hợp đơn hàng

Mục tiêu:

* Service trừ kho theo order.
* Service hoàn kho theo order.
* Chống trừ/hoàn nhiều lần.
* Chuẩn bị API/service cho module Order.

Phạm vi:

* deduct_inventory_for_order.
* restore_inventory_for_order.
* idempotency rules.
* tests.

---

## 26. Kết luận

Module Kho hàng phải được thiết kế cẩn thận vì nó ảnh hưởng trực tiếp đến khả năng bán hàng thật.

Điểm cốt lõi:

* Kho quản lý theo SKU, không theo sản phẩm cha.
* Tồn hiện tại và lịch sử kho phải tách riêng.
* Mọi thay đổi kho phải có transaction.
* Không cho tồn âm trong MVP.
* Nhập kho và điều chỉnh kho phải hỗ trợ hàng loạt.
* Phải có góc nhìn theo sản phẩm cha và theo SKU.
* Phải có cảnh báo tồn thấp.
* Phải chuẩn bị logic trừ kho/hoàn kho cho đơn hàng.

Một phần mềm bán hàng có thể giao diện đơn giản, nhưng kho hàng không được hời hợt. Nếu kho sai, người dùng sẽ mất niềm tin vào toàn bộ hệ thống.
