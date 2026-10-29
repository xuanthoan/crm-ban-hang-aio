# DEVELOPMENT_PLAN — CRM_Ban_Hang

## Quyết định đã chốt (2026-10-28, chủ dự án)

1. **Database giữ PostgreSQL** — không đổi sang SQLite/portable.
2. **Dùng cả Docker Compose và npm, cùng một code, cùng một env.**
   Tiêu chí: dễ dùng, đơn giản, dễ bảo trì, nâng cấp, ít lỗi.
   Docker Compose để chạy/vận hành hàng ngày và triển khai; npm để phát
   triển/debug. Đã bổ sung `backend/Dockerfile`, `frontend/Dockerfile`
   (nginx + proxy `/api`), sửa `docker-compose.yml` để 3 service chạy
   được với nhau, và cập nhật README nêu khi nào dùng cách nào.
3. **Đăng nhập bằng tên đăng nhập + mật khẩu là mặc định.**
   OTP qua email là tùy chọn do admin bật/tắt (`otp_mode`: `off` mặc
   định, `email` khi bật). OTP qua điện thoại/SMS chưa làm vì chưa có
   nhà cung cấp SMS — API từ chối `otp_mode=phone`.

## Đã làm xong: Sprint 0.1 (scaffold)

- Monorepo `backend/`, `frontend/`, `docs/`, `scripts/`
- Backend Express + TypeScript, `GET /api/health` trả `{status: "ok"}`
  mà không phụ thuộc database, middleware lỗi cơ bản, đọc `PORT`/`DATABASE_URL` từ env
- Prisma schema với các model lõi (xem `backend/prisma/schema.prisma`)
- Frontend React + Vite + TailwindCSS, trang chào liệt kê module, hiển thị
  trạng thái health thật (kết nối / chưa kết nối, không fake dữ liệu)
- `docker-compose.yml` mẫu 3 service, `README.md` hướng dẫn chạy

Không làm trong Sprint 0.1 (cố tình chưa làm): CRUD nghiệp vụ, đăng nhập,
tính tiền, trừ/hoàn kho, SMS/Zalo, marketplace, AI, kế toán sâu, đa chi nhánh.

## Đã làm xong: Sprint Auth

- **Auth lõi backend:** `POST /api/auth/login` (username + password, chấp
  nhận cả username lẫn email ở ô đăng nhập), `GET /api/auth/me`,
  `POST /api/auth/logout` (MVP: xóa token ở client, JWT stateless),
  `POST /api/auth/change-password` (cần mật khẩu cũ, mới >= 8 ký tự).
  JWT lấy secret từ env `JWT_SECRET`, hết hạn `JWT_EXPIRES_IN` (mặc định
  `8h`); thiếu `JWT_SECRET` thì backend từ chối khởi động với thông báo
  rõ, không dùng secret mặc định cứng. Token chứa `userId`, `username`, `role`.
- **User/Role/Permission:** model `User` thêm `username` duy nhất,
  `phone`, `requireOtp` (true/false/null), `lastLoginAt`;
  `Role` thêm `code` + `isSystemRole`; model mới `Permission`,
  `RolePermission`, `SystemSetting`, `OtpChallenge`. Seed 5 vai trò mặc
  định (admin, manager, sales, warehouse, accountant) với tập quyền theo
  docs 08, bảo thủ theo hướng ít quyền hơn cho các vai trò không phải
  admin. Script `npm run seed` (vai trò + quyền + `otp_mode=off`) và
  `npm run seed:admin` (chỉ tạo khi chưa có admin, đọc `ADMIN_*` từ env,
  mật khẩu >= 8 ký tự, thiếu env thì fail rõ, không có mật khẩu mặc định).
- **Middleware:** `authenticate` (thiếu/sai/hết hạn token → 401; user
  locked/inactive không dùng được token cũ) và `authorize(permission)`
  (thiếu quyền → 403, không trả dữ liệu). Áp dụng cho mọi route admin.
  Không thể khóa / hạ vai trò của admin đang hoạt động duy nhất.
  Mật khẩu bcrypt, không trả `passwordHash`, không ghi log mật khẩu.
  Audit log cho: đăng nhập sai, đổi mật khẩu, khóa/mở khóa user, đổi
  vai trò/quyền, đổi cấu hình OTP.
- **OTP do admin điều khiển:** `otp_mode` hệ thống (`off` mặc định,
  `email`); `PUT /api/admin/settings/otp-mode` chỉ admin và ghi audit.
  Bật `email` khi chưa có SMTP và `OTP_DEV_LOG` tắt thì API từ chối và
  giữ nguyên `off`. Khi cần OTP: sau khi mật khẩu đúng, backend trả
  `otp_required` + challenge tạm thời, `POST /api/auth/verify-otp` với mã
  6 số mới cấp JWT; mã lưu dạng bcrypt hash, hết hạn 5 phút, tối đa 5
  lần sai, gửi lại chờ 60 giây (`POST /api/auth/resend-otp`). Gửi qua
  SMTP (`SMTP_HOST/PORT/USER/PASS/FROM`, nodemailer); `OTP_DEV_LOG=true`
  chỉ in mã ra log cho dev local, mặc định false, cấm ở production.
  `User.requireOtp`: true = luôn yêu cầu, false = không yêu cầu dù hệ
  thống bật, null = theo hệ thống. API admin đổi `requireOtp` cần quyền
  `user.set_require_otp`. `otp_mode=phone` bị từ chối rõ ràng.
- **Frontend:** trang đăng nhập tên đăng nhập + mật khẩu, tự chuyển sang
  bước nhập OTP khi backend trả `otp_required`, hiển thị lỗi rõ (sai mật
  khẩu, tài khoản bị khóa, mã hết hạn), lưu JWT, gọi `/api/auth/me` để
  hiển thị user/role, nút đăng xuất xóa token, form đổi mật khẩu, panel
  cấu hình OTP cho admin (chỉ hiện khi có quyền). Ẩn/hiện menu theo
  role chỉ là giao diện, không thay thế kiểm tra backend.
- **Docker + npm song song:** `backend/Dockerfile` (build rồi chạy
  `node dist/index.js`), `frontend/Dockerfile` (build Vite rồi nginx
  phục vụ tĩnh + proxy `/api` sang backend), `.dockerignore` cho cả hai,
  `docker-compose.yml` với healthcheck cho postgres, `JWT_SECRET` bắt
  buộc (Compose từ chối chạy nếu thiếu), `ADMIN_*` truyền vào backend
  để seed. README đã có 2 cách chạy, backup volume postgres, và nâng cấp.

Cố tình chưa làm trong Sprint Auth: CRUD người dùng đầy đủ ngoài các
route admin trên (tìm kiếm phân trang sâu, đặt lại mật khẩu qua email),
quên mật khẩu, ghi nhớ đăng nhập, refresh token / thu hồi token phía
server, OTP qua SMS, cấu hình danh sách (nguồn khách, tag, đơn vị tính)
— các mục này thuộc sprint Config hoặc mở rộng sau, không tự thêm vào
sprint này.

## Đã làm xong: Sprint Customer (chỉ ở mức code, chưa kiểm chứng với DB thật)

- **Backend API** (`backend/src/routes/customers.ts`, `src/lib/customers.ts`,
  tái dùng `authenticate`/`authorize` của Sprint Auth, không viết lại auth):
  `GET /api/customers` (phân trang page/pageSize mặc định 20 tối đa 100,
  tìm theo tên hoặc bất kỳ số nào, lọc tag/trạng thái/nguồn/ngày tạo),
  `GET /api/customers/:id` (hồ sơ 360), `POST /api/customers`,
  `PATCH /api/customers/:id`, `DELETE /api/customers/:id` (mặc định xóa mềm),
  `DELETE /api/customers/:id?hard=true` (chỉ Admin, chỉ khi chưa có dữ
  liệu liên quan), phone riêng (`POST /customers/:id/phones`,
  `make-primary`, `DELETE` một số), tag cho khách, con riêng
  (`POST/PATCH/DELETE /customers/:id/children`), tag
  (`GET/POST/PATCH/DELETE /api/tags`). Tạo/sửa khách kèm số + tag + con
  chạy trong một transaction Prisma nên không tạo được khách nửa vời.
- **Nhiều số — đúng quy tắc chốt cứng 4.1:** bảng `CustomerPhone`, không
  giới hạn số lượng, không dùng `phone_1`/`phone_2`; chuẩn hóa bỏ khoảng
  trắng/dấu chấm/dấu gạch ngang/ngoặc, `+84` → `0`, lưu `phoneNormalized`;
  đúng 1 số chính (không chỉ số chính → >1 số chính lỗi; không chỉ số
  chính nào → số đầu tiên thành số chính); kiểm tra trùng trên TẤT CẢ
  các số với tất cả số đang hoạt động của khách khác (loại trừ chính
  khách đang sửa) và trong cùng danh sách đó — trùng thì chặn toàn bộ
  thao tác, rollback, trả 400 kèm số trùng và id + tên khách đã có số
  đó; trong cùng một khách trùng nhau sau chuẩn hóa cũng chặn, không
  chỉ cảnh báo. Số đã ngừng sử dụng (inactive/deletedAt) không tính là
  trùng và có thể được kích hoạt lại nếu nhập lại cho cùng một khách.
  Xóa số phụ là xóa mềm; xóa số chính thì số còn lại cũ nhất tự thành
  số chính; xóa số chính duy nhất cần xác nhận rõ
  (`confirm_delete_last_phone: true`).
- **Quyền và phạm vi:** dùng mã đã seed (`customer.view_all`,
  `customer.view_own`, `customer.create`, `customer.update`,
  `customer.deactivate`, `customer.assign`) và 2 mã MỚI bổ sung trong
  sprint này: `customer.hard_delete` (chỉ Admin, vì admin có mọi mã) và
  `customer.tag_manage` (Admin + Manager; Sales không có, đúng yêu cầu
  "Admin/Manager trở lên"). Thiếu token 401, thiếu quyền 403, ngoài
  phạm vi 403. Phạm vi: `view_all` xem tất cả; `view_own` chỉ xem khách
  do mình tạo (`createdById`, mới bổ sung vào schema) hoặc được giao
  (`assignedToId`, mới bổ sung vào schema). **Chưa có thực thể team nên
  phạm vi team chưa thực thi được** — manager/admin hiện dùng `view_all`,
  sales dùng `view_own`; khách cũ chưa có `createdById` thì sales chỉ
  thấy được sau khi admin giao phụ trách. Đổi người phụ trách cần quyền
  `customer.assign` (trừ khi giao cho chính mình).
- **Tag và con:** tag tên duy nhất sau trim (không phân biệt hoa/thường),
  tag đã xóa mềm có thể kích hoạt lại khi tạo trùng tên; xóa tag là
  ngừng hoạt động, không xóa cứng. Con: không giới hạn số lượng, có tên,
  ngày sinh, giới tính, ghi chú, `sortOrder`; ngày sinh không được là
  ngày tương lai; tuổi tính từ ngày sinh ở backend khi trả về
  (`ageYears`), không lưu tuổi cứng. Theo docs 11, con KHÔNG có trường
  trường học trong schema nên sprint này không tự thêm trường đó.
  Dữ liệu con chỉ trả cho user có quyền xem khách; danh sách khách chỉ
  trả `childrenCount`, không trả chi tiết con.
- **Validation và audit:** họ tên HOẶC ít nhất một số là bắt buộc
  (theo docs 01 §6/§13, tính trên trạng thái cuối sau khi sửa, không
  chỉ trên payload); email nếu có thì kiểm tra định dạng; audit cho
  tạo/sửa/xóa mềm khách, thêm/xóa/đổi số chính, gán/bỏ tag, thêm/sửa/xóa
  con, tạo/ngừng tag, xóa cứng khách.
- **Frontend:** tab Khách hàng sau khi đăng nhập (chỉ hiện nếu có quyền
  xem khách): danh sách + tìm kiếm tên/số + lọc tag/trạng thái + phân
  trang, hồ sơ 360, form tạo/sửa với danh sách số động (“+ Thêm số điện
  thoại”, chọn số chính bằng radio), chọn tag, phần con động (“+ Thêm
  con”), hiển thị lỗi trùng số kèm tên khách đã có số đó. Ẩn/hiện nút
  theo quyền chỉ là giao diện; backend vẫn chặn. Đơn hàng/thanh toán
  trong hồ sơ để trống kèm ghi chú "sẽ có ở Sprint Đơn hàng/Thanh toán".
- **Schema thay đổi trong sprint này** (chưa migrate, vì chưa có DB):
  `Customer.createdById` + `Customer.assignedToId` (quan hệ tới User),
  `CustomerChild.sortOrder`, `CustomerTag.color`. Chưa thêm các trường
  trong docs 01 mà schema cũ chưa có (mã khách `customer_code`, Zalo,
  Facebook, tỉnh/quận/phường, mức tiềm năng, ghi chú nội bộ tách riêng):
  ghi nhận là tồn đọng, không tự thêm ồ ạt trong sprint này để tránh
  phình schema khi chưa có DB để migrate kiểm chứng.

Cố tình chưa làm trong Sprint Customer: đơn hàng, thanh toán, kho,
import/export khách (kiểm tra trùng trong file thuộc Sprint
Import/Export), export khách tràn lan, remarketing theo con, lọc khách
theo độ tuổi con (dữ liệu tuổi đã có sẵn để làm ở Sprint Care).

## Đã làm xong: Sprint Product/SKU (chỉ ở mức code, chưa kiểm chứng với DB thật)

- **Backend API** (`backend/src/routes/products.ts`, `src/lib/products.ts`,
  tái dùng `authenticate`/`authorize` của Sprint Auth):
  `GET /api/products` (phân trang page/pageSize mặc định 20 tối đa 100,
  tìm theo tên/SKU/mã vạch/tên biến thể, lọc category/trạng thái sản phẩm/
  trạng thái SKU/khoảng giá bán, kèm biến thể + tồn tổng),
  `GET /api/products/:id` (chi tiết cha + toàn bộ biến thể + tồn),
  `POST /api/products`, `PATCH /api/products/:id`,
  `DELETE /api/products/:id` (mặc định xóa mềm, `?hard=true` chỉ Admin),
  `POST /api/products/:id/variants`,
  `POST /api/products/:id/variants/generate` (sinh thêm tổ hợp, bỏ qua tổ
  hợp đã có),
  `PATCH /api/products/:id/variants/:variantId`,
  `DELETE /api/products/:id/variants/:variantId`,
  `GET /api/variants` (tìm mọi SKU: SKU/tên biến thể/mã vạch/tên sản phẩm,
  lọc product/category/trạng thái/khoảng giá/`sellable=true`),
  `GET/POST /api/categories`.
  Tạo/sửa sản phẩm kèm biến thể chạy trong một transaction Prisma nên
  không tạo được sản phẩm nửa vời.
