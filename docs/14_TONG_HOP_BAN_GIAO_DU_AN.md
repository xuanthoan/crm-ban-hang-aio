# CRM_Ban_Hang — Tài liệu bàn giao tổng hợp (để developer khác code lại hoàn chỉnh MVP)

> **Mục đích của tài liệu này:** một developer chưa từng tham gia dự án đọc tài liệu này (cộng với code nguồn trên GitHub làm tham chiếu) là có thể code lại hoàn chỉnh bản MVP của phần mềm, đúng nghiệp vụ, đúng quy tắc, đúng phân quyền.
>
> - Repo nguồn: `https://github.com/xuanthoan/crm-ban-hang-aio` (nhánh `main`). Commit mới nhất tại thời điểm viết tài liệu: `e15058c` (2026-11-03).
> - Đặc tả gốc gồm 12 tài liệu `00_MASTER_CORE_SPEC.md` … `11_BO_SUNG_THONG_TIN_CON_CAI_KHACH_HANG.md`, cộng tài liệu thiết kế nhà cung cấp `13_THIET_KE_NHA_CUNG_CAP.md`.
> - **Quy tắc vàng:** tài liệu `12_QUY_TAC_CHOT_CUNG.md` là quy tắc đã chốt cứng và **thắng mọi tài liệu cũ khi có mâu thuẫn**. Mục 3 dưới đây tóm tắt lại các quy tắc đó; khi code, nếu thấy tài liệu cũ nói khác, làm theo mục 3 và báo lại cho chủ dự án.
> - Trạng thái dự án: MVP đã được chủ dự án tuyên bố hoàn tất ngày 2026-11-02; toàn bộ module đã được kiểm chứng bằng database thật (không chỉ chạy giao diện). Các bản sửa sau ngày đó (mục 11) cũng đã nằm trong code nguồn.

---

## 1. Bối cảnh và mục tiêu

**CRM_Ban_Hang** là phần mềm quản lý bán hàng cho cửa hàng nhỏ và vừa bán hàng vật lý: sách (kể cả sách thiếu nhi), đồ chơi, ba lô, quần áo, mỹ phẩm, v.v.

**Điểm đặc biệt của phần mềm** (khác các CRM bán hàng thông thường): hồ sơ khách hàng gắn với **thông tin con cái** của khách (tên, ngày sinh, giới tính, ghi chú) để phục vụ chăm sóc và remarketing theo sinh nhật, độ tuổi của con.

**Người dùng của hệ thống (5 vai trò):**

| Vai trò | Đối tượng | Phạm vi chính |
|---|---|---|
| Admin | Chủ cửa hàng | Toàn quyền hệ thống, quản trị user và phân quyền |
| Manager | Quản lý | Vận hành đội, xem toàn hệ thống nhưng không quản trị hệ thống |
| Sales | Nhân viên bán hàng | Chỉ dữ liệu của mình (khách, đơn do mình tạo) |
| Warehouse | Nhân viên kho | Sản phẩm, tồn kho, nhận hàng |
| Accountant | Kế toán / thu ngân | Tiền, công nợ, thanh toán |

**Phạm vi MVP gồm:** tài khoản và phân quyền; khách hàng (kèm con cái, tag, nhiều số điện thoại); sản phẩm/SKU (kèm ảnh); kho; đơn bán; thanh toán và công nợ; chăm sóc, nhắc việc và Remarketing; dashboard và báo cáo; import/export CSV; nhật ký audit; nhà cung cấp, đơn nhập hàng và công nợ nhà cung cấp; trang quản trị phân quyền.

**Nguyên tắc làm việc của dự án (developer mới cần tôn trọng):**

- Phê duyệt từng bước ở mức code, kiểm chứng bằng database thật trước khi sang bước sau.
- Phân biệt rạch ròi "code đã viết xong" với "code đã kiểm chứng bằng database thật".
- Sửa lỗi phải sửa **cả họ lỗi tương tự** trong cùng trang/khu vực, không chỉ chỗ được báo.
- Chỉ đẩy code lên GitHub khi chủ dự án chỉ đạo rõ ràng, và báo cáo chính xác commit và file đã đổi.
- Không tự ý thêm tính năng, không tự ý nới lỏng quy tắc chốt cứng.

---

## 2. Công nghệ và kiến trúc

### 2.1. Stack

- **Backend:** Node.js 20 + TypeScript + Express + Prisma 5, database **PostgreSQL 16**.
- **Frontend:** React + TypeScript + Vite + TailwindCSS v3.4 (SPA, gọi API qua `fetch` với header `Authorization: Bearer <JWT>`).
- **Chạy:** Docker Compose cho dùng hàng ngày và triển khai; npm (`npm run dev` ở `backend/` và `frontend/`) cho phát triển/debug. Cả hai cách dùng **cùng code và cùng tên biến môi trường**.

### 2.2. Cấu trúc repo (monorepo)

```text
backend/
  src/
    index.ts, app.ts            # entry, Express app, error middleware
    routes/                     # 1 file route / 1 nhóm tài nguyên (xem mục 9)
    lib/                        # logic nghiệp vụ dùng chung ("choke point")
    middleware/auth.ts          # authenticate + authorize + loadEffectivePermissions
    seed.ts, seedAdmin.ts       # seed vai trò/quyền (upsert-only) và tạo admin đầu tiên
  prisma/
    schema.prisma               # toàn bộ data model (mục 4)
    migrations/                 # 20261030053031_init + 5 migration theo sprint
  Dockerfile
frontend/
  src/
    App.tsx                     # shell: sidebar, nav theo quyền, login/OTP, home
    customers.tsx, products.tsx, inventory.tsx, orders.tsx, debts.tsx,
    care.tsx, dashboard.tsx, importExport.tsx, audit.tsx,
    suppliers.tsx, purchases.tsx, supplierDebts.tsx, admin.tsx
    labels.ts                   # nhãn tiếng Việt, badge trạng thái, nhãn audit
    validity.ts                 # thông báo validation tiếng Việt cho input
    index.css                   # design system (mục 8)
  index.html                    # title "CRM_Ban_Hang"
docker-compose.yml              # postgres + backend + frontend
docker-compose.override.yml     # chỉ thêm volume uploads_data cho backend
```

### 2.3. Cổng và biến môi trường

| Thành phần | Cổng | Ghi chú |
|---|---|---|
| PostgreSQL (container) | 5432 | Volume `postgres_data` giữ dữ liệu; `docker compose down` giữ, `down -v` xóa |
| Backend | 3001 | Kết nối nội bộ tới `postgres:5432` |
| Frontend | 5173 | Dev Vite; bản Docker chạy qua cổng 80 map ra 5173 |

Biến môi trường chính (file `.env` ở repo root cho Compose, `backend/.env` cho npm dev — cùng tên biến):

- `POSTGRES_PASSWORD`, `DATABASE_URL` (dạng `postgresql://postgres:<pass>@postgres:5432/crm_ban_hang?schema=public`).
- `JWT_SECRET` — **bắt buộc, không có giá trị mặc định**; backend từ chối khởi động nếu thiếu. Chỉ dùng ký tự chữ/số cho password và JWT_SECRET vì chúng nằm trong `DATABASE_URL`.
- `JWT_EXPIRES_IN` (mặc định `8h`), `SMTP_HOST/PORT/USER/PASS/FROM` (OTP qua email), `OTP_DEV_LOG` (chỉ bật ở dev, **không bao giờ bật ở production** vì nó in mã OTP ra log), `ADMIN_USERNAME/ADMIN_EMAIL/ADMIN_PASSWORD` (chỉ dùng cho `seed:admin`).
- **Không bao giờ commit file `.env` thật.**
- Lưu ý máy của chủ dự án: cổng host 5432/5433 đã bận nên máy đó dùng `"5434:5432"` (sửa local, **không commit**); bản trên GitHub giữ `"5432:5432"`. Developer mới dùng máy khác thì dùng đúng 5432.

### 2.4. Các "choke point" (điểm thắt nghiệp vụ — bắt buộc đi qua, không làm đường tắt)

- **Kho:** `backend/src/lib/inventory.ts` — mọi thay đổi tồn kho phải qua đây, trong cùng một DB transaction với bản ghi `InventoryTransaction`.
- **Đơn bán:** `backend/src/lib/orders.ts` — `reserveStock` / `releaseReservation` / `availableQuantity` (giữ kho của đơn nháp).
- **Thanh toán:** `backend/src/lib/payments.ts` — `recalculateOrderPaymentTotals` (tính lại `paid_total`/`debt_total`/`payment_status`).
- **Đơn nhập và thanh toán NCC:** `backend/src/lib/purchases.ts`, `backend/src/lib/supplierPayments.ts` (mirror của hai choke point trên).
- **Quyền hiệu lực:** `loadEffectivePermissions` trong `backend/src/middleware/auth.ts` — dùng cho mọi request và cho trang quản trị.
- **Audit:** `writeAudit` trong `backend/src/lib/audit.ts` — ghi log, tự redact trường nhạy cảm.
- **Upload:** `backend/src/lib/multipart.ts` — parser multipart in-memory (CSV import và ảnh đều dùng chung).

### 2.5. Các bẫy kỹ thuật đã gặp (developer mới không lặp lại)

1. **Prisma + OpenSSL trên Debian 12:** image `node:20-bookworm-slim` không có binary `openssl`, Prisma mặc định dùng engine openssl-1.1.x mà `libssl.so.1.1` không tồn tại trên Debian 12 → migrate/seed lỗi. Cách sửa đã có trong code: schema đặt `binaryTargets = ["native", "debian-openssl-3.0.x"]`, Dockerfile cài gói `openssl`, và Dockerfile chạy `chown -R node:node /app` (tránh lỗi quyền khi migrate/seed trong container, vì container chạy bằng user `node`).
2. **Comment trong file Prisma schema chỉ dùng `//`, không dùng `#`** (dòng `#` trong block generator gây lỗi P1012).
3. **Tên bảng PostgreSQL là tên model PascalCase có quote** (không có `@@map` trong schema): ví dụ `"Product"`, `"ProductVariant"`, `"PurchaseOrder"`, `"ProductImage"`, `"UserPermissionOverride"`, cột camelCase có quote. Không viết SQL tay với tên bảng lowercase.
4. **Seed là upsert-only:** `seedRoles.ts` chỉ upsert `Role`/`Permission`/`RolePermission`, không bao giờ xóa và không bao giờ chạm vào user hay override. Vì vậy khi thêm mã quyền mới: `pull` → `rebuild` → `prisma migrate deploy` (nếu có bảng mới) → chạy seed → **đăng xuất rồi đăng nhập lại** (snapshot quyền của frontend load lúc login; API thì có hiệu lực ngay).
5. **Ảnh upload:** file lưu ở `backend/uploads` (volume `uploads_data` qua `docker-compose.override.yml`), tên file sinh bằng uuid (không dùng tên gốc). Giới hạn 5 MiB mỗi ảnh, chỉ nhận jpg/png/webp. Backend dùng `express.raw` với limit `"5mib"` (không dùng `"5mb"` vì gói `bytes` hiểu đó là 5.000.000 byte, lệch với mức trình duyệt kiểm tra là 5×1024×1024); lỗi vượt giới hạn trả HTTP 413 với thông báo tiếng Việt.
6. **Ngày/giờ:** ranh giới ngày tính theo UTC của server (ngày lật lúc 07:00 giờ Việt Nam) — đây là hạn chế đã biết của MVP, xem mục 11.

---

## 3. Quy tắc chốt cứng (BẮT BUỘC — thắng mọi tài liệu cũ)

### 3.1. SKU là đơn vị bán và trừ kho duy nhất

- Mọi dòng đơn hàng bắt buộc trỏ tới một `product_variant_id` (SKU) cụ thể. Không tạo dòng đơn chỉ bằng `product_id` (sản phẩm cha).
- Kho, báo cáo bán chạy, remarketing theo sản phẩm đã mua đều tính theo SKU, không tính chung theo sản phẩm cha.
- Sản phẩm không có biến thể vẫn phải có đúng 1 SKU mặc định. Không tồn tại sản phẩm không có SKU.
- Mỗi dòng đơn lưu snapshot tại thời điểm bán: `sku_snapshot`, `product_name_snapshot`, `variant_name_snapshot`, đơn giá, giảm giá, thành tiền. Đổi tên sản phẩm/SKU sau này không được làm thay đổi đơn cũ.
- Không bán SKU đang ngừng bán (`inactive`) và không bán khi sản phẩm cha đang ngừng bán.

### 3.2. Mọi thay đổi kho phải có transaction, không trừ/hoàn 2 lần, không tồn âm

