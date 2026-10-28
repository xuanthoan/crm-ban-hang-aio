# CRM_Ban_Hang — Quy tắc đã chốt cứng (không thay đổi nếu không có quyết định mới của chủ dự án)

Ngày chốt: 2026-10-28
Bổ sung ngày 2026-10-28: mục 4.1 được thay bằng quy tắc nhiều số điện thoại, không giới hạn cứng 2 số.
Trạng thái: **ĐÃ CHỐT CỨNG**
Phạm vi áp dụng: toàn bộ MVP và mọi sprint sau này, cho cả AI Agent và người code tay.

Nguyên tắc chung: AI Agent không được tự ý nới lỏng, bỏ qua hay “tạm làm khác cho nhanh” bất kỳ quy tắc nào dưới đây. Nếu một tài liệu cũ (00–11) mâu thuẫn với tài liệu này thì **tài liệu này thắng**, và AI phải báo mâu thuẫn đó cho chủ dự án thay vì tự chọn theo tài liệu cũ.

Muốn thay đổi một quy tắc đã chốt: chỉ chủ dự án được quyết, và phải sửa trực tiếp tài liệu này (ghi ngày sửa, nội dung cũ, nội dung mới, lý do), không được sửa ngầm trong code.

---

## 1. SKU là đơn vị bán hàng và trừ kho duy nhất

- Mọi dòng trong đơn hàng (`order_items`) bắt buộc phải trỏ tới một `product_variant_id` / SKU cụ thể. Không được tạo dòng đơn chỉ bằng `product_id` (sản phẩm cha).
- Kho, báo cáo bán chạy, remarketing theo sản phẩm đã mua đều tính theo SKU, không tính chung chung theo sản phẩm cha.
- Sản phẩm không có biến thể vẫn phải có đúng 1 SKU mặc định để bán và quản lý kho. Không tồn tại sản phẩm không có SKU.
- Mỗi dòng đơn phải lưu snapshot tại thời điểm bán: `sku_snapshot`, `product_name_snapshot`, `variant_name_snapshot`, đơn giá, giảm giá, thành tiền. Sau này đổi tên sản phẩm/SKU cũng không được làm thay đổi đơn cũ.
- Không được bán SKU đang ngừng bán (`inactive`) và không được bán khi sản phẩm cha đang ngừng bán.

Kiểm chứng bắt buộc: tạo đơn chỉ chọn sản phẩm cha phải bị chặn; tạo đơn chọn SKU cụ thể phải trừ đúng SKU đó, không trừ SKU khác cùng sản phẩm cha.

---

## 2. Mọi thay đổi kho phải có transaction, không trừ/hoàn 2 lần, không tồn âm ở MVP

### 2.1. Tách tồn hiện tại và lịch sử kho

- `inventory_items` chỉ lưu tồn hiện tại của từng SKU.
- Mọi thay đổi tồn đều phải tạo `inventory_transactions` với đầy đủ: `product_variant_id`, `transaction_type`, `quantity_before`, `quantity_changed`, `quantity_after`, `reason`, `reference_type`, `reference_id` (nếu có), `created_by`, `created_at`.
- Cấm sửa trực tiếp `inventory_items.quantity` ngoài inventory service. Mọi thao tác nhập kho, điều chỉnh, trừ kho, hoàn kho đều phải đi qua service này.

### 2.2. Các loại transaction trong MVP

`initial`, `import`, `export`, `adjustment_increase`, `adjustment_decrease`, `set`, `order_confirmed`, `order_cancelled`, `return`.

### 2.3. Trừ kho và hoàn kho chỉ đúng 1 lần

- Chỉ trừ kho khi đơn chuyển từ `draft` sang `confirmed`.
- Đơn phải có cờ `inventory_deducted` và `inventory_deducted_at`. Nếu cờ đã là `true`, mọi lần xác nhận lại sau đó đều không được trừ kho thêm, không được tạo thêm transaction `order_confirmed`.
- Chỉ hoàn kho khi đơn đã trừ kho rồi mới bị hủy/hoàn. Đơn phải có cờ `inventory_restored` và `inventory_restored_at`. Nếu cờ đã là `true`, không được hoàn kho lần 2, không được tạo thêm transaction `order_cancelled`/`return` cho cùng một lần hoàn.
- Chuyển trạng thái qua lại (ví dụ confirmed → packing → shipping → completed) không được tự tạo transaction kho.