- **Sản phẩm cha không phải đơn vị bán:** cha chỉ gom tên, danh mục, mô
  tả, trạng thái. Mọi bán/kho sau này chỉ dùng `ProductVariant`. API trả
  `isSellable` = biến thể active VÀ sản phẩm cha active để Sprint Đơn
  hàng chặn bán SKU/product inactive (sprint này chưa tạo đơn nên chỉ
  chuẩn bị cờ, không làm logic đơn).
- **SKU mặc định:** sản phẩm không có biến thể và không gửi `variants`
  hay `variantOptions` thì hệ thống tự tạo đúng 1 biến thể
  (`isDefault=true`, tên mặc định "Mặc định", SKU tự sinh từ tên sản
  phẩm). Một sản phẩm không bao giờ có 2 SKU mặc định (tạo/sửa đều
  kiểm tra; đặt SKU khác làm mặc định sẽ bỏ cờ cũ). Schema bổ sung
  `ProductVariant.isDefault` (chưa migrate, vì chưa có DB).
- **Biến thể:** tối đa 3 nhóm thuộc tính, tên nhóm và giá trị trong nhóm
  không trùng (không phân biệt hoa/thường). Thuộc tính lưu trong
  `ProductVariant.attributes` dạng danh sách `{name, value}` theo đúng
  thứ tự nhóm, tên biến thể là các giá trị nối bằng " / "
  (ví dụ "Đen / S"). Sinh tổ hợp tối đa 200 SKU/sản phẩm (đặc tả 02
  §11.5, lựa chọn MVP); vượt giới hạn thì chặn kèm thông báo, không tự
  ý cắt bớt. Sinh thêm tổ hợp ở sản phẩm đã có thì bỏ qua tổ hợp đã
  tồn tại và báo rõ tổ hợp nào bị bỏ qua, không tạo trùng.
- **Quy tắc sinh mã SKU đã chọn (nhất quán toàn hệ thống):**
  mã = slug tên sản phẩm + slug từng giá trị thuộc tính, nối bằng "-",
  ví dụ "Áo thun nữ 2027" + Đen + S → `AO-THUN-NU-2027-DEN-S`;
  sản phẩm đơn giản → chỉ slug tên sản phẩm, ví dụ
  `SACH-THIEU-NHI-TAP-1`. Slug: bỏ dấu tiếng Việt, viết hoa, khoảng
  trắng/ký tự đặc biệt thành "-", tối đa 60 ký tự. SKU lưu trim +
  viết hoa toàn bộ.
- **Chống trùng SKU (quy tắc chốt cứng 4.2):** SKU người dùng tự nhập
  mà trùng bất kỳ SKU nào trong toàn hệ thống thì chặn toàn bộ thao
  tác, trả 400 kèm SKU trùng và sản phẩm/biến thể đã có SKU đó, hệ
  thống KHÔNG tự đổi mã của người dùng. SKU tự sinh trùng thì tự thêm
  hậu tố `-002`, `-003`, … cho tới khi hết trùng. Unique constraint
  `ProductVariant.sku` giữ nguyên; lỗi đua tranh (P2002) được bắt lại
  thành 400 rõ ràng.
- **Quyết định về tái sử dụng SKU (mặc định an toàn): KHÔNG tái sử
  dụng.** SKU của biến thể inactive hay xóa mềm vẫn giữ hàng của nó
  trong database nên unique constraint đã chặn tái sử dụng; chỉ khi
  biến thể bị xóa cứng (chỉ khi không còn đơn, lịch sử kho và tồn)
  thì SKU đó mới được giải phóng. Lý do: tránh nhầm lẫn lịch sử đơn/
  kho cũ với SKU mới cùng mã.
- **Đổi mã SKU:** chỉ cho đổi khi biến thể chưa có dòng đơn hàng nào;
  đã có đơn thì chặn vì đơn cũ lưu snapshot theo SKU. Đổi giá bán/giá
  nhập ghi audit giá cũ/giá mới (`product.price_change`).
- **Xóa:** mặc định là ngừng bán (status inactive + deletedAt) cho cả
  sản phẩm (kèm toàn bộ SKU) và từng SKU. Không được xóa SKU duy nhất
  còn lại của sản phẩm (hãy ngừng bán cả sản phẩm). Xóa cứng chỉ Admin
  (mã quyền mới `product.hard_delete`, admin có mọi mã theo cơ chế
  seed) và chỉ khi không còn dòng đơn, lịch sử kho và tồn khác 0;
  có liên quan thì trả 400 kèm số lượng từng loại và giữ nguyên.
- **Giá nhập và dữ liệu nhạy cảm:** `importPrice` chỉ trả cho user có
  `product.view_cost`; user khác không thấy trường này ở API (không
  phải chỉ ẩn cột ở giao diện). Đổi giá bán cần `product.update_price`,
  đổi giá nhập cần `product.update_cost`. Các mã quyền sản phẩm đã có
  sẵn từ Sprint Auth (`product.view/create/update/deactivate/view_cost/
  update_price/update_cost`); sprint này chỉ bổ sung `product.hard_delete`.
  Lưu ý: theo tập quyền mặc định hiện tại, chỉ Admin có
  `product.create/update`, các vai trò khác chỉ xem — đúng hướng bảo
  thủ của docs 08, nếu chủ dự án muốn Manager tạo/sửa sản phẩm thì
  phải chỉnh tập quyền trong `permissions.ts` rồi seed lại.
- **Kho trong sprint này:** biến thể mới luôn được tạo kèm
  `InventoryItem` tồn 0 và KHÔNG có transaction kho. Tồn kho ban đầu
  (initial) thuộc Sprint Kho. Đây là điểm lệch có chủ ý so với đặc tả
  02 §9.2/§24.2 (vốn nói Product sprint tạo transaction initial): sprint
  này được giao là "không làm kho nhập/xuất, chỉ chuẩn bị SKU", và
  quy tắc chốt cứng §2.1 cấm mọi thay đổi tồn ngoài inventory service
  — nên payload gửi `initialQuantity` khác 0 sẽ bị từ chối kèm thông
  báo rõ, thay vì bị lặng lẽ bỏ qua hay lưu tồn mà không có transaction.
  Frontend vì vậy không có ô nhập tồn ban đầu ở form sản phẩm.
- **Các trường đặc tả 02 chưa có trong schema nên chưa làm:**
  brand, product_code, unit, sale_price, low_stock_threshold, image_url,
  internal_note, trạng thái product "draft" (schema enum chỉ có
  active/inactive). Ghi nhận là tồn đọng, không tự thêm cột khi chưa
  có DB để migrate kiểm chứng.
- **Frontend:** tab Sản phẩm/SKU sau khi đăng nhập (chỉ hiện nếu có
  `product.view`): danh sách + tìm kiếm tên/SKU/mã vạch + lọc danh
  mục/trạng thái + phân trang, chi tiết với bảng biến thể (cột giá
  nhập chỉ hiện khi có `product.view_cost`), form tạo/sửa với chế độ
  đơn giản (1 SKU mặc định) hoặc có biến thể (nhóm thuộc tính động
  tối đa 3, nút sinh tổ hợp, bảng biến thể chỉnh giá từng dòng, áp
  dụng giá cho tất cả, xóa dòng không bán, hiển thị lỗi trùng SKU kèm
  sản phẩm đã có SKU đó). Ẩn/hiện nút theo quyền chỉ là giao diện;
  backend vẫn chặn/lọc.

## Đã làm xong: Sprint Kho (chỉ ở mức code, chưa kiểm chứng với DB thật)

- Inventory service duy nhất `backend/src/lib/inventory.ts`: mọi thay
  đổi tồn đều đi qua `applyInventoryChange` trong transaction Prisma —
  kiểm tra tồn âm, ghi `InventoryTransaction` bất biến
  (before/changed/after/reason/reference/createdBy), rồi mới cập nhật
  `InventoryItem.quantity`. Không route nào sửa trực tiếp quantity.
- Các thao tác thủ công: `POST /api/inventory/initial` (chỉ lần đầu —
  SKU đã có transaction nào thì trả 409, hướng dùng điều chỉnh; initial
  0 không ghi transaction rỗng và vẫn cho initial thật sau đó),
  `POST /api/inventory/import`, `POST /api/inventory/export`,
  `POST /api/inventory/adjust` (increase / decrease / set; set tính
  changed = mới − cũ, changed = 0 thì từ chối, không ghi transaction
  rỗng). Import/export/adjust bắt buộc có lý do; số lượng phải là số
  nguyên, tồn cuối không âm.
- Hàng loạt all-or-nothing: mọi dòng được validate và kiểm tra âm
  trước khi áp dụng; lỗi ở 1 SKU thì toàn bộ request rollback, không
  áp dụng một phần (bảo đảm lần 2 bằng transaction Prisma).
- Quyết định SKU inactive: initial/import/export bị chặn cho biến thể
  hoặc sản phẩm cha inactive; adjust được phép cho SKU inactive (kiểm
  kê / xử lý tồn chết, theo docs 03 §20) với lý do bắt buộc, và kết
  quả gắn cờ `inactiveWarning`. Xem tồn và lịch sử vẫn được cho SKU
  inactive.
- Lịch sử kho bất biến: `GET /api/inventory/:variantId/transactions`
  (lọc loại, khoảng ngày, mới nhất trước); không có API sửa/xóa
  transaction. Danh sách tồn `GET /api/inventory` lọc theo SKU/tên,
  danh mục, trạng thái SKU, `?maxQuantity=N` (chưa có cột ngưỡng tồn
  thấp trong schema nên chưa có ngưỡng riêng cho từng SKU — tồn đọng),
  sắp xếp tồn thấp lên trước bằng `?sort=low_stock`.
- Quyền mới: `inventory.export` (xuất kho thủ công), seed cho Warehouse
  (Admin có mọi mã theo cơ chế seed). Các mã đã có được tái dùng:
  `inventory.view`, `inventory.import_stock` (cả initial và import),
  `inventory.adjust`, `inventory.view_transactions`. Mọi thao tác thủ
  công đều ghi AuditLog ngoài InventoryTransaction.
- Chuẩn bị cho Sprint Đơn hàng (chưa có route đơn hàng):
  `deductForOrder` / `restoreForOrder` trong cùng service, dùng cờ
  `Order.inventoryDeducted(inventoryDeductedAt)` /
  `inventoryRestored(inventoryRestoredAt)`: trừ lần 2 trả 409 không ghi
  thêm transaction; hoàn khi chưa từng trừ trả 409; hoàn lần 2 trả 409;
  trừ chặn SKU inactive, hoàn cho phép SKU đã inactive sau khi bán.
  Các hàm này sẽ được Sprint Đơn hàng gọi trong transaction đổi trạng
  thái đơn, chưa kiểm chứng với đơn thật.
- Frontend: tab Kho (danh sách tồn, lọc, tồn thấp lên trước, lịch sử
  từng SKU, form nhập ban đầu / nhập / xuất / điều chỉnh một hoặc
  nhiều dòng kèm lý do bắt buộc). Nút theo quyền chỉ là giao diện.
- Kiểm tra đã chạy (xem báo cáo Sprint Kho): frontend build PASS
  (34 module); backend tsc chỉ còn đúng 3 lỗi PrismaClient chưa
  generate do mạng; logic thuần và logic service với mock transaction
  PASS (trừ/hoàn 2 lần bị chặn, xuất vượt tồn bị chặn, initial lần 2
  bị chặn, thiếu lý do bị chặn). Chưa chạy: migrate/seed/CRUD kho
  thật với DB, `docker compose up`, `prisma validate` (lỗi mạng tải
  engine như các sprint trước).

## Tồn đọng Sprint Product/SKU — kiểm chứng sau khi có PostgreSQL

Chạy sau `prisma validate` → `generate` → `migrate dev` (migration mới
gồm `ProductVariant.isDefault` và mã quyền mới `product.hard_delete`)
→ `seed` → `seed:admin` → `docker compose up -d --build`, rồi kiểm
chứng bằng curl (thay `<TOKEN>` bằng token thật,
`<BASE>` bằng `http://localhost:3001`):

```bash
# 1. Tạo sản phẩm đơn giản (không variants, không variantOptions)
#    -> 201, đúng 1 biến thể, isDefault=true, SKU tự sinh từ tên sản phẩm, tồn 0, không có transaction kho
curl -X POST <BASE>/api/products -H "Authorization: Bearer <TOKEN>" -H 'Content-Type: application/json' \
  -d '{"name":"Sách thiếu nhi tập 1","defaultVariant":{"sellingPrice":50000}}'
# 2. Tạo sản phẩm có biến thể: Màu [Đen, Trắng] x Size [S, M]
#    -> 201, đúng 4 SKU: ...-DEN-S, ...-DEN-M, ...-TRANG-S, ...-TRANG-M, tên biến thể "Đen / S"...
curl -X POST <BASE>/api/products -H "Authorization: Bearer <TOKEN>" -H 'Content-Type: application/json' \
  -d '{"name":"Áo thun nữ 2027","variantOptions":[{"name":"Màu sắc","values":["Đen","Trắng"]},{"name":"Size","values":["S","M"]}],"defaultSellingPrice":129000}'
# 3. Tạo sản phẩm khác có SKU người dùng tự nhập trùng SKU ở (1) hoặc (2) -> 400, báo rõ SKU + sản phẩm cũ, không tạo sản phẩm
# 4. Tạo 2 sản phẩm đơn giản cùng tên -> SKU thứ hai tự thêm hậu tố -002 (ví dụ SACH-THIEU-NHI-TAP-1-002)
# 5. Sinh thêm tổ hợp cho sản phẩm ở (2) (thêm Size XL qua POST /products/<ID>/variants/generate)
#    -> chỉ tạo thêm 2 SKU mới (Đen / XL, Trắng / XL), 4 tổ hợp cũ nằm trong skippedCombinations
# 6. Tạo sản phẩm có 4 nhóm thuộc tính -> 400; sinh tổ hợp vượt 200 SKU -> 400
# 7. Gửi initialQuantity=10 khi tạo biến thể -> 400, thông báo tồn ban đầu nhập ở Sprint Kho
# 8. Tìm kiếm: GET /api/products?q=AO-THUN-NU-2027-DEN-S và GET /api/variants?q=đen (theo chuỗi) -> ra đúng SKU
# 9. Đổi giá bán/giá nhập của 1 SKU -> 200 và có audit product.price_change ghi giá cũ/mới
# 10. Ngừng bán 1 SKU (DELETE variant) rồi GET /api/variants?sellable=true -> SKU đó biến mất; ngừng bán sản phẩm cha
#     rồi GET /api/variants?sellable=true -> toàn bộ SKU của sản phẩm đó biến mất
# 11. Xóa SKU duy nhất của sản phẩm đơn giản -> 400, gợi ý ngừng bán cả sản phẩm
# 12. Xóa cứng SKU/sản phẩm đã có lịch sử kho hoặc đơn -> 400 và giữ nguyên (kiểm chứng đầy đủ sau Sprint Kho/Đơn)
# 13. Phân quyền: không token -> 401; token sale (chỉ product.view) tạo sản phẩm -> 403; token không có
#     product.view_cost gọi GET /api/products -> response không có trường importPrice ở bất kỳ biến thể nào
# 14. Tạo sản phẩm với 2 SKU mặc định (isDefault=true ở 2 biến thể) -> 400
```