- `inventory_items` chỉ lưu tồn hiện tại của từng SKU. Mọi thay đổi tồn đều tạo `inventory_transactions` đủ: `product_variant_id`, `transaction_type`, `quantity_before`, `quantity_changed`, `quantity_after`, `reason`, `reference_type`, `reference_id` (nếu có), `created_by`, `created_at`.
- Cấm sửa trực tiếp `inventory_items.quantity` ngoài inventory service.
- Loại transaction MVP: `initial`, `import`, `export`, `adjustment_increase`, `adjustment_decrease`, `set`, `order_confirmed`, `order_cancelled`, `return`, cộng thêm cho đơn nhập: `purchase_received`, `purchase_cancelled`, `purchase_return`.
- Chỉ trừ kho khi đơn chuyển `draft` → `confirmed`, và chỉ đúng 1 lần nhờ cờ `inventory_deducted` / `inventory_deducted_at`. Chỉ hoàn kho khi đơn đã trừ kho rồi mới bị hủy/trả, và chỉ đúng 1 lần nhờ cờ `inventory_restored` / `inventory_restored_at`. Chuyển trạng thái qua lại không tự tạo transaction kho.
- Không tồn âm: trước khi trừ/giảm/đặt lại tồn hay xác nhận đơn, kiểm tra `quantity_after >= 0` với mọi SKU liên quan; chỉ cần 1 SKU không đủ là chặn và rollback toàn bộ, báo rõ SKU nào gây lỗi. Điều chỉnh hàng loạt cũng vậy.
- Mọi thao tác kho thủ công (nhập, điều chỉnh tăng/giảm, đặt lại) bắt buộc có lý do.

### 3.3. Tiền: paid_total tính từ payment, không sửa tay; công nợ khớp theo đơn và theo khách

- Một đơn có nhiều payment. Mỗi payment có: `order_id`, `customer_id`, `amount`, `payment_method`, `paid_at`, `note`, `status` (`active`/`cancelled`), `created_by`, `created_at`.
- Cấm sửa trực tiếp `paid_total` trên đơn, kể cả từ frontend hay API sửa đơn. Frontend có thể tính để hiển thị, nhưng backend phải tính lại và không tin giá trị frontend gửi.
- Công thức duy nhất, backend tính lại sau mỗi thay đổi payment:
  - `paid_total` = tổng `amount` của các payment đang `active` của đơn.
  - `debt_total` = `grand_total - paid_total`.
  - `payment_status`: `paid_total = 0` → `unpaid`; `0 < paid_total < grand_total` → `partial`; `paid_total = grand_total` → `paid`.
  - MVP: `amount > 0`, `payment_method` bắt buộc, `amount` không lớn hơn `debt_total` còn lại. Không cho thanh toán vượt trong MVP.
- Hủy payment là chuyển `status` sang `cancelled`, bắt buộc nhập lý do, lưu `cancelled_by`, `cancelled_at`. Payment đã hủy không tính vào `paid_total`. Không xóa cứng payment.
- Công nợ theo đơn = `debt_total` của đơn; công nợ theo khách = tổng `debt_total` của tất cả đơn còn nợ của khách. Dashboard, danh sách công nợ và tab công nợ trong hồ sơ khách phải cho cùng một con số.
- Trường hợp đặc biệt đã chốt: nếu trả hàng làm `grand_total < paid_total` thì công nợ âm = khách đang được **ghi có** (credit), trạng thái vẫn `paid`, không cho tạo payment mới khi `debt_total <= 0`, không tự hoàn tiền trong MVP (quy trình hoàn tiền thật là backlog).

### 3.4. Chống trùng: số điện thoại khách hàng và mã SKU

**Số điện thoại khách hàng — không giới hạn số lượng:**

- Một khách hàng có **không giới hạn** số điện thoại, lưu ở bảng riêng `customer_phones` (không phải 2 cột cố định). Mỗi dòng gồm: `customer_id`, `phone`, `phone_normalized`, `is_primary`, `label` (chính, phụ, Zalo, người thân…), `status`, `created_at`. Mỗi khách có đúng 1 số chính (`is_primary = true`) dùng để hiển thị mặc định, tìm kiếm và điền nhanh khi tạo đơn.
- Chuẩn hóa trước khi so sánh: bỏ khoảng trắng, dấu chấm, dấu gạch ngang; chuyển đầu `+84` về `0`; lưu vào `phone_normalized`. Lưu ý: chuỗi `84...` không có dấu `+` thì **bị từ chối** (dấu `+` là một phần của đầu số).
- Kiểm tra trùng trên **tất cả** các số: bất kỳ số nào trong danh sách mới cũng phải so với tất cả số đang hoạt động của tất cả khách khác **và** với chính các số còn lại trong cùng danh sách đó. Áp dụng khi tạo mới, khi sửa, khi thêm/bớt số và khi import. Khi sửa, loại trừ chính khách đang sửa khỏi kết quả trùng với khách khác, nhưng vẫn chặn trùng trong chính danh sách của khách đó.
- Số trùng chính xác với khách khác thì chặn, thông báo phải chỉ rõ số nào trùng và khách nào đã có số đó để người dùng mở hồ sơ cũ thay vì tạo mới.
- Xóa số: số phụ xóa mềm/ngừng sử dụng được; số chính chỉ được xóa khi khách còn ít nhất 1 số khác (số đó thành số chính) hoặc khi khách không còn số nào thì phải xác nhận rõ. Số đã từng dùng trong đơn/lịch sử chăm sóc thì không được xóa mất dấu vết.
- Tìm kiếm, tạo đơn và hiển thị khách phải tìm được khách qua **bất kỳ** số nào trong danh sách, không chỉ số chính.
- Nhà cung cấp dùng cùng mô hình số điện thoại (`supplier_phones`, 1 số chính, không giới hạn số lượng) nhưng **phạm vi kiểm tra trùng chỉ trong các nhà cung cấp với nhau** — một số có thể vừa là của khách vừa là của nhà cung cấp.

**Mã SKU:**

- `sku` duy nhất toàn hệ thống, có ràng buộc unique ở database, không chỉ kiểm tra ở frontend. Lưu ở dạng đã trim và viết hoa.
- Người dùng tự nhập SKU mà bị trùng thì báo lỗi, hệ thống không tự ý đổi mã của người dùng.
- SKU do hệ thống tự sinh mà bị trùng thì tự thêm hậu tố tăng dần (`...-002`, `...-003`, …) cho tới khi hết trùng.
- Import sản phẩm/SKU cũng kiểm tra trùng SKU trong file và trùng với database như tạo tay.

### 3.5. Không xóa cứng dữ liệu đã có giao dịch

- Ưu tiên dùng trạng thái: khách `inactive`, sản phẩm/SKU `inactive`, payment `cancelled`, đơn `cancelled`, user `inactive`/`locked`.
- Không xóa cứng: khách đã có đơn/thanh toán/lịch sử chăm sóc; sản phẩm/SKU đã có tồn kho hoặc đơn hàng; đơn hàng; payment; user đã có lịch sử thao tác; tag/danh mục đang được sử dụng.
- Chỉ được xóa cứng khi đồng thời: bản ghi chưa có bất kỳ dữ liệu liên quan nào, người thực hiện có quyền Admin, và thao tác được ghi audit log. Ngoài ra chỉ chuyển trạng thái.
- Xóa mềm (`deleted_at`) vẫn phải giữ lại lịch sử kho, đơn, payment và audit log liên quan để truy vết.
- Ngoại lệ: ảnh sản phẩm không phải dữ liệu giao dịch nên xóa ảnh là xóa thật cả dòng lẫn file.

### 3.6. Backend kiểm tra quyền, frontend ẩn nút chỉ là giao diện

- Ẩn nút, ẩn menu, ẩn cột ở frontend không phải là bảo mật. Mọi API quan trọng đều kiểm tra ở backend: đã đăng nhập chưa, có permission không, và có đúng phạm vi dữ liệu không (`all` / `team` / `own` / `assigned`).
- Không đủ quyền thì backend trả 403, không trả dữ liệu và không thực hiện thao tác, kể cả khi request được gọi trực tiếp bằng API.
- Dữ liệu nhạy cảm phải được lọc ở backend trước khi trả về và trước khi export, không chỉ ẩn ở giao diện: `import_price`, lãi gộp, giá trị tồn kho, doanh thu toàn hệ thống, công nợ toàn hệ thống, export toàn bộ khách hàng — nếu user không có quyền tương ứng thì không được thấy các trường này ở UI, API hay file export.
- User bị khóa (`locked`/`inactive`) không được đăng nhập. Mật khẩu hash bằng bcrypt, không lưu plain text, không trả `password_hash` ra frontend, không ghi mật khẩu vào log.
- Các thao tác nhạy cảm bắt buộc kiểm tra quyền ở backend và ghi audit log: điều chỉnh kho, hủy đơn, hủy/sửa payment, đổi giá nhập/giá bán, đổi vai trò/quyền của user, import/export dữ liệu nhạy cảm.

### 3.7. Checklist blocker (vi phạm bất kỳ mục nào thì sprint chưa xong, dù giao diện đã chạy)

1. Đơn chọn được sản phẩm cha thay vì SKU.
2. Tồn kho ban đầu nhập 10 nhưng lưu thành 0.
3. Thay đổi kho không có transaction, hoặc transaction thiếu before/after.
4. Xác nhận đơn trừ kho 2 lần, hoặc hủy đơn hoàn kho 2 lần.
5. Hủy đơn đã trừ kho nhưng không hoàn kho.
6. `paid_total` / `debt_total` / `payment_status` lệch nhau hoặc lệch với tổng payment active.
7. Hủy payment nhưng công nợ không tính lại.
8. Tạo hoặc sửa thành khách trùng số điện thoại (kể cả trùng ở bất kỳ số phụ nào), hoặc SKU trùng; hoặc khách bị giới hạn cứng ở tối đa 2 số điện thoại.
9. Xóa cứng khách/SKU/đơn/payment đã có giao dịch.
10. User không có quyền vẫn gọi API thành công, hoặc vẫn thấy giá nhập/lãi gộp/công nợ toàn hệ thống ở API/export.

---

## 4. Mô hình dữ liệu

Tất cả bảng nằm trong `backend/prisma/schema.prisma`. Kiểu tiền: đơn bán dùng `Decimal(19,2)`; đơn nhập và thanh toán NCC dùng số nguyên VND (`Int`) — đây là quyết định có chủ đích, không phải thiếu nhất quán. ID dùng `cuid()`. Các bảng có `deletedAt` là soft-delete; `InventoryTransaction` và `AuditLog` là lịch sử bất biến (không có `updatedAt`/`deletedAt`, không sửa tại chỗ).

### 4.1. Enum

- `UserStatus`: `active`, `inactive`, `locked`.
- `CustomerStatus` / `CustomerPhoneStatus` / `SupplierStatus` / `SupplierPhoneStatus`: `active`, `inactive`.
- `ProductStatus` / `ProductVariantStatus`: `active`, `inactive`.
- `OrderStatus` (đơn bán, MVP chỉ 4 trạng thái, **không** có packing/shipping/returned): `draft`, `confirmed`, `completed`, `cancelled`.
- `PurchaseOrderStatus` (đơn nhập, cũng 4 trạng thái): `draft`, `confirmed`, `completed`, `cancelled`.
- `PaymentStatus`: `unpaid`, `partial`, `paid`. `PaymentRecordStatus`: `active`, `cancelled`.
- `InventoryTransactionType`: `initial`, `import`, `export`, `adjustment_increase`, `adjustment_decrease`, `set`, `order_confirmed`, `order_cancelled`, `return`, `purchase_received`, `purchase_cancelled`, `purchase_return`.
- `ReminderStatus`: `pending`, `completed`, `cancelled`.

### 4.2. Tài khoản và phân quyền

- **Role**: `code` (unique: `admin`, `manager`, `sales`, `warehouse`, `accountant`), `name`, `description`, `isSystemRole`, `deletedAt`.
- **Permission**: `code` (unique, do hệ thống định nghĩa — xem mục 5), `module`, `description`. Không tạo permission tự do từ giao diện trong MVP.
- **RolePermission**: liên kết role–permission, unique theo cặp `(roleId, permissionId)`.
- **UserPermissionOverride**: quyền riêng từng người, unique theo cặp `(userId, permissionId)`; `effect` là `"allow"` hoặc `"deny"`; `createdById` là admin đã cấp. Xem mục 5.3.
- **User**: `username` (unique, định danh đăng nhập chính), `email` (unique), `phone`, `passwordHash` (bcrypt), `fullName`, `status`, `roleId`, `requireOtp` (nullable: `true` = luôn yêu cầu OTP, `false` = không bao giờ, `null` = theo cài đặt hệ thống), `lastLoginAt`, `deletedAt`.
- **OtpChallenge**: một dòng cho một lần đăng nhập cần OTP; chỉ lưu **hash bcrypt của mã** (không lưu mã plain text); mã 6 số, hết hạn sau 5 phút, dùng 1 lần, khóa sau 5 lần nhập sai; `channel` mặc định `"email"`; gửi lại cách nhau tối thiểu 60 giây.
- **SystemSetting**: key/value; key hệ thống biết trong MVP là `otp_mode`: `"off"` (mặc định) hoặc `"email"`. Giá trị `"phone"` phải bị API từ chối vì chưa có nhà cung cấp SMS.

