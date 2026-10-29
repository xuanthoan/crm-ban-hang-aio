# CRM_Ban_Hang

Phần mềm CRM bán hàng cho cửa hàng nhỏ và vừa bán hàng vật lý
(sách, đồ chơi, balo, quần áo, mỹ phẩm, sữa, đồ dùng học tập, …).

> **Trạng thái: toàn bộ MVP đã xong ở mức code — Scaffold, Auth, Customer,
> Product/SKU, Inventory, Order, Payment/Debt, Care/Reminders, Dashboard/Reports,
> Import/Export (CSV) và Audit — nhưng CHƯA kiểm chứng với database thật
> (chưa chạy được prisma generate/migrate/seed và docker compose up trên máy này
> vì chưa có Docker/PostgreSQL).**
> Quy tắc chốt cứng trong `docs/12_QUY_TAC_CHOT_CUNG.md` thắng mọi tài liệu cũ
> khi có mâu thuẫn.

## Quyết định đã chốt (2026-10-28)

1. **Database: PostgreSQL** — không đổi sang SQLite. Schema Prisma dùng provider `postgresql`.
2. **Chạy bằng cả Docker Compose và npm, cùng một code, cùng một env.**
   Tiêu chí chọn: dễ dùng, đơn giản, dễ bảo trì, nâng cấp, ít lỗi.
   - **Docker Compose: dùng để chạy/vận hành hàng ngày và triển khai.**
     Một lệnh là có đủ postgres + backend + frontend, dữ liệu nằm trong
     volume `postgres_data`, nâng cấp bằng build lại rồi up lại.
   - **npm: dùng để phát triển/debug.** Chạy backend/frontend riêng, xem log
     trực tiếp, sửa code là chạy lại ngay, không phải build image.
   - Không duy trì 2 bộ code hay 2 bộ cấu hình khác nhau: cùng biến môi
     trường (`DATABASE_URL`, `JWT_SECRET`, `SMTP_*`, `OTP_DEV_LOG`).
3. **Đăng nhập: tên đăng nhập + mật khẩu là mặc định.** OTP qua email là
   tùy chọn do admin bật/tắt (xem “Cấu hình OTP” bên dưới). OTP qua
   điện thoại/SMS chưa làm vì chưa có nhà cung cấp SMS.

## Stack

- Backend: Node.js + TypeScript + Express + Prisma (PostgreSQL)
- Frontend: React + TypeScript + Vite + TailwindCSS
- Docker: backend chạy `node dist/index.js`, frontend build Vite rồi phục vụ bằng nginx (proxy `/api` sang backend)

## Chạy bằng Docker Compose (khuyên dùng để chạy hàng ngày)

```bash
cp .env.example .env   # bắt buộc: đặt JWT_SECRET thành chuỗi ngẫu nhiên dài
docker compose up -d --build
# frontend: http://localhost:5173
# backend:  http://localhost:3001/api/health
# postgres: localhost:5432
```

Khởi tạo database lần đầu (sau khi postgres đã healthy):

```bash
docker compose exec backend npx prisma migrate dev
docker compose exec backend npm run seed        # 5 vai trò + quyền, otp_mode=off
docker compose exec backend npm run seed:admin  # cần ADMIN_* trong .env của backend (xem dưới)
```

> Lưu ý: `seed:admin` đọc `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
> từ môi trường của backend. Với Compose, đặt 3 biến này trong file `.env`
> ở gốc repo (Compose đã truyền chúng vào backend) rồi chạy seed; với npm
> thì đặt 3 biến đó trong `backend/.env`. Không có admin nào được tạo nếu
> hệ thống đã có admin, và không có mật khẩu mặc định nào trong code.

Dừng / khởi động lại (dữ liệu không mất vì nằm trong volume):

```bash
docker compose down        # dừng, giữ volume
docker compose up -d       # chạy lại
```

Nâng cấp code mới:

```bash
docker compose up -d --build
docker compose exec backend npx prisma migrate deploy
```

Sao lưu database (PostgreSQL trong volume):

```bash
docker compose exec postgres pg_dump -U postgres crm_ban_hang > backup.sql
# Khôi phục: docker compose exec -T postgres psql -U postgres crm_ban_hang < backup.sql
```

Xóa sạch cả dữ liệu (chỉ làm khi thật sự muốn bắt đầu lại):

```bash
docker compose down -v
```

## Chạy bằng npm (phát triển / debug)

```bash
cd backend
cp .env.example .env   # sửa DATABASE_URL, JWT_SECRET (bắt buộc), SMTP_* nếu dùng OTP email
npm install
npx prisma generate
npx prisma migrate dev
npm run seed
npm run seed:admin     # cần ADMIN_USERNAME / ADMIN_EMAIL / ADMIN_PASSWORD trong .env, mật khẩu >= 8 ký tự
npm run dev            # http://localhost:3001
curl http://localhost:3001/api/health   # {"status":"ok"} — không cần database
```

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173 (proxy /api sang localhost:3001)
```

Build / chạy bản đã build:

```bash
cd backend && npm run build && npm start
cd frontend && npm run build && npm run preview
```

## Đăng nhập và API Auth

| Endpoint | Quyền | Ghi chú |
|---|---|---|
| `POST /api/auth/login` | Công khai | `{username, password}`. Nếu không cần OTP → trả `token` + `user`. Nếu cần OTP → trả `otp_required`, `otp_challenge_id`, `masked_email`, `expires_at` |
| `POST /api/auth/verify-otp` | Công khai | `{otp_challenge_id, code}` — mã 6 số, hết hạn 5 phút, sai quá 5 lần phải đăng nhập lại |
| `POST /api/auth/resend-otp` | Công khai | `{otp_challenge_id}` — chờ 60 giây giữa 2 lần gửi |
| `GET /api/auth/me` | Đã đăng nhập | Không bao giờ trả `passwordHash` |
| `POST /api/auth/logout` | Đã đăng nhập | MVP: JWT là stateless nên đăng xuất là xóa token ở client; token cũ còn hiệu lực tới khi hết hạn (mặc định 8h) |
| `POST /api/auth/change-password` | Đã đăng nhập | Cần mật khẩu cũ, mật khẩu mới >= 8 ký tự |