## Tồn đọng Sprint Customer — kiểm chứng sau khi có PostgreSQL

Cùng nguyên nhân như Sprint Auth: máy này không có Docker/PostgreSQL và
`prisma validate` vẫn lỗi mạng (`ECONNRESET` khi tải engine, đã thử
lại trong sprint này). Vì vậy các kiểm tra cần DB dưới đây là CHƯA
chạy, không được coi là PASS. Thứ tự kiểm chứng chung cho Auth +
Customer (làm chung một lần như chủ dự án đã chốt):

1. `npx prisma validate` → `npx prisma generate` → `npx prisma migrate dev`
   (lưu ý: migration mới gồm `createdById`/`assignedToId` cho Customer,
   `sortOrder` cho CustomerChild, `color` cho CustomerTag, và 2 mã quyền
   mới `customer.hard_delete`, `customer.tag_manage`) → `npm run seed`
   → `npm run seed:admin` → `docker compose up -d --build`.
2. Kiểm chứng Auth như checklist cũ trong phần "Tồn đọng Sprint Auth".
3. Kiểm chứng Customer bằng curl (thay `<TOKEN>` bằng token thật,
   `<BASE>` bằng `http://localhost:3001`):

```bash
# 1. Tạo khách có 3 số (số đầu không chỉ số chính -> số đầu thành số chính)
curl -X POST <BASE>/api/customers -H "Authorization: Bearer <TOKEN>" -H 'Content-Type: application/json' \
  -d '{"fullName":"Nguyễn Văn A","phones":[{"phone":"0987 884 244"},{"phone":"+84901234567","label":"Zalo"},{"phone":"0901112233"}],"tagIds":[],"children":[{"fullName":"Bé A","dateOfBirth":"2020-05-01","gender":"Nữ"}]}'
# -> 201, đúng 1 số chính là 0987884244, children trả ageYears tính từ ngày sinh
# 2. Tạo khách trùng 1 số PHỤ của khách khác (dùng số 0901112233) -> 400, báo rõ số + tên khách A
# 3. Sửa khách B thành số của khách A -> 400, toàn bộ sửa bị rollback (kiểm tra lại hồ sơ B không đổi)
# 4. Tạo khách có 2 số sau chuẩn hóa giống nhau (0987884244 và +84987884244) -> 400, không tạo khách
# 5. Tạo khách có 2 số chính -> 400
# 6. Tìm kiếm bằng số phụ: GET /api/customers?q=0901112233 và q=+84901112233 -> đều ra khách A
# 7. Tìm kiếm bằng số viết khác định dạng: q=0987 884 244 -> ra khách A
# 8. Đổi số chính: POST /api/customers/<ID>/phones/<PHONE_ID>/make-primary -> số cũ hết chính, số mới thành chính
# 9. Xóa số chính khi còn số khác -> số còn lại cũ nhất thành số chính; xóa số chính duy nhất không xác nhận -> 400
# 10. Lọc theo tag: tạo tag, gán cho khách, GET /api/customers?tagId=<TAG_ID> -> chỉ ra khách có tag đó
# 11. Thêm con có ngày sinh tương lai -> 400; thêm con hợp lệ -> 201, ageYears đúng
# 12. Xóa mềm khách: DELETE /api/customers/<ID> -> khách biến mất khỏi danh sách; DELETE ?hard=true với khách có số/con -> 400 và giữ nguyên
# 13. Phân quyền: không token -> 401; token sale (view_own) xem khách của người khác -> 403; sale tạo tag -> 403 (thiếu customer.tag_manage)
# 14. Họ tên và số đều trống -> 400 "Vui lòng nhập họ tên hoặc số điện thoại khách hàng."
```

## Thứ tự sprint tiếp theo

1. **Auth** — đăng nhập, user/role, backend kiểm tra quyền (403),
   user bị khóa không đăng nhập được, mật khẩu hash, không trả password_hash.
2. **Customer** — CRUD khách, bảng `CustomerPhone` nhiều số / 1 số chính,
   chuẩn hóa + kiểm tra trùng tất cả các số, tìm kiếm theo bất kỳ số nào,
   tag, con cái, lịch sử chăm sóc.
3. **Product/SKU** — sản phẩm cha + SKU mặc định, biến thể, SKU unique
   toàn hệ thống (trim + viết hoa), không bán SKU/product inactive.
4. **Inventory** — tồn theo SKU, mọi thay đổi qua `InventoryTransaction`
   đủ before/after/reason, không trừ/hoàn 2 lần, không tồn âm ở MVP.
5. **Order** — dòng đơn bắt buộc có SKU + snapshot, chỉ trừ kho khi
   `draft` → `confirmed`, cờ `inventory_deducted` / `inventory_restored`.
6. **Payment** — nhiều payment/đơn, `paid_total`/`debt_total`/`payment_status`
   do backend tính lại từ payment active, hủy payment phải có lý do,
   không thanh toán vượt trong MVP.
7. **Care** — nhắc việc, chăm sóc, remarketing cơ bản theo SKU đã mua.
8. **Dashboard** — báo cáo khớp với công nợ theo đơn và theo khách.
9. **Import/Export** — kiểm tra trùng phone/SKU trong file và với database,
   lọc dữ liệu nhạy cảm theo quyền trước khi export.
10. **Audit** — audit log cho các thao tác nhạy cảm, không xóa cứng dữ
    liệu đã có giao dịch.

Mỗi sprint phải chạy lại checklist blocker trong
`docs/12_QUY_TAC_CHOT_CUNG.md` trước khi coi là xong.

## Các điểm CHƯA chốt — chủ dự án quyết TRƯỚC Sprint Customer

1. ~~Database: PostgreSQL hay portable (SQLite dạng file)?~~ **ĐÃ CHỐT: giữ PostgreSQL** (2026-10-28).
2. ~~Docker bắt buộc hay không?~~ **ĐÃ CHỐT: dùng cả hai** — Docker Compose để chạy/vận hành, npm để phát triển/debug, cùng code và env.
3. ~~Auth: JWT hay session, thời hạn token, refresh?~~ **ĐÃ CHỐT: JWT, mặc định 8h** (qua `JWT_EXPIRES_IN`); username + mật khẩu mặc định, OTP email do admin bật/tắt. Refresh token / thu hồi token phía server chưa làm trong MVP.
4. **Kiểm chứng Sprint Auth sau khi có PostgreSQL** (chưa chạy được ở máy làm việc này — xem “Tồn đọng” dưới): checklist curl trong README/phần tồn đọng, bao gồm đăng nhập đúng/sai, user bị khóa, thiếu token, thiếu quyền, OTP off/on, đổi `otp_mode` không có SMTP.
5. **Một kho hay thiết kế sẵn đa kho?** — scaffold dùng 1 kho (`MAIN`);
   đa kho là ngoài MVP, không tự mở rộng trong Sprint Inventory.
6. **Trạng thái đơn ở MVP:** bản đầy đủ có packing/shipping/returned,
   bản MVP rút gọn có draft/confirmed/completed/cancelled. Schema đã giữ
   cả hai nhóm để tương thích, nhưng Sprint Order phải chốt rõ trạng thái
   nào được dùng ở MVP và trạng thái nào chỉ ẩn đi.

## Mâu thuẫn đã xử lý theo quy tắc chốt cứng

- Đặc tả cũ dùng `phone_1`/`phone_2` (tối đa 2 số) → **quy tắc chốt cứng
  4.1 thắng**: dùng bảng `CustomerPhone`, không giới hạn số lượng,
  1 số chính, kiểm tra trùng tất cả các số.
- Mọi tài liệu cũ khác mâu thuẫn với `12_QUY_TAC_CHOT_CUNG.md` đều phải
  báo cho chủ dự án, không tự chọn theo tài liệu cũ.

## Tồn đọng Sprint Auth — phải làm sau khi có PostgreSQL (chưa chạy được ở máy này)

Nguyên nhân: máy làm việc này không có Docker và không có PostgreSQL,
và `prisma generate` / `prisma validate` đều thất bại khi tải engine từ
mạng (lỗi socket hang up / ECONNRESET, giống Sprint 0.1). Vì vậy các
kiểm tra cần database dưới đây là CHƯA chạy, không được coi là PASS:

1. `npx prisma validate` rồi `npx prisma generate` (khi mạng tải được engine).
2. `npx prisma migrate dev`, `npm run seed`, `npm run seed:admin`
   (cần `ADMIN_*` trong env, mật khẩu >= 8 ký tự).
3. `docker compose up -d --build` rồi kiểm tra frontend ở cổng 5173,
   backend health ở cổng 3001, và `docker compose exec backend` chạy
   được seed/migrate.

Checklist curl để chủ dự án kiểm chứng sau khi compose up (thay
`<TOKEN_ADMIN>` bằng token admin thật, `<BASE>` bằng `http://localhost:3001`):

```bash
# 1. Đăng nhập đúng (otp_mode=off) -> 200 + token, không có passwordHash
curl -X POST <BASE>/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"<ADMIN>","password":"<MAT_KHAU>"}'
# 2. Đăng nhập sai mật khẩu -> 401, thông báo chung chung
curl -X POST <BASE>/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"<ADMIN>","password":"sai"}'
# 3. Không có token -> 401; token của sale gọi API admin -> 403, không trả dữ liệu
curl <BASE>/api/admin/users
curl <BASE>/api/admin/users -H "Authorization: Bearer <TOKEN_SALE>"
# 4. /api/auth/me với token admin -> 200, có role + permissions, không có passwordHash
curl <BASE>/api/auth/me -H "Authorization: Bearer <TOKEN_ADMIN>"
# 5. Khóa user rồi đăng nhập bằng user đó -> 403 "Tài khoản đã bị khóa"
# 6. Đổi otp_mode sang email khi chưa có SMTP và OTP_DEV_LOG=false -> 400, otp_mode vẫn off
curl -X PUT <BASE>/api/admin/settings/otp-mode -H "Authorization: Bearer <TOKEN_ADMIN>" \
  -H 'Content-Type: application/json' -d '{"otp_mode":"email"}'
# 7. Đổi otp_mode sang phone -> 400 (SMS chưa hỗ trợ)
curl -X PUT <BASE>/api/admin/settings/otp-mode -H "Authorization: Bearer <TOKEN_ADMIN>" \
  -H 'Content-Type: application/json' -d '{"otp_mode":"phone"}'
# 8. Bật otp_mode=email sau khi cấu hình SMTP (hoặc OTP_DEV_LOG=true cho dev):
#    đăng nhập đúng mật khẩu -> otp_required + otp_challenge_id; verify sai mã 6 lần
#    -> khóa challenge; verify đúng mã trong 5 phút -> token
# 9. Đổi mật khẩu với mật khẩu cũ sai -> 400; với mật khẩu cũ đúng -> 200,
#    đăng nhập lại bằng mật khẩu mới thành công
```

Việc còn tồn đọng cho Sprint Đơn hàng (tiếp theo): dùng hàm
`deductForOrder` / `restoreForOrder` của Sprint Kho khi đơn chuyển
`draft` → `confirmed` (trừ kho) và khi đơn đã trừ kho bị hủy/hoàn
(hoàn kho), kèm kiểm chứng chung Auth + Khách hàng + Sản phẩm/SKU +
Kho sau khi có PostgreSQL (xem các phần “Tồn đọng” và checklist kho
mới dưới đây).

## Tồn đọng Sprint Kho — kiểm chứng sau khi có PostgreSQL

Chạy sau `prisma validate` → `generate` → `migrate dev` (migration mới
gồm mã quyền `inventory.export`) → `seed` → `seed:admin` →
`docker compose up -d --build`, rồi kiểm chứng bằng curl (thay
`<TOKEN_WAREHOUSE>` bằng token của tài khoản kho thật,
`<BASE>` bằng `http://localhost:3001`, `<SKU_ID>` bằng id biến thể thật):

```bash
# 1. Tạo SKU tồn 0 -> initial 10 -> tồn 10, có transaction loại initial
curl -X POST <BASE>/api/inventory/initial -H "Authorization: Bearer <TOKEN_WAREHOUSE>" \
  -H 'Content-Type: application/json' -d '{"variantId":"<SKU_ID>","quantity":10,"reason":"Nhập tồn ban đầu"}'
# 2. Initial lần 2 -> lỗi (409), tồn vẫn 10
curl -X POST <BASE>/api/inventory/initial -H "Authorization: Bearer <TOKEN_WAREHOUSE>" \
  -H 'Content-Type: application/json' -d '{"variantId":"<SKU_ID>","quantity":5,"reason":"Nhập lại"}'
# 3. Import 5 -> tồn 15; export 20 -> lỗi, tồn vẫn 15, không có transaction mới
curl -X POST <BASE>/api/inventory/import -H "Authorization: Bearer <TOKEN_WAREHOUSE>" \
  -H 'Content-Type: application/json' -d '{"variantId":"<SKU_ID>","quantity":5,"reason":"Nhập hàng đợt 1"}'
curl -X POST <BASE>/api/inventory/export -H "Authorization: Bearer <TOKEN_WAREHOUSE>" \
  -H 'Content-Type: application/json' -d '{"variantId":"<SKU_ID>","quantity":20,"reason":"Xuất bán"}'
# 4. Export 5 -> tồn 10; adjust đặt về 7 -> transaction loại set, changed -3
curl -X POST <BASE>/api/inventory/export -H "Authorization: Bearer <TOKEN_WAREHOUSE>" \
  -H 'Content-Type: application/json' -d '{"variantId":"<SKU_ID>","quantity":5,"reason":"Xuất bán lẻ"}'
curl -X POST <BASE>/api/inventory/adjust -H "Authorization: Bearer <TOKEN_WAREHOUSE>" \
  -H 'Content-Type: application/json' -d '{"variantId":"<SKU_ID>","mode":"set","setTo":7,"reason":"Kiểm kê cuối tháng"}'
# 5. Bulk import [SKU A +5, SKU B -100 vượt tồn] -> lỗi, cả A cũng không đổi (all-or-nothing)
# 6. Xem lịch sử -> before/after khớp từng dòng, mới nhất trước
curl "<BASE>/api/inventory/<SKU_ID>/transactions" -H "Authorization: Bearer <TOKEN_WAREHOUSE>"
# 7. Không token -> 401; sale không có quyền adjust -> 403; điều chỉnh không có lý do -> 400
curl -X POST <BASE>/api/inventory/adjust -H 'Content-Type: application/json' \
  -d '{"variantId":"<SKU_ID>","mode":"increase","quantity":1}'
```