### 4.3. Khách hàng và chăm sóc

- **Customer**: `fullName`, `gender` (giao diện dùng select, không nhập tự do), `dateOfBirth`, `address`, `email`, `note`, `source`, `status`, `createdById`, `assignedToId` (phạm vi dữ liệu, xem mục 5.4), `deletedAt`.
- **CustomerPhone**: `customerId`, `phone`, `phoneNormalized`, `isPrimary`, `label`, `status`, `deletedAt`. Unique theo cặp `(customerId, phoneNormalized)`; index trên `phoneNormalized` để tìm khách qua bất kỳ số nào.
- **CustomerTag**: `name` (unique), `color`, `description`, `deletedAt`. **CustomerTagAssignment**: unique theo cặp `(customerId, tagId)`.
- **CustomerChild**: `customerId`, `fullName`, `dateOfBirth`, `gender`, `note`, `sortOrder` (thứ tự hiển thị), `deletedAt`. **Tuổi không bao giờ lưu** — tính từ `dateOfBirth` lúc đọc.
- **CustomerActivity**: `customerId`, `type` (thuộc danh sách cố định trong đặc tả 06), `title`, `content`, `performedAt` (mặc định ngày tạo), `result`, `createdById`. Hoạt động là **bất biến — không có route sửa/xóa**.
- **Reminder**: `customerId` (nullable — nhắc việc chung có thể không gắn khách), `orderId`, `type`, `title`, `description`, `dueAt`, `status`, `assignedToId`, `completedAt`, `completedById`, `completionNote`, `cancelReason`, `createdById`, `deletedAt`. Chỉ nhắc việc `pending` mới được sửa/hoàn thành/hủy; hoàn thành hoặc hủy 2 lần → 409.

### 4.4. Sản phẩm, SKU, kho, ảnh

- **Category**: `name` (unique), `description`, `deletedAt`.
- **Product**: `name`, `description`, `categoryId`, `status`, `deletedAt`. Sản phẩm cha chỉ để gom nhóm, không bán được.
- **ProductVariant (SKU)**: `productId`, `sku` (unique toàn hệ thống, lưu dạng trim + viết hoa), `variantName`, `attributes` (Json — giá trị các nhóm thuộc tính), `isDefault` (đúng 1 SKU mặc định cho sản phẩm không biến thể; tối đa 1 `isDefault = true` mỗi sản phẩm, do service kiểm tra), `sellingPrice` (Decimal), `importPrice` (Decimal nullable), `barcode` (unique nullable), `status`, `deletedAt`.
- **ProductImage**: `productId`, `variantId` (null = ảnh chung gallery của sản phẩm, có giá trị = thumbnail riêng của SKU đó), `fileName` (sinh bằng uuid, không dùng tên gốc), `originalName`, `mimeType`, `size`, `sortOrder`, `createdAt`. Không có `createdById` (người tạo đã có trong audit log) và không có `deletedAt` (xóa ảnh là xóa thật). Mỗi SKU tối đa 1 thumbnail riêng (đặt thumbnail mới thì xóa ảnh cũ của SKU đó).
- **InventoryItem**: 1 dòng tồn hiện tại cho 1 SKU: `variantId` (unique), `warehouseCode` (mặc định `"MAIN"` — MVP chỉ 1 kho, đây chỉ là nhãn, đa kho **không** thuộc MVP), `quantity` (tồn vật lý), `reservedQuantity` (số lượng đang bị đơn nháp giữ — xem mục 6.6). Tồn khả dụng = `quantity - reservedQuantity`.
- **InventoryTransaction**: `productVariantId`, `transactionType`, `quantityBefore`, `quantityChanged`, `quantityAfter`, `reason` (bắt buộc với thao tác thủ công), `referenceType`, `referenceId`, `createdById`, `createdAt`. Không có `updatedAt`/`deletedAt`.

### 4.5. Đơn bán và thanh toán

- **Order**: `orderCode` (unique, dạng `DH-YYYYMMDD-XXXXXX`, tối đa 5 lần thử khi trùng), `customerId`, `status`, `paymentStatus`, `subtotal`, `discountTotal`, `shippingFee`, `grandTotal` (Decimal), `paidTotal` và `debtTotal` (**snapshot suy ra**, backend tính lại, không nhận từ frontend), `inventoryDeducted`/`inventoryDeductedAt`, `inventoryRestored`/`inventoryRestoredAt`, `fullyReturned` (true khi mọi dòng đã trả hết — trạng thái đơn **giữ nguyên** khi trả hết vì MVP không có trạng thái returned), `createdById`, `note`, `deletedAt`. Không đổi được khách của đơn khi sửa đơn.
- **OrderItem**: `orderId`, `productVariantId`, `skuSnapshot`, `productNameSnapshot`, `variantNameSnapshot`, `unitPrice`, `discountAmount`, `quantity`, `returnedQuantity` (số lượng đã trả của dòng; còn trả được = `quantity - returnedQuantity`), `lineTotal`. Trả hàng một phần: tổng đơn tính lại từ số lượng còn lại, **giảm giá của dòng giữ nguyên cả dòng, không chia theo tỷ lệ**.
- **Payment**: `orderId`, `customerId`, `amount` (Decimal), `paymentMethod` (`cash`, `bank_transfer`, `cod`, `e_wallet`), `paidAt`, `note`, `status` (`active`/`cancelled`), `cancelReason`, `cancelledById`, `cancelledAt`, `createdById`.

### 4.6. Nhà cung cấp, đơn nhập và thanh toán NCC

- **Supplier**: `name`, `taxCode` (nullable, unique **khi có giá trị** — chuỗi rỗng lưu thành null để unique index không chặn 2 NCC cùng không có mã số thuế), `email`, `address`, `note`, `status`, `createdById`.
- **SupplierPhone**: giống `CustomerPhone` (`supplierId`, `phone`, `phoneNormalized`, `isPrimary`, `label`, `status`, `deletedAt`; unique theo cặp `(supplierId, phoneNormalized)`).
- **PurchaseOrder**: `code` (unique, dạng `NH-YYYYMMDD-XXXXXX`), `supplierId`, `status`, `grandTotal`/`paidTotal`/`debtTotal` (Int, suy ra — xem mục 6.14), `paymentStatus` (chuỗi thường `"unpaid"`/`"partial"`/`"paid"`, không dùng enum), `received`/`receivedAt`, `restored`/`restoredAt`, `fullyReturned`, `createdById`, `note`. Không có `deletedAt` (hủy đơn là chuyển trạng thái).
- **PurchaseOrderItem**: `purchaseOrderId`, `variantId`, `skuSnapshot`, `productNameSnapshot`, `variantNameSnapshot`, `quantity`, `unitCost` (Int, snapshot giá nhập tại thời điểm nhận hàng), `returnedQuantity`, `lineTotal`. **Nhận hàng không bao giờ ghi đè `importPrice` hiện tại của SKU.**
- **SupplierPayment**: mirror của `Payment` nhưng tiền là Int: `purchaseOrderId`, `amount`, `paymentMethod`, `note`, `status` (chuỗi `"active"`/`"cancelled"`), `cancelReason` (`cancelledReason` trong code), `cancelledById`, `cancelledAt`, `createdById`. Không có route xóa cứng. Không có `supplierId` (đi qua đơn nhập).

### 4.7. Audit

- **AuditLog**: `actorId`, `action` (mã thao tác, ví dụ `product_image.uploaded`, `user_permissions_changed`, `role_changed`), `entityType`, `entityId`, `oldValue`/`newValue` (Json), `ipAddress`, `createdAt`. Không có `updatedAt`/`deletedAt`. Không có route tạo/sửa/xóa audit qua API — audit chỉ được ghi bởi `writeAudit()` bên trong các thao tác khác.

---

## 5. Phân quyền

### 5.1. Nguyên tắc

- Mọi API quan trọng đều qua `authenticate` (401 nếu chưa đăng nhập) và `authorize(<mã quyền>)` (403 nếu thiếu quyền hoặc sai phạm vi). Frontend ẩn nút/menu/cột chỉ là giao diện.
- Quyền hiệu lực của một user = **quyền của vai trò + allow overrides − deny overrides** (deny thắng theo cấu trúc: một mã quyền không bao giờ vừa allow vừa deny cho cùng một user).
- API có hiệu lực **ngay** khi đổi quyền (vì `authenticate` load quyền hiệu lực theo từng request); giao diện của user đó chỉ đổi sau khi **đăng nhập lại** (snapshot quyền load lúc login qua `/api/auth/me`). Trang quản trị phải ghi rõ điều này.
- Mã quyền do hệ thống định nghĩa trong `backend/src/lib/permissions.ts`; không tạo mã quyền tự do từ giao diện.

### 5.2. Mã quyền theo module

- **user:** `user.view`, `user.create`, `user.update`, `user.lock`, `user.reset_password`, `user.set_require_otp`, `user.set_permissions` (chỉ Admin), `role.view`.
- **settings:** `settings.view`, `settings.update_otp`.
- **customer:** `customer.view_all`, `customer.view_own`, `customer.create`, `customer.update`, `customer.deactivate`, `customer.hard_delete` (chỉ Admin, kèm kiểm tra backend `role === admin`), `customer.tag_manage`, `customer.assign`, `customer.export`, `customer.import`.
- **product:** `product.view`, `product.create`, `product.update`, `product.deactivate`, `product.hard_delete`, `product.view_cost`, `product.import`, `product.export`, `product.update_price`, `product.update_cost`.
- **inventory:** `inventory.view`, `inventory.view_value`, `inventory.import_stock`, `inventory.export`, `inventory.adjust`, `inventory.view_transactions`.
- **order:** `order.view_all`, `order.view_own`, `order.create`, `order.update_draft`, `order.confirm`, `order.cancel`, `order.complete`, `order.return`, `order.hard_delete`, `order.export`.
- **payment:** `payment.view_all`, `payment.view_own`, `payment.create`, `payment.update`, `payment.cancel`, `debt.view_all`, `debt.view_own`.
- **care:** `activity.view_all`, `activity.view_own`, `activity.create`, `reminder.view_all`, `reminder.view_own`, `reminder.create`, `reminder.update`, `reminder.complete`, `reminder.cancel`, `segment.view`.
- **report:** `report.view_all`, `report.view_team`, `report.view_own`, `report.view_revenue`, `report.view_profit`, `report.view_inventory_value`, `report.view_debt`, `report.export`.
- **supplier:** `supplier.view_all`, `supplier.view_own`, `supplier.create`, `supplier.update`, `supplier.deactivate`, `supplier.hard_delete` (chỉ Admin), `supplier.import`, `supplier.export`.
- **purchase:** `purchase.view_all`, `purchase.view_own`, `purchase.create` (tạo **và** sửa đơn nháp — cố tình **không** có `purchase.update` riêng), `purchase.confirm`, `purchase.complete`, `purchase.cancel`, `purchase.return`, `purchase.export`.
- **supplier_payment:** chỉ có `supplier_payment.create` và `supplier_payment.cancel` — cố tình **không** có mã view: phần thanh toán và trang công nợ NCC theo quyền xem đơn nhập (`purchase.view_all`/`view_own`).
- **audit:** `audit.view_all`, `audit.view_own` — cố tình **không** có mã tạo/sửa/xóa audit.

### 5.3. Quyền mặc định theo vai trò (seed)

- **Admin:** tất cả các mã.
- **Manager:** `customer.view_all`, `customer.create`, `customer.update`, `customer.assign`, `customer.tag_manage`, `customer.import`; `supplier.view_all`, `supplier.create`, `supplier.update`, `supplier.import`; `purchase.view_all`, `purchase.create`, `purchase.confirm`, `purchase.export`; `supplier_payment.create`; `order.export`; `product.view`; `inventory.view`, `inventory.view_transactions`; `order.view_all`, `order.create`, `order.update_draft`, `order.confirm`, `order.cancel`, `order.complete`, `order.return`; `payment.view_all`, `payment.create`; `debt.view_all`; `activity.view_all`, `activity.create`, `reminder.view_all`, `reminder.create`, `reminder.update`, `reminder.complete`, `reminder.cancel`, `segment.view`; `report.view_team`, `report.view_revenue`, `report.view_debt`; `audit.view_all`.
  - Manager **chỉ xem** kho (không nhập/xuất/điều chỉnh kho), **chỉ xem** sản phẩm (không tạo/sửa, không thấy giá nhập), tạo được payment nhưng **không hủy** payment.