- Token JWT chứa `userId`, `username`, `role`; hết hạn theo `JWT_EXPIRES_IN` (mặc định `8h`).
- **Không có `JWT_SECRET` thì backend từ chối khởi động** và báo rõ cần đặt biến này — không dùng secret mặc định cứng trong code.
- Tài khoản `locked`/`inactive` không đăng nhập được, kể cả dùng token cũ.
- Thiếu token → 401, sai quyền → 403 và không trả dữ liệu (backend kiểm tra, không chỉ ẩn nút ở frontend).

### Quản trị người dùng (cần quyền, chỉ admin mặc định có đủ)

| Endpoint | Quyền |
|---|---|
| `GET /api/admin/users` | `user.view` |
| `POST /api/admin/users` | `user.create` |
| `PATCH /api/admin/users/:id` | `user.update` (+ `user.set_require_otp` nếu đổi `requireOtp`) |
| `POST /api/admin/users/:id/lock` và `/unlock` | `user.lock` |
| `POST /api/admin/users/:id/reset-password` | `user.reset_password` |
| `GET /api/admin/roles` | `role.view` |
| `GET /api/admin/settings`, `PUT /api/admin/settings/otp-mode` | `settings.view`, `settings.update_otp` |

Không thể khóa / hạ vai trò của admin đang hoạt động duy nhất trong hệ thống.
Mật khẩu lưu bằng bcrypt, không ghi vào log, không trả ra API.
Audit log ghi lại: đăng nhập sai, đổi mật khẩu, khóa/mở khóa user, đổi vai trò, đổi cấu hình OTP.

## Khách hàng — API Sprint Customer

Quy tắc chốt cứng: một khách có bao nhiêu số cũng được (bảng `CustomerPhone`, không dùng `phone_1`/`phone_2`),
đúng 1 số chính, chuẩn hóa số trước khi lưu/so sánh (bỏ khoảng trắng, dấu chấm, dấu gạch ngang, `+84` → `0`),
kiểm tra trùng trên **tất cả** các số — trùng với khách khác hoặc trùng trong cùng một khách đều chặn toàn bộ
thao tác (rollback) và báo rõ số nào trùng với khách nào.

| Endpoint | Quyền | Ghi chú |
|---|---|---|
| `GET /api/customers?page=&pageSize=&q=&tagId=&status=&source=&createdFrom=&createdTo=` | `customer.view_all` hoặc `customer.view_own` | Phân trang, mặc định 20/trang, tối đa 100. `q` tìm theo tên hoặc **bất kỳ số nào** (chuẩn hóa từ khóa giống số đã lưu) |
| `GET /api/customers/:id` | `customer.view_all` hoặc `customer.view_own` (trong phạm vi) | Hồ sơ 360: thông tin, tất cả số, tag, con (kèm tuổi tính từ ngày sinh), người tạo/phụ trách. Đơn hàng/thanh toán để trống với ghi chú "sẽ có ở Sprint Đơn hàng/Thanh toán", không fake số liệu |
| `POST /api/customers` | `customer.create` | Tạo khách + số + tag + con trong một transaction. Họ tên hoặc ít nhất một số là bắt buộc |
| `PATCH /api/customers/:id` | `customer.update` | Chỉ đổi những gì được gửi lên (`phones`/`tagIds`/`children` vắng mặt thì giữ nguyên) |
| `DELETE /api/customers/:id` | `customer.deactivate` | Mặc định là xóa mềm: trạng thái `inactive` + `deletedAt` |
| `DELETE /api/customers/:id?hard=true` | `customer.hard_delete` (chỉ Admin) | Chỉ thành công khi khách **chưa có bất kỳ dữ liệu liên quan nào** (số, tag, con, đơn, thanh toán, chăm sóc, nhắc việc); có liên quan thì trả lỗi và giữ nguyên |
| `POST /api/customers/:id/phones`, `POST /api/customers/:id/phones/:phoneId/make-primary`, `DELETE /api/customers/:id/phones/:phoneId` | `customer.update` | Thêm một số, đổi số chính, xóa mềm một số. Xóa số chính thì số còn lại cũ nhất tự thành số chính; xóa số chính duy nhất cần xác nhận `confirm_delete_last_phone: true` |
| `POST /api/customers/:id/tags`, `DELETE /api/customers/:id/tags/:tagId` | `customer.update` | Gán / bỏ gán tag cho khách |
| `POST /api/customers/:id/children`, `PATCH /api/customers/:id/children/:childId`, `DELETE /api/customers/:id/children/:childId` | `customer.update` | Thêm / sửa / xóa mềm con. Ngày sinh con không được là ngày tương lai; tuổi tính từ ngày sinh khi trả về, không lưu tuổi cứng |
| `GET /api/tags`, `POST /api/tags`, `PATCH /api/tags/:id`, `DELETE /api/tags/:id` | Xem: `customer.view_all`/`view_own`; tạo/sửa/xóa: `customer.tag_manage` (Admin/Manager) | Tên tag duy nhất sau khi trim (không phân biệt hoa/thường); xóa tag là ngừng hoạt động (xóa mềm) |

Phạm vi dữ liệu: `customer.view_all` xem tất cả khách. `customer.view_own` chỉ xem khách do mình tạo
hoặc được giao phụ trách (`createdById`/`assignedToId`). Chưa có thực thể team nên phạm vi team chưa
thực thi được — xem `DEVELOPMENT_PLAN.md`. Dữ liệu con là dữ liệu nhạy cảm, chỉ trả cho user có quyền
xem khách, không export tràn lan (export thuộc Sprint Import/Export sau).