Tồn đọng cho Sprint Đơn hàng — ĐÃ CHỐT (2026-10-29, chủ dự án):
trạng thái MVP đơn giản draft/confirmed/completed/cancelled; đơn nháp
CÓ giữ tồn (reservedQuantity); trả hàng một phần LÀM LUÔN trong Sprint
Đơn hàng, dùng loại transaction `return` (hủy toàn đơn đã xác nhận
dùng `order_cancelled` cho phần chưa trả). Chi tiết xem phần "Đã làm
xong: Sprint Đơn hàng" ở cuối file.

## Đã làm xong: Sprint Đơn hàng (chỉ ở mức code, chưa kiểm chứng với DB thật)

Quyết định của chủ dự án cho sprint này (2026-10-29):
1. Trạng thái đơn MVP là BẢN ĐƠN GIẢN, chỉ 4 trạng thái:
   draft / confirmed / completed / cancelled. Enum `OrderStatus`
   trong schema đã được thu hẹp về 4 giá trị này (packing/shipping/
   returned đã có từ scaffold đã bị loại bỏ; chưa có đơn nào nên việc
   thu hẹp là an toàn, nhưng vẫn là một migration cần chạy).
2. Đơn nháp CÓ GIỮ TỒN, qua trường mới `InventoryItem.reservedQuantity`.
3. Trả hàng một phần LÀM LUÔN trong sprint này.

**Mô hình đặt giữ — và cách nó vẫn giữ quy tắc chốt cứng "chỉ trừ
kho khi draft → confirmed, chỉ trừ 1 lần" (§2.3):**
- Tồn khả dụng = `quantity - reservedQuantity`. Tồn vật lý
  (`quantity`) không đổi khi tạo/sửa/hủy đơn nháp.
- Tạo đơn nháp: kiểm tra tồn khả dụng của từng SKU, thiếu thì chặn
  toàn bộ đơn (rollback, không tạo đơn nửa vời). Đủ thì
  `reservedQuantity += số lượng` từng dòng, trong cùng transaction
  với việc tạo đơn.
- Sửa đơn nháp: giải phóng đặt giữ cũ trước, rồi kiểm tra và đặt giữ
  lại theo dòng mới, vẫn trong cùng một transaction (lỗi thì rollback
  cả việc giải phóng, đơn cũ nguyên vẹn). Đơn đã xác nhận trở đi
  không sửa được dòng/tổng tiền, chỉ đổi trạng thái, trả hàng, ghi chú.
- Xác nhận (draft → confirmed): kiểm tra tồn vật lý >= số lượng từng
  dòng (điều chỉnh thủ công có thể đã làm tồn vật lý thấp hơn số đã
  giữ — khi đó chặn xác nhận, đơn vẫn nháp và vẫn giữ), rồi
  `reservedQuantity -= số lượng` và gọi `deductForOrder` của Sprint
  Kho (trừ vật lý, loại `order_confirmed`, bật cờ
  `inventoryDeducted/inventoryDeductedAt`). Xác nhận lần 2 bị chặn.
- Hủy đơn nháp (draft → cancelled): `reservedQuantity -= số lượng`,
  tồn vật lý không đổi, không ghi transaction `order_confirmed`.
- Hủy đơn đã xác nhận (confirmed → cancelled): hoàn kho thật loại
  `order_cancelled`, bật cờ `inventoryRestored/inventoryRestoredAt`.
  QUAN TRỌNG: nếu đơn đã trả một phần trước đó, hủy chỉ hoàn phần
  CHƯA TRẢ (`quantity - returnedQuantity`), không gọi
  `restoreForOrder()` nguyên bản vì hàm đó hoàn toàn bộ số lượng gốc
  và sẽ hoàn trùng phần đã trả. Việc hoàn phần còn lại vẫn đi qua
  `applyInventoryChange` của inventory service (cùng choke point).
  Hủy lần 2 bị chặn. Đơn hoàn thành không hủy được (chuyển
  completed → cancelled bị chặn); muốn đảo ngược đơn hoàn thành thì
  dùng trả hàng.
- Hoàn thành (confirmed → completed): chỉ đổi trạng thái, không đổi
  tồn, không đổi tiền. Các chuyển trạng thái khác đều bị chặn.

**Backend API** (`backend/src/routes/orders.ts`,
`backend/src/lib/orders.ts`, tái dùng `authenticate`/`authorize`):
`GET /api/orders` (phân trang, tìm theo mã đơn/tên khách, lọc trạng
thái/khách/khoảng ngày/khoảng tổng tiền, kèm tên khách và số dòng),
`GET /api/orders/:id` (chi tiết kèm khách, từng dòng với snapshot SKU/
tên sản phẩm/tên biến thể/đơn giá, số lượng đã trả và còn trả được,
cờ đã trừ/đã hoàn, fullyReturned),
`POST /api/orders` (tạo nháp: khách phải tồn tại và active, mỗi dòng
bắt buộc có `productVariantId` — dòng chỉ có `productId` bị chặn;
SKU và cha phải active; đơn giá mặc định lấy giá bán hiện tại của SKU
và lưu snapshot; số lượng nguyên > 0; chiết khấu cấp đơn >= 0 và <=
subtotal; phí ship >= 0; mã đơn tự sinh `DH-YYYYMMDD-XXXXXX`, trùng
mã thì sinh lại và thử lại tối đa 5 lần),
`PATCH /api/orders/:id` (chỉ đơn nháp, xem trên),
`POST /api/orders/:id/confirm|complete|cancel`,
`POST /api/orders/:id/return` (xem dưới),
`DELETE /api/orders/:id` (mặc định = hủy theo luồng cancel;
`?hard=true` chỉ Admin với mã mới `order.hard_delete`, chỉ đơn nháp
chưa từng trừ kho, chưa có payment, chưa có inventory transaction —
đặt giữ đang có của đơn nháp được giải phóng trong cùng transaction
xóa, vì nếu hiểu "chưa từng giữ tồn" theo nghĩa đen thì không bao
giờ xóa cứng được đơn nháp nào; điều kiện thực chất là chưa từng
trừ kho và chưa có giao dịch).
- **Tiền (sprint này chưa có payment):** `subtotal = Σ lineTotal`,
  `lineTotal = quantity × unitPrice − discountAmount` (dòng),
  `grandTotal = subtotal − discountTotal + shippingFee`,
  `paidTotal = 0`, `debtTotal = grandTotal`,
  `paymentStatus = paid` nếu `grandTotal = 0`, ngược lại `unpaid`.
  Tính bằng số nguyên cents để tránh sai số float. Sprint Thanh toán
  sẽ tính lại `paid_total`/`debt_total`/`payment_status` từ payment
  active — frontend không được gửi các giá trị này lên và backend
  không nhận chúng làm input.
- **Quyền:** dùng mã đã seed (`order.view_all/view_own/create/
  update_draft/confirm/cancel/complete`) và 2 mã MỚI:
  `order.return` (giao cho Manager; Admin có mọi mã) và
  `order.hard_delete` (chỉ Admin). Manager được bổ sung thêm
  `order.complete` (trước đó Manager chưa có). Sales giữ
  create/update_draft/confirm cho đơn của mình, không có cancel/
  complete/return (bảo thủ như các sprint trước — nếu chủ dự án muốn
  Sales được hủy đơn của mình thì chỉnh tập quyền rồi seed lại).
  Phạm vi: `view_all` xem tất cả; `view_own` chỉ xem đơn do mình tạo
  (`Order.createdById`, mới bổ sung vào schema); ngoài phạm vi → 403.
  Thiếu token → 401, thiếu quyền → 403.
- **Audit:** tạo/sửa nháp, xác nhận, hoàn thành, hủy, trả hàng, xóa
  cứng — tất cả đều ghi AuditLog.

**Trả hàng một phần (làm luôn trong sprint này):**
- `POST /api/orders/:id/return`, chỉ cho đơn confirmed hoặc completed;
  đơn nháp hoặc đã hủy bị chặn. Body: danh sách dòng (theo
  `orderItemId` hoặc `productVariantId`) kèm số lượng và lý do bắt
  buộc (lý do chung hoặc từng dòng).
- Kiểm tra: số lượng trả nguyên > 0 và <= `quantity −
  returnedQuantity` của từng dòng; vượt thì chặn toàn bộ, rollback,
  không hoàn một phần. Các dòng trùng nhau được gộp trước khi kiểm tra.
- Áp dụng trong cùng transaction: hoàn kho thật qua inventory service
  loại `return`, tham chiếu là order id; `returnedQuantity += số
  lượng`; tính lại tổng từ số lượng CÒN LẠI:
  `subtotal = Σ (remaining × unitPrice − discount dòng còn lại)`,
  trong đó discount của dòng được giữ khi dòng còn số lượng và bỏ
  khi dòng đã trả hết; `discountTotal` cấp đơn bị chặn trên (cap) ở
  mức subtotal mới; `grandTotal = subtotal − discountTotal +
  shippingFee`; `debtTotal = grandTotal` (paid vẫn 0).
  Nếu mọi dòng đều trả hết thì `fullyReturned = true` nhưng TRẠNG
  THÁI ĐƠN GIỮ NGUYÊN (không đổi thành cancelled, không có trạng
  thái returned ở MVP). Cờ `inventoryRestored` KHÔNG bị bật bởi trả
  hàng — cờ đó chỉ dành cho hủy toàn đơn; hủy sau trả một phần sẽ
  hoàn nốt phần chưa trả như mô tả ở trên.
- Tồn đọng cho Sprint Thanh toán: khi đã có payment, trả hàng có thể
  làm `grandTotal` nhỏ hơn `paidTotal` (trả thừa) — Payment sprint
  phải quyết xử lý hoàn tiền / công nợ âm, vì sprint này giả định
  paid = 0.

**Schema thay đổi trong sprint này** (chưa migrate, vì chưa có DB):
`InventoryItem.reservedQuantity` (mặc định 0),
`Order.shippingFee`, `Order.fullyReturned`, `Order.createdById`
(+ quan hệ `User.createdOrders`),
`OrderItem.returnedQuantity`, thu hẹp `OrderStatus` còn
draft/confirmed/completed/cancelled.
Mã quyền mới: `order.return`, `order.hard_delete`.

**Frontend:** tab Đơn hàng sau khi đăng nhập (chỉ hiện nếu có
`order.view_all` hoặc `order.view_own`): danh sách + lọc trạng thái +
tìm mã đơn/tên khách + phân trang, chi tiết đơn với bảng dòng và
snapshot, form tạo/sửa đơn nháp (chọn khách, tìm SKU qua
`/api/variants`, thêm dòng với đơn giá mặc định là giá bán hiện tại),
nút xác nhận/hoàn thành/hủy theo trạng thái hiện tại và quyền, form
trả hàng một phần (nhập số lượng trả từng dòng, lý do bắt buộc, hiển
thị số còn trả được và cờ fullyReturned). Ẩn/hiện nút theo quyền và
trạng thái chỉ là giao diện; backend vẫn chặn.

**Kiểm tra đã chạy (xem báo cáo Sprint Đơn hàng):** frontend build
PASS; backend tsc chỉ còn đúng 3 lỗi PrismaClient chưa generate do
mạng; logic thuần (tính tiền, đặt giữ, chuyển trạng thái, tính lại
tổng khi trả hàng) PASS; chưa chạy: migrate/seed/CRUD đơn thật với
DB, `docker compose up`, `prisma validate` (lỗi mạng tải engine như
các sprint trước).

## Tồn đọng Sprint Đơn hàng — kiểm chứng sau khi có PostgreSQL

Chạy sau `prisma validate` → `generate` → `migrate dev` (migration mới
gồm `InventoryItem.reservedQuantity`, `Order.shippingFee`,
`Order.fullyReturned`, `Order.createdById`,
`OrderItem.returnedQuantity`, thu hẹp `OrderStatus`, mã quyền mới
`order.return` và `order.hard_delete`) → `seed` → `seed:admin` →
`docker compose up -d --build`, rồi kiểm chứng bằng curl (thay
`<TOKEN>` bằng token thật, `<BASE>` bằng `http://localhost:3001`,
`<CUSTOMER_ID>` và `<SKU_ID>` bằng id thật; chuẩn bị trước 2 SKU có
tồn vật lý, ví dụ SKU A tồn 10, SKU B tồn 5):

```bash
# 1. Tạo đơn nháp 2 SKU (A x3, B x2) -> 201, trạng thái draft, paid=0,
#    debt=grand, tồn VẬT LÝ không đổi (A vẫn 10, B vẫn 5), tồn KHẢ DỤNG
#    giảm (A còn 7, B còn 3 — kiểm tra qua GET /api/inventory)
curl -X POST <BASE>/api/orders -H "Authorization: Bearer <TOKEN>" -H 'Content-Type: application/json' \
  -d '{"customerId":"<CUSTOMER_ID>","items":[{"productVariantId":"<SKU_A>","quantity":3},{"productVariantId":"<SKU_B>","quantity":2}]}'
# 2. Tạo đơn nháp vượt tồn khả dụng (A x8 khi khả dụng chỉ còn 7) -> 400, KHÔNG tạo đơn (kiểm tra lại danh sách)
# 3. Tạo đơn với productId thay vì productVariantId -> 400; tạo đơn với SKU inactive -> 400
# 4. Xác nhận đơn ở (1) -> 200, trạng thái confirmed, tồn vật lý A=7 B=3, đặt giữ về 0, cờ inventoryDeducted=true
# 5. Xác nhận lần 2 -> lỗi, tồn vật lý không đổi, không có thêm transaction order_confirmed
# 6. Hủy đơn nháp khác -> đặt giữ giải phóng (khả dụng trở lại), tồn vật lý không đổi, không có transaction mới
# 7. Hủy đơn đã xác nhận -> tồn vật lý hoàn lại (A=10, B=5), cờ inventoryRestored=true, hủy lần 2 -> lỗi
# 8. Hoàn thành đơn đã xác nhận -> trạng thái completed, tồn và tiền không đổi; completed -> cancel -> lỗi
# 9. Trả một phần đơn đã xác nhận/hoàn thành (A trả 1) -> tồn A tăng 1, returnedQuantity của dòng A = 1,
#    grandTotal tính lại theo số còn lại, lý do bắt buộc (không có lý do -> 400)
# 10. Trả vượt số còn trả được -> lỗi, không đổi gì (tồn, returnedQuantity, tổng đều nguyên)
# 11. Trả hết mọi dòng -> fullyReturned=true nhưng trạng thái đơn VẪN completed (không thành cancelled/returned)
# 12. Hủy đơn đã xác nhận sau khi đã trả một phần -> chỉ hoàn phần chưa trả, không hoàn trùng phần đã trả
# 13. Phân quyền: không token -> 401; sale không có order.confirm xác nhận -> 403; sale view_own xem đơn của người khác -> 403
# 14. Sửa đơn đã xác nhận (PATCH dòng/tổng tiền) -> 400; sửa đơn nháp đổi dòng -> đặt giữ tính lại đúng
# 15. Xóa cứng đơn nháp có payment hoặc đã từng trừ kho -> 400; xóa cứng đơn nháp sạch -> 200 và đơn biến mất
```

