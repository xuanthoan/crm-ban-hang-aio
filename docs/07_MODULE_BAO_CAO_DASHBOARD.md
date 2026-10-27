# ĐẶC TẢ MODULE CHI TIẾT

# Module Báo cáo / Dashboard

# Dự án: CRM_Ban_Hang

## 1. Mục tiêu của module Báo cáo / Dashboard

Module Báo cáo / Dashboard dùng để tổng hợp dữ liệu từ toàn bộ hệ thống và trình bày thành các chỉ số dễ hiểu, giúp chủ cửa hàng, quản lý và nhân viên biết tình hình kinh doanh hiện tại.

Mục tiêu không phải là làm thật nhiều biểu đồ phức tạp, mà là trả lời được các câu hỏi quan trọng:

* Hôm nay bán được bao nhiêu tiền?
* Tháng này doanh thu bao nhiêu?
* Có bao nhiêu đơn hàng?
* Đơn nào chưa xử lý?
* Đơn nào còn nợ?
* Tổng công nợ là bao nhiêu?
* Sản phẩm nào bán chạy?
* SKU nào sắp hết hàng?
* SKU nào hết hàng?
* Khách hàng nào mua nhiều?
* Khách nào lâu chưa mua lại?
* Khách nào cần chăm sóc hôm nay?
* Nhân viên nào bán tốt?
* Nguồn khách nào tạo doanh thu tốt?
* Tiền thực thu là bao nhiêu?
* Hàng tồn kho có giá trị khoảng bao nhiêu?

Nguyên tắc quan trọng:

**Dashboard không chỉ để xem cho đẹp. Dashboard phải giúp người dùng ra quyết định và hành động.**

Ví dụ:

* Thấy SKU sắp hết → nhập kho.
* Thấy khách lâu chưa mua → chăm sóc lại.
* Thấy công nợ cao → nhắc thanh toán.
* Thấy nguồn khách Facebook tạo doanh thu tốt → tập trung khai thác.
* Thấy sản phẩm bán chạy → nhập thêm hàng.
* Thấy đơn hủy nhiều → kiểm tra quy trình bán hàng.

---

## 2. Vai trò của Dashboard trong toàn hệ thống

Dashboard lấy dữ liệu từ các module:

* Khách hàng.
* Chăm sóc khách hàng.
* Sản phẩm/SKU.
* Kho hàng.
* Đơn hàng.
* Thanh toán/Công nợ.
* Remarketing.
* Người dùng/Nhân viên.
* Nguồn khách.

Dashboard không phải nơi nhập dữ liệu chính, mà là nơi tổng hợp và điều hướng hành động.

Ví dụ:

* Bấm vào chỉ số “SKU sắp hết hàng” → mở danh sách tồn thấp.
* Bấm vào “Đơn còn nợ” → mở danh sách công nợ.
* Bấm vào “Khách cần chăm sóc hôm nay” → mở danh sách nhắc việc.
* Bấm vào “Sản phẩm bán chạy” → mở báo cáo sản phẩm.
* Bấm vào “Doanh thu theo nguồn” → mở báo cáo nguồn khách.

Dashboard tốt phải giúp người dùng đi từ “thấy vấn đề” sang “xử lý vấn đề” nhanh.

---

## 3. Người dùng của module Báo cáo / Dashboard

### 3.1. Chủ cửa hàng / Admin

Nhu cầu:

* Xem tổng quan toàn bộ hoạt động kinh doanh.
* Xem doanh thu.
* Xem tiền đã thu.
* Xem công nợ.
* Xem đơn hàng.
* Xem sản phẩm bán chạy.
* Xem hàng tồn kho.
* Xem nhân viên bán hàng.
* Xem nguồn khách.
* Xem khách hàng giá trị cao.
* Xem việc chăm sóc khách hàng.

Quyền:

* Xem toàn bộ dashboard.
* Xem báo cáo tài chính.
* Xem giá trị tồn kho.
* Xem giá nhập/lãi gộp nếu có.
* Export báo cáo.

---

### 3.2. Quản lý bán hàng

Nhu cầu:

* Xem doanh thu của đội.
* Xem đơn hàng đang xử lý.
* Xem sale nào có nhiều đơn.
* Xem khách chưa chăm sóc.
* Xem công nợ trong phạm vi.
* Xem nguồn khách hiệu quả.
* Xem sản phẩm bán chạy.

Quyền:

* Xem dashboard trong phạm vi được phân quyền.
* Có thể không xem lợi nhuận/giá nhập nếu không được phép.
* Xem báo cáo theo nhân viên trong đội.

---

### 3.3. Nhân viên bán hàng

Nhu cầu:

* Xem việc cần làm hôm nay.
* Xem khách cần chăm sóc.
* Xem đơn hàng của mình.
* Xem doanh số cá nhân nếu được phép.
* Xem khách còn nợ do mình phụ trách.
* Xem khách sinh nhật.
* Xem khách lâu chưa mua.

