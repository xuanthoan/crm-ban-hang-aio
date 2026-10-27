# Kế Hoạch Dự Án CRM_Ban_Hang

## 1. Tổng Quan Kiến Trúc

- **Backend**: Node.js + TypeScript + Express + Prisma (PostgreSQL)
- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Database**: PostgreSQL (chạy trong Docker)
- **Container**: Docker Compose (3 services: postgres, backend, frontend)
- **Xác thực**: JWT, phân quyền RBAC
- **Triển khai**: Docker Compose cho môi trường dev, production sử dụng CI/CD

## 2. Các Sprint & Atomic Tasks

### Sprint 0: Chuẩn Bị & Kiến Trúc Hệ Thống (Foundation)

**Mục tiêu**: Thiết lập cấu trúc dự án, môi trường dev, tài liệu và pipeline cơ bản.

**Atomic Tasks**:

1. Tạo cấu trúc thư mục dự án (backend, frontend, docker, docs, scripts).
2. Tạo file `package.json` cho backend và cài các dependencies cơ bản (express, typescript, prisma, dotenv, cors, helmet, morgan, jsonwebtoken, bcrypt, joi).
3. Tạo file `tsconfig.json` cho backend.
4. Tạo file `.env.example` cho backend.
5. Tạo file `Dockerfile` cho backend.
6. Tạo file `package.json` cho frontend và cài dependencies (react, react-dom, typescript, vite, tailwindcss, axios, react-router-dom, react-hook-form, zod).
7. Tạo file `tsconfig.json` cho frontend.
8. Tạo file `vite.config.ts` cho frontend.
9. Tạo file `.env.example` cho frontend.
10. Tạo file `Dockerfile` cho frontend.
11. Tạo file `docker-compose.yml` với services: postgres, backend, frontend.
12. Tạo file `.dockerignore` và `.gitignore`.
13. Tạo file `README.md` (hướng dẫn cài đặt và chạy).
14. Tạo file `DEVELOPMENT_PLAN.md` (kế hoạch phát triển).
15. Tạo file `DATABASE_SCHEMA.md` (thiết kế schema sơ bộ).
16. Tạo file `API_SPEC.md` (đặc tả API sơ bộ).
17. Tạo file `MVP_SPRINT_PLAN.md` (kế hoạch sprint chi tiết).
18. Thiết lập Prisma: `npx prisma init` và cấu hình database connection.
19. Tạo migration đầu tiên cho bảng `users` và `roles`.
20. Tạo seed data cho roles mặc định (Admin, Manager, Sales, Warehouse, Accountant).
21. Tạo health check endpoint `GET /api/health`.
22. Chạy thử `docker-compose up` và xác nhận các service khởi động thành công.

**Kiểm tra**: Backend health check OK, frontend hiển thị trang mặc định, database kết nối được.

---

### Sprint 1: Quản Lý Người Dùng & Phân Quyền (User & RBAC)

**Mục tiêu**: Đăng nhập, đăng ký, phân quyền người dùng (5 vai trò).

**Atomic Tasks**:

1. Tạo Prisma model `User` (id, email, password_hash, full_name, phone, role_id, status, created_at, updated_at).
2. Tạo Prisma model `Role` (id, name, description, created_at, updated_at).
3. Tạo Prisma model `Permission` (id, name, resource, action, created_at).
4. Tạo Prisma model `RolePermission` (role_id, permission_id).
5. Chạy migration cho các bảng trên.
6. Tạo service `AuthService` (đăng ký, đăng nhập, quên mật khẩu, reset mật khẩu).
7. Tạo controller `AuthController` với các endpoint: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`.
8. Tạo middleware `auth` để xác thực JWT.
9. Tạo middleware `rbac` để kiểm tra quyền (dựa trên role và permission).
10. Tạo service `UserService` (CRUD user, phân trang, lọc).
11. Tạo controller `UserController` với các endpoint: `GET /api/users`, `GET /api/users/:id`, `POST /api/users`, `PUT /api/users/:id`, `DELETE /api/users/:id`.
12. Tạo service `RoleService` (CRUD role, gán quyền).
13. Tạo controller `RoleController` với các endpoint: `GET /api/roles`, `POST /api/roles`, `PUT /api/roles/:id`, `DELETE /api/roles/:id`, `POST /api/roles/:id/permissions`.
14. Tạo frontend pages: Login, Register, ForgotPassword, ResetPassword.
15. Tạo frontend components: Navbar, Sidebar, ProtectedRoute (dựa trên role).
16. Tạo frontend service `authApi` (gọi API auth).
17. Tạo frontend context `AuthContext` (quản lý trạng thái user).
18. Tạo frontend page `UserList` (hiển thị danh sách user, phân trang, tìm kiếm).
19. Tạo frontend page `UserForm` (tạo/sửa user, chọn role).
20. Tạo frontend page `RoleList` và `RoleForm` (quản lý role và permission).
21. Viết unit test cho AuthService (đăng ký, đăng nhập, JWT).
22. Viết integration test cho các endpoint auth.
23. Viết UI test cho luồng đăng nhập/đăng xuất.

**Kiểm tra**: API coverage > 80%, không có bug Blocker/Critical.

---

### Sprint 2: Quản Lý Khách Hàng & CRM (Leads & Contacts)

**Mục tiêu**: Quản lý hồ sơ khách hàng, chống trùng số điện thoại, thông tin con cái.

**Atomic Tasks**:

1. Tạo Prisma model `Customer` (id, full_name, phone_1, phone_2, email, address, source, status, potential_level, assigned_to, internal_note, created_by, updated_by, created_at, updated_at, deleted_at).
2. Tạo Prisma model `CustomerChild` (id, customer_id, full_name, birthday, gender, note, sort_order, status, created_by, updated_by, created_at, updated_at, deleted_at).
3. Tạo Prisma model `CustomerTag` (id, customer_id, tag_name).
4. Tạo Prisma model `CustomerActivity` (id, customer_id, activity_type, content, created_by, created_at).
5. Chạy migration cho các bảng trên.
6. Tạo service `CustomerService` (CRUD, tìm kiếm, phân trang, chống trùng phone).
7. Tạo service `CustomerChildService` (CRUD, validation birthday not future).
8. Tạo service `CustomerTagService` (thêm/xóa tag).
9. Tạo service `CustomerActivityService` (ghi nhận hoạt động).
10. Tạo controller `CustomerController` với các endpoint: `GET /api/customers`, `GET /api/customers/:id`, `POST /api/customers`, `PUT /api/customers/:id`, `DELETE /api/customers/:id`.
11. Tạo controller `CustomerChildController` với các endpoint: `GET /api/customers/:customerId/children`, `POST /api/customers/:customerId/children`, `PUT /api/customers/:customerId/children/:childId`, `DELETE /api/customers/:customerId/children/:childId`.
12. Tạo controller `CustomerActivityController` với endpoint `GET /api/customers/:customerId/activities` và `POST /api/customers/:customerId/activities`.
13. Tạo frontend page `CustomerList` (hiển thị danh sách, lọc theo source, status, potential_level, assigned_to).
14. Tạo frontend page `CustomerDetail` (hiển thị thông tin khách, danh sách con, hoạt động, công nợ).
15. Tạo frontend component `CustomerForm` (tạo/sửa khách hàng, chọn assigned_to, source, status).
16. Tạo frontend component `ChildForm` (thêm/sửa con, validation birthday).
17. Tạo frontend component `ActivityTimeline` (hiển thị các hoạt động).
18. Tạo frontend component `AddActivityForm` (ghi nhận hoạt động).
19. Viết unit test cho CustomerService (chống trùng phone).
20. Viết integration test cho CustomerController.

**Kiểm tra**: Không thể tạo khách hàng trùng số điện thoại, ngày sinh con không ở tương lai.

---

### Sprint 3: Quản Lý Sản Phẩm & SKU (Products & Variants)

**Mục tiêu**: Quản lý sản phẩm cha, biến thể linh hoạt, tự sinh SKU, tồn kho theo SKU.

**Atomic Tasks**:

1. Tạo Prisma model `Product` (id, name, description, category, brand, status, created_by, updated_by, created_at, updated_at).
2. Tạo Prisma model `ProductVariant` (id, product_id, sku, price, cost_price, attributes JSON, images JSON, status, created_by, updated_by, created_at, updated_at).
3. Tạo Prisma model `InventoryItem` (id, variant_id, quantity, reorder_level, warehouse_location, created_at, updated_at).
4. Tạo Prisma model `InventoryTransaction` (id, variant_id, quantity_change, transaction_type, reason, created_by, created_at).
5. Chạy migration cho các bảng trên.
6. Tạo service `ProductService` (CRUD sản phẩm cha).
7. Tạo service `ProductVariantService` (CRUD biến thể, tự sinh SKU, kiểm tra trùng SKU).
8. Tạo service `InventoryService` (cập nhật tồn kho, tạo transaction, không cho tồn kho âm).
9. Tạo controller `ProductController` với các endpoint: `GET /api/products`, `GET /api/products/:id`, `POST /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id`.
10. Tạo controller `ProductVariantController` với các endpoint: `GET /api/products/:productId/variants`, `POST /api/products/:productId/variants`, `PUT /api/variants/:variantId`, `DELETE /api/variants/:variantId`.
11. Tạo controller `InventoryController` với các endpoint: `GET /api/inventory`, `GET /api/inventory/:variantId`, `POST /api/inventory/adjust` (điều chỉnh kho có lý do).
12. Tạo frontend page `ProductList` và `ProductForm` (tạo sản phẩm cha).
13. Tạo frontend page `VariantList` và `VariantForm` (tạo biến thể, checkbox progressive: Biến thể 1 -> Biến thể 2 -> Biến thể 3, tự sinh tổ hợp).
14. Tạo frontend component `VariantCombinationGenerator` (tự sinh các tổ hợp giá trị).
15. Tạo frontend page `InventoryList` (hiển thị tồn kho theo SKU, cảnh báo hết hàng/sắp hết).
16. Tạo frontend component `InventoryAdjustForm` (nhập kho/điều chỉnh kho, lý do).
17. Viết unit test cho ProductVariantService (tự sinh SKU, không trùng).
18. Viết unit test cho InventoryService (không âm, transaction).

**Kiểm tra**: Tạo biến thể tự sinh SKU, không trùng, không cho tồn kho âm.

---

### Sprint 4: Quản Lý Đơn Hàng (Orders)

**Mục tiêu**: Tạo đơn hàng theo SKU, kiểm tra tồn kho, trừ kho khi xác nhận, hoàn kho khi hủy.

**Atomic Tasks**:

1. Tạo Prisma model `Order` (id, customer_id, order_date, status, total_amount, discount, shipping_fee, net_amount, paid_amount, note, created_by, updated_by, created_at, updated_at).
2. Tạo Prisma model `OrderItem` (id, order_id, variant_id, quantity, unit_price, discount, total_price).
3. Tạo Prisma model `OrderStatusHistory` (id, order_id, status, changed_by, changed_at).
4. Chạy migration cho các bảng trên.
5. Tạo service `OrderService` (tạo đơn, tính toán tổng tiền, giảm giá, phí ship, kiểm tra tồn kho khi tạo và khi xác nhận).
6. Tạo service `OrderStatusService` (cập nhật trạng thái, ghi nhận lịch sử).
7. Tạo service `InventoryService` (thêm method `reserveStock` và `releaseStock`).
8. Tạo controller `OrderController` với các endpoint: `GET /api/orders`, `GET /api/orders/:id`, `POST /api/orders`, `PUT /api/orders/:id`, `DELETE /api/orders/:id`, `POST /api/orders/:id/confirm`, `POST /api/orders/:id/cancel`.
9. Tạo frontend page `OrderList` (hiển thị danh sách đơn, lọc theo status, customer).
10. Tạo frontend page `OrderDetail` (hiển thị thông tin đơn, các order item, trạng thái, thanh toán).
11. Tạo frontend page `OrderForm` (tạo đơn, chọn customer, thêm SKU, tính tổng tự động).
12. Tạo frontend component `OrderItemSelector` (tìm kiếm SKU, thêm vào đơn).
13. Tạo frontend component `OrderStatusBadge` và `OrderStatusUpdate` (cập nhật trạng thái).
14. Tạo frontend page `OrderConfirm` (xác nhận đơn, kiểm tra tồn kho, hiển thị cảnh báo).
15. Viết unit test cho OrderService (tính toán, kiểm tra tồn kho).
16. Viết integration test cho OrderController (xác nhận đơn trừ kho).

**Kiểm tra**: Đơn hàng phải chọn customer và SKU, không được bán theo sản phẩm cha. Xác nhận đơn trừ kho, hủy đơn hoàn kho.

---

### Sprint 5: Thanh Toán & Công Nợ (Payment & Debt)

**Mục tiêu**: Quản lý thanh toán nhiều lần cho một đơn, công nợ theo đơn và khách.

**Atomic Tasks**:

1. Tạo Prisma model `Payment` (id, order_id, customer_id, amount, payment_method, payment_date, status, note, created_by, created_at, updated_at).
2. Tạo Prisma model `Debt` (id, customer_id, order_id, debt_amount, paid_amount, remaining_amount, status, due_date, created_at, updated_at).
3. Chạy migration cho các bảng trên.
4. Tạo service `PaymentService` (ghi nhận thanh toán, cập nhật paid_amount của order, cập nhật công nợ).
5. Tạo service `DebtService` (tính công nợ của khách, cảnh báo nợ quá hạn).
6. Tạo controller `PaymentController` với các endpoint: `GET /api/payments`, `GET /api/payments/order/:orderId`, `POST /api/payments`, `PUT /api/payments/:id`, `DELETE /api/payments/:id` (soft delete/cancel).
7. Tạo controller `DebtController` với các endpoint: `GET /api/debts/customer/:customerId`, `GET /api/debts/overdue`.
8. Tạo frontend page `PaymentList` (hiển thị các thanh toán của đơn).
9. Tạo frontend component `PaymentForm` (thêm thanh toán mới, chọn phương thức).
10. Tạo frontend component `DebtSummary` (hiển thị công nợ của khách hàng trên trang chi tiết khách hàng).
11. Tạo frontend page `DebtList` (danh sách khách hàng còn nợ, lọc theo quá hạn).
12. Viết unit test cho PaymentService (cập nhật công nợ).

**Kiểm tra**: Không sửa trực tiếp số đã thanh toán, payment ghi nhận qua bảng riêng. Công nợ khách = tổng công nợ các đơn.

---

### Sprint 6: Chăm Sóc, Nhắc Việc & Remarketing (Activities, Reminders, Remarketing)

**Mục tiêu**: Lịch sử hoạt động, nhắc việc, bộ lọc remarketing cơ bản.

**Atomic Tasks**:

1. Tạo Prisma model `Reminder` (id, customer_id, title, description, due_date, priority, status, assigned_to, created_by, created_at, updated_at).
2. Tạo Prisma model `RemarketingSegment` (id, name, conditions JSON, created_by, created_at).
3. Chạy migration.
4. Tạo service `ReminderService` (CRUD, lọc theo hôm nay/quá hạn/sắp tới).
5. Tạo service `RemarketingService` (lọc khách hàng theo điều kiện: tag, nguồn, sản phẩm đã mua, lâu chưa mua, sinh nhật khách, sinh nhật con, còn nợ).
6. Tạo controller `ReminderController` với các endpoint: `GET /api/reminders`, `POST /api/reminders`, `PUT /api/reminders/:id`, `DELETE /api/reminders/:id`.
7. Tạo controller `RemarketingController` với endpoint `POST /api/remarketing/query` (nhận filter conditions, trả về danh sách khách hàng).
8. Tạo frontend page `ReminderList` (hiển thị danh sách nhắc việc, lọc theo hôm nay, quá hạn, sắp tới).
9. Tạo frontend component `ReminderForm` (tạo/sửa reminder).
10. Tạo frontend page `RemarketingBuilder` (xây dựng bộ lọc, export danh sách khách hàng).
11. Tạo frontend component `FilterBuilder` (các điều kiện tag, nguồn, sản phẩm, ngày mua, sinh nhật, nợ).
12. Viết unit test cho RemarketingService (lọc đúng đối tượng).

**Kiểm tra**: Bộ lọc remarketing hoạt động chính xác, không gửi tự động, chỉ lọc và export.

---

### Sprint 7: Dashboard & Báo Cáo (Dashboard & Reports)

**Mục tiêu**: Dashboard với các chỉ số hành động, báo cáo cơ bản.

**Atomic Tasks**:

1. Tạo service `DashboardService` (tổng hợp chỉ số: doanh thu, số đơn, tiền đã thu, công nợ, đơn chưa xử lý, SKU sắp hết/hết hàng, sản phẩm bán chạy, khách cần chăm sóc, khách lâu chưa mua, khách sinh nhật).
2. Tạo service `ReportService` (báo cáo doanh thu theo ngày/tuần/tháng, báo cáo sản phẩm bán chạy, báo cáo công nợ).
3. Tạo controller `DashboardController` với endpoint `GET /api/dashboard` (dữ liệu tùy theo quyền).
4. Tạo controller `ReportController` với endpoints: `GET /api/reports/revenue`, `GET /api/reports/top-products`, `GET /api/reports/debt`.
5. Tạo frontend page `Dashboard` (hiển thị các widget: doanh thu, đơn hàng, công nợ, tồn kho, khách cần chăm sóc, top sản phẩm).
6. Tạo frontend component `RevenueChart` (biểu đồ cột/đường).
7. Tạo frontend component `TopProductsTable`.
8. Tạo frontend component `DebtWarningList`.
9. Tạo frontend page `ReportRevenue` (báo cáo doanh thu theo khoảng thời gian).
10. Tạo frontend page `ReportProducts` (báo cáo sản phẩm bán chạy).
11. Viết unit test cho DashboardService (tổng hợp đúng).

**Kiểm tra**: Dashboard tải trong <2s, dữ liệu chính xác, tuân thủ phân quyền.

---

### Sprint 8: Import/Export, Audit Log & Hoàn Thiện (Import, Export, Audit, Hardening)

**Mục tiêu**: Import/export Excel, audit log, bảo mật, UAT, release.

**Atomic Tasks**:

1. Tạo Prisma model `AuditLog` (id, user_id, action, resource, resource_id, old_value, new_value, ip_address, user_agent, created_at).
2. Chạy migration.
3. Tạo middleware `audit` (ghi log cho các thao tác nhạy cảm: sửa/xóa khách, hủy đơn, điều chỉnh kho, sửa giá, ghi nhận/hủy payment, import, thay đổi quyền).
4. Tạo service `ImportExportService` (import: upload file -> preview -> validate -> confirm -> insert; export: theo bộ lọc và quyền).
5. Tạo controller `ImportController` với endpoints: `POST /api/import/upload`, `POST /api/import/preview`, `POST /api/import/confirm`.
6. Tạo controller `ExportController` với endpoint `POST /api/export` (nhận loại dữ liệu, filter, trả về file).
7. Tạo frontend page `ImportWizard` (upload file, preview dữ liệu, xác nhận import).
8. Tạo frontend page `ExportBuilder` (chọn loại dữ liệu, áp dụng filter, tải file).
9. Tạo frontend page `AuditLogList` (hiển thị log, lọc theo user, action, resource).
10. Tạo sample import templates (khách hàng, sản phẩm, đơn hàng).
11. Tối ưu index database (các trường hay tìm kiếm).
12. Cấu hình CORS, helmet, rate-limiting, validation.
13. Chạy bảo mật scan (OWASP).
14. UAT: triển khai staging, mời user thử nghiệm, thu thập feedback.
15. Sửa bug từ UAT.
16. Viết tài liệu hướng dẫn sử dụng (User Manual).
17. Viết tài liệu API (OpenAPI/Swagger).
18. Chạy load test (JMeter/K6) với 1000 concurrent users.
19. Tối ưu hiệu năng (caching, query optimization).
20. Đóng gói release (docker images, docker-compose production).

**Kiểm tra**: Import không ghi thẳng vào DB, audit log đầy đủ, export theo đúng quyền, không bug Blocker/Critical, uptime 99.9%.

---

## 3. Checklist Tổng Hợp (Step 1 → Step N)

Dưới đây là checklist chi tiết từng bước từ khởi tạo đến đóng gói, được đánh số liên tục. Mỗi bước là một atomic task, có thể thực hiện độc lập.

### Giai đoạn 0: Khởi tạo dự án (Steps 1-22)

1. Tạo cấu trúc thư mục.
2. Tạo package.json backend.
3. Tạo tsconfig.json backend.
4. Tạo .env.example backend.
5. Tạo Dockerfile backend.
6. Tạo package.json frontend.
7. Tạo tsconfig.json frontend.
8. Tạo vite.config.ts frontend.
9. Tạo .env.example frontend.
10. Tạo Dockerfile frontend.
11. Tạo docker-compose.yml.
12. Tạo .dockerignore và .gitignore.
13. Tạo README.md.
14. Tạo DEVELOPMENT_PLAN.md.
15. Tạo DATABASE_SCHEMA.md.
16. Tạo API_SPEC.md.
17. Tạo MVP_SPRINT_PLAN.md.
18. Cài Prisma và cấu hình.
19. Tạo migration users & roles.
20. Tạo seed data roles.
21. Tạo health check endpoint.
22. Chạy docker-compose up và kiểm tra.

### Giai đoạn 1: User & RBAC (Steps 23-45)

23. Tạo model User.
24. Tạo model Role.
25. Tạo model Permission.
26. Tạo model RolePermission.
27. Chạy migration.
28. Tạo AuthService.
29. Tạo AuthController.
30. Tạo middleware auth.
31. Tạo middleware rbac.
32. Tạo UserService.
33. Tạo UserController.
34. Tạo RoleService.
35. Tạo RoleController.
36. Tạo frontend Login, Register, ForgotPassword, ResetPassword.
37. Tạo frontend Navbar, Sidebar, ProtectedRoute.
38. Tạo frontend authApi.
39. Tạo frontend AuthContext.
40. Tạo frontend UserList.
41. Tạo frontend UserForm.
42. Tạo frontend RoleList.
43. Tạo frontend RoleForm.
44. Viết unit test AuthService.
45. Viết integration test AuthController.

### Giai đoạn 2: Khách hàng (Steps 46-65)

46. Tạo model Customer.
47. Tạo model CustomerChild.
48. Tạo model CustomerTag.
49. Tạo model CustomerActivity.
50. Chạy migration.
51. Tạo CustomerService.
52. Tạo CustomerChildService.
53. Tạo CustomerTagService.
54. Tạo CustomerActivityService.
55. Tạo CustomerController.
56. Tạo CustomerChildController.
57. Tạo CustomerActivityController.
58. Tạo frontend CustomerList.
59. Tạo frontend CustomerDetail.
60. Tạo frontend CustomerForm.
61. Tạo frontend ChildForm.
62. Tạo frontend ActivityTimeline.
63. Tạo frontend AddActivityForm.
64. Viết unit test CustomerService.
65. Viết integration test CustomerController.

### Giai đoạn 3: Sản phẩm & SKU (Steps 66-83)

66. Tạo model Product.
67. Tạo model ProductVariant.
68. Tạo model InventoryItem.
69. Tạo model InventoryTransaction.
70. Chạy migration.
71. Tạo ProductService.
72. Tạo ProductVariantService.
73. Tạo InventoryService.
74. Tạo ProductController.
75. Tạo ProductVariantController.
76. Tạo InventoryController.
77. Tạo frontend ProductList.
78. Tạo frontend ProductForm.
79. Tạo frontend VariantList.
80. Tạo frontend VariantForm (progressive).
81. Tạo frontend VariantCombinationGenerator.
82. Tạo frontend InventoryList.
83. Tạo frontend InventoryAdjustForm.

### Giai đoạn 4: Đơn hàng (Steps 84-99)

84. Tạo model Order.
85. Tạo model OrderItem.
86. Tạo model OrderStatusHistory.
87. Chạy migration.
88. Tạo OrderService.
89. Tạo OrderStatusService.
90. Tạo InventoryService (bổ sung reserve/release).
91. Tạo OrderController.
92. Tạo frontend OrderList.
93. Tạo frontend OrderDetail.
94. Tạo frontend OrderForm.
95. Tạo frontend OrderItemSelector.
96. Tạo frontend OrderStatusBadge.
97. Tạo frontend OrderStatusUpdate.
98. Tạo frontend OrderConfirm.
99. Viết test OrderService.

### Giai đoạn 5: Thanh toán & Công nợ (Steps 100-112)

100. Tạo model Payment.
101. Tạo model Debt.
102. Chạy migration.
103. Tạo PaymentService.
104. Tạo DebtService.
105. Tạo PaymentController.
106. Tạo DebtController.
107. Tạo frontend PaymentList.
108. Tạo frontend PaymentForm.
109. Tạo frontend DebtSummary.
110. Tạo frontend DebtList.
111. Viết test PaymentService.
112. Viết test DebtService.

### Giai đoạn 6: Chăm sóc & Nhắc việc (Steps 113-124)

113. Tạo model Reminder.
114. Tạo model RemarketingSegment.
115. Chạy migration.
116. Tạo ReminderService.
117. Tạo RemarketingService.
118. Tạo ReminderController.
119. Tạo RemarketingController.
120. Tạo frontend ReminderList.
121. Tạo frontend ReminderForm.
122. Tạo frontend RemarketingBuilder.
123. Tạo frontend FilterBuilder.
124. Viết test RemarketingService.

### Giai đoạn 7: Dashboard & Báo cáo (Steps 125-135)

125. Tạo DashboardService.
126. Tạo ReportService.
127. Tạo DashboardController.
128. Tạo ReportController.
129. Tạo frontend Dashboard.
130. Tạo frontend RevenueChart.
131. Tạo frontend TopProductsTable.
132. Tạo frontend DebtWarningList.
133. Tạo frontend ReportRevenue.
134. Tạo frontend ReportProducts.
135. Viết test DashboardService.

### Giai đoạn 8: Import/Export & Audit (Steps 136-156)

136. Tạo model AuditLog.
137. Chạy migration.
138. Tạo middleware audit.
139. Tạo ImportExportService.
140. Tạo ImportController.
141. Tạo ExportController.
142. Tạo frontend ImportWizard.
143. Tạo frontend ExportBuilder.
144. Tạo frontend AuditLogList.
145. Tạo sample import templates.
146. Tối ưu index database.
147. Cấu hình CORS, helmet, rate-limiting.
148. Chạy bảo mật scan.
149. UAT (triển khai staging).
150. Sửa bug từ UAT.
151. Viết User Manual.
152. Viết API documentation.
153. Chạy load test.
154. Tối ưu hiệu năng.
155. Đóng gói release images.
156. Triển khai production và go-live.

---

## 4. Lưu Ý Quan Trọng

- **Không viết code ứng dụng trước khi có kế hoạch này được duyệt.**
- Mỗi atomic task chỉ nên thực hiện một file hoặc một tính năng nhỏ.
- Luôn chạy test sau mỗi task để đảm bảo không phá vỡ chức năng cũ.
- Tuân thủ thứ tự sprint và không nhảy cóc.
- Báo cáo tiến độ sau mỗi sprint (đã đọc file nào, đã sửa/tạo file nào, đã thêm bảng/API/màn hình nào, cách chạy/test, lỗi còn, sprint tiếp theo).

---

**Xác nhận**: Tôi đã tạo file PROJECT_PLAN.md chứa checklist chi tiết từng bước. Hiện tại chưa viết code ứng dụng. Vui lòng xem xét và xác nhận để bắt đầu thực hiện Sprint 0.