## Sprint Thanh toán / Công nợ — đã làm ở mức code (chưa kiểm chứng với DB thật)

**Công thức duy nhất, do backend tính lại — không nhận từ frontend:**
`paid_total = tổng amount của các payment đang active của đơn đó`;
`debt_total = grand_total - paid_total`;
`payment_status`: `grand_total <= 0` → `paid`; `paid_total = 0` → `unpaid`;
`0 < paid_total < grand_total` → `partial`; `paid_total >= grand_total` → `paid`.
Mọi thay đổi payment đều đi qua đúng một hàm `recalculateOrderPaymentTotals(tx, orderId)`
trong `backend/src/lib/payments.ts`, gọi trong cùng transaction với tạo/hủy payment
và với trả hàng sau khi đổi `grand_total`. Frontend gửi `paidTotal`/`debtTotal`/
`paymentStatus` lên cũng bị backend bỏ qua (không phải lỗi, mà là thiết kế:
backend luôn tính lại). Tiền là số nguyên đồng; số tiền payment phải là số nguyên > 0.

**API mới** (`backend/src/routes/payments.ts`, đã gắn vào `app.ts`):
- `GET /api/orders/:id/payments` (`payment.view_all` hoặc `payment.view_own` trong phạm vi):
  danh sách payment của 1 đơn, mới nhất trước, kèm cả payment đã hủy (lý do, người hủy,
  ngày hủy) và tổng tiền hiện tại của đơn.
- `POST /api/orders/:id/payments` (`payment.create`): body duy nhất được nhận là
  `{amount, paymentMethod, note?}`. Phương thức theo docs 05 §7.1: `cash` (Tiền mặt),
  `bank_transfer` (Chuyển khoản), `cod` (COD), `e_wallet` (Ví điện tử) — phương thức
  tự do bị chặn. Chỉ thu cho đơn `confirmed` hoặc `completed` (đơn nháp/đã hủy bị chặn).
  Trong cùng transaction: khóa dòng đơn (`SELECT ... FOR UPDATE`) rồi đọc lại tổng
  payment active hiện tại, chặn nếu `debt_total <= 0`, chặn nếu `amount > debt_total`
  (báo rõ số còn nợ), tạo payment `active`, gọi recalculate, ghi AuditLog.
- `POST /api/payments/:id/cancel` (`payment.cancel`): bắt buộc có `reason`, lưu
  `cancelReason`/`cancelledById`/`cancelledAt`, chuyển sang `cancelled`, KHÔNG xóa cứng,
  KHÔNG xóa khỏi danh sách. Hủy payment đã hủy rồi → 409. Sau hủy, recalculate ngay
  trong cùng transaction; hủy payment không hoàn kho và không đổi trạng thái đơn.
  Không có route xóa cứng payment.
- `GET /api/debts` (`debt.view_all` hoặc `debt.view_own` trong phạm vi): danh sách công nợ
  theo đơn, phân trang, lọc `q` (mã đơn/tên khách), `customerId`, `paymentStatus`,
  `status` (ghi đè mặc định), `sort=debt` (nợ lớn trước), `debtOnly=false` (hiện cả đơn
  đã đủ tiền). Mặc định chỉ gồm đơn `confirmed`/`completed` có `debt_total > 0`, kèm
  `summary.totalDebt`/`count` tính trên toàn bộ bộ lọc (không chỉ trang hiện tại).
- `GET /api/customers/:id/debt` (`debt.view_all` hoặc `debt.view_own` với khách do mình
  tạo/phụ trách): công nợ theo khách, tính TRỰC TIẾP từ các đơn `confirmed`/`completed`
  của khách (không có trường tổng riêng trên Customer để tránh lệch), trả
  `totalDebt` (ròng), `totalOwing` (tổng nợ dương), `totalCredit` (tổng tiền thừa) và
  danh sách các đơn còn nợ. Số này phải khớp với tổng ở trang Công nợ khi không có
  đơn trả thừa.

**Quyết định công nợ — đơn nào tính là "còn nợ":** mặc định chỉ đơn `confirmed`/
`completed`. Đơn nháp chưa chốt và đơn đã hủy (đã vô hiệu, hủy đơn không reset tổng
tiền cũ trong code) không tính là còn nợ — nếu tính cả hai thì danh sách công nợ sẽ
hiển thị nợ giả cho đơn chưa bán và đơn đã hủy. Cả hai đầu (`/api/debts` và
`/api/customers/:id/debt`) dùng cùng mặc định này nên luôn khớp nhau; `?status=`
cho phép xem cả đơn nháp/đã hủy khi cần đối soát.

**Quyết định tiền thừa khi trả hàng (đã chốt trong sprint này, thay cho tồn đọng
của Sprint Đơn hàng):** nếu trả hàng làm `grand_total < paid_total` thì `debt_total`
ÂM, đó là tiền thừa của khách (credit), `payment_status` vẫn là `paid`, trang Công nợ
và hồ sơ khách hiển thị số âm này là "tiền thừa cần hoàn" chứ không phải nợ, và
không cho tạo thêm payment khi `debt_total <= 0`. Không tự tạo payment âm, không tự
hoàn tiền ở sprint này — hoàn tiền là tồn đọng cho sprint sau, cần quyết hình thức
hoàn (tiền mặt/chuyển khoản) và ai duyệt.

**Trả hàng sau Payment sprint:** luồng trả hàng trong `routes/orders.ts` đã được sửa:
sau khi tính lại `subtotal`/`discountTotal`/`grandTotal` theo số còn lại, code gọi
`recalculateOrderPaymentTotals` thay vì gán `paidTotal = 0` / `debtTotal = grandTotal`
như Sprint Đơn hàng (cách cũ chỉ đúng khi chưa có payment). `recomputeTotalsAfterReturn`
vẫn trả về `debtTotal`/`paymentStatus` theo giả định paid = 0 nhưng route không còn
dùng hai trường đó nữa.

**Quyền:** không cần mã quyền mới — mã đã seed sẵn được tái dùng:
`payment.view_all/view_own/create/cancel`, `debt.view_all/view_own`. Lưu ý tập quyền
mặc định hiện tại: Manager có `payment.create` nhưng KHÔNG có `payment.cancel`;
Accountant và Admin có `payment.cancel`; Sales có `payment.create` cho đơn của mình
nhưng không có `payment.cancel`. Nếu chủ dự án muốn Manager cũng hủy được payment
thì chỉnh tập quyền rồi seed lại. Thiếu token → 401, thiếu quyền → 403. Audit cho
tạo và hủy payment.

**Schema thay đổi trong sprint này:** không có thay đổi schema mới (dùng sẵn
`Payment.status/cancelReason/cancelledById/cancelledAt`, `Order.paidTotal/debtTotal/
paymentStatus`). Migration cần chạy chỉ là các migration tồn đọng từ các sprint trước.

**Frontend:** tab Thanh toán trong chi tiết đơn (chỉ hiện nếu có quyền xem payment):
danh sách payment kèm trạng thái và lý do hủy, form ghi nhận payment (số nguyên đồng,
phương thức theo docs 05, kiểm tra không vượt số còn nợ ở cả frontend và backend),
hủy payment với ô lý do bắt buộc, cảnh báo tiền thừa khi `debt_total < 0`, và mọi
tổng tiền hiển thị đều được tải lại từ backend sau mỗi thao tác (frontend không tự
tính lại để hiển thị). Trang Công nợ mới (tab "Công nợ" nếu có `debt.view_all` hoặc
`debt.view_own`): danh sách đơn còn nợ, tổng nợ theo bộ lọc, bấm xem payment của đơn.
Hồ sơ khách hiển thị công nợ tính trực tiếp (tổng ròng, tiền thừa, danh sách đơn còn
nợ) thay cho khối "đang để trống" trước đây. Ẩn/hiện nút theo quyền chỉ là giao diện;
backend vẫn chặn.

**Kiểm tra đã chạy (xem báo cáo Sprint Thanh toán):** frontend build; backend tsc
(chỉ còn lỗi PrismaClient chưa generate do mạng, như các sprint trước); logic thuần
tính paid/debt/status, chặn vượt nợ, tính lại sau hủy, tổng nợ khách, trường hợp
trả thừa — PASS. Chưa chạy: migrate/seed/thu tiền thật với DB, `docker compose up`,
`prisma validate` (lỗi mạng tải engine như các sprint trước).

## Tồn đọng Sprint Thanh toán — kiểm chứng sau khi có PostgreSQL

Chạy sau `prisma validate` → `generate` → `migrate dev` → `seed` → `seed:admin` →
`docker compose up -d --build`, rồi kiểm chứng bằng curl (thay `<TOKEN>` bằng token
thật, `<BASE>` bằng `http://localhost:3001`, `<ORDER_ID>` bằng id thật; chuẩn bị
trước 1 đơn đã xác nhận tổng 1.000.000, chưa thu tiền):

```bash
# 1. Tạo đơn 1.000.000 -> debt 1.000.000, paymentStatus unpaid, paid 0
# 2. Tạo payment 300.000 tiền mặt -> paid 300.000, debt 700.000, partial
curl -X POST <BASE>/api/orders/<ORDER_ID>/payments -H "Authorization: Bearer <TOKEN>" -H 'Content-Type: application/json' \
  -d '{"amount":300000,"paymentMethod":"cash","note":"Cọc"}'
# 3. Tạo thêm payment 500.000 chuyển khoản -> paid 800.000, debt 200.000, partial
# 4. Tạo payment 300.000 vượt nợ 200.000 -> 400, paid/debt không đổi, không tạo payment mới
# 5. Hủy payment 500.000 với lý do -> paid quay lại 300.000, debt 700.000, status partial,
#    payment đã hủy vẫn hiển thị trong GET /api/orders/<ORDER_ID>/payments với lý do hủy
# 6. Tạo payment đúng 700.000 -> paid 1.000.000, debt 0, paid; tạo thêm payment khi debt 0 -> 400
# 7. GET /api/debts -> đơn trên không còn trong danh sách mặc định (debt > 0); GET /api/customers/<CUSTOMER_ID>/debt
#    -> tổng bằng tổng debt các đơn còn nợ của khách đó; so với trang Công nợ phải khớp
# 8. Tạo payment cho đơn nháp -> 400; cho đơn đã hủy -> 400; amount 0 / âm / không nguyên -> 400;
#    phương thức tự do (vd "barter") -> 400; thiếu method -> 400
# 9. Hủy payment không có lý do -> 400; hủy payment đã hủy rồi -> 409; hủy payment không đổi tồn kho, không đổi trạng thái đơn
# 10. Phân quyền: không token -> 401; sale không có payment.cancel hủy payment -> 403;
#     sale view_own xem payment của đơn người khác -> 403; sale view_own xem công nợ khách của người khác -> 403
# 11. Frontend gửi paidTotal/debtTotal giả khi tạo payment -> backend bỏ qua và tính lại đúng
#    (kiểm tra bằng cách gửi kèm "paidTotal": 999999999 trong body tạo payment, tổng sau đó vẫn đúng)
# 12. Trả hàng sau khi đã thu tiền: đơn 1.000.000 đã thu 800.000, trả hàng làm grand còn 500.000
#     -> debt -300.000, status paid, hiển thị "tiền thừa cần hoàn 300.000", tạo thêm payment -> 400
# 13. Khóa dòng đơn khi tạo payment: dòng SELECT ... FOR UPDATE trong lib/payments.ts
#     chưa được kiểm chứng với DB thật (prisma generate bị chặn bởi mạng ở máy này) —
#     nếu migrate xong mà tạo payment lỗi ở bước khóa dòng thì phải sửa ở đó, không được lặng lẽ bỏ khóa
```

**Tồn đọng cho sprint sau (Chăm sóc / Dashboard, theo thứ tự trong kế hoạch):**
- Hoàn tiền cho đơn trả thừa (debt âm): hình thức hoàn, ai duyệt, payment hoàn có phải
  là payment âm hay bản ghi riêng, và hoàn tiền có đổi `paymentStatus` không.
- Sửa payment (hiện chỉ có hủy + tạo mới).
- Báo cáo tiền theo phương thức (tiền mặt/chuyển khoản/COD/ví) — dữ liệu đã có sẵn
  từ `paymentMethod`, chỉ cần sprint Dashboard tổng hợp.

## Sprint Chăm sóc / Nhắc việc — đã làm ở mức code (chưa kiểm chứng với DB thật)

**Phạm vi:** hoạt động chăm sóc (immutable), nhắc việc, phân đoạn remarketing cơ
bản tính trực tiếp. KHÔNG gửi tin tự động qua Zalo/SMS/Email/Messenger, KHÔNG
tự tạo hoạt động từ phân đoạn hay nhắc việc, KHÔNG có job chạy nền, KHÔNG làm
dashboard hay import/export trong sprint này.

**Hoạt động chăm sóc:**
- `GET /api/customers/:id/activities` (lịch sử 1 khách, mới nhất trước, lọc loại
  và khoảng ngày trên `performedAt`), `POST /api/customers/:id/activities`
  (loại trong danh sách cố định docs 06 §5.2: call, zalo, facebook, email, visit,
  consultation, quote, close, reschedule, refuse, after_sales, payment_reminder,
  complaint, internal_note, other; nội dung bắt buộc; kết quả không bắt buộc trong
  danh sách docs 06 §5.3; ngày thực hiện mặc định hôm nay, không được là tương lai;
  người thực hiện là user đang đăng nhập), `GET /api/activities` (toàn bộ trong
  phạm vi user).