Quyền:

* Xem dashboard cá nhân.
* Không xem toàn bộ doanh thu/công nợ hệ thống nếu không được phân quyền.
* Không xem giá nhập/lợi nhuận.

---

### 3.4. Nhân viên kho

Nhu cầu:

* Xem SKU hết hàng.
* Xem SKU sắp hết hàng.
* Xem giao dịch kho gần đây.
* Xem đơn cần đóng gói/xuất hàng.
* Xem tồn kho theo sản phẩm/SKU.

Quyền:

* Xem dashboard kho.
* Không xem doanh thu/lợi nhuận nếu không được phân quyền.

---

### 3.5. Kế toán / Thu ngân

Nhu cầu:

* Xem tiền thu hôm nay.
* Xem thanh toán theo phương thức.
* Xem công nợ.
* Xem đơn chưa thanh toán.
* Xem khách nợ nhiều.
* Xem lịch sử thanh toán.

Quyền:

* Xem dashboard thanh toán/công nợ.
* Không nhất thiết xem báo cáo sản phẩm/kho nếu không được phân quyền.

---

## 4. Cấu trúc module Dashboard / Báo cáo

Module nên chia thành 2 phần:

1. **Dashboard tổng quan**

   * Màn hình chính, hiển thị các chỉ số quan trọng nhất.

2. **Báo cáo chi tiết**

   * Báo cáo bán hàng.
   * Báo cáo đơn hàng.
   * Báo cáo thanh toán/công nợ.
   * Báo cáo sản phẩm/SKU.
   * Báo cáo kho hàng.
   * Báo cáo khách hàng.
   * Báo cáo chăm sóc khách hàng.
   * Báo cáo nguồn khách.
   * Báo cáo nhân viên.

MVP không cần làm tất cả báo cáo nâng cao ngay, nhưng cần có cấu trúc rõ để mở rộng.

---

## 5. Dashboard tổng quan

### 5.1. Mục tiêu

Dashboard tổng quan là màn hình đầu tiên sau khi đăng nhập.

Nó cần trả lời nhanh:

* Hôm nay cửa hàng đang thế nào?
* Có vấn đề gì cần xử lý ngay?
* Có cơ hội gì cần hành động?
* Tiền, đơn, kho, khách, công nợ đang ra sao?

### 5.2. Bộ lọc thời gian

Dashboard cần có bộ lọc:

* Hôm nay.
* Hôm qua.
* 7 ngày gần nhất.
* Tháng này.
* Tháng trước.
* Tùy chọn khoảng ngày.

MVP nên có:

* Hôm nay.
* 7 ngày.
* Tháng này.
* Tùy chọn khoảng ngày.

### 5.3. Bộ lọc phạm vi

Tùy quyền, dashboard có thể lọc theo:

* Nhân viên bán hàng.
* Nguồn khách.
* Danh mục sản phẩm.
* Trạng thái đơn.
* Kho, nếu sau này có nhiều kho.

MVP có thể làm trước:

* Theo nhân viên.
* Theo nguồn đơn.
* Theo thời gian.

### 5.4. Nhóm chỉ số chính trên Dashboard

Dashboard nên có các nhóm:

1. Bán hàng.
2. Thanh toán/Công nợ.
3. Kho hàng.
4. Khách hàng/CRM.
5. Chăm sóc/Nhắc việc.
6. Cảnh báo cần xử lý.

---

## 6. Nhóm chỉ số bán hàng

### 6.1. Chỉ số chính

Các chỉ số nên có:

* Doanh thu đơn hàng.
* Số đơn hàng.
* Giá trị đơn trung bình.
* Số đơn hoàn thành.
* Số đơn đã xác nhận.
* Số đơn hủy.
* Tỷ lệ đơn hủy.
* Doanh thu theo nguồn.
* Doanh thu theo nhân viên.

### 6.2. Giải thích chỉ số

Doanh thu đơn hàng:

* Tổng `grand_total` của các đơn trong khoảng thời gian.
* Cần quyết định lấy theo đơn nào:

  * confirmed.
  * completed.
  * hoặc tất cả trừ cancelled.

Đề xuất MVP:

* Doanh thu chính tính theo đơn completed hoặc confirmed + completed.
* Không tính đơn draft.
* Không tính đơn cancelled.
* Đơn returned cần trừ hoặc tách riêng, nếu đã có hoàn hàng.

Số đơn hàng:

* Số đơn được tạo trong khoảng thời gian.
* Có thể tách theo trạng thái.

Giá trị đơn trung bình:

* Doanh thu / số đơn hợp lệ.

Tỷ lệ đơn hủy:

* Số đơn hủy / tổng số đơn tạo.

### 6.3. Biểu đồ bán hàng