- **Sales:** `customer.view_own`, `customer.create`, `customer.update`; `supplier.view_all`; `product.view`; `inventory.view`; `order.view_own`, `order.create`, `order.update_draft`, `order.confirm`; `payment.view_own`, `payment.create`; `debt.view_own`; `activity.view_own`, `activity.create`, `reminder.view_own`, `reminder.create`, `reminder.update`, `reminder.complete`, `reminder.cancel`, `segment.view`; `report.view_own`; `audit.view_own`.
  - Sales **không** có quyền hủy/hoàn thành/trả đơn của mình theo mặc định; muốn đổi phải sửa bộ quyền và seed lại.
- **Warehouse:** `product.view`; `inventory.view`, `inventory.import_stock`, `inventory.export`, `inventory.adjust`, `inventory.view_transactions`; `order.view_all`; `purchase.view_all`, `purchase.confirm`; `audit.view_own`.
  - Kho làm được mọi thao tác kho, xác nhận nhận hàng cho đơn nhập, nhưng không tạo/hủy/hoàn thành đơn nhập, không thấy giá nhập.
- **Accountant:** `customer.view_all`; `supplier.view_all`; `purchase.view_all`, `purchase.export`; `product.view`; `order.view_all`, `order.export`; `payment.view_all`, `payment.create`, `payment.update`, `payment.cancel`; `supplier_payment.create`, `supplier_payment.cancel`; `debt.view_all`; `segment.view`; `report.view_debt`, `report.view_revenue`; `audit.view_own`.
  - Kế toán **không** có tab Dashboard/Báo cáo theo thiết kế (quyền `report.view_debt`/`view_revenue` chỉ chi phối cột tiền trong export, không chi phối quyền vào trang); xem được công nợ và công nợ NCC; hủy payment được nhưng bắt buộc có lý do.
- **Không vai trò nào ngoài Admin có mặc định:** quản lý user, đổi cài đặt hệ thống, `product.view_cost` (xem giá nhập), `report.view_profit` (xem lãi gộp). Muốn đổi mặc định: sửa bộ quyền trong code, seed lại, user đăng nhập lại.

### 5.4. Phạm vi dữ liệu (scope)

- `view_all` = thấy tất cả; `view_own` = chỉ thấy bản ghi do mình tạo hoặc được phân công cho mình (khách: `createdById` hoặc `assignedToId`; đơn: `createdById`; đơn nhập: `createdById`; NCC: `createdById`).
- Phạm vi `team` **chưa cài đặt** vì MVP không có thực thể team — không được giả vờ có scope team.
- Chỉ user có `reminder.view_all` mới được gán nhắc việc cho người khác.
- Audit `view_own` chỉ thấy log do chính mình thực hiện; lọc theo `actorId` của người khác → 403.

### 5.5. Trang quản trị và tùy chỉnh quyền từng người

- Trang "Quản trị" (nav chỉ hiện khi có `user.view`) gồm: danh sách user (tìm kiếm + lọc vai trò/trạng thái), form tạo/sửa user (username và email **không sửa được sau khi tạo**, theo đúng API), khóa/mở khóa, đặt lại mật khẩu, xem ma trận vai trò (read-only), và **trình sửa quyền riêng từng người**.
- Trình sửa quyền riêng: mỗi mã quyền có 3 trạng thái — "Theo vai trò" / "Luôn cho phép" / "Luôn chặn" — nhóm theo module, có xem trước quyền hiệu lực trực tiếp, có cảnh báo khi cấp mã `user.*` cho user không phải admin, có xem trước diff khi đổi vai trò (quyền thêm/bớt; override được giữ nguyên khi đổi vai trò), có nút "Xóa hết quyền riêng" (trở về thuần vai trò).
- API: `GET /api/admin/users/:id/permissions` (quyền `user.view`) trả về vai trò, quyền vai trò, override và quyền hiệu lực kèm toàn bộ danh sách mã quyền để frontend không hard-code bảng quyền; `PUT /api/admin/users/:id/permissions` (quyền `user.set_permissions`) nhận `{allow: string[], deny: string[]}` và **thay toàn bộ** override trong một transaction; mã không tồn tại → 400; một mã vừa allow vừa deny → 400; đặt override khác rỗng cho admin đang hoạt động duy nhất → 400 (xóa hết override thì luôn cho phép); ghi audit `user_permissions_changed`.
- Hệ thống không được khóa/xóa admin đang hoạt động duy nhất. Không được khóa/xóa chính mình theo cách làm hệ thống mất admin cuối cùng.
- Đổi vai trò ghi audit `role_changed`.

---

## 6. Các module chi tiết

### 6.1. Tài khoản và đăng nhập

- **Đăng nhập bằng username + mật khẩu** (mật khẩu hash bcrypt). Ô đăng nhập trong code hiện tại còn chấp nhận cả email — rộng hơn quyết định "chỉ username" ban đầu và chưa được chốt lại là chấp nhận được hay phải thu hẹp; developer mới giữ nguyên hành vi hiện tại trừ khi chủ dự án quyết khác.
- **OTP là tùy chọn do admin điều khiển, không bắt buộc mặc định:** hệ thống có chế độ `otp_mode` (`off` mặc định, hoặc `email`); từng user có override `requireOtp` (luôn yêu cầu / không bao giờ / theo hệ thống). OTP gửi qua email (SMTP), mã 6 số, hash bcrypt, hết hạn 5 phút, dùng 1 lần, tối đa 5 lần nhập sai, gửi lại cách nhau tối thiểu 60 giây. Chế độ OTP qua điện thoại (`phone`) bị API từ chối vì chưa có nhà cung cấp SMS.
- **JWT:** hết hạn mặc định 8 giờ; backend từ chối khởi động nếu thiếu `JWT_SECRET`. Đăng xuất hiện tại chỉ là xóa token ở client (JWT stateless, chưa có thu hồi token phía server — thuộc backlog).
- **Đổi mật khẩu, xem hồ sơ `/me`, khóa/mở khóa user, đặt lại mật khẩu** đều có API riêng; user bị khóa/không hoạt động không đăng nhập được.
- **Cài đặt OTP của hệ thống** nằm ở trang Tổng quan (chỉ admin thấy): đổi `otp_mode`, đổi mật khẩu của chính mình.

### 6.2. Khách hàng

- **Trường:** họ tên, giới tính (select), ngày sinh, địa chỉ, email, ghi chú, nguồn (`source`), trạng thái, người tạo, người được phân công.
- **Số điện thoại:** xem mục 3.4 — không giới hạn số lượng, đúng 1 số chính, kiểm tra trùng mọi số. Thao tác: thêm số, đặt số chính, xóa số (theo quy tắc ở 3.4). Xóa số chính thì số cũ nhất còn lại thành số chính.
- **Con cái:** thêm/sửa/xóa thông tin con (tên, ngày sinh, giới tính, ghi chú, thứ tự). Tuổi tính lúc đọc, không lưu. Lưu ý: dữ liệu ngày sinh test cũ có thể bị sai do lỗi lịch cũ (ví dụ lưu thành năm 0001) — **không tự sửa** dữ liệu sai đó; chỉ sửa khi người dùng yêu cầu và xác nhận.
- **Tag:** tạo/sửa/ngừng tag (cần `customer.tag_manage`); gán/bỏ tag cho khách. Tag chưa có thì chỉ được tạo khi user có `customer.tag_manage` (import cũng vậy).
- **Tìm kiếm:** theo tên, theo bất kỳ số điện thoại nào (kể cả dạng `+84` hoặc có khoảng trắng), theo tag.
- **Xóa:** mặc định là ngừng hoạt động (soft); xóa cứng chỉ khi Admin, chưa có dữ liệu liên quan, và có audit log. Xóa khách có đơn/thanh toán/chăm sóc → chặn.
- **Hoạt động chăm sóc:** xem mục 6.8.
- **Lịch sử mua hàng (trang chi tiết, khung "Đơn hàng và công nợ"):** ngoài tổng công nợ và danh sách đơn còn nợ, trang còn hiện toàn bộ lịch sử đơn của khách — mỗi đơn gồm ngày đặt, trạng thái đơn, trạng thái thanh toán, tổng tiền / đã trả / còn nợ, từng dòng sản phẩm (SKU, tên sản phẩm, tên biến thể, số lượng, thành tiền, số lượng đã trả) và từng lần thanh toán (số tiền, phương thức, ngày trả; lần đã hủy ghi rõ lý do). Lịch sử gồm cả đơn nháp và đơn đã hủy (gắn nhãn trạng thái rõ ràng) nhưng tổng công nợ vẫn chỉ tính từ đơn đã xác nhận/hoàn thành, không đổi. Dữ liệu lấy từ `GET /api/customers/:id/debt` (trường `history` thêm vào, các trường cũ giữ nguyên); chi tiết thanh toán dùng chung cổng xem công nợ của trang này (người xem công nợ vốn đã thấy tổng đã trả/còn nợ), còn trang chi tiết đơn hàng vẫn giữ cổng `payment.view` riêng chặt hơn.

### 6.3. Sản phẩm và SKU

- **Hai chế độ:** "Không có biến thể (1 SKU mặc định)" và "Có biến thể". Sản phẩm có biến thể: tối đa **3 nhóm thuộc tính**, sinh tổ hợp tối đa **200 SKU/sản phẩm**; sinh lại thì bỏ qua tổ hợp đã tồn tại; tổ hợp chưa có dòng thì không có giá (giá nằm ở từng SKU, không nằm ở sản phẩm cha).
- **SKU:** xem mục 3.4 — duy nhất toàn hệ thống, trim + viết hoa, nhập trùng thì báo lỗi, tự sinh trùng thì thêm hậu tố `-002`, `-003`… SKU tự sinh = slug tiếng Việt của tên sản phẩm + slug thuộc tính, viết hoa. SKU đã có dòng đơn thì **không được đổi tên SKU**.
- **Giá:** giá bán bắt buộc ở từng SKU; giá nhập chỉ hiện và chỉ sửa khi có `product.view_cost` (mặc định chỉ Admin). Giá nhập trên form tạo sản phẩm là giá nhập **hiện tại** của SKU, không phải lịch sử giá.
- **Tồn kho ban đầu:** form tạo sản phẩm **từ chối** `initialQuantity != 0` — tồn ban đầu phải nhập ở module Kho (transaction `initial`, mỗi SKU chỉ 1 lần). SKU mới tạo luôn có `InventoryItem` bằng 0 và **không** sinh transaction.
- **Trạng thái:** sản phẩm ngừng bán vẫn hiện trong danh sách khi lọc "Ngừng bán" và mở Sửa để chuyển lại thành "Đang bán" được. Đổi trạng thái sản phẩm cha thì lan sang tất cả SKU, trừ SKU được sửa riêng trong cùng request. Ngừng bán 1 SKU riêng thì chỉ SKU đó ngừng.
- **Danh mục:** tạo danh mục từ form sản phẩm hoặc API riêng; tên danh mục unique.
- **Xóa:** xóa sản phẩm cha là chuyển sang ngừng bán (không xóa cứng, không đặt `deletedAt` cho trường hợp này); xóa 1 SKU riêng là soft-delete SKU đó. Xóa cứng chỉ khi Admin và chưa có dữ liệu liên quan.
- **Tìm SKU cho đơn hàng:** API `GET /api/variants` tìm theo mã/tên; giao diện đơn hàng tìm **live theo từng ký tự gõ** (debounce 300ms), nút "Tìm SKU" chỉ là fallback tìm ngay.

### 6.4. Ảnh sản phẩm