- KHÔNG có route sửa/xóa activity: lịch sử phải trung thực, ghi sai thì ghi thêm
  một hoạt động mới để đính chính. Điều này là quyết định có chủ ý, lệch với
  docs 06 §5.4 nếu docs đó cho sửa — quy tắc giữ lịch sử (§5 chốt cứng) được ưu tiên.
- Phạm vi: `activity.view_all` xem tất cả; `activity.view_own` chỉ xem hoạt động
  do mình tạo hoặc của khách do mình tạo/phụ trách. Tạo hoạt động cho khách ngoài
  phạm vi của mình bị chặn 403.

**Nhắc việc:**
- `GET /api/reminders` (lọc status, timeGroup overdue/due_today/upcoming/done/
  cancelled/all, assignedToId, customerId, q; upcoming mặc định 7 ngày tới, tham
  số `days` đổi được tối đa 90). Quá hạn/hôm nay/sắp tới ĐƯỢC TÍNH TRỰC TIẾP từ
  `dueAt` + `status` lúc đọc (docs 06 §6.2): pending + hạn < hôm nay = quá hạn,
  pending + hạn = hôm nay = hôm nay, pending + hạn sau hôm nay = sắp tới. Ngày
  được so sánh theo ngày UTC của server (ghi rõ: server UTC nên ngày đổi lúc
  07:00 giờ Việt Nam).
- `POST /api/reminders` (tiêu đề và hạn bắt buộc; khách không bắt buộc; đơn liên
  quan không bắt buộc và phải thuộc khách đã chọn nếu có cả hai; loại trong danh
  sách docs 06 §6.1; người được giao mặc định là người tạo; chỉ manager/admin —
  tức người có `reminder.view_all` — mới được giao cho người khác, sale giao cho
  người khác bị 403).
- `PATCH /api/reminders/:id` (chỉ pending; sửa tiêu đề/ghi chú/hạn/loại/người giao),
  `POST /api/reminders/:id/complete` (chỉ pending, lưu completedBy/completedAt và
  ghi chú hoàn thành nếu có; hoàn thành lần 2 bị 409),
  `POST /api/reminders/:id/cancel` (chỉ pending, lý do không bắt buộc; hủy rồi
  không hoàn thành được, hoàn thành/hủy lần 2 đều 409). Không có route xóa cứng
  nhắc việc. Tạo/hoàn thành/hủy đều ghi AuditLog.
- Phạm vi nhắc việc: `reminder.view_all` xem tất cả; `reminder.view_own` chỉ xem
  nhắc việc do mình tạo hoặc được giao cho mình.

**Phân đoạn remarketing (tính trực tiếp, không lưu sẵn, không gửi tin):**
- `GET /api/segments` (định nghĩa + số lượng tính trực tiếp; phân đoạn theo tag
  cần `tagId` mới đếm được, không có `tagId` thì count = null),
  `GET /api/segments/:key/customers` (danh sách, phân trang trong bộ nhớ sau khi
  tính — giới hạn MVP, ghi rõ).
- Công thức từng phân đoạn (chỉ khách active, chưa xóa mềm; đơn chỉ tính
  confirmed/completed, giống quy tắc công nợ):
  - `birthday_customers`: sinh nhật trong N ngày tới (mặc định 7, `days`), theo
    ngày/tháng sinh nhật, không phụ thuộc năm sinh. Sinh nhật 29/2 hiện vào 28/2
    ở năm không nhuận (quyết định có chủ ý để không bỏ sót).
  - `birthday_children`: con (chưa xóa mềm, có ngày sinh) của khách active có
    sinh nhật trong N ngày tới; chỉ trả tên con, khách liên quan, ngày sinh nhật
    sắp tới và tuổi sắp tới — KHÔNG trả ngày sinh gốc, ghi chú hay giới tính của con.
  - `inactive_customers`: đã từng mua nhưng không có đơn confirmed/completed nào
    trong X ngày qua (mặc định 90, tham số `inactiveDays` đổi được). Khách chưa
    từng mua KHÔNG lẫn vào đây.
  - `new_customers`: tạo trong 30 ngày qua.
  - `no_purchase_customers`: chưa từng có đơn confirmed/completed nào.
  - `debt_customers`: tổng debt_total (chỉ đơn confirmed/completed) > 0 — khớp
    với trang Công nợ.
  - `high_value_customers`: tổng grand_total đơn confirmed/completed (sau trả
    hàng, KHÔNG phải paid_total) >= ngưỡng (mặc định 5.000.000, `threshold`).
  - `by_tag`: khách được gán tagId chỉ định (cần `tagId`).
- Phạm vi phân đoạn: dùng phạm vi khách hàng — `customer.view_all` xem tất cả,
  còn lại chỉ khách do mình tạo/phụ trách (kể cả phân đoạn nợ và giá trị cao).

**Quyền mới trong sprint này (đã thêm vào seed):** `reminder.view_all`,
`reminder.update`, `reminder.cancel`, `segment.view`. Manager và Admin có đủ;
Sales có `reminder.update`/`reminder.cancel` cho nhắc việc của mình và
`segment.view`; Accountant có thêm `segment.view`. Các mã đã có được tái dùng:
`activity.view_all/view_own/create`, `reminder.view_own/create/complete`.

**Schema thay đổi trong sprint này (CHƯA migrate vì chưa có DB):**
`CustomerActivity.performedAt` + `result`; `Reminder` thêm `assignedToId`,
`completedById`, `cancelReason`, `completionNote`, `type`, `orderId`, và
`customerId` thành không bắt buộc; `Order.reminders`, `User.assignedReminders`,
`User.completedReminders`. Migration cần chạy gồm tất cả thay đổi này cùng các
migration tồn đọng từ các sprint trước.

**Frontend:** tab Chăm sóc trong hồ sơ khách (lịch sử + form ghi hoạt động mới,
ghi rõ hoạt động đã ghi không sửa/xóa được); trang Nhắc việc (lọc quá hạn/hôm
nay/sắp tới/đã xong/đã hủy, form tạo, nút hoàn thành/hủy); trang Phân đoạn (chọn
phân đoạn, xem số lượng và danh sách, bấm vào phân đoạn để xem khách). Ẩn/hiện
nút theo quyền chỉ là giao diện; backend vẫn chặn.

**Kiểm tra đã chạy (xem báo cáo Sprint Chăm sóc):** frontend build PASS (37
module); backend tsc chỉ còn 3 lỗi PrismaClient chưa generate do mạng, như các
sprint trước; logic thuần (sinh nhật sắp tới, 29/2, quá hạn/hôm nay/sắp tới,
inactive/new/debt/high_value) PASS 20/20 sau khi sửa 1 kỳ vọng sai trong test
(1/8 → 29/10 mới 89 ngày, chưa đủ 90 ngày inactive — lỗi ở dữ liệu test, không
phải ở code). Chưa chạy: migrate/seed/hoạt động/nhắc việc/phân đoạn thật với DB,
`docker compose up`, `prisma validate` (lỗi mạng tải engine như các sprint trước).

## Tồn đọng Sprint Chăm sóc — kiểm chứng sau khi có PostgreSQL

Chạy sau `prisma validate` → `generate` → `migrate dev` (gồm các trường mới của
Activity/Reminder ở trên + 4 mã quyền mới) → `seed` → `seed:admin` →
`docker compose up -d --build`, rồi kiểm chứng bằng curl (thay `<TOKEN>` bằng
token thật, `<BASE>` bằng `http://localhost:3001`):

```bash
# 1. Ghi hoạt động cho khách (type=call, content bắt buộc) -> 201, xuất hiện
#    đầu lịch sử GET /api/customers/<CUSTOMER_ID>/activities
curl -X POST <BASE>/api/customers/<CUSTOMER_ID>/activities -H "Authorization: Bearer <TOKEN>" -H 'Content-Type: application/json' \
  -d '{"type":"call","content":"Tư vấn balo 20L","result":"interested"}'
# 2. Ghi hoạt động với type tự do (vd "smoke-signal") -> 400; không có content -> 400;
#    ngày thực hiện tương lai -> 400; không có route PATCH/DELETE activity (404 ở catch-all)
# 3. Tạo nhắc việc hạn hôm qua -> xuất hiện ở GET /api/reminders?timeGroup=overdue;
#    hạn hôm nay -> due_today; hạn trong 7 ngày -> upcoming; hạn ngoài 7 ngày -> không ở upcoming
# 4. Tạo nhắc việc không có hạn -> 400; không có tiêu đề -> 400; sale tạo nhắc việc giao cho người khác -> 403
# 5. Hoàn thành nhắc việc -> status completed, không còn ở overdue/due_today; hoàn thành lần 2 -> 409
# 6. Hủy nhắc việc pending -> status cancelled; hủy rồi hoàn thành -> 409; hủy lần 2 -> 409
# 7. Phân đoạn: khách sinh nhật trong 7 ngày -> birthday_customers; con sinh nhật trong 7 ngày ->
#    birthday_children (chỉ tên con + khách + ngày sắp tới + tuổi sắp tới, không có ngày sinh gốc);
#    khách mua lần cuối > 90 ngày -> inactive_customers, khách chưa từng mua KHÔNG ở đó mà ở no_purchase_customers;
#    khách tạo < 30 ngày -> new_customers; khách có debt > 0 -> debt_customers và khớp tổng ở trang Công nợ;
#    khách tổng grand >= 5.000.000 -> high_value_customers; by_tag thiếu tagId -> 400
# 8. Phân quyền: không token -> 401; sale xem hoạt động/nhắc việc/phân đoạn của khách người khác -> 403;
#    sale không có reminder.update sửa nhắc việc người khác -> 403
# 9. Không có gửi tin tự động: kiểm tra bằng grep — không có route nào trong care.ts gọi mail/SMS/Zalo,
#    và phân đoạn không tạo activity hay reminder nào
```

**Tồn đọng cho sprint sau (Dashboard, theo thứ tự trong kế hoạch):**
- Dashboard/báo cáo tổng hợp (doanh thu, công nợ, tồn kho, top SKU/khách) — dữ liệu
  đã có sẵn từ các sprint trước, chỉ cần tổng hợp và lọc quyền.
- Hoàn tiền cho đơn trả thừa, sửa payment (tồn đọng từ Sprint Thanh toán).
- Job nhắc tự động / gửi tin (Zalo/SMS/Email) cho phân đoạn và nhắc việc — cần chọn
  nhà cung cấp và quyết định chính sách gửi, không làm ngầm trong sprint này.

## Đã làm xong: Sprint Dashboard / Báo cáo (chỉ ở mức code, chưa kiểm chứng với DB thật)

- **Backend API** (`backend/src/routes/dashboard.ts`, `backend/src/lib/dashboard.ts`,
  tái dùng `authenticate`; KHÔNG ghi AuditLog cho việc xem vì chỉ đọc):
  `GET /api/dashboard/summary`, `GET /api/dashboard/revenue-by-day`,
  `GET /api/dashboard/revenue-by-payment-method`, `GET /api/reports/top-skus`,
  `GET /api/reports/top-customers`, `GET /api/reports/debt`,
  `GET /api/reports/inventory`. Tất cả nhận `preset` (today/7d/30d/all,
  mặc định 30 ngày qua) hoặc `from`/`to` (cả hai, from <= to, tối đa 365
  ngày); `limit` mặc định 10, tối đa 50; ngưỡng tồn thấp mặc định 5.
- **Định nghĩa chỉ số (nhất quán với danh sách đơn và công nợ):** chỉ tính
  đơn confirmed/completed, không tính đơn nháp và đơn đã hủy; payment đã
  hủy không tính vào tiền thu. sales_total = tổng grandTotal (đã trừ trả
  hàng) của đơn trong khoảng; paid_total trong khoảng = tổng paidTotal
  snapshot của chính các đơn đó (snapshot do Sprint Thanh toán tính lại
  từ payment active — payment thu muộn cho đơn cũ vẫn tính vào ngày tạo
  đơn, không phải ngày tạo payment; tiền thu theo ngày payment xem ở
  revenue-by-payment-method). debt_total = sales − paid (âm = tiền thừa
  cần hoàn, không phải nợ). Top SKU: số lượng bán = quantity −
  returnedQuantity (dòng trả hết không tính), doanh thu dòng = số lượng
  bán × đơn giá − discount dòng đã lưu (discount không chia tỷ lệ khi
  trả một phần, nên doanh thu trả một phần hơi thấp). Lãi gộp là ƯỚC
  TÍNH theo giá nhập HIỆN TẠI của SKU, không phải lãi chính xác theo
  lô hay giá nhập lịch sử; SKU không có giá nhập thì chi phí tính bằng 0
  (làm lãi ước tính cao hơn cho dòng đó). Ngày tính theo ngày UTC
  (đổi ngày lúc 07:00 giờ Việt Nam, giống Sprint Chăm sóc).
- **Lọc quyền ở backend (không chỉ ẩn thẻ ở giao diện):** phạm vi
  `report.view_all` = toàn hệ thống, `report.view_team` = team (MVP chưa
  có thực thể team nên tính như toàn hệ thống và response ghi rõ),
  `report.view_own` = chỉ đơn do mình tạo, khách do mình tạo/được giao,
  nhắc việc do mình tạo/được giao; không có mã report nào → 403 (riêng
  báo cáo tồn kho thì `inventory.view` cũng mở được, nhưng chỉ thấy tồn
  kho). Doanh thu toàn hệ thống cần `report.view_all` hoặc
  `report.view_revenue` — thiếu thì các trường doanh thu bị LƯỢC khỏi
  response (không phải bằng 0); phạm vi own thì chỉ thấy doanh thu của
  mình. Lãi gộp cần `report.view_profit` (mặc định chỉ admin) — thiếu
  thì trường grossProfitEstimate bị lược. Giá trị tồn kho cần
  `report.view_inventory_value` hoặc `inventory.view_value` — thiếu thì
  lược giá trị (số lượng tồn vẫn thấy). Công nợ toàn hệ thống cần
  `debt.view_all`, `report.view_debt` hoặc `report.view_all` — thiếu thì
  chỉ trả công nợ trong phạm vi và lược tổng toàn hệ thống. Không cần
  mã quyền mới trong sprint này: các mã report đã được seed từ Sprint
  Auth (manager có view_team/revenue/debt; sales có view_own; accountant
  có view_debt/revenue; warehouse không có mã report nên chỉ xem được
  báo cáo tồn kho qua inventory.view).