MVP nên có biểu đồ đơn giản:

* Doanh thu theo ngày.
* Số đơn theo ngày.
* Doanh thu theo nguồn.
* Doanh thu theo nhân viên.

Không cần quá nhiều biểu đồ ban đầu.

---

## 7. Nhóm chỉ số thanh toán / công nợ

### 7.1. Chỉ số chính

* Tiền đã thu.
* Tiền đã thu hôm nay.
* Tiền thu theo phương thức.
* Tổng công nợ hiện tại.
* Số đơn còn nợ.
* Số khách còn nợ.
* Công nợ quá hạn.
* Khách nợ nhiều nhất.
* Đơn nợ lâu nhất.

### 7.2. Phân biệt doanh thu và tiền thu

Dashboard phải phân biệt rõ:

* Doanh thu đơn hàng: giá trị đơn bán.
* Tiền đã thu: số tiền thực tế đã thanh toán.
* Công nợ: phần chưa thu.

Ví dụ:

Tháng này:

* Doanh thu đơn hàng: 100.000.000.
* Tiền đã thu: 80.000.000.
* Công nợ còn lại: 20.000.000.

Nếu không phân biệt, chủ cửa hàng có thể tưởng đã thu đủ tiền trong khi thực tế còn nợ.

### 7.3. Biểu đồ thanh toán

MVP nên có:

* Tiền thu theo ngày.
* Tiền thu theo phương thức.
* Công nợ theo khách hàng, dạng bảng.

### 7.4. Hành động nhanh

Từ dashboard:

* Bấm “Công nợ” → mở danh sách công nợ.
* Bấm “Khách nợ nhiều” → mở hồ sơ khách.
* Bấm “Đơn còn nợ” → mở đơn hàng.

---

## 8. Nhóm chỉ số kho hàng

### 8.1. Chỉ số chính

* Tổng số SKU.
* Tổng số lượng tồn kho.
* SKU hết hàng.
* SKU sắp hết hàng.
* Sản phẩm có SKU sắp hết.
* Tổng giá trị tồn kho, nếu có quyền xem giá nhập.
* Giao dịch kho hôm nay.
* Sản phẩm tồn nhiều, có thể làm sau.
* Sản phẩm lâu chưa bán, có thể làm sau khi có đủ đơn hàng.

### 8.2. Cảnh báo kho

Dashboard cần hiển thị rõ:

* Danh sách SKU hết hàng.
* Danh sách SKU sắp hết hàng.
* Nút nhập kho nhanh.

Ví dụ:

SKU sắp hết:

* AO-THUN-NU-2027-DEN-S | Tồn 2 | Ngưỡng 5.
* BALO-XANH-20L | Tồn 1 | Ngưỡng 3.

### 8.3. Giá trị tồn kho

Nếu người dùng có quyền xem giá nhập:

Giá trị tồn kho = tổng quantity × import_price của từng SKU.

MVP có thể tính đơn giản theo giá nhập hiện tại của SKU.

Lưu ý:

* Đây là ước tính, không phải kế toán chuẩn.
* Nếu giá nhập thay đổi theo từng lần nhập, sau này cần tính phức tạp hơn.

### 8.4. Hành động nhanh

* Bấm SKU sắp hết → mở SKU hoặc nhập kho.
* Bấm sản phẩm → mở chi tiết sản phẩm.
* Bấm kho → mở màn hình tồn kho.

---

## 9. Nhóm chỉ số khách hàng / CRM

### 9.1. Chỉ số chính

* Khách hàng mới.
* Tổng số khách hàng.
* Khách đã mua.
* Khách chưa mua.
* Khách mua nhiều.
* Khách lâu chưa mua lại.
* Khách theo nguồn.
* Khách theo tag.
* Khách sinh nhật tháng này.
* Khách có công nợ.

### 9.2. Khách hàng mới

Tính theo ngày tạo khách trong khoảng thời gian.

Ví dụ:

* Hôm nay có 15 khách mới.
* Tháng này có 320 khách mới.

### 9.3. Khách đã mua / chưa mua

Sau khi có đơn hàng:

* Khách đã mua: có ít nhất một đơn completed/confirmed.
* Khách chưa mua: chưa có đơn hợp lệ.

### 9.4. Khách lâu chưa mua lại

Điều kiện:

* Khách đã từng mua.
* last_order_at trước X ngày.

MVP có thể dùng mặc định:

* 30 ngày.
* 60 ngày.
* 90 ngày.

### 9.5. Khách sinh nhật

Dựa vào `birthday`.

Hiển thị:

* Sinh nhật hôm nay.
* Sinh nhật trong 7 ngày tới.
* Sinh nhật tháng này.

---

## 10. Nhóm chỉ số chăm sóc / nhắc việc

### 10.1. Chỉ số chính

