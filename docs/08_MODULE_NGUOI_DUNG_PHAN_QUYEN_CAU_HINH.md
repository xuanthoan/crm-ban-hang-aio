# ĐẶC TẢ MODULE CHI TIẾT

# Module Người dùng / Phân quyền / Cấu hình hệ thống

# Dự án: CRM_Ban_Hang

## 1. Mục tiêu của module

Module Người dùng / Phân quyền / Cấu hình hệ thống dùng để quản lý người dùng, vai trò, quyền truy cập và các cấu hình nền tảng của phần mềm.

Mục tiêu của module này là đảm bảo:

* Mỗi người dùng có tài khoản riêng.
* Mỗi người dùng có vai trò rõ ràng.
* Người dùng chỉ được xem/sửa dữ liệu phù hợp với quyền của mình.
* Dữ liệu nhạy cảm như doanh thu, giá nhập, lãi gộp, công nợ, tồn kho không bị lộ cho người không có quyền.
* Các thao tác nguy hiểm như xóa dữ liệu, hủy đơn, điều chỉnh kho, hủy thanh toán phải được kiểm soát.
* Các danh mục dùng chung như nguồn khách, trạng thái khách, danh mục sản phẩm, đơn vị tính, phương thức thanh toán có thể cấu hình.
* Hệ thống có thể mở rộng về sau mà không phải sửa lại toàn bộ cấu trúc quyền.

Nguyên tắc quan trọng:

**Phần mềm càng liên quan đến tiền, kho, khách hàng và công nợ thì phân quyền càng phải rõ.**

Nếu không có phân quyền, các lỗi rất nguy hiểm có thể xảy ra:

* Sale xem được toàn bộ khách hàng của người khác.
* Nhân viên kho sửa được giá bán.
* Sale xem được giá nhập/lãi gộp.
* Người không có quyền điều chỉnh kho.
* Người không có quyền hủy đơn.
* Người không có quyền hủy thanh toán.
* Dữ liệu khách hàng bị xóa mất.
* Công nợ bị sửa sai.
* Báo cáo tài chính bị lộ.

---

## 2. Vai trò của module trong toàn hệ thống

Module này liên kết với tất cả các module khác:

* Khách hàng / CRM.
* Sản phẩm / SKU.
* Kho hàng.
* Đơn hàng.
* Thanh toán / Công nợ.
* Chăm sóc / Nhắc việc.
* Remarketing.
* Báo cáo / Dashboard.
* Import / Export.
* Nhật ký thao tác.

Các module khác đều cần kiểm tra:

* Người dùng hiện tại là ai?
* Người dùng thuộc vai trò nào?
* Người dùng có quyền thực hiện hành động này không?
* Người dùng có được xem dữ liệu này không?
* Người dùng chỉ được xem dữ liệu của mình hay toàn bộ?
* Người dùng có được export không?
* Người dùng có được xem giá nhập/lợi nhuận không?

---

## 3. Nhóm chức năng chính

Module này gồm 3 phần lớn:

1. **Người dùng**

   * Quản lý tài khoản đăng nhập.
   * Thông tin nhân viên.
   * Trạng thái tài khoản.
   * Đổi mật khẩu.
   * Khóa/mở tài khoản.

2. **Phân quyền**

   * Vai trò người dùng.
   * Quyền theo module.
   * Quyền theo hành động.
   * Phạm vi dữ liệu được xem.
   * Quyền xem dữ liệu nhạy cảm.

3. **Cấu hình hệ thống**

   * Nguồn khách hàng.
   * Trạng thái khách hàng.
   * Tag khách hàng.
   * Danh mục sản phẩm.
   * Đơn vị tính.
   * Phương thức thanh toán.
   * Trạng thái đơn hàng.
   * Cấu hình SKU.
   * Cấu hình mã đơn hàng.
   * Cấu hình ngưỡng tồn thấp.
   * Cấu hình trừ kho.
   * Cấu hình chăm sóc sau mua.

---

## 4. Người dùng chính của module

### 4.1. Chủ cửa hàng / Admin

Nhu cầu:

* Tạo tài khoản cho nhân viên.
* Phân vai trò cho từng người.
* Khóa tài khoản nhân viên nghỉ việc.
* Quy định ai được xem/sửa dữ liệu.
* Quy định ai được xem báo cáo nhạy cảm.
* Cấu hình danh mục, nguồn khách, trạng thái, đơn vị tính.
* Kiểm soát các thao tác nguy hiểm.

Quyền:

* Toàn quyền hệ thống.
* Quản lý người dùng.
* Quản lý vai trò.
* Quản lý cấu hình.
* Xem toàn bộ nhật ký thao tác.

---

### 4.2. Quản lý

Nhu cầu:

* Xem danh sách nhân viên trong đội.
* Phân công khách hàng.
* Xem dữ liệu trong phạm vi đội.
* Có thể cấu hình một số danh mục nếu được phép.

Quyền:

* Không nhất thiết toàn quyền.
* Có thể không được tạo admin khác.
* Có thể không được thay đổi cấu hình hệ thống quan trọng.
* Có thể được quản lý người dùng cấp dưới nếu phần mềm hỗ trợ.

---

### 4.3. Nhân viên bán hàng / Sale