- **Frontend:** tab Dashboard (thẻ chỉ số — thẻ nào backend không trả thì
  không hiện, biểu đồ cột doanh thu theo ngày bằng CSS, top SKU và top
  khách dạng bảng) và tab Báo cáo (tiền thu theo phương thức, top SKU,
  top khách, công nợ, tồn thấp). Biểu đồ không dùng thư viện ngoài.
- **Kiểm tra đã chạy:** frontend build PASS (38 module); backend tsc sau
  khi sửa lỗi kiểu thật trong báo cáo tồn kho chỉ còn đúng 3 lỗi
  PrismaClient chưa generate do mạng (giống các sprint trước); logic
  thuần qua ts-node transpile-only PASS 19/19 (khoảng ngày, loại trừ
  đơn nháp/hủy, doanh thu theo ngày, tiền theo phương thức, top SKU
  trừ trả hàng, top khách, công nợ tách tiền thừa, tồn kho, nhắc việc
  quá hạn/hôm nay). Chưa chạy: migrate/seed/dashboard thật với DB,
  `docker compose up`, `prisma validate` (lỗi mạng tải engine như các
  sprint trước). Không có schema thay đổi trong sprint này.

## Tồn đọng Sprint Dashboard — kiểm chứng sau khi có PostgreSQL

Chạy sau `prisma validate` → `generate` → `migrate dev` → `seed` →
`seed:admin` → `docker compose up -d --build`, rồi kiểm chứng bằng curl
(thay `<TOKEN>` bằng token thật, `<BASE>` bằng `http://localhost:3001`;
chuẩn bị trước: 2 đơn confirmed (tổng 1.500.000, đã thu 800.000), 1 đơn
nháp (tổng 999.999), 1 đơn đã hủy, 1 dòng trả một phần):

```bash
# 1. Dashboard 30 ngày -> sales_total = 1.500.000 (không tính đơn nháp/hủy),
#    paid_total = 800.000, debt_total = 700.000, orders_count = 2
curl "<BASE>/api/dashboard/summary?preset=30d" -H "Authorization: Bearer <TOKEN>"
# 2. Doanh thu theo ngày -> tổng các ngày bằng sales_total ở (1); đơn nháp/hủy không có trong ngày nào
# 3. Trả hàng một phần 1 dòng -> top SKU và doanh thu tính theo số lượng còn lại, dòng trả hết biến mất khỏi top
# 4. User không có report.view_profit gọi top-skus -> response không có trường grossProfitEstimate
# 5. User view_own gọi summary/top-customers -> chỉ thấy đơn/khách của mình, scope = "own"
# 6. User warehouse (không có mã report) gọi summary -> 403; gọi reports/inventory -> 200 nhưng không có giá trị tồn
# 7. Không token -> 401; from > to -> 400; khoảng > 365 ngày -> 400; preset sai -> 400;
#    revenue-by-day với preset=all -> 400 (cần khoảng cụ thể)
# 8. Công nợ: tổng nợ ở dashboard (debtInScopeOwing) khớp với tổng ở GET /api/debts và
#    GET /api/customers/<ID>/debt cho cùng phạm vi; đơn trả thừa (debt âm) không làm giảm tổng nợ dương,
#    mà nằm ở totalCredit/tiền thừa
# 9. Tồn kho: tổng tồn và tồn thấp/hết hàng ở dashboard khớp GET /api/inventory;
#    SKU không có dòng InventoryItem được tính là tồn 0 (hết hàng)
```

**Tồn đọng cho sprint sau (Import/Export, theo thứ tự trong kế hoạch):**
- Import/export khách, sản phẩm/SKU, đơn (kiểm tra trùng phone/SKU trong
  file và với database, lọc dữ liệu nhạy cảm theo quyền trước khi export).
- Hoàn tiền cho đơn trả thừa, sửa payment (tồn đọng từ Sprint Thanh toán).
- Job nhắc tự động / gửi tin (Zalo/SMS/Email) cho phân đoạn và nhắc việc.
- Báo cáo theo nguồn khách/nhân viên: cần thêm trường nguồn vào Order
  (schema MVP hiện không có) nếu chủ dự án muốn báo cáo này.

## Sprint Import/Export — CSV, preview-confirm, lọc export theo quyền

- **Định dạng MVP là CSV UTF-8, dấu phẩy, dòng đầu là header, hỗ trợ
  trường có dấu ngoặc kép.** File CSV mở được bằng Excel nên đủ dùng
  cho MVP; xuất/nhập .xlsx thật là tồn đọng sau này nếu chủ dự án yêu
  cầu, sprint này không thêm thư viện Excel nặng.
- **Giới hạn:** tối đa 1000 dòng dữ liệu/file, tối đa 5MB, chỉ nhận
  file .csv. Vượt giới hạn thì chặn trước khi xử lý (file > 5MB trả
  413, file > 1000 dòng trả 400).
- **Luồng import 2 bước bắt buộc, không có luồng ghi ngay:**
  1. `POST /api/import/:entity/preview` — kiểm tra từng dòng (định
     dạng, trùng trong file, trùng với database) và trả bảng preview
     với từng dòng valid/invalid kèm lỗi từng dòng, KHÔNG ghi dữ liệu.
     Preview được lưu trong bộ nhớ theo preview_id, cùng user, hết hạn
     sau 15 phút.
  2. `POST /api/import/:entity/confirm` — gửi lại preview_id, backend
     kiểm tra lại toàn bộ dòng với database HIỆN TẠI (không tin tưởng
     preview của frontend), rồi nhập các dòng valid. Dòng nào lỗi ở
     bước confirm do database thay đổi sau preview thì bị bỏ qua và
     báo rõ, các dòng khác vẫn nhập, không rollback toàn bộ chỉ vì
     một dòng lỗi (trừ lỗi hệ thống). Preview chỉ dùng được một lần,
     thuộc về đúng user đã preview. Chỉ lần confirm mới ghi AuditLog
     (entity, tổng dòng, số nhập thành công, số bỏ qua).
- **Template:** `GET /api/import/templates/:entity` trả file mẫu CSV
  với header đúng và 1-2 dòng ví dụ (dòng ví dụ phải thay bằng dữ
  liệu thật trước khi import — preview sẽ kiểm tra chúng như dòng
  thường). Cột khách hàng: name, phones (nhiều số ngăn cách bằng ;
  hoặc |), email, address, source, tags (ngăn cách bằng ;), status,
  note. Cột sản phẩm: product_name, category, sku, variant_name,
  attributes (dạng color:Đen;size:S), sell_price, import_price,
  barcode, status.
- **Import khách hàng:** cần có tên HOẶC ít nhất một số (như Sprint
  Khách hàng); phone sau chuẩn hóa phải hợp lệ (bắt đầu 0, 9-11 số);
  email nếu có thì đúng định dạng; tag chưa tồn tại thì tạo mới nếu
  user có `customer.tag_manage`, nếu không thì dòng đó lỗi. Trùng số
  sau chuẩn hóa trong cùng một dòng, giữa các dòng trong file, hoặc
  với số đang hoạt động của khách khác trong database đều làm dòng đó
  invalid, kèm số trùng và khách đã có số đó. Trùng tên nhưng không
  trùng số thì vẫn nhập bình thường (không chặn theo tên).
- **Import sản phẩm/SKU:** product_name bắt buộc, sell_price bắt buộc
  và >= 0, import_price >= 0 nếu có. SKU người dùng nhập thì trim +
  viết hoa, trùng trong file hoặc với database thì dòng invalid kèm
  sản phẩm/biến thể đã có SKU đó, hệ thống KHÔNG tự đổi mã người
  dùng; SKU để trống thì tự sinh theo logic Sprint Sản phẩm/SKU
  (slug tên + thuộc tính, hậu tố -002/-003 khi trùng). Các dòng có
  cùng product_name + category (không phân biệt hoa/thường sau trim)
  được gom thành 1 sản phẩm cha với nhiều biến thể; nếu sản phẩm đã
  tồn tại trong database với cùng tên thì thêm biến thể vào sản phẩm
  đó, nếu không thì tạo sản phẩm mới. Biến thể trùng tổ hợp thuộc
  tính với biến thể đã có của cùng sản phẩm thì dòng đó bị bỏ qua.
  Biến thể mới được tạo kèm InventoryItem tồn 0, không có transaction
  kho (như Sprint Sản phẩm/SKU).
- **Quyền import/export (3 mã mới):** `product.import`,
  `product.export`, `order.export`. `customer.import` và
  `customer.export` đã có từ Sprint Auth. Phân quyền mặc định:
  Manager được `customer.import` và `order.export`; Accountant được
  `order.export`; Admin có tất cả. Sales không có quyền import/export
  hàng loạt (thao tác nhạy cảm, nhập tay từng dòng vẫn được qua
  `customer.create`/`product.create`). Export khách hàng cần
  `customer.export` (mặc định chỉ Admin), export sản phẩm cần
  `product.export` (mặc định chỉ Admin), export đơn cần
  `order.export`, export tồn kho cần `inventory.view`.
- **Export (CSV tải về, BOM UTF-8 để Excel hiển thị tiếng Việt):**
  `GET /api/export/customers|products|orders|inventory` với bộ lọc
  giống trang danh sách tương ứng, dữ liệu lọc theo phạm vi của user
  (view_all/view_own như các sprint trước). Cột nhạy cảm được LƯỢC
  ở backend, không trả 0: import_price chỉ khi có
  `product.view_cost`; debt_total ở export khách chỉ khi có quyền xem
  công nợ; các cột tiền ở export đơn chỉ khi có quyền xem công nợ
  hoặc doanh thu (nếu không thì file chỉ có mã đơn, tên khách, ngày,
  trạng thái); giá trị tồn chỉ khi có quyền xem giá trị tồn. Không
  bao giờ trả import_price/lãi trong export đơn hàng. Chống CSV
  injection: ô bắt đầu bằng =, +, -, @, tab hoặc xuống dòng được
  thêm dấu ' ở đầu khi xuất. Mỗi lần export ghi AuditLog (entity,
  bộ lọc, số dòng, user).
- **Không có schema thay đổi trong sprint này.** Backend không dùng
  thư viện multer: multipart được parse bằng parser in-memory nhỏ
  trong `src/lib/multipart.ts` (chỉ phục vụ đúng upload import, file
  không bao giờ ghi lên đĩa vĩnh viễn).
- **Kiểm tra đã chạy:** frontend build PASS (39 module, gồm trang
  Import/Export); backend tsc sau khi sửa các lỗi kiểu thật trong
  route import/export chỉ còn đúng 3 lỗi PrismaClient chưa generate
  do mạng (giống các sprint trước); logic thuần qua ts-node
  transpile-only PASS 29/29 (parser CSV có dấu ngoặc kép/dấu phẩy
  trong trường, BOM, CRLF, ngoặc kép không đóng, chống CSV injection,
  chuẩn hóa phone/SKU, trùng trong file, gom nhóm sản phẩm, sinh SKU
  tự động + hậu tố, parser multipart). Chưa chạy: migrate/seed,
  import/export thật với DB, `docker compose up`, `prisma validate`
  (lỗi mạng tải engine như các sprint trước).

## Tồn đọng Sprint Import/Export — kiểm chứng sau khi có PostgreSQL

Chạy sau `prisma validate` → `generate` → `migrate dev` (gồm 3 mã
quyền mới `product.import`, `product.export`, `order.export`) →
`seed` → `seed:admin` → `docker compose up -d --build`, rồi kiểm
chứng bằng curl (thay `<TOKEN>` bằng token thật, `<BASE>` bằng
`http://localhost:3001`):

```bash
# 1. Tải mẫu khách, thay dòng ví dụ bằng dữ liệu thật
curl "<BASE>/api/import/templates/customers" -H "Authorization: Bearer <TOKEN>" -o template-customers.csv
# 2. Preview file 3 dòng: 1 dòng trùng số với khách đã có, 1 dòng trùng
#    số trong file, 1 dòng hợp lệ -> preview báo đúng 1 valid / 2 invalid,
#    kèm số trùng và tên khách đã có số đó; chưa có dữ liệu mới trong DB
curl "<BASE>/api/import/customers/preview" -H "Authorization: Bearer <TOKEN>" -F "file=@khach.csv"
# 3. Confirm bằng preview_id -> chỉ nhập dòng valid; gọi lại cùng
#    preview_id -> 404 (preview chỉ dùng một lần)
curl "<BASE>/api/import/customers/confirm" -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" -d '{"preview_id":"<ID>"}'
# 4. Preview sản phẩm 2 dòng cùng tên khác SKU -> confirm tạo 1 sản phẩm
#    2 biến thể; dòng SKU trùng database -> invalid; dòng SKU trống ->
#    tự sinh theo slug + hậu tố khi trùng
# 5. Export sản phẩm với user không có product.view_cost -> file KHÔNG
#    có cột import_price (không phải cột toàn 0)
curl "<BASE>/api/export/products" -H "Authorization: Bearer <TOKEN>"
# 6. Export khách với user view_own -> chỉ khách do mình tạo hoặc được
#    giao; export khách với user không có customer.export -> 403
# 7. Không token -> 401; sale không có quyền import -> 403;
#    file > 1000 dòng -> 400; file > 5MB -> 413; file không phải .csv -> 400
# 8. Export đơn với user không có quyền xem công nợ/doanh thu -> file
#    không có các cột grand_total/paid_total/debt_total/payment_status
# 9. Export ô bắt đầu bằng "=2+2" (ví dụ tên khách) -> trong file là
#    "'=2+2", mở bằng Excel không thực thi công thức
```

**Tồn đọng cho sprint sau (Audit, theo thứ tự trong kế hoạch):**
- Audit log chi tiết: xem/tìm kiếm/lọc audit log qua API và giao diện.
- Import/export .xlsx thật nếu chủ dự án yêu cầu (hiện chỉ CSV).
- Hoàn tiền cho đơn trả thừa, sửa payment (tồn đọng từ Sprint Thanh toán).
- Job nhắc tự động / gửi tin (Zalo/SMS/Email) cho phân đoạn và nhắc việc.
- Báo cáo theo nguồn khách/nhân viên: cần thêm trường nguồn vào Order
  (schema MVP hiện không có) nếu chủ dự án muốn báo cáo này.

## Sprint Audit — xem/tìm kiếm/lọc audit log (chỉ đọc)