* Việc cần làm hôm nay.
* Việc quá hạn.
* Việc sắp tới.
* Hoạt động chăm sóc hôm nay.
* Hoạt động chăm sóc theo nhân viên.
* Khách lâu chưa chăm sóc.
* Nhắc thanh toán quá hạn.
* Nhắc sinh nhật.

### 10.2. Việc hôm nay

Tính từ reminders:

* due_at trong ngày hôm nay.
* status = pending.

### 10.3. Việc quá hạn

Điều kiện:

* due_at < hiện tại.
* status = pending.

### 10.4. Hoạt động chăm sóc hôm nay

Tính từ customer_activities:

* created_at trong ngày hôm nay.

### 10.5. Hành động nhanh

* Bấm “Việc hôm nay” → mở danh sách reminder hôm nay.
* Bấm “Việc quá hạn” → mở reminder quá hạn.
* Bấm “Khách sinh nhật” → mở danh sách sinh nhật.
* Bấm “Khách lâu chưa mua” → mở tệp remarketing.

---

## 11. Cảnh báo cần xử lý

Dashboard nên có một khu vực riêng: “Cần xử lý”.

Các cảnh báo:

* Đơn chờ xác nhận.
* Đơn còn nợ.
* Đơn quá hạn thanh toán.
* SKU hết hàng.
* SKU sắp hết hàng.
* Việc chăm sóc quá hạn.
* Khách sinh nhật hôm nay.
* Khách lâu chưa mua.
* Đơn hủy tăng bất thường, làm sau MVP.

Mục tiêu:

Không chỉ báo cáo số liệu, mà nhắc người dùng hành động.

---

## 12. Báo cáo bán hàng

### 12.1. Mục tiêu

Phân tích doanh thu và đơn hàng.

### 12.2. Chỉ số

* Doanh thu theo ngày.
* Doanh thu theo tháng.
* Số đơn hàng.
* Giá trị đơn trung bình.
* Đơn theo trạng thái.
* Đơn hủy.
* Doanh thu theo nguồn.
* Doanh thu theo nhân viên.
* Doanh thu theo khách hàng.
* Doanh thu theo danh mục sản phẩm.
* Doanh thu theo sản phẩm/SKU.

### 12.3. Bộ lọc

* Khoảng ngày.
* Nhân viên.
* Nguồn đơn.
* Trạng thái đơn.
* Danh mục sản phẩm.
* Sản phẩm.
* Khách hàng.

MVP nên có:

* Khoảng ngày.
* Nhân viên.
* Nguồn đơn.
* Trạng thái đơn.

---

## 13. Báo cáo sản phẩm / SKU

### 13.1. Mục tiêu

Biết sản phẩm nào bán tốt, sản phẩm nào tồn nhiều, SKU nào cần nhập thêm.

### 13.2. Chỉ số

* Sản phẩm bán chạy.
* SKU bán chạy.
* Doanh thu theo sản phẩm.
* Doanh thu theo SKU.
* Số lượng bán theo SKU.
* Lãi gộp theo SKU, nếu có quyền và có giá nhập.
* SKU tồn thấp.
* SKU hết hàng.
* Sản phẩm lâu chưa bán, sau MVP.

### 13.3. Bảng sản phẩm bán chạy

Cột:

* Sản phẩm.
* SKU, nếu báo cáo theo SKU.
* Số lượng bán.
* Doanh thu.
* Giá vốn ước tính, nếu có quyền.
* Lãi gộp ước tính, nếu có quyền.
* Tồn hiện tại.

### 13.4. Lãi gộp cơ bản

Lãi gộp ước tính:

* revenue - cost.

Trong MVP:

* cost = quantity_sold × import_price hiện tại của SKU.

Lưu ý:

* Đây là ước tính.
* Nếu cần chuẩn hơn, sau này phải lưu giá vốn tại thời điểm bán hoặc theo lô nhập.

---

## 14. Báo cáo kho hàng

### 14.1. Mục tiêu

Theo dõi tình trạng tồn kho.

### 14.2. Chỉ số

* Tổng tồn kho.
* Tổng SKU.
* SKU sắp hết hàng.
* SKU hết hàng.
* Giá trị tồn kho.
* Giao dịch nhập kho.
* Giao dịch điều chỉnh kho.
* Biến động kho theo thời gian.
* Sản phẩm tồn nhiều, sau MVP.
* Sản phẩm lâu chưa bán, sau MVP.

### 14.3. Bộ lọc

* Danh mục.
* Sản phẩm.
* SKU.
* Trạng thái tồn.
* Khoảng ngày giao dịch.
* Người thao tác.

---

## 15. Báo cáo công nợ / thanh toán

### 15.1. Mục tiêu

Theo dõi tiền đã thu và tiền còn nợ.

### 15.2. Chỉ số