## Sản phẩm / SKU — API Sprint Product/SKU

Quy tắc chốt cứng: sản phẩm cha **không phải** đơn vị bán — chỉ SKU (biến thể) mới bán và trừ kho.
Sản phẩm không có biến thể luôn có đúng 1 SKU mặc định (`isDefault=true`). SKU lưu trim + viết hoa,
duy nhất toàn hệ thống: SKU do bạn nhập mà trùng thì bị chặn (400 kèm sản phẩm đã có SKU đó, hệ thống
không tự đổi mã của bạn); SKU tự sinh trùng thì tự thêm hậu tố `-002`, `-003`, … Mã tự sinh =
slug tên sản phẩm + slug từng giá trị thuộc tính, ví dụ `AO-THUN-NU-2027-DEN-S`.
SKU của biến thể inactive/xóa mềm không được tái sử dụng khi hàng của nó còn tồn tại.
Biến thể mới luôn có `InventoryItem` tồn 0 và **không** có transaction kho — tồn ban đầu được nhập
ở Sprint Kho (kèm transaction loại `initial`); gửi `initialQuantity` khác 0 khi tạo sản phẩm sẽ bị
từ chối kèm thông báo rõ, thay vì bị lặng lẽ bỏ qua hay lưu tồn mà không có transaction.

| Endpoint | Quyền | Ghi chú |
|---|---|---|
| `GET /api/products?page=&pageSize=&q=&sku=&categoryId=&status=&variantStatus=&minPrice=&maxPrice=` | `product.view` | Phân trang, mặc định 20/trang, tối đa 100. `q` tìm theo tên, SKU, mã vạch, tên biến thể; kèm biến thể + tổng tồn |
| `GET /api/products/:id` | `product.view` | Chi tiết cha + toàn bộ biến thể + tồn từng SKU + ghi chú tồn ban đầu thuộc Sprint Kho |
| `POST /api/products` | `product.create` | Tạo cha + biến thể trong một transaction. Không gửi `variants`/`variantOptions` → tự tạo 1 SKU mặc định; gửi `variantOptions` (tối đa 3 nhóm, tối đa 200 tổ hợp) → tự sinh tổ hợp; gửi `variants` → tạo thủ công từng biến thể |
| `PATCH /api/products/:id` | `product.update` | Chỉ đổi những gì được gửi lên; gửi kèm `variants` để thêm/sửa biến thể, gửi kèm `variantOptions` để sinh thêm tổ hợp (tổ hợp đã có sẽ bị bỏ qua và báo rõ) |
| `DELETE /api/products/:id` | `product.deactivate` | Mặc định là ngừng bán cả sản phẩm + toàn bộ SKU (xóa mềm) |
| `DELETE /api/products/:id?hard=true` | `product.hard_delete` (chỉ Admin) | Chỉ thành công khi không còn dòng đơn, lịch sử kho và tồn khác 0; có liên quan thì trả lỗi và giữ nguyên |
| `POST /api/products/:id/variants`, `PATCH /api/products/:id/variants/:variantId`, `DELETE /api/products/:id/variants/:variantId` | Tạo/sửa: `product.update`; xóa: `product.deactivate` (xóa cứng: `product.hard_delete`) | Thêm/sửa/ngừng 1 SKU. Không được xóa SKU duy nhất còn lại của sản phẩm; đổi mã SKU bị chặn khi biến thể đã có dòng đơn hàng |
| `POST /api/products/:id/variants/generate` | `product.update` | Sinh thêm tổ hợp từ `variantOptions`, trả `createdSkus` và `skippedCombinations` |
| `GET /api/variants?q=&productId=&categoryId=&status=&sellable=&minPrice=&maxPrice=` | `product.view` | Tìm mọi SKU; `sellable=true` chỉ trả SKU đang bán được (biến thể active và sản phẩm cha active) |
| `GET /api/categories`, `POST /api/categories` | Xem: `product.view`; tạo: `product.create` | Danh mục; tạo trùng tên (không phân biệt hoa/thường) sẽ kích hoạt lại danh mục đã xóa mềm nếu có |

Giá nhập (`importPrice`) chỉ trả cho user có `product.view_cost` — user khác không thấy trường này ở API.
Đổi giá bán cần `product.update_price`, đổi giá nhập cần `product.update_cost`; đổi giá ghi audit giá cũ/mới.
Theo tập quyền mặc định hiện tại, chỉ Admin có `product.create/update`, các vai trò khác chỉ xem.

## Kho — API Sprint Kho

Quy tắc chốt cứng: mọi thay đổi tồn đều đi qua inventory service duy nhất (`backend/src/lib/inventory.ts`)
trong một transaction Prisma — kiểm tra tồn âm, ghi `InventoryTransaction` bất biến
(before/changed/after/reason/reference/createdBy), rồi mới cập nhật `InventoryItem.quantity`.
Không route nào sửa trực tiếp quantity. Tồn không bao giờ âm ở MVP; thao tác hàng loạt lỗi ở 1 SKU
thì rollback toàn bộ, không áp dụng một phần.