Nhu cầu:

* Đăng nhập.
* Xem khách hàng được phân công.
* Tạo khách hàng.
* Tạo đơn hàng.
* Ghi chú chăm sóc.
* Tạo nhắc việc.
* Xem dashboard cá nhân.

Quyền:

* Không được quản lý người dùng.
* Không được xem báo cáo toàn hệ thống nếu không được phép.
* Không được điều chỉnh kho nếu không được phép.
* Không được xem giá nhập/lợi nhuận nếu không được phép.

---

### 4.4. Nhân viên kho

Nhu cầu:

* Đăng nhập.
* Xem sản phẩm/SKU.
* Xem tồn kho.
* Nhập kho.
* Điều chỉnh kho.
* Xem lịch sử kho.

Quyền:

* Không được xem công nợ nếu không cần.
* Không được sửa đơn hàng/giá bán nếu không được phép.
* Không được xem doanh thu/lợi nhuận nếu không được phép.

---

### 4.5. Kế toán / Thu ngân

Nhu cầu:

* Đăng nhập.
* Xem đơn hàng.
* Ghi nhận thanh toán.
* Xem công nợ.
* Xem báo cáo tiền thu.
* Xuất công nợ nếu được phép.

Quyền:

* Không nhất thiết được sửa sản phẩm/kho.
* Không nhất thiết được xem toàn bộ CRM.
* Không nhất thiết được xem lợi nhuận nếu không được phép.

---

## 5. Vai trò người dùng đề xuất

MVP nên có 5 vai trò mặc định:

1. Admin / Chủ cửa hàng.
2. Manager / Quản lý.
3. Sales / Nhân viên bán hàng.
4. Warehouse / Nhân viên kho.
5. Accountant / Kế toán / Thu ngân.

---

## 6. Vai trò Admin / Chủ cửa hàng

### 6.1. Mục tiêu

Admin là người có quyền cao nhất.

### 6.2. Quyền chính

Admin được phép:

* Xem tất cả khách hàng.
* Tạo/sửa/ngừng hoạt động khách hàng.
* Xem tất cả đơn hàng.
* Tạo/sửa/hủy đơn hàng.
* Xem tất cả sản phẩm/SKU.
* Tạo/sửa/ngừng bán sản phẩm/SKU.
* Xem giá nhập.
* Xem lãi gộp.
* Xem giá trị tồn kho.
* Nhập kho.
* Điều chỉnh kho.
* Ghi nhận thanh toán.
* Sửa/hủy thanh toán.
* Xem công nợ toàn hệ thống.
* Xem toàn bộ báo cáo.
* Export dữ liệu.
* Import dữ liệu.
* Quản lý người dùng.
* Quản lý vai trò.
* Quản lý cấu hình hệ thống.
* Xem nhật ký thao tác.

### 6.3. Hạn chế

Admin gần như không bị hạn chế. Tuy nhiên các thao tác nguy hiểm vẫn nên có xác nhận:

* Hủy đơn.
* Hủy payment.
* Điều chỉnh kho.
* Xóa dữ liệu.
* Import dữ liệu lớn.

---

## 7. Vai trò Manager / Quản lý

### 7.1. Mục tiêu

Quản lý phụ trách vận hành đội sale hoặc cửa hàng.

### 7.2. Quyền đề xuất

Manager có thể:

* Xem khách hàng trong phạm vi được phân quyền.
* Tạo/sửa khách hàng.
* Phân công khách hàng cho sale.
* Xem hoạt động chăm sóc của đội.
* Xem đơn hàng của đội.
* Tạo/sửa đơn hàng nếu được phép.
* Xác nhận/hủy đơn nếu được phép.
* Xem công nợ trong phạm vi.
* Xem báo cáo bán hàng trong phạm vi.
* Xem sản phẩm/SKU.
* Xem tồn kho.
* Tạo nhắc việc cho nhân viên.
* Xem dashboard đội.

### 7.3. Hạn chế

Manager có thể bị giới hạn:

* Không xem giá nhập.
* Không xem lãi gộp.
* Không quản lý user admin.
* Không thay đổi cấu hình hệ thống quan trọng.
* Không xóa dữ liệu quan trọng nếu không có quyền.

---

## 8. Vai trò Sales / Nhân viên bán hàng

### 8.1. Mục tiêu

Sale là người trực tiếp chăm sóc khách và tạo đơn.

### 8.2. Quyền đề xuất

Sale có thể:

* Tạo khách hàng.
* Xem khách hàng do mình phụ trách.
* Sửa khách hàng do mình phụ trách.
* Ghi chú chăm sóc.
* Tạo reminder cho khách của mình.
* Xem việc cần làm của mình.
* Tìm sản phẩm/SKU.
* Xem giá bán.
* Xem tồn kho khả dụng.
* Tạo đơn hàng.
* Lưu đơn nháp.
* Xác nhận đơn nếu được phép.
* Xem đơn hàng do mình tạo.
* Xem công nợ của khách mình phụ trách nếu được phép.
* Xem dashboard cá nhân.

### 8.3. Hạn chế

Sale không nên được phép mặc định:

* Xem toàn bộ khách hàng.
* Xem khách của sale khác.
* Xem giá nhập.
* Xem lãi gộp.
* Điều chỉnh kho.
* Hủy thanh toán.
* Hủy đơn đã xác nhận, trừ khi được phép.
* Export toàn bộ khách hàng.
* Xem báo cáo toàn hệ thống.
* Quản lý người dùng.
* Cấu hình hệ thống.

---

## 9. Vai trò Warehouse / Nhân viên kho

### 9.1. Mục tiêu

Nhân viên kho phụ trách tồn kho, nhập kho, điều chỉnh kho và xử lý hàng hóa.

### 9.2. Quyền đề xuất

Warehouse có thể:

* Xem sản phẩm/SKU.
* Xem tồn kho.
* Xem SKU sắp hết/hết hàng.
* Nhập kho.
* Điều chỉnh kho.
* Xem lịch sử kho.
* Xem đơn cần đóng gói/xuất hàng nếu quy trình có.
* Cập nhật trạng thái kho/đóng gói nếu được phép.

### 9.3. Hạn chế

Warehouse không nên mặc định được phép:

* Xem doanh thu.
* Xem công nợ.
* Ghi nhận thanh toán.
* Sửa giá bán.
* Xem giá nhập nếu không cần.
* Xem lãi gộp.
* Tạo/hủy đơn hàng.
* Quản lý khách hàng CRM.
* Export dữ liệu khách hàng.

---

## 10. Vai trò Accountant / Kế toán / Thu ngân

### 10.1. Mục tiêu

Kế toán/thu ngân phụ trách tiền, thanh toán, công nợ.

### 10.2. Quyền đề xuất

Accountant có thể:

* Xem đơn hàng.
* Ghi nhận thanh toán.
* Xem lịch sử thanh toán.
* Xem công nợ.
* Tạo nhắc thanh toán.
* Xem báo cáo tiền thu.
* Xem báo cáo công nợ.
* Export công nợ nếu được phép.
* Hủy/sửa payment nếu được phân quyền.

### 10.3. Hạn chế

Accountant không nên mặc định được phép:

* Điều chỉnh kho.
* Sửa sản phẩm/SKU.
* Xóa khách hàng.
* Xem toàn bộ báo cáo bán hàng nếu không cần.
* Xem lãi gộp nếu không được phép.
* Quản lý người dùng.

---

## 11. Ma trận quyền theo module

### 11.1. Nhóm quyền Khách hàng / CRM

Các quyền:

* customer.view_all
* customer.view_own
* customer.create
* customer.update
* customer.delete
* customer.deactivate
* customer.assign
* customer.export
* customer.import
* customer.view_debt
* customer.view_order_history
* customer.view_activity

Gợi ý:

Admin:

* Tất cả.

Manager:

* view_all hoặc view_team.
* create/update/assign.
* export nếu được phép.

Sales:

* view_own.
* create.
* update own.
* view_order_history own.
* view_activity own.

Warehouse:

* Không cần hoặc chỉ xem thông tin giao hàng trong đơn.

Accountant:

* view customer liên quan công nợ/thanh toán.

---

### 11.2. Nhóm quyền Sản phẩm / SKU

Các quyền:

* product.view
* product.create
* product.update
* product.delete
* product.deactivate
* product.import
* product.export
* product.view_cost
* product.update_price
* product.update_cost
* sku.create
* sku.update
* sku.deactivate

Gợi ý:

Admin:

* Tất cả.

Manager:

* product.view.
* product.update nếu được phép.
* update_price nếu được phép.

Sales:

* product.view.
* Không view_cost.

Warehouse:

* product.view.
* Có thể không update_price/cost.

Accountant:

* product.view.
* view_cost nếu cần.

---

### 11.3. Nhóm quyền Kho hàng

Các quyền:

* inventory.view
* inventory.view_value
* inventory.import_stock
* inventory.adjust
* inventory.bulk_adjust
* inventory.view_transactions
* inventory.export
* inventory.stocktake

Gợi ý:

Admin:

* Tất cả.

Manager:

* view.
* view_transactions.
* adjust nếu được phép.

Warehouse:

* view.
* import_stock.
* adjust.
* bulk_adjust.
* view_transactions.

Sales:

* view tồn khả dụng, không adjust.

Accountant:

* view_value nếu được phép.

---

### 11.4. Nhóm quyền Đơn hàng

Các quyền:

* order.view_all
* order.view_own
* order.create
* order.update_draft
* order.update_confirmed
* order.confirm
* order.cancel
* order.complete
* order.return
* order.change_price
* order.discount
* order.export

Gợi ý:

Admin:

* Tất cả.

Manager:

* view_all hoặc view_team.
* confirm/cancel nếu được phép.
* discount nếu được phép.

Sales:

* view_own.
* create.
* update_draft.
* confirm nếu được phép.
* change_price/discount tùy cấu hình.

Warehouse:

* view order cần xử lý kho.
* Có thể update packing/shipping nếu có.

Accountant:

* view order để thanh toán/công nợ.

---

### 11.5. Nhóm quyền Thanh toán / Công nợ

Các quyền:

* payment.view_all
* payment.view_own
* payment.create
* payment.update
* payment.cancel
* debt.view_all
* debt.view_own
* debt.export

Gợi ý:

Admin:

* Tất cả.

Manager:

* view trong phạm vi.
* create nếu được phép.

Sales:

* view_own debt.
* create payment nếu được phép.

Accountant:

* view_all hoặc theo phạm vi.
* create payment.
* update/cancel payment nếu được phân quyền.
* export debt nếu được phép.

Warehouse:

* Không cần.

---

### 11.6. Nhóm quyền Chăm sóc / Nhắc việc / Remarketing

Các quyền:

* activity.view_all
* activity.view_own
* activity.create
* activity.update
* activity.delete
* reminder.view_all
* reminder.view_own
* reminder.create
* reminder.update
* reminder.complete
* reminder.cancel
* marketing.view_segments
* marketing.create_segments
* marketing.export_customers
* marketing.bulk_action

Gợi ý:

Admin:

* Tất cả.

Manager:

* view team.
* create reminder cho đội.
* export nếu được phép.

Sales:

* view_own.
* create activity.
* create reminder.
* complete reminder.

Accountant:

* reminder payment.
* activity payment reminder.

Warehouse:

* Không cần hoặc chỉ task liên quan kho.

---

### 11.7. Nhóm quyền Báo cáo / Dashboard

Các quyền:

* report.view_all
* report.view_own
* report.view_team
* report.view_revenue
* report.view_profit
* report.view_cost
* report.view_inventory_value
* report.view_debt
* report.export

Gợi ý:

Admin:

* Tất cả.

Manager:

* view_team.
* view_revenue theo quyền.
* Không view_profit/cost nếu không được phép.

Sales:

* view_own.
* Không view_profit/cost.

Warehouse:

* view inventory report.
* Không view_revenue/profit.

Accountant:

* view_payment/debt.
* Có thể không view_profit.

---

## 12. Phạm vi dữ liệu

Phân quyền không chỉ là “được làm gì”, mà còn là “được xem dữ liệu nào”.

### 12.1. Các phạm vi dữ liệu

Đề xuất:

* all: toàn bộ dữ liệu.
* team: dữ liệu của đội/nhóm.
* own: dữ liệu của chính người dùng.
* assigned: dữ liệu được phân công.
* none: không có quyền.

### 12.2. Ví dụ

Sale:

* customer scope = assigned hoặc own.
* order scope = own.
* report scope = own.

Manager:

* customer scope = team.
* order scope = team.
* report scope = team.

Admin:

* scope = all.

Warehouse:

* inventory scope = all.
* customer scope = none hoặc limited.

Accountant:

* payment/debt scope = all hoặc team tùy cấu hình.

---

## 13. Quản lý người dùng

### 13.1. Màn hình danh sách người dùng

Cột:

* Họ tên.
* Email/tên đăng nhập.
* Số điện thoại.
* Vai trò.
* Trạng thái.
* Ngày tạo.
* Lần đăng nhập gần nhất.
* Hành động.

Hành động:

* Xem chi tiết.
* Sửa.
* Đổi vai trò.
* Đặt lại mật khẩu.
* Khóa/mở tài khoản.
* Xem lịch sử thao tác, nếu có.

---

### 13.2. Thêm người dùng

Form gồm:

* Họ tên.
* Email hoặc tên đăng nhập.
* Số điện thoại.
* Mật khẩu ban đầu.
* Vai trò.
* Trạng thái.
* Ghi chú.

Quy tắc:

* Email/tên đăng nhập không được trùng.
* Mật khẩu phải đạt độ dài tối thiểu.
* Vai trò bắt buộc.
* Trạng thái mặc định active.

MVP có thể đơn giản:

* Admin tạo user với mật khẩu.
* User tự đổi mật khẩu sau này, nếu có.

---

### 13.3. Sửa người dùng

Có thể sửa:

* Họ tên.
* Số điện thoại.
* Vai trò.
* Trạng thái.
* Ghi chú.

Không nên cho sửa email/tên đăng nhập tùy tiện nếu đã dùng làm login, hoặc nếu sửa phải kiểm tra trùng.

---

### 13.4. Khóa / mở tài khoản

Trạng thái user:

* active: đang hoạt động.
* inactive: ngừng hoạt động.
* locked: bị khóa.

Nếu nhân viên nghỉ việc, nên chuyển inactive/locked thay vì xóa.

Không nên xóa user đã có lịch sử thao tác, vì cần giữ audit.

---

### 13.5. Đặt lại mật khẩu

Admin có thể đặt lại mật khẩu cho user.

Quy tắc:

* Mật khẩu mới phải đạt yêu cầu tối thiểu.
* Có thể yêu cầu user đổi mật khẩu khi đăng nhập lần sau, làm sau MVP.

---

## 14. Xác thực / Đăng nhập

### 14.1. Màn hình đăng nhập

Trường:

* Email/tên đăng nhập.
* Mật khẩu.

Tùy chọn:

* Ghi nhớ đăng nhập, có thể sau.
* Quên mật khẩu, có thể sau.

### 14.2. Quy tắc đăng nhập

* User phải tồn tại.
* User phải active.
* Mật khẩu đúng.
* Nếu sai, trả lỗi chung chung, không nói rõ email hay mật khẩu sai.

Thông báo:

“Tài khoản hoặc mật khẩu không đúng.”