* Tổng tiền đã thu.
* Tiền thu theo ngày.
* Tiền thu theo phương thức.
* Tổng công nợ.
* Công nợ theo khách.
* Công nợ theo nhân viên phụ trách.
* Công nợ theo nguồn khách.
* Đơn còn nợ.
* Đơn quá hạn.
* Khách nợ nhiều.

### 15.3. Bộ lọc

* Khoảng ngày.
* Phương thức thanh toán.
* Nhân viên.
* Khách hàng.
* Nguồn đơn.
* Trạng thái thanh toán.

---

## 16. Báo cáo khách hàng / CRM

### 16.1. Mục tiêu

Đánh giá chất lượng và giá trị khách hàng.

### 16.2. Chỉ số

* Khách mới.
* Khách đã mua.
* Khách chưa mua.
* Khách quay lại.
* Khách mua nhiều.
* Khách lâu chưa mua.
* Khách theo nguồn.
* Khách theo tag.
* Khách theo nhân viên phụ trách.
* Khách sinh nhật.
* Khách còn nợ.

### 16.3. Khách mua nhiều

Có thể tính theo:

* Tổng số đơn.
* Tổng tiền đã mua.
* Lần mua gần nhất.

### 16.4. Khách quay lại

Khách quay lại là khách có từ 2 đơn hợp lệ trở lên.

Tỷ lệ khách quay lại:

* số khách có từ 2 đơn trở lên / số khách đã mua.

MVP có thể làm sau nếu chưa đủ thời gian.

---

## 17. Báo cáo chăm sóc khách hàng

### 17.1. Mục tiêu

Theo dõi hiệu quả chăm sóc của sale.

### 17.2. Chỉ số

* Số hoạt động chăm sóc theo ngày.
* Số hoạt động theo nhân viên.
* Số việc cần làm.
* Số việc hoàn thành.
* Số việc quá hạn.
* Tỷ lệ hoàn thành nhắc việc.
* Khách lâu chưa chăm sóc.
* Kết quả chăm sóc:

  * Đã liên hệ.
  * Không nghe máy.
  * Khách quan tâm.
  * Đã chốt đơn.
  * Từ chối.

### 17.3. Bộ lọc

* Khoảng ngày.
* Nhân viên.
* Loại hoạt động.
* Kết quả.
* Khách hàng.

MVP nên có:

* Hoạt động hôm nay.
* Việc hôm nay.
* Việc quá hạn.
* Hoạt động theo nhân viên.

---

## 18. Báo cáo nguồn khách

### 18.1. Mục tiêu

Biết nguồn nào đem lại khách và doanh thu tốt.

Nguồn có thể là:

* Facebook.
* Zalo.
* TikTok.
* Website.
* Shopee.
* Giới thiệu.
* Khách cũ.
* Offline.
* Khác.

### 18.2. Chỉ số

* Số khách theo nguồn.
* Số đơn theo nguồn.
* Doanh thu theo nguồn.
* Tiền đã thu theo nguồn.
* Công nợ theo nguồn.
* Tỷ lệ chuyển đổi từ khách thành đơn, nếu có dữ liệu lead/customer đủ chuẩn.
* Giá trị đơn trung bình theo nguồn.

### 18.3. MVP

MVP nên có:

* Khách theo nguồn.
* Đơn theo nguồn.
* Doanh thu theo nguồn.

---

## 19. Báo cáo nhân viên

### 19.1. Mục tiêu

Theo dõi hiệu quả làm việc của nhân viên.

### 19.2. Chỉ số cho sale

* Số khách phụ trách.
* Số khách mới tạo.
* Số đơn hàng.
* Doanh thu.
* Tiền đã thu.
* Công nợ khách phụ trách.
* Số hoạt động chăm sóc.
* Số việc hoàn thành.
* Số việc quá hạn.
* Tỷ lệ đơn hủy.

### 19.3. Chỉ số cho kho

* Số giao dịch nhập kho.
* Số giao dịch điều chỉnh.
* Số SKU xử lý.
* Lịch sử thao tác kho.

### 19.4. Chỉ số cho kế toán

* Số payment ghi nhận.
* Tổng tiền ghi nhận.
* Payment theo phương thức.
* Payment bị hủy/sửa, nếu có.

MVP nên làm báo cáo sale cơ bản trước.

---

## 20. Phân quyền trong báo cáo

### 20.1. Nguyên tắc

Không phải ai cũng được xem mọi báo cáo.

Đặc biệt các dữ liệu nhạy cảm:

* Doanh thu toàn hệ thống.
* Giá nhập.
* Lãi gộp.
* Giá trị tồn kho.
* Công nợ toàn hệ thống.
* Hiệu quả nhân viên.

### 20.2. Admin

* Xem tất cả báo cáo.
* Xem giá nhập/lãi gộp.
* Xem toàn bộ công nợ.
* Export toàn bộ.