| Endpoint | Quyền | Ghi chú |
|---|---|---|
| `GET /api/inventory?page=&pageSize=&q=&categoryId=&variantStatus=&maxQuantity=&sort=` | `inventory.view` | Tồn theo SKU, mặc định 20/trang, tối đa 100. `q` tìm theo SKU/tên sản phẩm/tên biến thể/mã vạch; `sort=low_stock` sắp xếp tồn thấp lên trước; `maxQuantity` lọc tồn ≤ N (chưa có cột ngưỡng tồn thấp riêng cho từng SKU trong schema) |
| `GET /api/inventory/:variantId` | `inventory.view` | Tồn hiện tại của 1 SKU; SKU chưa có dòng tồn thì trả tồn 0 kèm ghi chú |
| `GET /api/inventory/:variantId/transactions?type=&from=&to=` | `inventory.view_transactions` | Lịch sử kho của 1 SKU, mới nhất trước; lịch sử bất biến, không có API sửa/xóa transaction |
| `POST /api/inventory/initial` | `inventory.import_stock` | Nhập tồn ban đầu, 1 hoặc nhiều SKU (`{items:[{variantId,quantity,reason?}]}` hoặc 1 dòng). Chỉ cho khi SKU chưa có transaction nào; lần 2 trả 409 và hướng dùng điều chỉnh. Initial 0 không ghi transaction rỗng |
| `POST /api/inventory/import` | `inventory.import_stock` | Nhập kho, số lượng > 0, bắt buộc có lý do |
| `POST /api/inventory/export` | `inventory.export` (mới, Warehouse) | Xuất kho thủ công, số lượng > 0, bắt buộc có lý do, chặn toàn bộ nếu bất kỳ SKU nào sẽ âm |
| `POST /api/inventory/adjust` | `inventory.adjust` | Điều chỉnh: `mode` = `increase` / `decrease` (kèm `quantity` > 0) hoặc `set` (kèm `setTo` ≥ 0, changed = mới − cũ; changed = 0 thì từ chối, không ghi transaction rỗng). Bắt buộc có lý do |

Quyết định SKU inactive: initial/import/export bị chặn cho biến thể hoặc sản phẩm cha inactive;
adjust được phép cho SKU inactive (kiểm kê / xử lý tồn chết, theo docs 03 §20) với lý do bắt buộc,
kết quả gắn cờ `inactiveWarning`. Xem tồn và lịch sử vẫn được cho SKU inactive.

Chuẩn bị cho Sprint Đơn hàng: service đã có `deductForOrder` / `restoreForOrder` dùng cờ
`inventoryDeducted` / `inventoryRestored` của đơn — trừ lần 2 và hoàn lần 2 đều bị chặn (409),
hoàn khi chưa từng trừ cũng bị chặn, trừ chặn SKU inactive, hoàn cho phép SKU đã inactive sau
khi bán. Sprint Đơn hàng đã gọi `deductForOrder` khi xác nhận đơn; hủy đơn đã xác nhận sau
khi đã trả một phần thì hoàn phần chưa trả qua `applyInventoryChange` (cùng service) thay vì
`restoreForOrder` nguyên bản, để không hoàn trùng phần đã trả.

## Đơn hàng — API Sprint Đơn hàng

Trạng thái MVP chỉ có 4 giá trị: `draft` / `confirmed` / `completed` / `cancelled` (không có
packing/shipping/returned). Đơn nháp GIỮ TỒN qua `InventoryItem.reservedQuantity`: tồn khả dụng
= tồn vật lý − tồn đang giữ. Xác nhận mới trừ kho thật (loại `order_confirmed`) và chỉ trừ 1 lần.
Hủy đơn nháp giải phóng đặt giữ; hủy đơn đã xác nhận hoàn phần chưa trả (loại `order_cancelled`).
Trả hàng một phần hoàn kho (loại `return`) và tính lại tổng tiền, trạng thái đơn giữ nguyên,
`fullyReturned = true` khi mọi dòng đã trả hết. Tiền sprint này: `paidTotal = 0` (chưa có payment),
`debtTotal = grandTotal`; Sprint Thanh toán sẽ tính lại từ payment active.

| Endpoint | Quyền | Ghi chú |
|---|---|---|
| `GET /api/orders?page=&pageSize=&q=&status=&customerId=&dateFrom=&dateTo=&minTotal=&maxTotal=` | `order.view_all` hoặc `order.view_own` (trong phạm vi) | Danh sách đơn, mặc định 20/trang, tối đa 100; `q` tìm theo mã đơn/tên khách |
| `GET /api/orders/:id` | `order.view_all` hoặc `order.view_own` (trong phạm vi) | Chi tiết kèm khách, từng dòng với snapshot SKU/tên/đơn giá, số đã trả và còn trả được, cờ đã trừ/đã hoàn, fullyReturned |
| `POST /api/orders` | `order.create` | Tạo đơn nháp + giữ tồn trong cùng transaction. Body: `{customerId, items:[{productVariantId, quantity, unitPrice?, discountAmount?}], discountTotal?, shippingFee?, note?}`. Dòng bắt buộc có SKU, không nhận product cha; SKU/cha phải active; đơn giá mặc định = giá bán hiện tại của SKU (snapshot); thiếu tồn khả dụng thì chặn toàn bộ |
| `PATCH /api/orders/:id` | `order.update_draft` | Chỉ sửa được đơn nháp (dòng/tổng tiền/ghi chú); giải phóng đặt giữ cũ rồi đặt giữ lại theo dòng mới trong cùng transaction; không đổi khách hàng của đơn |
| `POST /api/orders/:id/confirm` | `order.confirm` | draft → confirmed: đặt giữ chuyển thành trừ kho thật, bật cờ `inventoryDeducted`; xác nhận lần 2 bị chặn; tồn vật lý thấp hơn số giữ thì chặn xác nhận, đơn vẫn nháp |
| `POST /api/orders/:id/complete` | `order.complete` | confirmed → completed: chỉ đổi trạng thái, không đổi tồn/tiền |
| `POST /api/orders/:id/cancel` | `order.cancel` | draft → cancelled (giải phóng đặt giữ) hoặc confirmed → cancelled (hoàn phần chưa trả); completed/cancelled không hủy được |
| `POST /api/orders/:id/return` | `order.return` (mới, Manager) | Trả hàng một phần, chỉ cho đơn confirmed/completed. Body: `{items:[{orderItemId\|productVariantId, quantity}], reason}` — lý do bắt buộc; vượt số còn trả được thì chặn toàn bộ; tính lại tổng theo số còn lại, cap chiết khấu ở subtotal mới |
| `DELETE /api/orders/:id` | `order.cancel` (mặc định) hoặc `order.hard_delete` (mới, chỉ Admin, với `?hard=true`) | Mặc định = hủy theo luồng cancel; xóa cứng chỉ đơn nháp chưa từng trừ kho, chưa có payment, chưa có inventory transaction |