Nếu tài khoản bị khóa:

“Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.”

### 14.3. Bảo mật mật khẩu

Mật khẩu không được lưu plain text.

Phải lưu password_hash.

Yêu cầu tối thiểu:

* Mật khẩu ít nhất 6 hoặc 8 ký tự.
* Hash bằng thư viện an toàn.
* Không log mật khẩu.

MVP chưa cần 2FA.

---

## 15. Cấu hình hệ thống

Cấu hình hệ thống giúp phần mềm linh hoạt theo nhiều ngành hàng.

### 15.1. Cấu hình nguồn khách hàng

Nguồn khách dùng trong khách hàng, đơn hàng, báo cáo.

Mặc định:

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
* Khác.

Người dùng có thể:

* Thêm nguồn.
* Sửa tên nguồn.
* Ẩn/ngừng sử dụng nguồn.
* Không xóa nguồn đã có dữ liệu.

---

### 15.2. Cấu hình trạng thái khách hàng

Mặc định:

* Mới.
* Đang tư vấn.
* Đã mua.
* Cần chăm sóc lại.
* Tạm ngưng.
* Không tiềm năng.
* VIP.

Có thể cho phép chỉnh tên/trạng thái sau MVP.

MVP có thể hard-code trước nhưng nên thiết kế có thể cấu hình.

---

### 15.3. Cấu hình tag khách hàng

Tag khách hàng nên cho người dùng tự tạo.

Trường:

* Tên tag.
* Màu.
* Mô tả.
* Trạng thái.

Quy tắc:

* Không tạo tag trùng tên.
* Không xóa tag đang được dùng, chỉ ẩn/ngừng hoạt động.

---

### 15.4. Cấu hình danh mục sản phẩm

Danh mục sản phẩm giúp phân loại hàng.

Trường:

* Tên danh mục.
* Danh mục cha, nếu có.
* Mô tả.
* Trạng thái.

MVP có thể dùng danh mục một cấp.

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

---

### 15.5. Cấu hình đơn vị tính

Mặc định:

* Cái.
* Chiếc.
* Bộ.
* Cuốn.
* Hộp.
* Gói.
* Kg.
* Lít.
* Chai.
* Lọ.
* Mét.

Người dùng có thể thêm/sửa/ngừng sử dụng.

---

### 15.6. Cấu hình phương thức thanh toán

Mặc định:

* Tiền mặt.
* Chuyển khoản.
* COD.
* Ví điện tử.
* Khác.

Người dùng có thể thêm:

* Momo.
* VietQR.
* Ngân hàng A.
* ShopeePay.
* ZaloPay.

MVP có thể đơn giản là enum, sau đó nâng cấp thành cấu hình.

---

### 15.7. Cấu hình trạng thái đơn hàng

Mặc định:

* Nháp.
* Đã xác nhận.
* Đang đóng gói.
* Đang giao.
* Hoàn thành.
* Hủy.
* Hoàn hàng.

MVP nên giữ cố định để tránh làm phức tạp logic kho.

Sau này có thể cho cấu hình tên hiển thị, nhưng không nên cho sửa logic trạng thái tùy tiện.

---

### 15.8. Cấu hình mã SKU tự sinh

Cấu hình:

* Tiền tố SKU.
* Cách sinh từ tên sản phẩm.
* Có thêm giá trị biến thể không.
* Có thêm số thứ tự không.
* Độ dài tối đa.
* Tự thêm hậu tố khi trùng.

MVP có thể dùng quy tắc mặc định:

Tên sản phẩm không dấu + giá trị biến thể không dấu + hậu tố nếu trùng.

Ví dụ:

AO-THUN-NU-2027-DEN-S.

---

### 15.9. Cấu hình mã đơn hàng tự sinh

Cấu hình mặc định:

* DH-YYYYMMDD-0001.

Ví dụ:

DH-20260621-0001.

Cần đảm bảo unique.

---

### 15.10. Cấu hình ngưỡng tồn thấp mặc định

Mặc định:

* 5.

Khi tạo SKU mới, nếu người dùng không nhập low_stock_threshold, dùng mặc định.

Người dùng có thể sửa theo từng SKU.

---

### 15.11. Cấu hình trừ kho

MVP đề xuất cố định:

* Trừ kho khi đơn chuyển sang Đã xác nhận.
* Hoàn kho khi đơn bị hủy sau khi đã trừ.
* Không cho bán vượt tồn.

Sau này có thể cấu hình:

* Trừ kho khi xác nhận.
* Trừ kho khi hoàn thành.
* Cho phép bán âm hay không.

Nhưng MVP nên đơn giản và an toàn.

---

### 15.12. Cấu hình chăm sóc sau mua

Có thể cấu hình:

* Tự tạo nhắc chăm sóc sau khi đơn hoàn thành: bật/tắt.
* Sau bao nhiêu ngày thì nhắc.
* Người phụ trách: sale tạo đơn hoặc nhân viên phụ trách khách.

MVP có thể để sau, nhưng nên có định hướng.

---

## 16. Nhật ký thao tác / Audit log

### 16.1. Mục tiêu

Audit log giúp biết ai đã làm gì, khi nào.

Cần cho các thao tác quan trọng:

* Tạo/sửa/xóa khách hàng.
* Đổi số điện thoại khách.
* Tạo/sửa sản phẩm.
* Đổi giá bán/giá nhập.
* Nhập kho.
* Điều chỉnh kho.
* Tạo/hủy đơn.
* Ghi nhận/sửa/hủy thanh toán.
* Thay đổi quyền người dùng.
* Import dữ liệu.

### 16.2. Dữ liệu audit log

Trường đề xuất:

* id.
* user_id.
* action.
* entity_type.
* entity_id.
* old_value.
* new_value.
* reason.
* ip_address, có thể sau.
* user_agent, có thể sau.
* created_at.

### 16.3. MVP nên làm đến đâu?

MVP nên lưu tối thiểu:

* Người tạo.
* Người cập nhật.
* Thời gian tạo.
* Thời gian cập nhật.

Với các module nhạy cảm nên có log rõ:

* Điều chỉnh kho.
* Hủy đơn.
* Hủy payment.
* Đổi quyền user.

Audit log đầy đủ có thể làm sau nhưng nên thiết kế sẵn.

---

## 17. Dữ liệu lõi

### 17.1. Bảng users

Trường đề xuất:

* id.
* full_name.
* email.
* username.
* phone.
* password_hash.
* role_id.
* status.
* last_login_at.
* created_by.
* updated_by.
* created_at.
* updated_at.
* deleted_at.

status:

* active.
* inactive.
* locked.

---

### 17.2. Bảng roles

Trường đề xuất:

* id.
* name.
* code.
* description.
* is_system_role.
* created_at.
* updated_at.

Vai trò mặc định:

* admin.
* manager.
* sales.
* warehouse.
* accountant.

is_system_role dùng để không xóa nhầm vai trò hệ thống.

---

### 17.3. Bảng permissions

Trường đề xuất:

* id.
* code.
* name.
* module.
* description.
* created_at.

Ví dụ code:

* customer.view_all.
* customer.view_own.
* order.create.
* inventory.adjust.
* payment.cancel.
* report.view_profit.

---

### 17.4. Bảng role_permissions

Trường đề xuất:

* id.
* role_id.
* permission_id.
* created_at.

---

### 17.5. Bảng system_settings

Trường đề xuất:

* id.
* key.
* value.
* value_type.
* description.
* updated_by.
* updated_at.

Ví dụ key:

* default_low_stock_threshold.
* order_code_format.
* sku_code_format.
* inventory_deduction_policy.
* allow_negative_stock.
* after_sale_reminder_days.

---

### 17.6. Bảng configurable_lists

Có thể dùng cho các danh mục đơn giản.

Trường đề xuất:

* id.
* type.
* name.
* code.
* color.
* description.
* sort_order.
* status.
* created_at.
* updated_at.

type ví dụ:

* customer_source.
* customer_status.
* payment_method.
* unit.
* order_cancel_reason.
* customer_activity_type.

Hoặc tách bảng riêng cho từng loại nếu muốn rõ ràng hơn.

MVP có thể dùng bảng chung để linh hoạt.

---

### 17.7. Bảng categories

Dành riêng cho danh mục sản phẩm.

Trường đề xuất:

* id.
* name.
* parent_id.
* description.
* status.
* created_at.
* updated_at.

MVP có thể chưa dùng parent_id.

---

### 17.8. Bảng audit_logs

Trường đề xuất:

* id.
* user_id.
* action.
* entity_type.
* entity_id.
* old_value.
* new_value.
* reason.
* created_at.

---

## 18. API đề xuất

### 18.1. Auth API

POST /auth/login

Body:

* username_or_email.
* password.

Response:

* access_token.
* user info.
* role.
* permissions.

---

GET /auth/me

Mục đích:

Lấy thông tin người dùng hiện tại.

Response:

* id.
* full_name.
* email.
* role.
* permissions.
* scopes.

---

POST /auth/change-password

Body:

* current_password.
* new_password.

---

### 18.2. User API

GET /users

Query:

* search.
* role_id.
* status.
* page.
* page_size.

POST /users

Tạo user.

PUT /users/{id}

Sửa user.

POST /users/{id}/lock

Khóa user.

POST /users/{id}/unlock

Mở user.

POST /users/{id}/reset-password

Đặt lại mật khẩu.

---

### 18.3. Role API

GET /roles

Lấy danh sách vai trò.

GET /roles/{id}

Lấy chi tiết vai trò và quyền.

POST /roles

Tạo vai trò mới, có thể để sau MVP.

PUT /roles/{id}

Sửa vai trò.

PUT /roles/{id}/permissions

Cập nhật quyền cho vai trò.

MVP có thể chưa cần UI tạo role tùy chỉnh, nhưng nên có roles mặc định.

---

### 18.4. Permission API

GET /permissions

Lấy danh sách quyền hệ thống.

Dùng cho màn hình cấu hình vai trò.

---

### 18.5. Settings API

GET /settings

Lấy cấu hình hệ thống.

PUT /settings

Cập nhật cấu hình.

---

### 18.6. Configurable Lists API

GET /config-lists/{type}

Ví dụ:

* /config-lists/customer_source
* /config-lists/payment_method
* /config-lists/unit