### 20.3. Quản lý

* Xem báo cáo theo phạm vi đội/chi nhánh nếu có.
* Có thể bị giới hạn giá nhập/lãi gộp.

### 20.4. Sale

* Xem dashboard cá nhân.
* Xem khách/đơn/doanh số của mình nếu được phép.
* Không xem giá nhập/lãi gộp nếu không được quyền.
* Không xem doanh thu toàn hệ thống nếu không được quyền.

### 20.5. Kho

* Xem báo cáo kho.
* Không xem doanh thu/lợi nhuận nếu không được quyền.

### 20.6. Kế toán

* Xem báo cáo thanh toán/công nợ.
* Có thể không xem báo cáo chăm sóc/marketing nếu không cần.

---

## 21. Dữ liệu lõi phục vụ báo cáo

Dashboard chủ yếu dùng dữ liệu từ các bảng đã có:

* customers.
* customer_tags.
* customer_activities.
* reminders.
* products.
* product_variants.
* inventory_items.
* inventory_transactions.
* orders.
* order_items.
* payments.
* users.

### 21.1. Có cần bảng báo cáo riêng không?

MVP chưa cần data warehouse hay bảng tổng hợp phức tạp.

Có thể tính trực tiếp từ database bằng query.

Tuy nhiên cần chú ý hiệu năng:

* Với dữ liệu nhỏ/vừa, tính trực tiếp được.
* Khi dữ liệu lớn, có thể tạo summary table hoặc materialized view.

MVP nên ưu tiên đơn giản:

* Query trực tiếp.
* Index đúng các trường quan trọng.
* Có filter thời gian.

### 21.2. Trường cần index

Nên có index cho các trường:

* orders.created_at.
* orders.status.
* orders.payment_status.
* orders.sales_user_id.
* orders.source.
* order_items.product_variant_id.
* payments.created_at.
* payments.payment_method.
* customers.created_at.
* customers.source.
* customers.assigned_to.
* reminders.due_at.
* reminders.status.
* inventory_items.product_variant_id.
* inventory_transactions.created_at.
* inventory_transactions.transaction_type.

---

## 22. API đề xuất

### 22.1. Dashboard Summary API

GET /dashboard/summary

Query:

* date_from.
* date_to.
* sales_user_id.
* source.
* scope.

Response:

sales:

* revenue.
* order_count.
* completed_order_count.
* cancelled_order_count.
* average_order_value.

payments:

* paid_amount.
* debt_amount.
* unpaid_order_count.
* partial_order_count.

inventory:

* total_sku_count.
* total_quantity.
* low_stock_count.
* out_of_stock_count.
* inventory_value, nếu có quyền.

customers:

* new_customer_count.
* total_customer_count.
* birthday_count.
* inactive_customer_count, nếu cần.
* customers_without_orders.

care:

* today_reminder_count.
* overdue_reminder_count.
* today_activity_count.
* birthday_today_count.

---

### 22.2. Sales Report API

GET /reports/sales

Query:

* date_from.
* date_to.
* group_by: day | month | source | sales_user.
* status.
* source.
* sales_user_id.

Response:

* group_key.
* revenue.
* order_count.
* average_order_value.
* cancelled_order_count.

---

### 22.3. Product Report API

GET /reports/products

Query:

* date_from.
* date_to.
* group_by: product | variant | category.
* sort_by: revenue | quantity.
* limit.

Response:

* product_id.
* product_name.
* variant_id.
* sku.
* variant_name.
* quantity_sold.
* revenue.
* estimated_cost, nếu có quyền.
* estimated_gross_profit, nếu có quyền.
* current_stock.

---

### 22.4. Inventory Report API

GET /reports/inventory

Query:

* stock_status.
* category_id.
* product_id.
* include_value.

Response:

* product_id.
* product_name.
* sku.
* variant_name.
* current_quantity.
* low_stock_threshold.
* stock_status.
* inventory_value, nếu có quyền.

---

### 22.5. Payment Report API

GET /reports/payments

Query:

* date_from.
* date_to.
* payment_method.
* sales_user_id.
* group_by: day | method | sales_user.

Response:

* group_key.
* paid_amount.
* payment_count.

---

### 22.6. Debt Report API

GET /reports/debts

Query:

* customer_id.
* sales_user_id.
* source.
* overdue_only.
* min_debt.
* max_debt.

Response:

* total_debt.
* debt_order_count.
* debt_customer_count.
* items:

  * customer_id.
  * customer_name.
  * phone.
  * debt_total.
  * debt_order_count.
  * oldest_debt_days.

---

### 22.7. Customer Report API

GET /reports/customers

Query:

* date_from.
* date_to.
* source.
* tag_id.
* assigned_to.
* group_by: source | tag | assigned_to.

Response:

* group_key.
* customer_count.
* new_customer_count.
* order_count.
* revenue.
* total_debt.