## Thanh toán / Công nợ — API Sprint Thanh toán

Công thức duy nhất, do backend tính lại sau mỗi thay đổi payment (frontend gửi
`paidTotal`/`debtTotal` lên cũng bị bỏ qua): `paid_total = tổng amount của các payment
đang active của đơn`; `debt_total = grand_total - paid_total`; `payment_status` là
`unpaid` / `partial` / `paid` theo công thức đó. Trả hàng làm `grand_total` nhỏ hơn
`paid_total` thì `debt_total` âm — đó là tiền thừa của khách (credit), trạng thái vẫn
`paid`, không tạo thêm payment, hoàn tiền chưa làm ở sprint này.

| Endpoint | Quyền | Ghi chú |
|---|---|---|
| `GET /api/orders/:id/payments` | `payment.view_all` hoặc `payment.view_own` (trong phạm vi) | Danh sách payment của 1 đơn, mới nhất trước, kèm cả payment đã hủy (lý do/người hủy/ngày hủy) và tổng tiền hiện tại của đơn |
| `POST /api/orders/:id/payments` | `payment.create` | Body duy nhất được nhận: `{amount, paymentMethod, note?}`. `amount` phải là số nguyên đồng > 0; `paymentMethod` theo docs 05 §7.1: `cash` (Tiền mặt), `bank_transfer` (Chuyển khoản), `cod` (COD), `e_wallet` (Ví điện tử). Chỉ thu cho đơn confirmed/completed; khóa dòng đơn rồi đọc lại tổng active trong cùng transaction; vượt số còn nợ hoặc đơn đã đủ/thừa tiền thì chặn toàn bộ |
| `POST /api/payments/:id/cancel` | `payment.cancel` | Hủy payment, bắt buộc có `reason`; lưu `cancelReason`/`cancelledById`/`cancelledAt`, chuyển sang `cancelled`, KHÔNG xóa cứng, không xóa khỏi danh sách. Hủy payment đã hủy rồi → 409; hủy không hoàn kho, không đổi trạng thái đơn. Không có route xóa cứng payment |
| `GET /api/debts?q=&customerId=&paymentStatus=&status=&sort=&debtOnly=` | `debt.view_all` hoặc `debt.view_own` (trong phạm vi) | Danh sách công nợ theo đơn, mặc định chỉ đơn confirmed/completed có `debt_total > 0`; kèm `summary.totalDebt`/`count` trên toàn bộ bộ lọc. `?status=` ghi đè để xem cả đơn nháp/đã hủy khi đối soát |
| `GET /api/customers/:id/debt` | `debt.view_all` hoặc `debt.view_own` (khách do mình tạo/phụ trách) | Công nợ theo khách, tính trực tiếp từ các đơn confirmed/completed của khách (không có trường tổng riêng trên Customer); trả `totalDebt` (ròng), `totalOwing`, `totalCredit` (tiền thừa) và danh sách đơn còn nợ. Đơn nháp và đơn đã hủy không tính là còn nợ |

## Chăm sóc / Nhắc việc / Phân đoạn — API Sprint Chăm sóc

Hoạt động chăm sóc là lịch sử bất biến: **không có route sửa/xóa activity** —
ghi sai thì ghi thêm một hoạt động mới để đính chính. Nhắc việc quá hạn/hôm
nay/sắp tới được tính trực tiếp từ hạn và trạng thái lúc đọc, không có job chạy
nền. Phân đoạn chỉ là danh sách để nhân viên tự chăm sóc: **sprint này KHÔNG tự
gửi Zalo/SMS/Email/Messenger và KHÔNG tự tạo hoạt động hay nhắc việc từ phân đoạn.**

| Endpoint | Quyền | Ghi chú |
|---|---|---|
| `GET /api/customers/:id/activities?type=&from=&to=` | `activity.view_all` hoặc `view_own` (trong phạm vi) | Lịch sử chăm sóc của 1 khách, mới nhất trước, lọc theo loại và khoảng ngày thực hiện |
| `POST /api/customers/:id/activities` | `activity.create` | Loại trong danh sách cố định docs 06 §5.2 (call, zalo, facebook, email, visit, consultation, quote, close, reschedule, refuse, after_sales, payment_reminder, complaint, internal_note, other); nội dung bắt buộc; kết quả không bắt buộc (docs 06 §5.3); ngày thực hiện mặc định hôm nay, không được là tương lai |
| `GET /api/activities?type=&createdById=&customerId=&from=&to=` | `activity.view_all` hoặc `view_own` | Hoạt động gần đây trong phạm vi user (`view_own`: do mình tạo hoặc của khách do mình tạo/phụ trách) |
| `GET /api/reminders?timeGroup=&status=&assignedToId=&customerId=&q=&days=` | `reminder.view_all` hoặc `view_own` | `timeGroup`: overdue/due_today/upcoming/done/cancelled/all; upcoming mặc định 7 ngày tới (`days` tối đa 90) |
| `POST /api/reminders` | `reminder.create` | Tiêu đề và hạn bắt buộc; khách và đơn liên quan không bắt buộc; người được giao mặc định là người tạo; chỉ người có `reminder.view_all` (manager/admin) mới được giao cho người khác |
| `PATCH /api/reminders/:id` | `reminder.update` | Chỉ sửa được nhắc việc đang chờ (pending) |
| `POST /api/reminders/:id/complete` | `reminder.complete` | Chỉ hoàn thành được nhắc việc pending; lưu người/ngày hoàn thành và ghi chú nếu có; hoàn thành lần 2 → 409 |
| `POST /api/reminders/:id/cancel` | `reminder.cancel` | Chỉ hủy được nhắc việc pending; lý do không bắt buộc; hủy rồi không hoàn thành được |
| `GET /api/segments?days=&inactiveDays=&tagId=` | `segment.view` | Định nghĩa + số lượng tính trực tiếp; phân đoạn theo tag cần `tagId` mới đếm được |
| `GET /api/segments/:key/customers?days=&inactiveDays=&threshold=&tagId=` | `segment.view` | Các phân đoạn: `birthday_customers`, `birthday_children` (chỉ tên con + khách + ngày sắp tới + tuổi sắp tới, không trả ngày sinh gốc), `inactive_customers` (mặc định 90 ngày, không lẫn khách chưa từng mua), `new_customers` (30 ngày), `no_purchase_customers`, `debt_customers` (khớp trang Công nợ), `high_value_customers` (tổng grand_total đơn confirmed/completed >= ngưỡng, mặc định 5.000.000), `by_tag` (cần `tagId`) |