- **Mô hình:** xem `ProductImage` ở mục 4.4. Ảnh chung (gallery) và thumbnail riêng từng SKU. Cách tính ảnh hiển thị: thumbnail của SKU = ảnh riêng của SKU đó, nếu không có thì lấy ảnh chung đầu tiên của sản phẩm; thumbnail của sản phẩm = ảnh chung đầu tiên, nếu không có thì lấy ảnh đầu tiên của bất kỳ loại nào.
- **Giới hạn:** chỉ nhận jpg/png/webp, mỗi ảnh tối đa 5 MiB, tối đa 10 ảnh chung/sản phẩm, mỗi SKU tối đa 1 thumbnail riêng.
- **API:** `POST /api/products/:id/images` (ảnh chung, cần `product.update`, đủ 10 ảnh thì 400), `POST /api/products/:id/variants/:variantId/thumbnail` (đặt thumbnail — xóa ảnh cũ của SKU đó cùng file trước), `GET /api/product-images/:id/file` (cần `product.view`, stream file kèm mimeType, `Cache-Control: private, max-age=86400`, 404 nếu dòng không có, sản phẩm đã soft-delete hoặc file thiếu trên đĩa), `DELETE /api/product-images/:id` (cần `product.update`, xóa cả dòng lẫn file). Tạo DB lỗi thì file vừa ghi phải được xóa (không để file mồ côi). Audit: `product_image.uploaded`, `product_thumbnail.set`, `product_image.deleted` (entityType `"product"`). Serializer **không bao giờ** trả `fileName` ra ngoài; frontend tải ảnh bằng fetch kèm token rồi hiển thị bằng blob URL (thẻ `<img>` không gửi được header Authorization).
- **Quy trình giao diện (đã chốt, không làm khác):** ảnh được chọn **ngay trong form tạo/sửa sản phẩm**, lưu cùng sản phẩm khi bấm "Lưu sản phẩm", và **hủy bỏ hoàn toàn khi bấm "Hủy"** (không byte nào rời khỏi trình duyệt trước khi Lưu). Cụ thể: ảnh chung chờ (xem trước local, tối đa 10 ảnh chung đang hiển thị + đang chờ), thumbnail chờ cho từng dòng SKU (cả SKU mặc định, SKU nhập tay và SKU sinh từ tổ hợp), xóa ảnh cũ chờ (có nút "Hoàn tác" từng ảnh). Khi Lưu: lưu sản phẩm trước (POST/PATCH trả về sản phẩm đầy đủ kèm id/SKU/tên biến thể), rồi tải ảnh chung chờ lên, rồi gắn thumbnail chờ vào đúng SKU đã lưu (đối chiếu theo thứ tự: id → SKU → tên biến thể; không đối chiếu được thì báo lỗi, **không đoán bừa**), rồi xóa các ảnh đã đánh dấu xóa; lỗi của từng file phải báo rõ tên file **và lý do**. Sau khi Lưu có thao tác ảnh thì mở trang chi tiết để người dùng thấy ảnh; không có thao tác ảnh thì về danh sách như cũ.
- **Trang chi tiết là trang thông tin thuần túy (đã chốt 2026-11-03):** bấm tên sản phẩm ở danh sách thì ra trang chi tiết chỉ để **xem** (thông tin, gallery, thumbnail SKU) — **không** có nút tải lên/xóa/đổi ảnh ở đây. Muốn quản lý ảnh thì bấm "Sửa sản phẩm" để vào form. (Trước đây trang chi tiết có nút tải ảnh trực tiếp; đã bỏ để vai trò các trang được sạch.)
- **Phóng to khi rê chuột:** rê chuột vào bất kỳ ảnh sản phẩm/thumbnail nào (danh sách, chi tiết, form, cả ảnh đang chờ) thì hiện khung **500×500** bên cạnh ảnh, ảnh bên trong giữ nguyên tỷ lệ (`object-contain`, không méo). Khung dùng `position: fixed` với tọa độ tính từ vị trí ảnh (ưu tiên bên phải, lật sang trái khi không đủ chỗ, kẹp trong viewport, tự ẩn khi cuộn trang), trễ hiện 150ms chống nháy, ẩn ở màn hình nhỏ (cảm ứng không có hover). Khung là thẻ `<img>` riêng ở kích thước 500px nên ảnh nét đúng độ phân giải gốc.

### 6.5. Kho

- **Trang Kho:** danh sách tồn theo SKU (mã, tên biến thể, tồn vật lý, trạng thái), xem chi tiết tồn của 1 SKU và toàn bộ lịch sử transaction của SKU đó. Lưu ý: trang Kho **không** hiển thị số lượng đang giữ (reserved) hay tồn khả dụng — việc giữ kho của đơn nháp chỉ kiểm chứng bằng hành vi.
- **Thao tác:** tồn ban đầu (`initial`, mỗi SKU chỉ 1 lần), nhập kho (`import`), xuất kho thủ công (`export`), điều chỉnh (`adjust`: tăng/giảm/đặt lại — `set` tính `changed` và từ chối khi bằng 0). Tất cả đều qua inventory service, trong một DB transaction, ghi transaction đầy đủ before/changed/after, và chặn hoàn toàn khi kết quả âm (kể cả nhập hàng loạt: 1 dòng gây âm thì không lưu dòng nào, báo rõ SKU gây lỗi).
- **Số nguyên:** số lượng kho là số nguyên, không nhận số thập phân. Form nhập hàng loạt chỉ có **một** loại thao tác cho tất cả các dòng.
- **Lý do bắt buộc** với nhập/xuất/điều chỉnh thủ công.
- **SKU ngừng bán:** chặn `initial`/`import`/`export` và chặn trừ kho cho đơn, nhưng **cho phép** điều chỉnh (kèm lý do và cờ cảnh báo) và **cho phép** hoàn kho nếu SKU bị ngừng sau khi đã bán.
- **Quyền mặc định:** Manager chỉ xem kho (không nhập/xuất/điều chỉnh); Kho làm được mọi thao tác kho.

### 6.6. Đơn bán

- **Trạng thái MVP chỉ 4:** `draft` → `confirmed` → `completed`, và `cancelled` từ draft hoặc confirmed. Đơn `completed` không hủy được. Không có packing/shipping/returned.
- **Giữ kho của đơn nháp:** đơn nháp **giữ** tồn qua `reservedQuantity` (tồn khả dụng = `quantity - reservedQuantity`); việc giữ kho **không** sinh transaction kho. Xác nhận đơn: kiểm tra lại tồn vật lý rồi chuyển giữ kho thành trừ kho vật lý **đúng 1 lần** (transaction `order_confirmed`, cờ `inventoryDeducted`). Hủy đơn nháp: giải phóng giữ kho. Hủy đơn đã xác nhận: hoàn tồn vật lý **chỉ phần chưa trả** (transaction `order_cancelled`, cờ `inventoryRestored`). Sửa đơn nháp: giải phóng giữ cũ và giữ lại mới trong cùng một transaction; không đổi được khách của đơn.
- **Tạo đơn:** chọn khách (tìm theo tên hoặc bất kỳ số điện thoại nào), thêm dòng **chỉ bằng cách chọn gợi ý SKU** (không có dòng trống, không có nút "+ Thêm dòng"); mỗi dòng có SKU, số lượng, đơn giá, giảm giá. Lỗi hiển thị cho người dùng phải ghi **mã SKU + tên sản phẩm**, không bao giờ ghi id nội bộ. Mã đơn `DH-YYYYMMDD-XXXXXX`.
- **Trả hàng (trong sprint Đơn, không dời lại):** trả một phần hoặc toàn phần; chỉ hoàn số lượng đã trả (transaction `return`); tổng đơn tính lại từ số lượng còn lại, giảm giá dòng giữ nguyên cả dòng (không chia tỷ lệ); đặt `fullyReturned` khi mọi dòng trả hết nhưng **giữ nguyên trạng thái đơn**. Trả hàng được phép cả khi SKU hoặc sản phẩm đã ngừng bán sau khi bán. Hủy đơn sau khi đã trả một phần thì chỉ hoàn phần chưa trả.
- **Hoàn thành đơn:** chuyển sang `completed` (cần `order.complete`).
- **Xóa cứng:** chỉ Admin, chỉ đơn nháp chưa từng trừ kho, chưa có payment và transaction.
- **Quyền mặc định:** Sales tạo/sửa nháp/xác nhận đơn của mình nhưng **không** hủy/hoàn thành/trả đơn của mình; Manager làm được cả bốn thao tác trên đơn toàn hệ thống.

### 6.7. Thanh toán và công nợ (bán hàng)

- **Ghi nhận thanh toán:** chỉ cho đơn `confirmed`/`completed`; body chỉ nhận `{amount, paymentMethod, note?}`; `paymentMethod` thuộc `cash`, `bank_transfer`, `cod`, `e_wallet`; `amount > 0` và `amount <= debt_total` còn lại; nếu `debt_total <= 0` thì chặn tạo mới. Trong một transaction, khóa dòng đơn bằng `SELECT ... FOR UPDATE` rồi tính lại tổng.
- **Hủy thanh toán:** bắt buộc có lý do, lưu `cancelledReason`/`cancelledById`/`cancelledAt`, giữ lại bản ghi, hủy 2 lần → 409, không động vào kho hay trạng thái đơn. **Không có route xóa cứng payment.**
- **Công nợ:** trang Công nợ liệt kê mã đơn/khách/đã trả/còn nợ, tìm theo mã đơn hoặc tên khách; mặc định **loại** đơn nháp và đơn đã hủy khỏi danh sách công nợ để khớp với công nợ theo khách. API công nợ của 1 khách: `GET /api/customers/:id/debt` (cùng quy tắc loại trừ).
- **Quyền mặc định:** Manager tạo được payment nhưng không hủy; Kế toán và Admin tạo và hủy được; Sales tạo payment cho đơn của mình.
- **Giao diện:** form thanh toán nằm trong trang chi tiết đơn; thông báo lỗi tiền tệ hiển thị dạng vi-VN (dấu chấm phân tách hàng nghìn).

### 6.8. Chăm sóc, nhắc việc và Remarketing

- **Hoạt động chăm sóc:** tạo và xem hoạt động cho khách (loại thuộc danh sách cố định trong đặc tả 06, ngày thực hiện, kết quả). Hoạt động bất biến, không sửa/xóa.
- **Nhắc việc:** tạo (gắn khách hoặc không, gắn đơn hoặc không), sửa, hoàn thành (kèm ghi chú hoàn thành), hủy (kèm lý do) — chỉ nhắc việc `pending` mới được sửa/hoàn thành/hủy; hoàn thành hoặc hủy 2 lần → 409; không có xóa cứng. Trạng thái quá hạn/hôm nay/sắp tới tính **lúc đọc** (không lưu sẵn). Chỉ user có `reminder.view_all` mới được gán nhắc việc cho người khác.
- **Remarketing (segments):** tính **trực tiếp lúc đọc, không lưu trữ**, và **không gửi bất kỳ tin nhắn nào** (không Zalo/SMS/Email trong MVP — phân đoạn chỉ là danh sách để nhân viên tự liên hệ). Các phân đoạn:
  - `birthday_customers`: khách đang hoạt động có sinh nhật trong N ngày tới (mặc định 7 ngày, theo ngày/tháng sinh nhật; 29/2 về 28/2 ở năm không nhuận).
  - `birthday_children`: con của khách đang hoạt động có sinh nhật trong N ngày tới — **chỉ trả tên con, khách liên quan, ngày sinh nhật sắp tới và tuổi sắp tới; không trả ngày sinh gốc, ghi chú hay giới tính của con**. API trả kèm `customerId` của cha mẹ; giao diện cho bấm vào dòng sinh nhật con để mở hồ sơ khách (cha mẹ) trong **tab mới** qua deep link `?customer=<id>` (xem mục 8).
  - `inactive_customers`: khách đã từng mua (có đơn confirmed/completed) nhưng không có đơn nào trong X ngày qua (mặc định 90 ngày); khách chưa từng mua thuộc nhóm riêng.
  - `new_customers`: khách tạo trong 30 ngày qua (tham số `days` đổi được).
  - `no_purchase_customers`: khách đang hoạt động chưa từng có đơn confirmed/completed.
  - `debt_customers`: khách có tổng công nợ > 0 (tính như sprint Thanh toán: chỉ đơn confirmed/completed, khớp trang Công nợ).
  - `high_value_customers`: khách có tổng `grand_total` đơn confirmed/completed (sau trả hàng, **không** phải `paid_total`) >= ngưỡng (mặc định 5.000.000, tham số `threshold` đổi được).
  - `by_tag`: khách đang hoạt động được gán `tagId` chỉ định (cần tham số `tagId`).
- **Hạn chế đã biết:** ranh giới ngày dùng ngày UTC của server (ngày lật lúc 07:00 giờ Việt Nam).

### 6.9. Dashboard và báo cáo

- **Chỉ đọc, không ghi audit khi xem.** Các route: tổng quan (`/dashboard/summary`), doanh thu theo ngày, doanh thu theo phương thức thanh toán, top SKU, top khách, công nợ, công nợ NCC, tồn kho.
- **Tham số kỳ:** `preset` (`today`/`7d`/`30d`/`all`, mặc định `30d`) hoặc `from` + `to` cùng lúc (tối đa 365 ngày). `revenue-by-day` từ chối `preset=all`.
- **Quy tắc tính:**
  - Chỉ đơn `confirmed`/`completed` mới tính vào doanh thu/công nợ; payment đã hủy bị loại.
  - `paid_total` theo kỳ = tổng `paidTotal` **snapshot** của các đơn đó (ghi theo ngày tạo đơn, không theo ngày thanh toán).
  - Công nợ = doanh thu − đã trả; phần âm (khách ghi có) báo cáo riêng, không trừ lấn vào số nợ dương.
  - Số lượng top SKU = `quantity - returnedQuantity`.
  - Lãi gộp là **ước tính** từ **giá nhập hiện tại** của từng SKU (SKU không có giá nhập thì chi phí = 0); giảm giá dòng không chia tỷ lệ khi trả hàng một phần.