---

### 22.8. Care Report API

GET /reports/care

Query:

* date_from.
* date_to.
* user_id.
* activity_type.
* reminder_status.

Response:

* activity_count.
* reminder_count.
* completed_reminder_count.
* overdue_reminder_count.
* by_user:

  * user_id.
  * user_name.
  * activity_count.
  * completed_reminder_count.
  * overdue_reminder_count.

---

## 23. UX/UI chi tiết

### 23.1. Nguyên tắc UI

* Chỉ số quan trọng đặt lên đầu.
* Không nhồi quá nhiều biểu đồ.
* Số liệu phải có thể bấm để xem chi tiết.
* Có filter thời gian rõ ràng.
* Có phân quyền hiển thị dữ liệu nhạy cảm.
* Báo cáo phải dễ hiểu với người không chuyên kỹ thuật.
* Dùng tiếng Việt rõ ràng.

### 23.2. Dashboard tổng quan đề xuất

Phần đầu:

* Bộ lọc thời gian.
* Bộ lọc nhân viên/nguồn nếu có.

Các card chính:

* Doanh thu.
* Tiền đã thu.
* Công nợ.
* Số đơn hàng.
* Khách mới.
* SKU sắp hết.
* Việc quá hạn.

Khu vực biểu đồ:

* Doanh thu theo ngày.
* Đơn hàng theo trạng thái.
* Tiền thu theo phương thức.
* Doanh thu theo nguồn.

Khu vực danh sách cần xử lý:

* Đơn còn nợ.
* SKU sắp hết.
* Việc quá hạn.
* Khách sinh nhật hôm nay.
* Khách lâu chưa mua.

### 23.3. Báo cáo chi tiết

Mỗi báo cáo nên có:

* Bộ lọc.
* Bảng dữ liệu.
* Biểu đồ đơn giản nếu hữu ích.
* Tổng cộng.
* Nút export, nếu được phân quyền.

---

## 24. Export báo cáo

MVP nên hỗ trợ export ở một số nơi quan trọng:

* Báo cáo bán hàng.
* Báo cáo công nợ.
* Báo cáo tồn kho.
* Danh sách khách hàng remarketing.
* Báo cáo thanh toán.

Định dạng:

* CSV là đơn giản nhất.
* XLSX tốt hơn nếu có thời gian.

Cần đảm bảo export theo đúng bộ lọc đang xem.

---

## 25. Validation và tính đúng số liệu

### 25.1. Nguyên tắc

Báo cáo phải thống nhất với dữ liệu gốc.

Ví dụ:

* Tổng công nợ trên dashboard phải khớp danh sách công nợ.
* Tổng tồn kho phải khớp inventory_items.
* Doanh thu phải không tính đơn hủy.
* Tiền đã thu phải tính từ payments active.
* paid_total trong order phải khớp tổng payments active.

### 25.2. Không tính dữ liệu sai trạng thái

Doanh thu không nên tính:

* Đơn draft.
* Đơn cancelled.
* Payment cancelled.

Tồn kho không nên tính:

* SKU bị xóa cứng, nếu có.
* Dữ liệu không active tùy báo cáo, nhưng cần rõ quy tắc.

### 25.3. Timezone

Cần thống nhất timezone khi lọc ngày.

Vì người dùng ở Việt Nam, nên hệ thống nên hiển thị theo timezone Việt Nam.

MVP có thể dùng local timezone hệ thống, nhưng nên ghi chú rõ.

---

## 26. Những lỗi/bug không được phép tồn tại

Các lỗi sau phải coi là nghiêm trọng:

1. Dashboard tính doanh thu gồm cả đơn hủy.
2. Tiền đã thu tính cả payment đã hủy.
3. Công nợ dashboard không khớp danh sách công nợ.
4. Tồn kho dashboard không khớp tồn SKU.
5. Sản phẩm bán chạy tính sai số lượng.
6. Sale xem được báo cáo toàn hệ thống khi không có quyền.
7. Người không có quyền xem giá nhập vẫn thấy lãi gộp/giá trị tồn.
8. Bộ lọc ngày cho kết quả sai.
9. Export không đúng dữ liệu đang lọc.
10. Khách sinh nhật tháng này lọc sai.
11. Việc quá hạn tính sai.
12. Dashboard quá chậm do query không tối ưu.
13. Báo cáo không phân biệt doanh thu và tiền đã thu.
14. Đơn returned không được xử lý đúng trong báo cáo nếu đã có hoàn hàng.
15. Dữ liệu biểu đồ khác dữ liệu bảng.

---

## 27. Tiêu chí hoàn thành MVP cho module Báo cáo / Dashboard

Module này được coi là dùng được thật khi đạt các tiêu chí:

1. Có dashboard tổng quan.
2. Có bộ lọc thời gian.
3. Hiển thị doanh thu đơn hàng.
4. Hiển thị tiền đã thu.
5. Hiển thị tổng công nợ.
6. Hiển thị số đơn hàng.
7. Hiển thị khách hàng mới.
8. Hiển thị SKU sắp hết/hết hàng.
9. Hiển thị việc hôm nay/quá hạn.
10. Có báo cáo bán hàng cơ bản.
11. Có báo cáo sản phẩm/SKU bán chạy.
12. Có báo cáo tồn kho thấp.
13. Có báo cáo thanh toán/công nợ cơ bản.
14. Có báo cáo khách hàng cơ bản.
15. Có phân quyền ẩn dữ liệu nhạy cảm.
16. Có liên kết từ chỉ số về danh sách chi tiết.
17. Số liệu khớp với dữ liệu gốc.
18. Không tính đơn hủy vào doanh thu chính.
19. Không tính payment đã hủy vào tiền thu.
20. Có thể export ít nhất báo cáo công nợ hoặc tồn kho nếu MVP có export.

---

## 28. Roadmap triển khai module Báo cáo / Dashboard

### Sprint REPORT-1: Dashboard tổng quan MVP

Mục tiêu:

* Hiển thị các card chính:

  * Doanh thu.
  * Tiền đã thu.
  * Công nợ.
  * Số đơn hàng.
  * Khách mới.
  * SKU sắp hết.
  * Việc quá hạn.
* Bộ lọc thời gian.

Phạm vi:

* GET /dashboard/summary.
* Dashboard UI.
* Link đến trang chi tiết.

---

### Sprint REPORT-2: Báo cáo bán hàng

Mục tiêu:

* Doanh thu theo ngày.
* Số đơn theo ngày.
* Doanh thu theo nguồn.
* Doanh thu theo nhân viên.

Phạm vi:

* GET /reports/sales.
* Sales report UI.
* Chart đơn giản.

---

### Sprint REPORT-3: Báo cáo sản phẩm/SKU

Mục tiêu:

* Sản phẩm bán chạy.
* SKU bán chạy.
* Số lượng bán.
* Doanh thu theo sản phẩm/SKU.
* Tồn hiện tại.

Phạm vi:

* GET /reports/products.
* Product report UI.

---

### Sprint REPORT-4: Báo cáo kho

Mục tiêu:

* SKU sắp hết.
* SKU hết hàng.
* Tổng tồn.
* Giá trị tồn nếu có quyền.
* Lịch sử biến động kho cơ bản.

Phạm vi:

* GET /reports/inventory.
* Inventory report UI.

---

### Sprint REPORT-5: Báo cáo thanh toán/công nợ

Mục tiêu:

* Tiền thu theo ngày.
* Tiền thu theo phương thức.
* Tổng công nợ.
* Khách còn nợ.
* Đơn còn nợ.

Phạm vi:

* GET /reports/payments.
* GET /reports/debts.
* Payment/debt report UI.

---

### Sprint REPORT-6: Báo cáo khách hàng/CRM

Mục tiêu:

* Khách mới.
* Khách theo nguồn.
* Khách mua nhiều.
* Khách lâu chưa mua.
* Khách sinh nhật.
* Khách còn nợ.

Phạm vi:

* GET /reports/customers.
* Customer report UI.

---

### Sprint REPORT-7: Báo cáo chăm sóc

Mục tiêu:

* Hoạt động chăm sóc theo nhân viên.
* Việc hôm nay/quá hạn.
* Tỷ lệ hoàn thành việc.
* Khách lâu chưa chăm sóc.

Phạm vi:

* GET /reports/care.
* Care report UI.

---

### Sprint REPORT-8: Export và tối ưu

Mục tiêu:

* Export CSV/XLSX.
* Tối ưu query.
* Kiểm tra phân quyền báo cáo.
* Thêm index cần thiết.

Phạm vi:

* Export reports.
* Performance tuning.
* Permission testing.

---

## 29. Kết luận

Module Báo cáo / Dashboard là nơi biến dữ liệu thành thông tin quản trị.

Điểm cốt lõi:

* Dashboard phải giúp người dùng biết tình hình kinh doanh ngay.
* Báo cáo phải phân biệt rõ doanh thu, tiền đã thu và công nợ.
* Kho phải có cảnh báo tồn thấp/hết hàng.
* CRM phải có khách cần chăm sóc, khách sinh nhật, khách lâu chưa mua.
* Báo cáo phải có khả năng bấm vào để xử lý chi tiết.
* Dữ liệu nhạy cảm phải được phân quyền.
* Số liệu phải khớp với dữ liệu gốc.
* MVP không cần biểu đồ phức tạp, nhưng các chỉ số lõi phải đúng.

Một dashboard tốt không chỉ cho người dùng “xem số”, mà phải giúp họ biết nên làm gì tiếp theo.