## Dashboard / Báo cáo — API Sprint Dashboard

Dashboard là READ-ONLY (không sửa dữ liệu, không ghi AuditLog cho việc xem).
Mọi endpoint đều nhận `preset` (today/7d/30d/all, mặc định 30 ngày qua) hoặc
`from`/`to` dạng YYYY-MM-DD (phải gửi cả hai, from <= to, tối đa 365 ngày).
Ngày tính theo ngày UTC (đổi ngày lúc 07:00 giờ Việt Nam, giống Sprint Chăm sóc).

Định nghĩa chỉ số (nhất quán ở dashboard, báo cáo, danh sách đơn và công nợ):
chỉ tính đơn confirmed/completed, KHÔNG tính đơn nháp và đơn đã hủy; payment
đã hủy KHÔNG tính vào tiền thu. `sales_total` = tổng grand_total (đã trừ trả
hàng) của đơn trong khoảng; `paid_total` trong khoảng = tổng paidTotal
snapshot của chính các đơn đó (snapshot do Sprint Thanh toán tính lại từ
payment active — lưu ý: payment thu muộn cho đơn cũ vẫn tính vào ngày tạo
đơn, không phải ngày tạo payment; tiền thu theo ngày payment xem ở
revenue-by-payment-method). `debt_total` = sales − paid (có thể âm khi trả
hàng làm tổng tiền nhỏ hơn số đã thu — đó là tiền thừa cần hoàn, không phải
nợ). Top SKU: số lượng bán = quantity − returnedQuantity (dòng trả hết
không tính), doanh thu dòng = số lượng bán × đơn giá − discount dòng đã lưu
(discount không chia tỷ lệ khi trả một phần). Lãi gộp là ƯỚC TÍNH theo giá
nhập HIỆN TẠI của SKU, không phải lãi chính xác theo lô hay giá nhập lịch sử.

Lọc quyền ở backend (không chỉ ẩn thẻ ở giao diện): phạm vi
`report.view_all` = toàn hệ thống, `report.view_team` = team (MVP chưa có
thực thể team nên tính như toàn hệ thống và response ghi rõ),
`report.view_own` = chỉ đơn do mình tạo, khách do mình tạo/được giao, nhắc
việc do mình tạo/được giao; không có mã report nào → 403 (riêng báo cáo
tồn kho thì `inventory.view` cũng mở được, nhưng chỉ thấy tồn kho, không
thấy doanh thu/lãi/nợ). Doanh thu toàn hệ thống cần `report.view_all` hoặc
`report.view_revenue` — thiếu thì các trường doanh thu bị LƯỢC khỏi
response (không phải bằng 0); lãi gộp cần `report.view_profit` (mặc định
chỉ admin); giá trị tồn kho cần `report.view_inventory_value` hoặc
`inventory.view_value`; công nợ toàn hệ thống cần `debt.view_all`,
`report.view_debt` hoặc `report.view_all` — thiếu thì chỉ trả công nợ trong
phạm vi và lược tổng toàn hệ thống.

| Endpoint | Quyền | Ghi chú |
|---|---|---|
| `GET /api/dashboard/summary?preset=&from=&to=&lowStockThreshold=` | `report.view_all`/`view_team`/`view_own` | Doanh thu/đã thu/nợ trong khoảng (nếu có quyền), số đơn theo trạng thái, tổng khách + khách mới, tồn kho (tổng tồn, tồn thấp, hết hàng, giá trị tồn nếu có quyền), nhắc việc quá hạn/hôm nay, công nợ trong phạm vi + tổng toàn hệ thống nếu có quyền. Ngưỡng tồn thấp mặc định 5 (chưa có cột ngưỡng riêng cho từng SKU) |
| `GET /api/dashboard/revenue-by-day?preset=&from=&to=` | Như trên + quyền doanh thu | Doanh thu/đã thu/nợ theo ngày tạo đơn; cần khoảng cụ thể, preset `all` → 400 |
| `GET /api/dashboard/revenue-by-payment-method?preset=&from=&to=` | Như trên + quyền doanh thu | Tổng payment active theo phương thức, theo ngày tạo payment, chỉ đơn confirmed/completed |
| `GET /api/reports/top-skus?preset=&from=&to=&limit=` | Như trên | Top SKU theo doanh thu, mặc định 10, tối đa 50; lãi gộp ước tính chỉ có khi có `report.view_profit` |
| `GET /api/reports/top-customers?preset=&from=&to=&limit=` | Như trên | Top khách theo grand_total trong khoảng, kèm số nợ hiện tại của khách (tổng nợ dương mọi thời gian, giống trang Công nợ) |
| `GET /api/reports/debt?preset=&from=&to=&limit=` | `debt.view_all`/`view_own` hoặc mã report | Công nợ trong khoảng và toàn thời gian: tổng nợ dương, tiền thừa, số đơn/khách còn nợ, nợ theo trạng thái thanh toán, top khách nợ |
| `GET /api/reports/inventory?q=&categoryId=&stockStatus=&lowStockThreshold=&page=&pageSize=` | Mã report hoặc `inventory.view` | Tổng quan tồn kho, danh sách tồn thấp (tối đa 50) và hết hàng (tối đa 50), phân trang các SKU; giá trị tồn chỉ có khi có quyền xem giá trị |