POST /config-lists/{type}

Thêm item.

PUT /config-lists/{type}/{id}

Sửa item.

DELETE /config-lists/{type}/{id}

MVP nên dùng soft delete hoặc inactive.

---

### 18.7. Category API

GET /categories

POST /categories

PUT /categories/{id}

DELETE /categories/{id}

Nếu category đã được sản phẩm sử dụng, không xóa cứng.

---

### 18.8. Audit Log API

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

MVP có thể làm sau, nhưng backend nên chuẩn bị.

---

## 19. Validation

### 19.1. User

* full_name bắt buộc.
* username/email không được trùng.
* password tối thiểu 6 hoặc 8 ký tự.
* role bắt buộc.
* status hợp lệ.

Thông báo:

“Vui lòng nhập họ tên.”
“Tài khoản này đã tồn tại.”
“Mật khẩu quá ngắn.”
“Vui lòng chọn vai trò.”

### 19.2. Role

* name bắt buộc.
* code không được trùng.
* Không xóa role hệ thống nếu đang có user sử dụng.

Thông báo:

“Vai trò đang được sử dụng, không thể xóa.”

### 19.3. Permission

* Không cho tạo permission tùy tiện từ UI trong MVP.
* Permission nên được định nghĩa bởi hệ thống.

### 19.4. Config list

* name bắt buộc.
* Không trùng tên trong cùng type.
* Không xóa item đã có dữ liệu liên quan, chỉ inactive.

Thông báo:

“Mục này đang được sử dụng, không thể xóa. Bạn có thể ngừng sử dụng.”

### 19.5. Category

* name bắt buộc.
* Không xóa category đã có sản phẩm.

Thông báo:

“Danh mục đang có sản phẩm, không thể xóa.”

---

## 20. UX/UI chi tiết

### 20.1. Menu Cấu hình

Menu Cấu hình nên gồm:

* Người dùng.
* Vai trò & quyền.
* Nguồn khách.
* Tag khách hàng.
* Danh mục sản phẩm.
* Đơn vị tính.
* Phương thức thanh toán.
* Cấu hình mã SKU.
* Cấu hình mã đơn hàng.
* Cấu hình kho.
* Nhật ký thao tác, có thể sau.

MVP có thể bắt đầu với:

* Người dùng.
* Vai trò.
* Nguồn khách.
* Tag khách hàng.
* Danh mục sản phẩm.
* Đơn vị tính.
* Phương thức thanh toán.

---

### 20.2. Màn hình Người dùng

Cần đơn giản:

* Danh sách user.
* Nút thêm user.
* Sửa user.
* Khóa/mở user.
* Đặt lại mật khẩu.

Không nên xóa user đã có lịch sử.

---

### 20.3. Màn hình Vai trò & quyền

MVP có thể hiển thị vai trò mặc định và quyền dưới dạng checkbox.

Nhóm quyền theo module:

* Khách hàng.
* Sản phẩm.
* Kho hàng.
* Đơn hàng.
* Thanh toán.
* Chăm sóc.
* Báo cáo.
* Cấu hình.

Nếu chưa muốn làm UI quyền phức tạp, MVP có thể hard-code quyền theo role trước, nhưng nên viết rõ trong tài liệu và backend.

---

### 20.4. Màn hình Cấu hình danh mục

Các cấu hình dạng danh sách nên có UI chung:

* Tên.
* Mô tả.
* Trạng thái.
* Màu, nếu cần.
* Thứ tự hiển thị.

Hành động:

* Thêm.
* Sửa.
* Ngừng sử dụng.
* Sắp xếp.

---

## 21. Quy tắc bảo mật

### 21.1. Mật khẩu

* Không lưu plain text.
* Không trả password_hash ra frontend.
* Không log mật khẩu.
* Hash mật khẩu an toàn.

### 21.2. Token đăng nhập

Nếu dùng JWT:

* Token có thời hạn.
* Có endpoint /auth/me để lấy user hiện tại.
* Backend luôn kiểm tra quyền, không chỉ ẩn nút ở frontend.

### 21.3. Kiểm tra quyền ở backend

Frontend ẩn nút là chưa đủ.

Backend phải kiểm tra quyền cho mọi API quan trọng:

* Xóa khách.
* Sửa giá.
* Điều chỉnh kho.
* Hủy đơn.
* Hủy payment.
* Xem báo cáo.
* Export.

### 21.4. Dữ liệu nhạy cảm

Các trường nhạy cảm:

* import_price.
* estimated_profit.
* inventory_value.
* total_revenue.
* full debt report.
* all customers export.

Nếu user không có quyền, backend không nên trả các trường này.

---

## 22. Những lỗi/bug không được phép tồn tại

Các lỗi sau phải coi là nghiêm trọng:

1. User không có quyền vẫn gọi API thành công.
2. Chỉ ẩn nút frontend nhưng backend không kiểm tra quyền.
3. Sale xem được toàn bộ khách hàng khi chỉ được xem khách của mình.
4. Sale xem được giá nhập/lãi gộp.
5. Warehouse sửa được thanh toán.
6. Accountant điều chỉnh được kho khi không có quyền.
7. User bị khóa vẫn đăng nhập được.
8. Xóa user làm mất lịch sử thao tác.
9. Xóa danh mục/tag đang được sử dụng gây lỗi dữ liệu.
10. Payment/công nợ/báo cáo nhạy cảm bị lộ cho user không có quyền.
11. Mật khẩu lưu plain text.
12. API /auth/me trả password_hash.
13. Role bị sửa làm mất quyền admin duy nhất.
14. Không có admin nào còn hoạt động trong hệ thống.
15. Import/export bỏ qua kiểm tra quyền.