### 2.4. Không tồn âm ở MVP

- Trước khi trừ kho, giảm tồn, đặt lại tồn hay xác nhận đơn, hệ thống phải kiểm tra để `quantity_after >= 0` với mọi SKU liên quan.
- Nếu bất kỳ SKU nào không đủ tồn, toàn bộ thao tác đó phải bị chặn và rollback, không được trừ một phần rồi báo lỗi một phần.
- Điều chỉnh kho hàng loạt cũng vậy: chỉ cần 1 dòng gây âm là không lưu toàn bộ, và phải báo rõ SKU nào gây lỗi.
- Mọi thao tác kho thủ công (nhập, điều chỉnh tăng/giảm, đặt lại) bắt buộc có lý do.

Kiểm chứng bắt buộc: xác nhận đơn 2 lần không trừ kho 2 lần; hủy đơn 2 lần không hoàn kho 2 lần; bán vượt tồn bị chặn; tồn ban đầu nhập 10 thì sau khi lưu kho phải hiển thị đúng 10.

---

## 3. Tiền: paid_total tính từ payment, không sửa tay; công nợ phải khớp theo đơn và theo khách

### 3.1. Payment là bản ghi riêng, không phải một con số trên đơn

- Một đơn có thể có nhiều payment. Mỗi payment có: `order_id`, `customer_id`, `amount`, `payment_method`, `paid_at`, `note`, `status` (`active`/`cancelled`), `created_by`, `created_at`.
- Cấm sửa trực tiếp `paid_total` trên đơn bằng tay, kể cả từ frontend hay từ API sửa đơn. Frontend có thể tính để hiển thị, nhưng backend phải tính lại và không tin giá trị frontend gửi lên.

### 3.2. Công thức duy nhất, do backend tính lại sau mỗi thay đổi payment

- `paid_total = tổng amount của các payment đang active của đơn đó`.
- `debt_total = grand_total - paid_total`.
- `payment_status`: `paid_total = 0` → `unpaid`; `0 < paid_total < grand_total` → `partial`; `paid_total = grand_total` → `paid`.
- Trong MVP: `amount > 0`, `payment_method` bắt buộc, và `amount` không được lớn hơn `debt_total` còn lại. Không cho thanh toán vượt trong MVP.
- Khi tạo, sửa hoặc hủy payment, backend phải tính lại ngay `paid_total`, `debt_total`, `payment_status` của đơn, và ghi audit log.

### 3.3. Hủy payment không xóa lịch sử

- Hủy payment là chuyển `status` sang `cancelled`, bắt buộc nhập lý do, lưu `cancelled_by`, `cancelled_at`. Payment đã hủy không được tính vào `paid_total` và tiền đã thu.
- Không xóa cứng payment đã có lịch sử quan trọng.

### 3.4. Công nợ phải khớp ở cả 2 cấp

- Công nợ theo đơn = `debt_total` của đơn đó.
- Công nợ theo khách = tổng `debt_total` của tất cả đơn còn nợ của khách đó.
- Dashboard, danh sách công nợ, và tab công nợ trong hồ sơ khách phải cho cùng một con số với 2 công thức trên. Lệch nhau là lỗi blocker.

Kiểm chứng bắt buộc: đơn 1.000.000, cọc 300.000 → còn nợ 700.000; trả thêm 500.000 → còn nợ 200.000; hủy payment 500.000 → còn nợ quay lại 700.000 và trạng thái thanh toán cập nhật đúng.

---

## 4. Chống trùng: số điện thoại khách hàng và mã SKU

### 4.1. Số điện thoại — không giới hạn cứng 2 số, kiểm tra trùng tất cả các số