- **Lọc theo quyền ở backend, lược trường chứ không trả 0:** lãi gộp chỉ có khi có `report.view_profit`; giá trị tồn kho chỉ có khi có `report.view_inventory_value` hoặc `inventory.view`. Nav "Dashboard"/"Báo cáo" hiện khi có `report.view_all`/`view_team`/`view_own` hoặc `inventory.view` — vì vậy Kế toán (chỉ có `view_debt`/`view_revenue`) **không** có 2 tab này theo thiết kế (2 quyền đó chỉ chi phối cột tiền trong export); Kho thấy 2 tab qua `inventory.view` nhưng các endpoint báo cáo sẽ từ chối bằng banner (trừ mục công nợ NCC — xem 6.15).
- **Giao diện:** 9 chỉ số tổng quan hiển thị dạng thẻ thống kê; báo cáo có chuyển kỳ 7 ngày/hôm nay/30 ngày dùng chung logic kỳ với mọi mục.

### 6.10. Import và Export (CSV)

- **Định dạng MVP là CSV** (file `.xlsx` thật là backlog). Giới hạn: tối đa 1000 dòng, tối đa 5MB, chỉ nhận `.csv`. Parser CSV tự viết; upload parse in-memory (không ghi file CSV xuống đĩa).
- **Luồng bắt buộc 2 bước — xem trước rồi mới xác nhận:**
  1. `POST /api/import/:entity/preview` — chỉ kiểm tra, **không ghi gì, không ghi audit**, trả về từng dòng kèm lỗi và một `preview_id` dùng 1 lần, hiệu lực 15 phút, thuộc về user đã xem trước, lưu trong bộ nhớ của tiến trình backend.
  2. `POST /api/import/:entity/confirm` — kiểm tra lại với database hiện tại, chỉ import các dòng hợp lệ, báo các dòng bị bỏ qua, ghi **một** audit log cho lần import.
- **Import khách hàng:** kiểm tra trùng số điện thoại như tạo tay (mục 3.4), báo rõ số nào trùng với khách nào; tag chưa có chỉ được tạo khi user có `customer.tag_manage`.
- **Import sản phẩm/SKU:** kiểm tra trùng SKU trong file và với database như tạo tay; các dòng cùng `product_name` + danh mục được gom thành 1 sản phẩm cha; SKU trống thì tự sinh; SKU mới tạo có `InventoryItem` bằng 0 và không sinh transaction.
- **Import nhà cung cấp:** xem mục 6.13. **Không** có import đơn nhập hàng bằng CSV trong MVP.
- **Export:** tên file `export-<đối tượng>-YYYY-MM-DD.csv` (template giữ tên `template-...`); file có BOM UTF-8; template kèm 2 dòng ví dụ. Chống CSV injection bằng cách thêm `'` vào đầu ô nguy hiểm. **Cột bị lược hoàn toàn theo quyền** (không trả cột rỗng): ví dụ export đơn nhập **không bao giờ** có cột đơn giá nhập; export khách/sản phẩm lược cột nhạy cảm theo quyền; phạm vi dữ liệu (all/own) áp dụng cho export. Mọi lần export đều ghi audit log.
- **Đối tượng:** import: `customers`, `products`, `suppliers`; export: `customers`, `suppliers`, `products`, `orders`, `purchase-orders`, `inventory`.

### 6.11. Nhật ký Audit

- **Chỉ đọc:** 3 route GET — danh sách (`/api/audit-logs`), chi tiết (`/api/audit-logs/:id`), dòng thời gian của 1 thực thể (`/api/audit-logs/entity/:entityType/:entityId`). **Không tồn tại** route POST/PATCH/PUT/DELETE cho audit (request tới các route đó rơi vào catch-all của app → 404).
- **Quyền:** `audit.view_all` (Admin, Manager) thấy tất cả; `audit.view_own` (Sales, Warehouse, Accountant) chỉ thấy log do chính mình thực hiện; lọc theo `actorId` của người khác → 403 kèm banner.
- **Ghi log:** mọi thao tác nhạy cảm và mọi thay đổi dữ liệu quan trọng đều ghi audit qua `writeAudit()` với `oldValue`/`newValue`. Các action đã có (kèm nhãn tiếng Việt ở `labels.ts`): đổi vai trò (`role_changed`), đổi quyền riêng (`user_permissions_changed`), tải ảnh (`product_image.uploaded`), đặt thumbnail SKU (`product_thumbnail.set`), xóa ảnh (`product_image.deleted`), đổi quyền riêng, tạo/sửa/xóa các thực thể chính, đăng nhập, gửi lại OTP (không ghi mã), cập nhật tag, v.v.
- **Redact:** `writeAudit` đệ quy ẩn các khóa chứa `password`/`token`/`secret`/`codehash`/`otpcode`/`authorization` và khóa đúng `otp`/`jwt` (cố tình **không** ẩn `otp_mode` hay khóa `code` chung chung). Lớp đọc (`sanitizeAuditValueForViewer`) ẩn các khóa chi phí (`importprice`, `import_price`, `importcost`, `unitcost`, `unit_cost`) thành `***` với người xem không có `product.view_cost`.
- **Tìm kiếm:** ô tìm tự do không phân biệt dấu và hiểu nhãn tiếng Việt của action (không chỉ mã action thô); ô "Mã thực thể" tìm đúng mã, không dịch. Nhãn hiển thị của audit là tiếng Việt, nhưng nội dung JSON chi tiết của audit và mã action gốc **không dịch**.

### 6.12. Nhà cung cấp (danh mục)

- **Trường:** tên, mã số thuế (`taxCode` — tùy chọn, unique khi có giá trị), email, địa chỉ, ghi chú, trạng thái, người tạo.
- **Số điện thoại:** cùng mô hình với khách (không giới hạn số lượng, 1 số chính, chuẩn hóa giống nhau) nhưng **kiểm tra trùng chỉ trong các nhà cung cấp với nhau** (xem mục 3.4).
- **Trạng thái:** đang hợp tác / ngừng hợp tác; NCC ngừng hợp tác vẫn hiện khi lọc và mở Sửa để hợp tác lại được (giống sản phẩm ngừng bán).
- **Xóa cứng:** chỉ Admin, chỉ NCC chưa có đơn nhập nào; NCC đã có đơn nhập → 409. Xóa số điện thoại khỏi trang chi tiết mà không cần vào chế độ Sửa là hành vi **đã chốt giữ nguyên**, không phải lỗi.
- **Quyền mặc định:** Admin đủ; Manager xem + tạo + sửa; Kế toán chỉ xem; Sales chỉ xem; Kho không có quyền NCC nào.
- **Sản phẩm của nhà cung cấp (trang chi tiết):** vì schema không có liên kết trực tiếp sản phẩm → NCC, danh sách này suy ra từ lịch sử nhập hàng — các SKU phân biệt từng xuất hiện trên đơn nhập **đã nhận hàng** (`confirmed`/`completed`) của NCC đó; đơn nháp và đơn đã hủy không tính. Hiện cả sản phẩm/SKU đang bán và đã ngừng bán (hàng đã xóa mềm thì loại). Bảng gồm tên sản phẩm, SKU, tên biến thể, trạng thái, **giá bán** và **giá nhập** — giá bán là giá bán hiện tại của SKU, chỉ hiện với người có `product.view`; giá nhập là giá nhập hiện tại của SKU (không phải đơn giá từng lần nhập — đơn giá từng lần nhập nằm ở chi tiết đơn nhập), chỉ hiện với người có `product.view_cost`; cả hai cột đều **bỏ hẳn** (không hiện 0 hay dấu gạch) với người không có quyền, đúng mẫu của trang Sản phẩm và cột đơn giá nhập ở chi tiết đơn nhập. Không cần mã quyền mới.

### 6.13. Đơn nhập hàng (mua hàng từ NCC)

- **Trạng thái (mirror đơn bán):** `draft` → `confirmed` → `completed`, và `cancelled` từ draft hoặc confirmed. Mã đơn `NH-YYYYMMDD-XXXXXX`.
- **Nháp không động kho.** Xác nhận = **nhận đủ toàn bộ** đúng 1 lần (transaction `purchase_received` qua inventory service; cờ `received`/`receivedAt`). **Không có nhận hàng một phần trong MVP.**
- **Sửa nháp:** dùng chung quyền `purchase.create` (không có `purchase.update` riêng); không đổi được nhà cung cấp của đơn nháp. Tạo đơn và xác nhận đều chặn khi SKU, sản phẩm cha hoặc nhà cung cấp đang ngừng hoạt động.
- **Hoàn thành, hủy, trả hàng** mirror đơn bán: hủy đơn đã nhận thì hoàn kho **chỉ phần chưa trả** (transaction `purchase_cancelled`, cờ `restored`); trả hàng một phần cho NCC (transaction `purchase_return`, `returnedQuantity` từng dòng, tổng đơn tính lại từ số lượng còn lại; **thành tiền từng dòng giữ nguyên số gốc**, chỉ tổng đơn tính lại); trả hàng được phép cả khi SKU/NCC đã ngừng sau khi nhận; `fullyReturned` khi mọi dòng trả hết nhưng trạng thái đơn giữ nguyên. Hủy đơn nháp chỉ đổi trạng thái, không đặt cờ `restored`.
- **Giá nhập trên đơn nhập là snapshot riêng** (`unitCost` từng dòng, số nguyên VND): form tạo đơn nhập gợi ý đơn giá từ `importPrice` của SKU khi user có `product.view_cost`; **nhận hàng không tự cập nhật `importPrice` của SKU**. Đơn nhập v1 **không** có chiết khấu, thuế, phí.
- **Hiển thị giá nhập:** cột "Đơn giá nhập" ở chi tiết đơn nhập chỉ hiện với người có `product.view_cost` — giống cách xử lý giá nhập sản phẩm. Backend lược hẳn khóa `unitCost` khỏi payload với người xem thuần túy (Kho, Kế toán); người có `purchase.create` (Manager) vẫn nhận đủ để sửa nháp qua lại. Export đơn nhập **không bao giờ** có cột đơn giá nhập. **Ngoại lệ có chủ đích:** ô nhập đơn giá trong form không bị chặn (Manager cần nhập giá).
- **Quyền mặc định:** Manager xem + tạo + xác nhận; Kho xem + xác nhận (đơn nháp hiện nút "Nhận hàng", đơn đã nhận chỉ hiện "Đóng"); Kế toán chỉ xem; Sales không có quyền đơn nhập nào. Chỉ Admin hủy/hoàn thành/trả đơn nhập theo mặc định (xem bảng quyền ở mục 5.3 — Manager có `purchase.confirm` nhưng không có `purchase.cancel`/`complete`/`return`).

### 6.14. Thanh toán và công nợ nhà cung cấp

- **Mirror thanh toán bán hàng** nhưng tiền là số nguyên VND: tạo thanh toán cho đơn nhập `confirmed`/`completed` (chỉ nhận `{amount, paymentMethod, note?}`), `amount > 0` và không vượt công nợ còn lại, khóa dòng đơn nhập khi tính lại, hủy cần lý do và giữ bản ghi, không có route xóa cứng.
- **Công thức suy ra giống đơn bán:** `paidTotal` = tổng payment NCC đang `active`; `debtTotal` = `grandTotal - paidTotal`; `paymentStatus` suy ra `unpaid`/`partial`/`paid`; trả thừa do trả hàng thì công nợ âm = ghi có cho NCC, trạng thái vẫn `paid`.
- **Trang Công nợ NCC:** chỉ liệt kê đơn nhập `confirmed`/`completed` có `debtTotal > 0`, kèm tổng công nợ theo từng NCC trên tập đã lọc.
- **Báo cáo công nợ NCC** (`GET /api/reports/supplier-debt`) nằm trong module Báo cáo; mục này hiển thị cả với Kho theo thiết kế (vì Kho có `purchase.view_all`), dù trang Báo cáo chính của Kho bị chặn bằng banner — đây là hành vi đã chốt, không phải lỗi.

### 6.15. Trang quản trị

- Xem mục 5.5. Ngoài ra: trang quản trị hiển thị ma trận vai trò (read-only) để đối chiếu; mọi thao tác quản trị user đều ghi audit; seed lại không bao giờ xóa override của user.

### 6.16. Trang Tổng quan (home)

- Sau lần dọn dẹp cuối MVP, trang Tổng quan **chỉ còn** cài đặt OTP của hệ thống (chỉ admin) và đổi mật khẩu của chính mình. Không còn khối "Các module sẽ làm" kiểu scaffold (đã xóa vì mọi module đều đã xây xong và nằm ở sidebar).