Cố tình chưa làm trong Sprint Dashboard: import/export (sprint sau), báo cáo
theo nguồn khách/nhân viên (schema Order MVP không có trường nguồn; chỉ có
người tạo đơn), báo cáo chăm sóc, và export báo cáo.

## Nhật ký Audit — API Sprint Audit (chỉ đọc)

Audit log là lịch sử bất biến (không có `updatedAt`/`deletedAt`): mọi thao
tác nhạy cảm từ các sprint trước đều đã ghi audit (xem bảng rà soát đầy đủ
trong `DEVELOPMENT_PLAN.md`). Sprint Audit bổ sung 3 log còn thiếu
(`tag_updated`, `logout`, `otp_resent`) và thêm API xem audit. **Không có
route POST/PATCH/DELETE nào cho audit log** — POST/DELETE tới
`/api/audit-logs` rơi về catch-all của app và trả 404, nên log không thể
sửa hay xóa qua API. `writeAudit()` là best-effort (ghi log thất bại không
làm hỏng thao tác chính, nhưng lỗi được in ra server log) và luôn lược
đệ quy các trường nhạy cảm (`password`, `token`, `secret`, `codeHash`,
mã OTP) khỏi `oldValue`/`newValue` trước khi lưu; ở tầng đọc, người xem
không có `product.view_cost` còn bị lược thêm giá nhập (`importPrice`).

Quyền xem audit (mã mới, cần seed lại để có hiệu lực): Admin có tất cả
theo cơ chế seed sẵn; Manager có `audit.view_all` (xem toàn hệ thống);
Sales, Warehouse, Accountant có `audit.view_own` — chỉ xem audit do chính
mình thực hiện. Trên danh sách, `view_own` mà lọc `actorId` của người khác
bị trả 403 (không lặng lẽ đổi bộ lọc); trên lịch sử của 1 thực thể,
`view_own` chỉ thấy hành động của chính mình trên thực thể đó, không thấy
hành động của người khác. Thiếu token → 401, thiếu quyền → 403.

| Endpoint | Quyền | Ghi chú |
|---|---|---|
| `GET /api/audit-logs?page=&pageSize=&actorId=&action=&entityType=&entityId=&q=&from=&to=` | `audit.view_all` hoặc `audit.view_own` | Danh sách mới nhất trước; phân trang mặc định 20, tối đa 100; `from`/`to` là khoảng ngày `createdAt` (ngày `to` dạng YYYY-MM-DD tính hết ngày); trả kèm tên người thực hiện, không trả mật khẩu/token |
| `GET /api/audit-logs/:id` | Như trên | Chi tiết 1 dòng với `oldValue`/`newValue` đầy đủ (đã lược trường nhạy cảm) |
| `GET /api/audit-logs/entity/:entityType/:entityId?page=&pageSize=` | Như trên | Timeline audit của 1 thực thể (vd: 1 khách, 1 đơn, 1 SKU); đã tích hợp vào hồ sơ khách ở frontend, các thực thể khác xem qua trang Nhật ký Audit với bộ lọc loại + mã thực thể |

Frontend: trang Nhật ký Audit (bộ lọc người thực hiện/hành động/loại/mã
thực thể/khoảng ngày, phân trang, bấm xem chi tiết dạng JSON; trường nhạy
cảm nếu lỡ có hiển thị thành `***`) và nút “Xem lịch sử audit của hồ sơ
này” trong hồ sơ khách. Ẩn/hiện theo quyền chỉ là giao diện; backend vẫn chặn.

### Cấu hình OTP (admin bật/tắt)

Mặc định `otp_mode=off`: chỉ cần tên đăng nhập + mật khẩu — nhanh, đơn giản, phù hợp khi ít nhân viên.

Khi nhiều người dùng, admin (ở giao diện sau khi đăng nhập, hoặc qua API) đổi sang `otp_mode=email`:

- Hệ thống kiểm tra trước: nếu chưa cấu hình SMTP và `OTP_DEV_LOG` đang tắt thì **từ chối đổi và giữ nguyên `off`**, để không ai bị khóa ngoài hệ thống.
- Sau khi mật khẩu đúng, người dùng nhận mã 6 số qua email, mã lưu dạng hash, hết hạn 5 phút.

Quy tắc yêu cầu OTP cho từng người dùng (`User.requireOtp`):

- `true` → luôn yêu cầu OTP qua email.
- `false` → không yêu cầu OTP, kể cả khi hệ thống đang ở chế độ email.
- `null` (mặc định) → theo `otp_mode` của hệ thống.

**OTP qua điện thoại/SMS: chưa hỗ trợ.** API từ chối `otp_mode=phone` với thông báo rõ ràng vì chưa có nhà cung cấp SMS; đây là việc tương lai, không được coi là chế độ đang chạy.

**Cảnh báo OTP_DEV_LOG:** `OTP_DEV_LOG=true` chỉ dùng cho dev local — mã OTP sẽ in ra log backend thay vì gửi email. **Không bao giờ bật ở production.**

## Cấu trúc