- **Không chốt cứng mỗi khách hàng chỉ có tối đa 2 số điện thoại.** Một khách hàng có thể có nhiều số điện thoại, không giới hạn số lượng ở database và ở giao diện (giao diện dùng nút “+ Thêm số điện thoại”, mỗi lần thêm một số).
- Mô hình dữ liệu phải dùng bảng riêng cho số điện thoại, ví dụ `customer_phones`, thay vì chỉ có 2 cột cố định trên bảng khách hàng. Mỗi dòng gồm ít nhất: `customer_id`, `phone`, `phone_normalized`, `is_primary`, `label` (ví dụ: chính, phụ, Zalo, người thân), `status`, `created_at`. Một khách có đúng 1 số chính (`is_primary = true`) dùng để hiển thị mặc định, tìm kiếm và điền nhanh khi tạo đơn; các số còn lại là số phụ.
- Dữ liệu cũ `phone_1` / `phone_2` (nếu có) phải được chuyển sang bảng `customer_phones` khi migrate, giữ đúng thứ tự, trong đó `phone_1` thành số chính, `phone_2` thành số phụ. Sau khi chuyển, không được dùng 2 cột cũ làm giới hạn cho tính năng mới.
- Trước khi so sánh, chuẩn hóa mọi số điện thoại giống nhau: bỏ khoảng trắng, dấu chấm, dấu gạch ngang; chuyển đầu `+84` về `0`; lưu vào `phone_normalized` để kiểm tra.
- **Kiểm tra trùng trên tất cả các số, không chỉ 2 số đầu:** bất kỳ số nào trong danh sách mới cũng phải được so với tất cả các số đang hoạt động của tất cả khách hàng khác, và so với chính các số còn lại trong cùng danh sách đó. Không còn khái niệm chỉ kiểm tra 4 chiều `phone_1`/`phone_2` nữa, vì với N số thì số chiều kiểm tra là N × tổng số điện thoại của các khách khác.
- Áp dụng cả khi tạo mới, khi sửa, khi thêm/bớt số, và khi import khách hàng. Khi sửa, loại trừ chính khách đang sửa khỏi kết quả kiểm tra trùng với khách khác, nhưng vẫn phải chặn trùng ngay trong chính danh sách số của khách đó.
- Số điện thoại trùng chính xác với khách khác thì chặn tạo/sửa/thêm số đó, không tạo hồ sơ trùng. Thông báo phải chỉ rõ số nào trùng và khách nào đã có số đó để người dùng mở hồ sơ cũ thay vì tạo mới.
- Trong cùng một khách, 2 số sau khi chuẩn hóa mà giống nhau thì phải chặn, không chỉ cảnh báo.
- Xóa số điện thoại: số phụ có thể xóa mềm/ngừng sử dụng; số chính chỉ được xóa khi khách còn ít nhất 1 số khác và số đó được chuyển thành số chính, hoặc khi khách không còn số nào thì phải xác nhận rõ. Số đã từng dùng trong đơn hàng/lịch sử chăm sóc thì không được xóa mất dấu vết.
- Tìm kiếm, tạo đơn và hiển thị khách phải tìm được khách qua bất kỳ số nào trong danh sách, không chỉ số chính.

### 4.2. Mã SKU

- `sku` là duy nhất toàn hệ thống, có ràng buộc unique ở database, không chỉ kiểm tra ở frontend.
- SKU lưu ở dạng đã trim khoảng trắng và viết hoa. Người dùng tự nhập SKU mà bị trùng thì báo lỗi, hệ thống không tự ý đổi mã của người dùng.
- SKU do hệ thống tự sinh mà bị trùng thì tự thêm hậu tố tăng dần (`...-002`, `...-003`, ...) cho tới khi hết trùng.
- Import sản phẩm/SKU cũng phải kiểm tra trùng SKU trong file và trùng với database, giống như tạo tay.

Kiểm chứng bắt buộc: tạo khách trùng số, sửa số thành số của khách khác, tạo SKU trùng, import SKU trùng đều phải bị chặn và báo rõ.

---

## 5. Không xóa cứng dữ liệu đã có giao dịch