---

## 7. Luồng nghiệp vụ đầu-cuối (kịch bản mẫu để kiểm chứng)

### 7.1. Bán hàng

1. Tạo khách (nhiều số điện thoại, 1 số chính, kiểm tra trùng) → tạo sản phẩm/SKU (giá bán, giá nhập nếu có quyền) → nhập tồn ban đầu ở Kho.
2. Tạo đơn nháp: chọn khách, chọn SKU (tìm live theo ký tự), nhập số lượng/giá/giảm giá → đơn nháp **giữ** tồn (tồn khả dụng giảm, tồn vật lý không đổi, không sinh transaction).
3. Xác nhận đơn → kiểm tra tồn vật lý → trừ kho 1 lần (`order_confirmed`) → đơn `confirmed`.
4. Ghi nhận thanh toán nhiều lần (mỗi lần `amount <= debt_total` còn lại) → `paid_total`/`debt_total`/`payment_status` tính lại sau mỗi lần → đủ tiền thì `paid`.
5. Hoàn thành đơn → `completed`. Hoặc: trả hàng một phần → hoàn kho phần trả, tổng đơn tính lại, `fullyReturned` nếu trả hết. Hoặc: hủy đơn đã xác nhận → hoàn kho phần chưa trả.
6. Kiểm tra khớp số: công nợ trang Công nợ = công nợ trong hồ sơ khách = `debt_total` của đơn; Dashboard và Báo cáo cho cùng con số theo cùng công thức.

### 7.2. Nhập hàng

1. Tạo nhà cung cấp (số điện thoại, mã số thuế nếu có) → tạo đơn nhập nháp (chọn NCC, chọn SKU, nhập số lượng và đơn giá nhập — đơn giá gợi ý từ giá nhập hiện tại của SKU nếu có quyền xem giá nhập).
2. Xác nhận đơn nhập → **nhận đủ toàn bộ** 1 lần, tồn vật lý tăng (`purchase_received`).
3. Trả tiền NCC nhiều lần (giống thanh toán bán hàng, tiền nguyên VND) → công nợ NCC giảm dần.
4. Trả hàng cho NCC (một phần hoặc toàn phần) → hoàn kho phần trả (`purchase_return`), tổng đơn nhập tính lại, công nợ tính lại (trả thừa thì ghi có).
5. Hoàn thành hoặc hủy đơn nhập theo quyền.

### 7.3. Chăm sóc khách

1. Ghi hoạt động chăm sóc cho khách (loại, ngày thực hiện, kết quả) → tạo nhắc việc (hạn, người phụ trách) → hoàn thành hoặc hủy nhắc việc khi xong.
2. Mở Remarketing (sinh nhật khách/con trong 7 ngày, lâu không mua, khách mới, chưa từng mua, còn nợ, giá trị cao, theo tag) → nhân viên tự liên hệ thủ công (không có gửi tin tự động trong MVP).

---

## 8. Quy ước giao diện (frontend)

- **Bố cục:** sidebar trái kiểu dashboard (cố định `w-64` trên màn hình md trở lên, thanh nav cuộn ngang trên mobile); logo + trạng thái backend; nav theo quyền với highlight mục đang chọn; thẻ user + nút đăng xuất ở cuối sidebar (desktop) / thanh trên (mobile). Thứ tự nav: Tổng quan, Khách hàng, Nhà cung cấp, Đơn nhập hàng, Sản phẩm / SKU, Kho, Đơn hàng, Công nợ, Công nợ NCC, Nhắc việc, Remarketing, Dashboard, Báo cáo, Import / Export, Nhật ký Audit, Quản trị.
- **Design system** (`frontend/src/index.css`, Tailwind `@layer components`): `.btn` (+ `.btn-primary/.btn-secondary/.btn-danger/.btn-success/.btn-warning`, `.btn-sm` nhỏ hơn), `.input` (ô trong form, full-width) và `.field` (ô trong thanh lọc inline, không full-width — **không dùng `.input` trực tiếp trong hàng flex** vì nó chiếm hết chiều rộng và bóp các ô còn lại), `.card/.card-sm/.stat-card`, `.table` (header xám, dòng có divider và hover), `.badge` (+ `.badge-green/.badge-red/.badge-yellow/.badge-gray/.badge-blue`), `.nav-item/.nav-item-active`, `.alert-error/.alert-success`.
- **Badge trạng thái:** đơn bán/đơn nhập (nháp xám, đã xác nhận xanh dương, hoàn thành xanh lá, đã hủy đỏ), trạng thái thanh toán (chưa trả đỏ, trả một phần vàng, đã trả xanh lá), sản phẩm (đang bán xanh lá, ngừng bán xám), NCC (đang hợp tác xanh lá, ngừng hợp tác xám), user (hoạt động xanh lá, bị khóa đỏ, khác xám).
- **Nhãn tiếng Việt, nhưng KHÔNG dịch:** mã gửi backend, mã đơn, SKU, ID, tên file CSV, nội dung JSON audit, mã action audit gốc, tên vai trò trong header, tên tab "Dashboard" trong nav (theo quyết định đã chốt — khi code lại, giữ nguyên các chuỗi này).
- **Ngày tháng:** hiển thị dạng `dd/mm/yyyy` cho mọi ngày dạng text. Ô nhập ngày dùng **native `<input type="date">`** (kiểu trang Nhật ký Audit), không dùng date picker tự làm, không tự thêm dấu gạch chéo khi gõ. Chấp nhận hệ quả: thứ tự ngày/tháng trong ô nhập theo vùng (Regional format) của Windows trên máy người dùng (máy đang để US thì hiện mm/dd/yyyy) cho tới khi đổi Regional format sang Vietnamese.
- **Tiền:** hiển thị theo `vi-VN` (dấu chấm phân tách hàng nghìn) kèm `đ`; ô nhập tiền là text + `inputMode numeric`, tự hiển thị nhóm nghìn và parse được dấu `.`, `,`, khoảng trắng làm phân tách nghìn.
- **Thông báo lỗi:** lỗi cho người dùng phải ghi mã SKU + tên sản phẩm, không ghi id nội bộ. Thông báo validation mặc định của trình duyệt (required/min/max) phải hiển thị tiếng Việt bằng thông báo tùy chỉnh (`frontend/src/validity.ts` — vì nội dung bubble của trình duyệt theo ngôn ngữ giao diện trình duyệt, không theo nhãn của app).
- **Tìm kiếm SKU trong form đơn:** gợi ý live theo từng ký tự gõ (debounce 300ms); không có dòng trống, không có nút "+ Thêm dòng"; dòng thật có nút "Xóa dòng".
- **Giới tính:** dùng select, không nhập tự do.
- **Ảnh:** xem mục 6.4 (staged upload trong form, trang chi tiết thuần túy, phóng to 500×500 khi rê chuột).
- **Trang Remarketing:** các thẻ filter (tiêu đề phân đoạn) và khối kết quả tách biệt rõ ràng — khối kết quả nằm trong khung riêng có viền đậm và nền xanh nhạt, kèm tiêu đề "Kết quả: \<tên phân đoạn\> (số lượng)"; thẻ filter đang được chọn cũng tô nền xanh nhạt để nhìn là biết kết quả thuộc về filter nào.
- **Deep link khách hàng:** URL có tham số `?customer=<id>` thì mở thẳng hồ sơ khách đó (trang Khách hàng tự mở chi tiết khi nhận tham số lúc mount; điều hướng trong tab không bị tham số này ảnh hưởng). Trang Remarketing dùng cơ chế này: bấm dòng sinh nhật con thì mở hồ sơ cha mẹ trong tab mới, trang hiện tại giữ nguyên.
- **Bài học CSS đã trả giá:** popup phóng to lớn không dùng `position: absolute` trong wrapper chỉ to bằng ảnh nhỏ (xem mục 6.4); nút nhỏ (`btn-sm`, ~26px) đặt cạnh ô nhập cao (~38px) sẽ lệch chiều cao — dùng đúng cỡ nút theo chiều cao ô bên cạnh; nút "Xóa" trong hàng nhóm thuộc tính và nút "Áp dụng cho tất cả" ở hàng giá hàng loạt dùng nút cỡ thường vì đứng cạnh ô `.field` cao.

---

## 9. API tổng quan (tham chiếu — mọi route đều dưới `/api`)

- **Xác thực:** header `Authorization: Bearer <JWT>` (trừ `POST /api/auth/login`, `POST /api/auth/verify-otp`, `POST /api/auth/resend-otp` và `GET /api/health`). `GET /api/health` trả `{"status":"ok"}` mà không cần database.
- **Định dạng chung:** thành công `{"status": ...}` (hoặc `{"status":"ok", ...}`); lỗi `{"status":"error","message":"<thông báo tiếng Việt>"}`. Mã lỗi: 401 chưa đăng nhập, 403 thiếu quyền/sai phạm vi, 404 không tìm thấy, 409 xung đột trạng thái (trừ/hoàn 2 lần, hủy 2 lần, xóa cứng khi đã có giao dịch), 400 dữ liệu không hợp lệ/trùng lặp có chỉ rõ đối tượng, 413 file vượt giới hạn ("File gửi lên quá lớn (giới hạn 5MB)."), 500 lỗi chung (không lộ stack trace hay secret).
- **Nhân đôi kiểm tra:** mọi route ghi đều kiểm tra quyền ở backend; frontend chỉ ẩn nút.

| Nhóm | Route (phương thức + đường dẫn) |
|---|---|
| Auth (dưới `/api/auth`) | `POST /login`, `POST /verify-otp`, `POST /resend-otp`, `GET /me`, `POST /logout`, `POST /change-password` |
| Quản trị | `GET /users`, `POST /users`, `PATCH /users/:id`, `POST /users/:id/lock`, `POST /users/:id/unlock`, `POST /users/:id/reset-password`, `GET /users/:id/permissions`, `PUT /users/:id/permissions`, `GET /roles`, `GET /settings`, `PUT /settings/otp-mode` (đều dưới `/api/admin`) |
| Khách hàng | `GET /tags`, `POST /tags`, `PATCH /tags/:id`, `DELETE /tags/:id`, `GET /customers`, `GET /customers/:id`, `POST /customers`, `PATCH /customers/:id`, `DELETE /customers/:id`, `POST /customers/:id/phones`, `POST /customers/:id/phones/:phoneId/make-primary`, `DELETE /customers/:id/phones/:phoneId`, `POST /customers/:id/tags`, `DELETE /customers/:id/tags/:tagId`, `POST /customers/:id/children`, `PATCH /customers/:id/children/:childId`, `DELETE /customers/:id/children/:childId` |
| Sản phẩm/SKU | `GET /categories`, `POST /categories`, `GET /products`, `GET /products/:id`, `POST /products`, `PATCH /products/:id`, `DELETE /products/:id`, `POST /products/:id/variants`, `POST /products/:id/variants/generate`, `PATCH /products/:id/variants/:variantId`, `DELETE /products/:id/variants/:variantId`, `GET /variants` |
| Ảnh | `POST /products/:id/images`, `POST /products/:id/variants/:variantId/thumbnail`, `GET /product-images/:id/file`, `DELETE /product-images/:id` |
| Kho | `GET /inventory`, `GET /inventory/:variantId`, `GET /inventory/:variantId/transactions`, `POST /inventory/initial`, `POST /inventory/import`, `POST /inventory/export`, `POST /inventory/adjust` |
| Đơn bán | `GET /orders`, `GET /orders/:id`, `POST /orders`, `PATCH /orders/:id`, `POST /orders/:id/confirm`, `POST /orders/:id/complete`, `POST /orders/:id/cancel`, `POST /orders/:id/return`, `DELETE /orders/:id` |
| Thanh toán/Công nợ | `GET /orders/:id/payments`, `POST /orders/:id/payments`, `POST /payments/:id/cancel`, `GET /debts`, `GET /customers/:id/debt` |
| Chăm sóc | `GET /customers/:id/activities`, `POST /customers/:id/activities`, `GET /activities`, `GET /reminders`, `POST /reminders`, `PATCH /reminders/:id`, `POST /reminders/:id/complete`, `POST /reminders/:id/cancel`, `GET /segments`, `GET /segments/:key/customers` |
| Dashboard/Báo cáo | `GET /dashboard/summary`, `GET /dashboard/revenue-by-day`, `GET /dashboard/revenue-by-payment-method`, `GET /reports/top-skus`, `GET /reports/top-customers`, `GET /reports/debt`, `GET /reports/supplier-debt`, `GET /reports/inventory` |
| Import/Export | `GET /import/templates/:entity`, `POST /import/:entity/preview`, `POST /import/:entity/confirm`, `GET /export/customers`, `GET /export/suppliers`, `GET /export/products`, `GET /export/orders`, `GET /export/purchase-orders`, `GET /export/inventory` |
| Nhà cung cấp | `GET /suppliers`, `GET /suppliers/:id`, `POST /suppliers`, `PATCH /suppliers/:id`, `DELETE /suppliers/:id`, `POST /suppliers/:id/phones`, `POST /suppliers/:id/phones/:phoneId/make-primary`, `DELETE /suppliers/:id/phones/:phoneId` |
| Đơn nhập | `GET /purchase-orders`, `GET /purchase-orders/:id`, `POST /purchase-orders`, `PATCH /purchase-orders/:id`, `POST /purchase-orders/:id/confirm`, `POST /purchase-orders/:id/complete`, `POST /purchase-orders/:id/cancel`, `POST /purchase-orders/:id/return` |
| Thanh toán NCC | `GET /purchase-orders/:id/payments`, `POST /purchase-orders/:id/payments`, `POST /purchase-orders/:id/payments/:paymentId/cancel`, `GET /supplier-debts` |
| Audit | `GET /audit-logs`, `GET /audit-logs/entity/:entityType/:entityId`, `GET /audit-logs/:id` |