---

## 23. Tiêu chí hoàn thành MVP cho module Người dùng / Phân quyền / Cấu hình

Module này được coi là dùng được thật khi đạt các tiêu chí:

1. Có đăng nhập.
2. Có user hiện tại /auth/me.
3. Có ít nhất 5 vai trò mặc định: Admin, Manager, Sales, Warehouse, Accountant.
4. Admin tạo/sửa/khóa user được.
5. User bị khóa không đăng nhập được.
6. Mật khẩu được hash an toàn.
7. Backend kiểm tra quyền ở các API quan trọng.
8. Sale không xem được dữ liệu ngoài quyền.
9. Người không có quyền không xem được giá nhập/lãi gộp.
10. Người không có quyền không điều chỉnh được kho.
11. Người không có quyền không hủy được payment.
12. Có cấu hình nguồn khách.
13. Có cấu hình tag khách hàng.
14. Có cấu hình danh mục sản phẩm.
15. Có cấu hình đơn vị tính.
16. Có cấu hình phương thức thanh toán.
17. Không xóa cứng cấu hình đang được sử dụng.
18. Có created_by/updated_by ở các bảng quan trọng.
19. Có nền tảng audit log hoặc ít nhất lưu người tạo/người sửa.
20. Giao diện cấu hình đơn giản, dễ dùng.

---

## 24. Roadmap triển khai module Người dùng / Phân quyền / Cấu hình

### Sprint AUTH-1: Đăng nhập và người dùng cơ bản

Mục tiêu:

* User table.
* Login.
* Password hash.
* /auth/me.
* User status active/locked.
* Admin tạo user.

Phạm vi:

* Auth API.
* User API cơ bản.
* Login UI.
* User list UI.

---

### Sprint AUTH-2: Vai trò mặc định

Mục tiêu:

* Tạo 5 role mặc định.
* Gán role cho user.
* Quyền cơ bản theo role.
* Middleware kiểm tra đăng nhập.

Phạm vi:

* roles.
* role assignment.
* auth guard.

---

### Sprint AUTH-3: Permission backend

Mục tiêu:

* Định nghĩa permission codes.
* Kiểm tra quyền ở API quan trọng.
* Scope dữ liệu own/team/all cơ bản.

Phạm vi:

* permission service.
* decorators/dependencies.
* customer/order/report permission checks.

---

### Sprint AUTH-4: Bảo vệ dữ liệu nhạy cảm

Mục tiêu:

* Ẩn giá nhập nếu không có quyền.
* Ẩn lãi gộp nếu không có quyền.
* Ẩn báo cáo toàn hệ thống nếu không có quyền.
* Chặn điều chỉnh kho/payment/order cancel nếu không có quyền.

Phạm vi:

* response filtering.
* permission tests.

---

### Sprint CONFIG-1: Cấu hình danh sách cơ bản

Mục tiêu:

* Nguồn khách.
* Tag khách hàng.
* Đơn vị tính.
* Phương thức thanh toán.
* Danh mục sản phẩm.

Phạm vi:

* configurable_lists.
* categories.
* config UI.

---

### Sprint CONFIG-2: Cấu hình mã và kho

Mục tiêu:

* Cấu hình SKU mặc định.
* Cấu hình mã đơn.
* Cấu hình ngưỡng tồn thấp.
* Cấu hình trừ kho MVP.

Phạm vi:

* system_settings.
* settings UI.
* apply default settings.

---

### Sprint AUDIT-1: Nhật ký thao tác quan trọng

Mục tiêu:

* Lưu audit log cho thao tác nhạy cảm.
* Xem audit log cơ bản.

Phạm vi:

* audit_logs.
* log service.
* audit UI basic.

---

## 25. Kết luận

Module Người dùng / Phân quyền / Cấu hình hệ thống là nền móng an toàn của phần mềm.

Điểm cốt lõi:

* Mỗi người dùng phải có tài khoản riêng.
* Mỗi người dùng phải có vai trò rõ ràng.
* Backend phải kiểm tra quyền, không chỉ ẩn nút ở frontend.
* Dữ liệu nhạy cảm như giá nhập, lãi gộp, công nợ, báo cáo phải được bảo vệ.
* Các thao tác nguy hiểm như điều chỉnh kho, hủy đơn, hủy payment phải có quyền.
* Không xóa cứng user/cấu hình đã có dữ liệu liên quan.
* Cấu hình hệ thống giúp phần mềm linh hoạt cho nhiều ngành hàng.
* Audit log giúp truy vết ai đã làm gì.

Nếu module này làm tốt, phần mềm sẽ an toàn hơn, chuyên nghiệp hơn và có thể dùng trong môi trường nhiều nhân viên mà không lo lộ dữ liệu hoặc thao tác sai quyền.