- Ưu tiên dùng trạng thái thay vì xóa: khách `inactive` / ngừng hoạt động, sản phẩm/SKU `inactive` / ngừng bán, payment `cancelled`, đơn `cancelled` / `returned`, user `inactive` / `locked`.
- Không xóa cứng: khách đã có đơn hàng, thanh toán hoặc lịch sử chăm sóc quan trọng; sản phẩm/SKU đã có tồn kho hoặc đơn hàng; đơn hàng; payment; user đã có lịch sử thao tác; tag/danh mục đang được sử dụng.
- Chỉ được xóa cứng khi đồng thời thỏa mãn: bản ghi chưa có bất kỳ dữ liệu liên quan nào, người thực hiện có quyền Admin, và thao tác được ghi audit log. Ngoài trường hợp đó, chỉ được chuyển trạng thái.
- Xóa mềm (nếu dùng `deleted_at`) vẫn phải giữ lại lịch sử kho, đơn, payment và audit log liên quan để truy vết.

---

## 6. Backend kiểm tra quyền, frontend ẩn nút chỉ là giao diện

- Ẩn nút, ẩn menu, ẩn cột ở frontend không phải là bảo mật. Mọi API quan trọng đều phải kiểm tra ở backend: đã đăng nhập chưa, có permission không, và có đúng phạm vi dữ liệu không (`all` / `team` / `own` / `assigned`).
- Không đủ quyền thì backend trả lỗi từ chối (403), không trả dữ liệu và không thực hiện thao tác, kể cả khi request được gọi trực tiếp bằng API.
- Dữ liệu nhạy cảm phải được lọc ở backend trước khi trả về và trước khi export, không chỉ ẩn ở giao diện. Bao gồm ít nhất: `import_price`, lãi gộp, giá trị tồn kho, doanh thu toàn hệ thống, công nợ toàn hệ thống, export toàn bộ khách hàng — nếu user không có quyền tương ứng thì không được thấy các trường này ở UI, API hay file export.
- User bị khóa (`locked` / `inactive`) không được đăng nhập. Mật khẩu không lưu plain text, không trả `password_hash` ra frontend, không ghi mật khẩu vào log.
- Các thao tác nhạy cảm sau đây bắt buộc phải kiểm tra quyền ở backend và ghi audit log: điều chỉnh kho, hủy đơn, hủy/sửa payment, đổi giá nhập/giá bán, đổi vai trò/quyền của user, import/export dữ liệu nhạy cảm.

Kiểm chứng bắt buộc: dùng tài khoản sale gọi trực tiếp API điều chỉnh kho, hủy payment, xem giá nhập, export toàn bộ khách khi không có quyền đều phải bị chặn ở backend, không chỉ bị ẩn nút.

---

## Checklist blocker trước khi coi một sprint là xong

Nếu vi phạm bất kỳ mục nào dưới đây, sprint đó chưa được coi là hoàn thành, dù giao diện đã chạy được:

1. Đơn chọn được sản phẩm cha thay vì SKU.
2. Tồn kho ban đầu nhập 10 nhưng lưu thành 0.
3. Thay đổi kho không có transaction, hoặc transaction thiếu before/after.
4. Xác nhận đơn trừ kho 2 lần, hoặc hủy đơn hoàn kho 2 lần.
5. Hủy đơn đã trừ kho nhưng không hoàn kho.
6. `paid_total` / `debt_total` / `payment_status` lệch nhau hoặc lệch với tổng payment active.
7. Hủy payment nhưng công nợ không tính lại.
8. Tạo hoặc sửa thành khách trùng số điện thoại (kể cả trùng ở bất kỳ số phụ nào trong danh sách nhiều số), hoặc SKU trùng; hoặc khách bị giới hạn cứng ở tối đa 2 số điện thoại.
9. Xóa cứng khách/SKU/đơn/payment đã có giao dịch.
10. User không có quyền vẫn gọi API thành công, hoặc vẫn thấy giá nhập/lãi gộp/công nợ toàn hệ thống ở API/export.