```text
backend/    Express + TypeScript, src/routes/auth.ts, src/routes/admin.ts, src/routes/customers.ts,
            src/routes/products.ts, src/routes/care.ts (hoạt động, nhắc việc, phân đoạn),
            src/routes/importExport.ts (import/export CSV),
            src/lib/customers.ts (chuẩn hóa + trùng số),
            src/lib/products.ts (chuẩn hóa/sinh mã SKU, sinh tổ hợp),
            src/lib/care.ts (sinh nhật, nhóm thời gian nhắc việc, công thức phân đoạn),
            src/middleware/auth.ts, src/lib/permissions.ts, prisma/schema.prisma
frontend/   React + Vite + TailwindCSS, đăng nhập 2 bước + panel OTP cho admin + trang Khách hàng
            (danh sách, hồ sơ 360, form nhiều số / tag / con, tab Chăm sóc) + trang Sản phẩm/SKU
            (danh sách, chi tiết bảng biến thể, form SKU mặc định / sinh tổ hợp / áp dụng giá hàng loạt)
            + trang Nhắc việc + trang Phân đoạn + trang Import/Export
            (tải mẫu, preview từng dòng, xác nhận nhập, tải CSV export)
docs/       Tài liệu chốt cứng và đặc tả (bản sao làm việc local, xem mục dưới)
scripts/    Script hỗ trợ (sẽ bổ sung theo sprint)
docker-compose.yml  postgres + backend + frontend, cùng env với npm dev
```

## Tài liệu

- `docs/12_QUY_TAC_CHOT_CUNG.md` — quy tắc đã chốt cứng (thắng tài liệu cũ)
- `DEVELOPMENT_PLAN.md` — thứ tự sprint và các quyết định đã chốt
- Đặc tả gốc 00–11: xem repo GitHub của chủ dự án; bản local này không sửa các file đặc tả gốc.

## Import / Export (CSV)

Định dạng MVP là CSV UTF-8, dấu phẩy, dòng đầu là header, hỗ trợ
trường có dấu ngoặc kép; file CSV mở được bằng Excel. Tối đa 1000
dòng/file và 5MB, chỉ nhận file `.csv`. Xuất/nhập `.xlsx` thật là
tồn đọng sau này nếu chủ dự án yêu cầu, sprint này không dùng thư
viện Excel nặng.

| API | Quyền | Ghi chú |
|---|---|---|
| `GET /api/import/templates/customers` | `customer.import` | File mẫu CSV khách hàng |
| `GET /api/import/templates/products` | `product.import` | File mẫu CSV sản phẩm / SKU |
| `POST /api/import/customers/preview` (multipart, field `file`) | `customer.import` | Preview: kiểm tra từng dòng, KHÔNG ghi dữ liệu, trả `preview_id` (hết hạn sau 15 phút) |
| `POST /api/import/products/preview` (multipart, field `file`) | `product.import` | Tương tự cho sản phẩm |
| `POST /api/import/:entity/confirm` (`{ "preview_id" }`) | quyền import tương ứng | Kiểm tra lại toàn bộ dòng với database hiện tại rồi nhập các dòng valid; dòng lỗi ở bước confirm bị bỏ qua và báo rõ, các dòng khác vẫn nhập; preview chỉ dùng một lần, thuộc về đúng user đã preview |
| `GET /api/export/customers` | `customer.export` | Cột: name, phones (nối bằng `;`), email, address, source, tags, status, debt_total (chỉ khi có quyền xem công nợ), created_at |
| `GET /api/export/products` | `product.export` | Cột: product_name, category, sku, variant_name, attributes, sell_price, import_price (CHỈ khi có `product.view_cost`, nếu không thì lược cột hoàn toàn, không trả 0), stock_quantity, status |
| `GET /api/export/orders` | `order.export` | Cột: order_code, customer_name, order_date, status, grand_total, paid_total, debt_total, payment_status (các cột tiền chỉ khi có quyền xem công nợ/doanh thu, nếu không thì lược và chỉ trả mã đơn/trạng thái/ngày); không bao giờ trả import_price/lãi |
| `GET /api/export/inventory` | `inventory.view` | Cột: sku, product_name, variant_name, quantity, reserved_quantity, inventory_value (chỉ khi có quyền xem giá trị tồn), status |

Cột import khách hàng: name, phones (nhiều số ngăn cách bằng `;`
hoặc `|`, không giới hạn số lượng, chuẩn hóa như Sprint Khách
hàng), email, address, source, tags (ngăn cách bằng `;`), status,
note. Cần có tên hoặc ít nhất một số. Số trùng trong cùng một dòng,
giữa các dòng trong file, hoặc với số đang hoạt động của khách khác
đều làm dòng đó invalid, kèm số trùng và khách đã có số đó. Trùng
tên nhưng không trùng số vẫn nhập bình thường. Tag chưa tồn tại thì
tạo mới nếu user có `customer.tag_manage`, nếu không thì dòng đó
lỗi.

Cột import sản phẩm: product_name, category, sku, variant_name,
attributes (ví dụ `color:Đen;size:S` hoặc để trống cho SKU mặc
định), sell_price, import_price, barcode, status. SKU người dùng
nhập thì trim + viết hoa; trùng trong file hoặc với database thì
dòng invalid kèm sản phẩm/biến thể đã có SKU đó và hệ thống không
tự đổi mã của bạn; SKU để trống thì tự sinh theo logic Sprint Sản
phẩm/SKU (slug tên + thuộc tính, hậu tố `-002`/`-003` khi trùng).
Các dòng có cùng product_name + category (không phân biệt
hoa/thường sau trim) được gom thành một sản phẩm cha với nhiều biến
thể; sản phẩm đã tồn tại trong database với cùng tên thì thêm biến
thể vào đó. Biến thể mới có tồn 0, không có transaction kho.

Export lọc theo phạm vi của user (view_all/view_own như các sprint
trước) và chống CSV injection (ô bắt đầu bằng `=`, `+`, `-`, `@`,
tab hoặc xuống dòng được thêm dấu `'` ở đầu khi xuất). Mỗi lần
confirm import và mỗi lần export đều ghi AuditLog (entity, tổng
dòng/số dòng, số nhập thành công/số bỏ qua, bộ lọc, user).