Phạm vi: rà soát tính đầy đủ của audit đã ghi ở các sprint trước, bổ sung
log còn thiếu, harden việc ghi/đọc audit, thêm 3 API xem audit chỉ đọc và
trang Nhật ký Audit ở frontend. Không làm E2E test tự động toàn hệ thống
ở sprint này (đó là sprint sau, nếu có). Không thay đổi schema (model
`AuditLog` đã có từ scaffold: `actorId`, `action`, `entityType`,
`entityId`, `oldValue`, `newValue`, `ipAddress`, `createdAt`, không có
`updatedAt`/`deletedAt` — lịch sử bất biến).

### Bảng rà soát audit (đã kiểm tra bằng grep qua mọi route)

| Thao tác nhạy cảm | Action đã có | Bổ sung ở Sprint Audit |
|---|---|---|
| Đăng nhập thành công / sai mật khẩu / tài khoản bị khóa | `login_success`, `login_failed` | Không |
| Verify OTP sai | `login_failed` (`reason: wrong_otp`, không ghi mã) | Không |
| Đăng xuất | — | CÓ: `logout` trong `POST /api/auth/logout` (làm thành async, ghi best-effort; logout vẫn trả ok nếu ghi log lỗi; vẫn là xóa token ở client, chưa có revoke phía server) |
| Gửi lại mã OTP | — | CÓ: `otp_resent` trong `POST /api/auth/resend-otp`, sau khi tạo challenge mới thành công, actor = user của challenge, `newValue: {channel: "email"}`, không ghi mã |
| Đổi mật khẩu | `password_changed` (không ghi mật khẩu) | Không |
| Tạo/sửa user, đổi role/requireOtp/trạng thái | `user_created`, `role_changed` hoặc `user_updated` | Không |
| Khóa/mở khóa user, đặt lại mật khẩu | `user_locked`, `user_unlocked`, `password_reset` (không ghi mật khẩu mới) | Không |
| Đổi cấu hình OTP | `settings_changed` (old/new là `otp_mode` "off"/"email", không phải mã) | Không |
| Tạo/sửa/xóa mềm/xóa cứng khách | `customer_created`, `customer_updated`, `customer_deactivated`, `customer_hard_deleted` | Không |
| Thêm/xóa/đổi số chính | `customer_phone_added`, `customer_phone_removed`, `customer_primary_changed` | Không |
| Gán/bỏ tag | `customer_tag_added`, `customer_tag_removed` | Không |
| Tạo/ngừng tag | `tag_created`, `tag_deactivated` | Không |
| Sửa tag | — | CÓ: `tag_updated` trong `PATCH /tags/:id`, kèm old/new name/color/description |
| Tạo/sửa/ngừng/xóa cứng sản phẩm | `product.create`, `product.update`, `product.deactivate`, `product.hard_delete` | Không |
| Tạo/sửa/ngừng/xóa cứng biến thể; đổi giá | `variant.create`, `variant.update`, `variant.deactivate`, `variant.hard_delete`, `product.price_change` (giá cũ/mới) | Không |
| Tạo danh mục | `category.create` | Không |
| Nhập tồn ban đầu / nhập / xuất / điều chỉnh kho (thủ công) | `inventory.initial`, `inventory.import`, `inventory.export`, `inventory.adjust` (mỗi dòng SKU một audit, kèm transactionId) | Không |
| Tạo/sửa nháp/xác nhận/hoàn thành/hủy/trả hàng/xóa cứng đơn | `order.create`, `order.update_draft`, `order.confirm`, `order.complete`, `order.cancel`, `order.return`, `order.hard_delete` | Không |
| Tạo/hủy payment | `payment.create`, `payment.cancel` | Không |
| Tạo/sửa/hoàn thành/hủy nhắc việc | `reminder.create`, `reminder.update`, `reminder.complete`, `reminder.cancel` | Không |
| Xác nhận nhập file | `import.confirm` (entity, tổng dòng, thành công, bỏ qua) | Không |
| Xuất file | `export` (entity, bộ lọc, rowCount) | Không |

### Cố tình KHÔNG audit (không phải lỗ hổng)

- **Xem dashboard/báo cáo:** chỉ đọc, không sửa dữ liệu; README đã ghi
  "Dashboard là READ-ONLY (không sửa dữ liệu, không ghi AuditLog cho
  việc xem)".
- **Preview import:** chỉ kiểm tra, không ghi dữ liệu, không ghi AuditLog
  (đã ghi rõ từ Sprint Import/Export); chỉ lần confirm mới ghi audit.
- **Tạo hoạt động chăm sóc:** bản thân activity là bản ghi lịch sử bất
  biến (không có route sửa/xóa activity, ghi sai thì ghi thêm activity
  mới để đính chính) — ghi thêm một dòng audit cho cùng một sự kiện sẽ
  trùng lặp. Nhiệm vụ Sprint Audit liệt kê các thao tác nhạy cảm cần
  audit là tạo/hoàn thành/hủy nhắc việc, không liệt kê tạo activity.
- **Các route GET** (xem khách/đơn/kho/tag/danh mục/hoạt động/phân đoạn,
  tải template): chỉ đọc, không audit.
- **Không có route sửa payment:** quyền `payment.update` đã seed nhưng
  chưa có route tương ứng; sửa payment hiện tại là hủy + tạo mới (đều
  có audit). Đây là tồn đọng, không phải lỗi audit.

### Harden ghi/đọc audit

- `backend/src/lib/audit.ts`: thêm `sanitizeAuditValue()` đệ quy, áp
  dụng cho cả `oldValue` và `newValue` trong `writeAudit()` trước khi
  lưu. Lược (thay bằng `***`) mọi khóa chứa `password`/`token`/`secret`/
  `codehash`/`otpcode`/`otp_code`/`authorization` (không phân biệt
  hoa/thường) và khóa chính xác `otp`/`jwt`. Cố tình KHÔNG lược khóa
  `otp_mode` (giá trị cấu hình "off"/"email", không phải mã) và không
  lược khóa `code` nói chung (mã vai trò, mã đơn).
- Tầng đọc audit: `sanitizeAuditValueForViewer()` lược thêm
  `importPrice`/`import_price`/`importCost` khi người xem không có
  `product.view_cost`, vì `variant.update` ghi old là toàn bộ biến thể
  cũ trong đó có giá nhập. Kiểm tra thuần (không cần DB): 10/10 đạt
  (lược password/passwordHash/token/secret/codeHash/authorization,
  giữ `otp_mode` và `code`, lược giá nhập khi không có quyền, giữ khi
  có quyền).
- Kiểm tra bằng grep: không có lời gọi audit nào ghi `passwordHash`,
  mật khẩu, token, mã OTP hay JWT secret vào `oldValue`/`newValue`;
  các kết quả grep chỉ là tên action (`password_changed`,
  `password_reset`) không kèm giá trị, `otp_mode` old/new và
  `wrong_otp` kèm số lần thử.

### Quyền xem audit (quyết định)

Mã mới trong `backend/src/lib/permissions.ts` (cần seed lại để có hiệu
lực): `audit.view_all`, `audit.view_own`. Admin có tất cả theo cơ chế
seed sẵn; Manager thêm `audit.view_all`; Sales/Warehouse/Accountant
thêm `audit.view_own`. Không có mã `audit.create/update/delete` —
audit chỉ được ghi bởi `writeAudit()` trong các thao tác khác, không
bao giờ qua API.

- Danh sách toàn cục: `view_all` xem tất cả; `view_own` bị ép lọc
  `actorId = chính mình` — nếu lọc `actorId` của người khác thì trả
  403 (không lặng lẽ đổi bộ lọc); không có mã nào thì 403.
- Chi tiết 1 dòng: `view_own` chỉ xem được khi `actorId` của dòng đó là
  chính mình, nếu không thì 403.
- Lịch sử 1 thực thể: `view_own` chỉ xem các dòng mà `actorId` là chính
  mình trên thực thể đó, không xem được hành động của người khác trên
  cùng thực thể. Cách này an toàn, đơn giản và nhất quán, tránh việc
  một sales xem được hành động đổi giá của người khác chỉ vì họ có
  quyền xem thực thể đó.

### API và frontend mới

- `backend/src/routes/audit.ts` (mới), gắn vào `app.ts` tại `/api`:
  `GET /api/audit-logs` (phân trang mặc định 20, tối đa 100; lọc
  `actorId`/`user_id`, `action`, `entityType`/`entity_type`,
  `entityId`/`entity_id`, `q` (tìm trong action/entityType/entityId),
  `from`/`date_from`, `to`/`date_to` cho `createdAt` — ngày `to` dạng
  YYYY-MM-DD tính hết ngày; mới nhất trước; trả kèm username/fullName
  của actor, và `scope: "all"|"own"`), `GET /api/audit-logs/:id`,
  `GET /api/audit-logs/entity/:entityType/:entityId` (phân trang, mới
  nhất trước). Không có route POST/PATCH/PUT/DELETE nào cho audit log
  (đã kiểm tra bằng grep) — POST/DELETE rơi về catch-all của app và
  trả 404. Thiếu token → 401 (qua `authenticate`), thiếu quyền → 403.
- `frontend/src/audit.tsx` (mới): trang `AuditPage` (bộ lọc người thực
  hiện/hành động/loại/mã thực thể/tìm kiếm/khoảng ngày, phân trang,
  chi tiết dạng JSON; trường nhạy cảm nếu lỡ có hiển thị thành `***`)
  và component `EntityAuditTimeline` (lịch sử của 1 thực thể).
  `App.tsx`: nút "Nhật ký Audit" (hiện khi có `audit.view_all` hoặc
  `audit.view_own`). `customers.tsx`: nút "Xem lịch sử audit của hồ sơ
  này" trong hồ sơ khách (tái dùng API entity với `entityType=customer`);
  đơn/sản phẩm xem qua trang Nhật ký Audit với bộ lọc loại + mã thực
  thể. Ẩn/hiện theo quyền chỉ là giao diện; backend vẫn chặn.

### Kiểm chứng Sprint Audit (đã làm / chưa làm)

- Đã làm: frontend `tsc -b` + `vite build` PASS (40 module, khoảng
  2,6 giây, tăng từ 39 nhờ trang Audit); backend `tsc --noEmit` chỉ
  còn đúng 3 lỗi `PrismaClient` chưa được export (ở `audit.ts`,
  `prisma.ts`, `customers.ts`) — cùng lỗi môi trường đã biết do
  `prisma generate` thất bại vì mạng, file audit mới và các bổ sung
  không gây thêm lỗi nào; logic thuần lược trường nhạy cảm 10/10 PASS;
  grep xác nhận không có route sửa/xóa audit và không có lời gọi audit
  nào ghi trường nhạy cảm.
- Chưa làm (cần PostgreSQL/Docker, xem checklist dưới đây): migrate
  (không có migration mới ở sprint này, chỉ cần seed lại để có 2 mã
  quyền audit), mọi kiểm chứng audit thật với database.

### Tồn đọng Sprint Audit — kiểm chứng sau khi có PostgreSQL

Chạy sau `prisma validate` → `generate` → `migrate dev` → `seed` (để
có `audit.view_all`/`audit.view_own`) → `seed:admin` →
`docker compose up -d --build`, rồi kiểm chứng bằng curl (thay
`<TOKEN>` bằng token thật, `<BASE>` bằng `http://localhost:3001`,
`<ADMIN_TOKEN>`/`<SALE_TOKEN>` bằng token của từng role):

```bash
# 1. Tạo/sửa 1 khách -> GET /api/audit-logs?action=customer_created
#    (hoặc customer_updated) thấy đúng dòng, actor = user vừa thao tác
curl "<BASE>/api/audit-logs?action=customer_created" -H "Authorization: Bearer <TOKEN>"
# 2. Đổi mật khẩu -> có audit password_changed, old/new KHÔNG chứa mật khẩu
# 3. Hủy 1 payment -> có audit payment.cancel
# 4. Xác nhận 1 đơn nháp -> có audit order.confirm
# 5. Lọc theo actor và action -> chỉ đúng dòng của actor đó và action đó
curl "<BASE>/api/audit-logs?actorId=<USER_ID>&action=order.confirm" -H "Authorization: Bearer <ADMIN_TOKEN>"
# 6. Lọc theo entity -> đúng timeline của thực thể đó (vd 1 khách, 1 đơn)
curl "<BASE>/api/audit-logs/entity/customer/<CUSTOMER_ID>" -H "Authorization: Bearer <ADMIN_TOKEN>"
# 7. Xem chi tiết -> old/new không có password/token/mã OTP
curl "<BASE>/api/audit-logs/<AUDIT_ID>" -H "Authorization: Bearer <TOKEN>"
# 8. Không token -> 401
curl "<BASE>/api/audit-logs"
# 9. Sale (chỉ audit.view_own) xem toàn hệ thống -> 403 khi lọc actorId
#    của người khác; danh sách không lọc chỉ thấy audit do chính sale đó làm
curl "<BASE>/api/audit-logs?actorId=<KHAC>" -H "Authorization: Bearer <SALE_TOKEN>"
# 10. Thử POST/DELETE audit -> 404 (không sửa được log)
curl -X POST "<BASE>/api/audit-logs" -H "Authorization: Bearer <ADMIN_TOKEN>" -d '{}'
curl -X DELETE "<BASE>/api/audit-logs/<AUDIT_ID>" -H "Authorization: Bearer <ADMIN_TOKEN>"
# 11. Logout và resend-otp -> có audit logout / otp_resent (không ghi mã)
# 12. Sửa 1 tag -> có audit tag_updated kèm old/new name/color/description
```

**Tồn đọng cho sprint sau (E2E/kiểm chứng chung, theo kế hoạch):**
- Kiểm chứng đầu cuối toàn hệ thống với PostgreSQL/Docker cho mọi
  sprint (Auth → Khách hàng → Sản phẩm/SKU → Kho → Đơn hàng → Thanh
  toán → Chăm sóc → Dashboard → Import/Export → Audit) theo các
  checklist đã ghi trong file này, đặc biệt: dòng khóa đơn
  `SELECT... FOR UPDATE` trong Payment sprint, Dockerfile/nginx chưa
  chạy thử, parser multipart/CSV tự viết với file thật từ trình duyệt,
  preview import lưu trong bộ nhớ tiến trình.
- Import/export .xlsx thật nếu chủ dự án yêu cầu (hiện chỉ CSV).
- Hoàn tiền cho đơn trả thừa, sửa payment (tồn đọng từ Sprint Thanh toán).
- Job nhắc tự động / gửi tin (Zalo/SMS/Email) cho phân đoạn và nhắc việc.
- Báo cáo theo nguồn khách/nhân viên: cần thêm trường nguồn vào Order
  (schema MVP hiện không có) nếu chủ dự án muốn báo cáo này.