---

## 10. Triển khai và vận hành

### 10.1. Cài đặt lần đầu (máy mới)

```powershell
git clone https://github.com/xuanthoan/crm-ban-hang-aio.git
cd crm-ban-hang-aio
# Tạo .env từ .env.example, điền POSTGRES_PASSWORD và JWT_SECRET (chỉ chữ/số)
docker compose up -d --build
Start-Sleep -Seconds 10
docker compose exec backend npx prisma migrate deploy
docker compose exec backend node dist/seed.js
docker compose exec backend node dist/seedAdmin.js   # cần ADMIN_USERNAME/ADMIN_EMAIL/ADMIN_PASSWORD trong .env
```

Mở `http://localhost:5173`, đăng nhập bằng tài khoản admin vừa seed.

### 10.2. Triển khai bản mới (một lệnh duy nhất, copy 1 lần)

- **Chỉ đổi code frontend/backend, không thêm bảng, không thêm mã quyền:**
  ```powershell
  cd G:\WorkSpace\Tool\crm-ban-hang-aio && git pull && docker compose up -d --build
  ```
- **Có bảng mới (migration mới):** thêm `docker compose exec backend npx prisma migrate deploy` sau khi build xong (chờ ~10 giây cho backend lên).
- **Có mã quyền mới:** thêm `docker compose exec backend node dist/seed.js` rồi **đăng xuất và đăng nhập lại** (xem mục 2.5.4).
- **Lệnh tổng hợp đầy đủ nhất (dùng khi không chắc):**
  ```powershell
  cd G:\WorkSpace\Tool\crm-ban-hang-aio && git pull && docker compose up -d --build && Start-Sleep -Seconds 10 && docker compose exec backend npx prisma migrate deploy && docker compose exec backend node dist/seed.js
  ```
  (Sau đó đăng nhập lại nếu bản đó có mã quyền mới.)

### 10.3. Vận hành

- **Sao lưu database:** `docker compose exec postgres pg_dump -U postgres crm_ban_hang > backup.sql`.
- **Dữ liệu sống trong volume:** `postgres_data` (database) và `uploads_data` (ảnh). `docker compose down` giữ dữ liệu; `down -v` xóa sạch.
- **Kiểm tra nhanh:** `GET /api/health` → `{"status":"ok"}`; container backend khỏe, postgres healthy (healthcheck `pg_isready`).
- **Lỗi hay gặp:** kéo code về mà không thấy nút/tab mới → 99% là chưa seed lại (thiếu mã quyền mới trong DB) hoặc chưa đăng nhập lại — không phải lỗi build. Xem mục 2.5.4.
- **Lỗi mạng khi clone/push (TLS reset / GnuTLS -110):** lỗi thoáng qua, thử clone lại vài lần, mỗi lần cách nhau vài giây.

---

## 11. Trạng thái hoàn thiện và việc còn lại

### 11.1. Đã hoàn thành và đã kiểm chứng bằng database thật

- Toàn bộ MVP: Khách hàng, Sản phẩm/SKU, Kho, Đơn hàng, Thanh toán/Công nợ, Chăm sóc/Nhắc việc/Remarketing, Dashboard/Báo cáo, Import/Export, Audit.
- Module Nhà cung cấp trọn vẹn: danh mục (NCC-1), đơn nhập (NCC-2), thanh toán và công nợ NCC (NCC-3), báo cáo công nợ NCC + import/export NCC (NCC-4).
- Kiểm chứng phân quyền đầy đủ cả 4 vai trò không phải admin (Manager, Sales, Warehouse, Accountant) trên giao diện và bằng API trực tiếp (403), gồm các kiểm tra điểm: Manager chỉ xem kho/sản phẩm, Sales chỉ thấy dữ liệu của mình, Kho nhận hàng nhưng không thấy giá nhập, Kế toán hủy payment có lý do và không có tab Dashboard/Báo cáo.
- Trang quản trị với tùy chỉnh quyền từng người (đã kiểm chứng: chặn quyền xem sản phẩm của Kho làm mất tab Sản phẩm sau khi đăng nhập lại; cho phép quyền xem thanh toán của Kho làm hiện mục thanh toán trong chi tiết đơn).
- Ảnh sản phẩm: gallery + thumbnail SKU, upload chờ trong form, trang chi tiết thuần túy, phóng to 500×500 khi rê chuột, giới hạn 5 MiB và thông báo lỗi rõ lý do.
- Giao diện sidebar dashboard, hệ thống badge và thẻ thống kê, nhãn tiếng Việt, ngày `dd/mm/yyyy`.

### 11.2. Việc nhỏ còn mở (không chặn MVP, chủ dự án quyết sau)

- Vệ sinh dữ liệu test cũ: ngày sinh của một khách test bị lưu sai từ lỗi lịch cũ (không tự sửa).
- Nút "Xem" trên danh sách đơn nhập khi panel chi tiết của chính đơn đó đã mở sẵn: hiện tại bấm không thấy thay đổi gì (vì dữ liệu đã hiển thị sẵn bên dưới); phương án đánh bóng đã đề xuất là tự cuộn tới panel chi tiết — chưa được chốt.
- Cờ lịch sử `restored` của một đơn nhập đã hủy từ thời kiểm thử (không ảnh hưởng tồn kho hay tiền bạc; muốn đối chiếu thì xem cờ "Đã hoàn kho" ở trang chi tiết đơn đó).

### 11.3. Ngoài phạm vi MVP (backlog cho giai đoạn sau — developer mới KHÔNG tự làm thêm)

- Quy trình hoàn tiền thật (hiện tại trả thừa chỉ ghi có, không hoàn tiền).
- File `.xlsx` thật cho import/export (hiện tại là CSV).
- Gửi nhắc việc tự động qua Zalo/SMS/Email (hiện tại phân đoạn chỉ là danh sách để liên hệ thủ công).
- Ngưỡng tồn thấp theo từng SKU; cảnh báo tồn thấp theo ngưỡng đó (hiện tại báo cáo tồn kho chưa có ngưỡng theo SKU).
- Thực thể team và phạm vi dữ liệu theo team (hiện tại chỉ có all/own).
- Thu hồi JWT phía server khi đăng xuất (hiện tại đăng xuất chỉ xóa token ở client).
- Thu hẹp ô đăng nhập về chỉ username (hiện tại chấp nhận cả email — xem mục 6.1).
- Các trường backlog của khách và sản phẩm: mã khách hàng, Zalo/Facebook, tỉnh/huyện/xã, mức tiềm năng, ghi chú nội bộ riêng; thương hiệu, mã sản phẩm, đơn vị, ghi chú nội bộ, trạng thái nháp của sản phẩm; trường `source` của đơn hàng.
- Sửa ranh giới ngày UTC (ngày lật lúc 07:00 giờ Việt Nam) nếu chủ dự án yêu cầu ngày theo giờ Việt Nam.
- Import preview hiện lưu trong bộ nhớ tiến trình backend (mất khi restart backend) — nếu cần bền vững thì chuyển sang database.

---

## 12. Checklist nghiệm thu cho developer mới

Trước khi bàn giao một bản build, chạy hết checklist này trên database thật (không chỉ nhìn giao diện):

**Quy tắc chốt cứng (mục 3.7):** 10 mục blocker — đặc biệt là trừ kho 2 lần, hoàn kho 2 lần, tồn âm, `paid_total` lệch, trùng số/SKU, xóa cứng có giao dịch, API lọt quyền.

**Theo module:**

- [ ] Auth: đăng nhập sai bị chặn; user bị khóa không đăng nhập được; OTP email hết hạn 5 phút, sai 5 lần thì khóa, gửi lại cách 60 giây; đổi `otp_mode` chỉ admin làm được.
- [ ] Khách: tạo khách trùng bất kỳ số nào (kể cả số phụ) bị chặn và báo rõ khách cũ; 1 khách có nhiều số, đúng 1 số chính; tìm khách bằng số phụ, bằng số dạng `+84` và dạng có khoảng trắng đều ra.
- [ ] Sản phẩm: tạo sản phẩm 3 nhóm thuộc tính sinh đúng số tổ hợp (nhân số giá trị các nhóm), tối đa 200 SKU; SKU nhập trùng báo lỗi, SKU tự sinh trùng thêm hậu tố; sản phẩm ngừng bán vẫn lọc được và mở Sửa để bán lại được; SKU đã có đơn thì không đổi được mã.
- [ ] Kho: nhập tồn ban đầu 10 thì hiển thị đúng 10; mọi thay đổi đều có transaction đủ before/changed/after; nhập hàng loạt có 1 dòng gây âm thì không lưu dòng nào và báo rõ SKU; SKU ngừng bán vẫn hoàn kho được nếu đã bán trước đó.
- [ ] Đơn bán: đơn nháp giữ kho (tồn khả dụng giảm, tồn vật lý không đổi); xác nhận trừ kho 1 lần; xác nhận lần 2 không trừ thêm; hủy đơn nháp giải phóng giữ; hủy đơn đã xác nhận hoàn đúng phần chưa trả; trả hàng một phần hoàn đúng phần trả, tổng đơn tính lại đúng.
- [ ] Thanh toán: đơn 1.000.000, cọc 300.000 → nợ 700.000; trả thêm 500.000 → nợ 200.000; hủy payment 500.000 → nợ về 700.000 và trạng thái cập nhật đúng; thanh toán vượt nợ bị chặn; hủy payment không có lý do bị chặn.
- [ ] NCC/Đơn nhập: NCC trùng số với NCC khác bị chặn, trùng với số của khách thì vẫn cho; đơn nhập nháp không động kho; xác nhận nhận đủ 1 lần; trả hàng NCC hoàn kho đúng phần; cột đơn giá nhập chỉ hiện với người có `product.view_cost`; export đơn nhập không có cột đơn giá nhập.
- [ ] Phân quyền: dùng tài khoản Sales gọi trực tiếp API điều chỉnh kho, hủy payment, xem giá nhập, export toàn bộ khách khi không có quyền → đều 403; đổi quyền riêng của Kho rồi đăng nhập lại thì tab/mục tương ứng đổi đúng; seed lại không xóa override.
- [ ] Ảnh: tạo sản phẩm kèm ảnh chung và thumbnail SKU, Lưu thì ảnh gắn đúng sản phẩm/SKU, Hủy thì không lưu gì; ảnh 5,0–5,2MB tải lên được, ảnh trên 5 MiB báo rõ lý do; rê chuột vào ảnh hiện khung 500×500 đúng kích thước (không thành đường dọc); bấm tên sản phẩm ra trang chi tiết thuần túy (không có nút tải/xóa/đổi ảnh), bấm Sửa mới quản lý được ảnh.
- [ ] Import/Export: xem trước không ghi gì; xác nhận chỉ import dòng hợp lệ và báo dòng bỏ qua; export lược cột theo quyền; tên file có tiền tố `export-`.
- [ ] Audit: user `view_own` lọc theo người khác → 403; người không có `view_cost` xem audit có giá nhập thì thấy `***`; tìm audit không dấu theo nhãn tiếng Việt ra kết quả.

---

*Tài liệu này được tổng hợp ngày 2026-11-04 từ đặc tả gốc (00–11), quy tắc chốt cứng (12), thiết kế nhà cung cấp (13) và code nguồn thực tế trên GitHub (schema Prisma, bảng quyền, route API, giao diện). Khi có mâu thuẫn giữa tài liệu này và code nguồn, code nguồn đã được kiểm chứng bằng database thật là căn cứ cuối cùng — và phải báo lại cho chủ dự án trước khi tự ý sửa.*
