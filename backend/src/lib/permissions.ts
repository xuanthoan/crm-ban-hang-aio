/**
 * System permission codes (docs 08 §11, §19.3).
 * Codes are defined by the system, not created from the UI in MVP.
 * A role's permissions are seeded in src/seed.ts and checked server-side
 * by the authorize() middleware — hiding a button in the frontend is
 * never a substitute (locked rules §6).
 */

export const PERMISSIONS = [
  // Users / roles (Sprint Auth)
  { code: "user.view", module: "user", description: "Xem danh sách người dùng" },
  { code: "user.create", module: "user", description: "Tạo người dùng" },
  { code: "user.update", module: "user", description: "Sửa người dùng / đổi vai trò" },
  { code: "user.lock", module: "user", description: "Khóa / mở khóa người dùng" },
  { code: "user.reset_password", module: "user", description: "Đặt lại mật khẩu cho người dùng" },
  { code: "user.set_require_otp", module: "user", description: "Đặt yêu cầu OTP cho từng người dùng" },
  { code: "role.view", module: "user", description: "Xem vai trò và quyền" },
  // System settings (Sprint Auth: otp_mode)
  { code: "settings.view", module: "settings", description: "Xem cấu hình hệ thống" },
  { code: "settings.update_otp", module: "settings", description: "Đổi chế độ OTP hệ thống" },
  // Future sprints — seeded now so later routes can reuse authorize()
  { code: "customer.view_all", module: "customer", description: "Xem tất cả khách hàng" },
  { code: "customer.view_own", module: "customer", description: "Xem khách hàng của mình" },
  { code: "customer.create", module: "customer", description: "Tạo khách hàng" },
  { code: "customer.update", module: "customer", description: "Sửa khách hàng" },
  { code: "customer.deactivate", module: "customer", description: "Ngừng hoạt động khách hàng" },
  { code: "customer.hard_delete", module: "customer", description: "Xóa cứng khách hàng chưa có dữ liệu liên quan (chỉ Admin)" },
  { code: "customer.tag_manage", module: "customer", description: "Tạo / sửa / ngừng tag khách hàng" },
  { code: "customer.assign", module: "customer", description: "Phân công khách hàng" },
  { code: "customer.export", module: "customer", description: "Export khách hàng" },
  { code: "customer.import", module: "customer", description: "Import khách hàng" },
  { code: "product.view", module: "product", description: "Xem sản phẩm / SKU" },
  { code: "product.create", module: "product", description: "Tạo sản phẩm" },
  { code: "product.update", module: "product", description: "Sửa sản phẩm / SKU" },
  { code: "product.deactivate", module: "product", description: "Ngừng bán sản phẩm / SKU" },
  { code: "product.hard_delete", module: "product", description: "Xóa cứng sản phẩm / SKU chưa có dữ liệu liên quan (chỉ Admin)" },
  { code: "product.view_cost", module: "product", description: "Xem giá nhập" },
  { code: "product.import", module: "product", description: "Import sản phẩm / SKU từ CSV" },
  { code: "product.export", module: "product", description: "Export sản phẩm / SKU ra CSV" },
  { code: "product.update_price", module: "product", description: "Đổi giá bán" },
  { code: "product.update_cost", module: "product", description: "Đổi giá nhập" },
  { code: "inventory.view", module: "inventory", description: "Xem tồn kho" },
  { code: "inventory.view_value", module: "inventory", description: "Xem giá trị tồn kho" },
  { code: "inventory.import_stock", module: "inventory", description: "Nhập kho" },
  { code: "inventory.export", module: "inventory", description: "Xuất kho thủ công" },
  { code: "inventory.adjust", module: "inventory", description: "Điều chỉnh kho" },
  { code: "inventory.view_transactions", module: "inventory", description: "Xem lịch sử kho" },
  { code: "order.view_all", module: "order", description: "Xem tất cả đơn hàng" },
  { code: "order.view_own", module: "order", description: "Xem đơn hàng của mình" },
  { code: "order.create", module: "order", description: "Tạo đơn hàng" },
  { code: "order.update_draft", module: "order", description: "Sửa đơn nháp" },
  { code: "order.confirm", module: "order", description: "Xác nhận đơn (trừ kho)" },
  { code: "order.cancel", module: "order", description: "Hủy đơn" },
  { code: "order.complete", module: "order", description: "Hoàn thành đơn" },
  { code: "order.return", module: "order", description: "Trả hàng một phần / toàn phần (hoàn kho)" },
  { code: "order.hard_delete", module: "order", description: "Xóa cứng đơn nháp chưa có giao dịch (chỉ Admin)" },
  { code: "order.export", module: "order", description: "Export đơn hàng ra CSV" },
  { code: "payment.view_all", module: "payment", description: "Xem tất cả thanh toán" },
  { code: "payment.view_own", module: "payment", description: "Xem thanh toán của mình" },
  { code: "payment.create", module: "payment", description: "Ghi nhận thanh toán" },
  { code: "payment.update", module: "payment", description: "Sửa thanh toán" },
  { code: "payment.cancel", module: "payment", description: "Hủy thanh toán" },
  { code: "debt.view_all", module: "payment", description: "Xem công nợ toàn hệ thống" },
  { code: "debt.view_own", module: "payment", description: "Xem công nợ của mình" },
  { code: "activity.view_all", module: "care", description: "Xem tất cả hoạt động chăm sóc" },
  { code: "activity.view_own", module: "care", description: "Xem hoạt động chăm sóc của mình" },
  { code: "activity.create", module: "care", description: "Tạo hoạt động chăm sóc" },
  { code: "reminder.view_all", module: "care", description: "Xem tất cả nhắc việc" },
  { code: "reminder.view_own", module: "care", description: "Xem nhắc việc của mình" },
  { code: "reminder.create", module: "care", description: "Tạo nhắc việc" },
  { code: "reminder.update", module: "care", description: "Sửa nhắc việc đang chờ" },
  { code: "reminder.complete", module: "care", description: "Hoàn thành nhắc việc" },
  { code: "reminder.cancel", module: "care", description: "Hủy nhắc việc" },
  { code: "segment.view", module: "care", description: "Xem phân đoạn remarketing (danh sách, không gửi tin)" },
  { code: "report.view_all", module: "report", description: "Xem báo cáo toàn hệ thống" },
  { code: "report.view_team", module: "report", description: "Xem báo cáo đội" },
  { code: "report.view_own", module: "report", description: "Xem báo cáo cá nhân" },
  { code: "report.view_revenue", module: "report", description: "Xem doanh thu" },
  { code: "report.view_profit", module: "report", description: "Xem lãi gộp" },
  { code: "report.view_inventory_value", module: "report", description: "Xem giá trị tồn kho trong báo cáo" },
  { code: "report.view_debt", module: "report", description: "Xem báo cáo công nợ" },
  { code: "report.export", module: "report", description: "Export báo cáo" },
  // Suppliers (Sprint NCC-1: directory only). Purchase-order codes
  // arrive with Sprint NCC-2; supplier-payment codes with NCC-3.
  { code: "supplier.view_all", module: "supplier", description: "Xem tất cả nhà cung cấp" },
  { code: "supplier.view_own", module: "supplier", description: "Xem nhà cung cấp của mình" },
  { code: "supplier.create", module: "supplier", description: "Tạo nhà cung cấp" },
  { code: "supplier.update", module: "supplier", description: "Sửa nhà cung cấp" },
  { code: "supplier.deactivate", module: "supplier", description: "Ngừng hợp tác nhà cung cấp" },
  { code: "supplier.hard_delete", module: "supplier", description: "Xóa cứng nhà cung cấp chưa có đơn nhập (chỉ Admin)" },
  // Purchase orders (Sprint NCC-2). There is deliberately NO
  // purchase.update code: creating and editing a draft belong to the
  // same drafting lifecycle, so draft edits are authorized by
  // purchase.create (see routes/purchases.ts).
  { code: "purchase.view_all", module: "purchase", description: "Xem tất cả đơn nhập" },
  { code: "purchase.view_own", module: "purchase", description: "Xem đơn nhập do mình tạo" },
  { code: "purchase.create", module: "purchase", description: "Tạo và sửa đơn nhập nháp" },
  { code: "purchase.confirm", module: "purchase", description: "Xác nhận nhận hàng (nhập kho)" },
  { code: "purchase.complete", module: "purchase", description: "Hoàn thành đơn nhập" },
  { code: "purchase.cancel", module: "purchase", description: "Hủy đơn nhập" },
  { code: "purchase.return", module: "purchase", description: "Trả hàng cho nhà cung cấp" },
  // Supplier payments (Sprint NCC-3) — deliberately NO view codes:
  // the payment section and the debt page follow PO visibility
  // (purchase.view_all / view_own); only create/cancel have codes.
  { code: "supplier_payment.create", module: "supplier_payment", description: "Tạo thanh toán NCC" },
  { code: "supplier_payment.cancel", module: "supplier_payment", description: "Hủy thanh toán NCC" },
  // Audit log (Sprint Audit) — read-only. There is deliberately NO
  // audit.create/update/delete permission: audit rows are written
  // only by writeAudit() inside other operations, never via an API.
  { code: "audit.view_all", module: "audit", description: "Xem toàn bộ nhật ký audit" },
  { code: "audit.view_own", module: "audit", description: "Xem nhật ký audit do chính mình thực hiện" },
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number]["code"];

/**
 * Default permission sets per role (docs 08 §6–§11, conservative defaults).
 * Admin has every code. Manager/Sales/Warehouse/Accountant intentionally
 * do NOT get: user management, settings, view_cost / view_profit, or
 * each other's sensitive operations.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: PERMISSIONS.map((p) => p.code),
  manager: [
    "customer.view_all", "customer.create", "customer.update", "customer.assign", "customer.tag_manage", "customer.import",
    "supplier.view_all", "supplier.create", "supplier.update",
    "purchase.view_all", "purchase.create", "purchase.confirm",
    "supplier_payment.create",
    "order.export",
    "product.view",
    "inventory.view", "inventory.view_transactions",
    "order.view_all", "order.create", "order.update_draft", "order.confirm", "order.cancel", "order.complete", "order.return",
    "payment.view_all", "payment.create",
    "debt.view_all",
    "activity.view_all", "activity.create", "reminder.view_all", "reminder.create", "reminder.update", "reminder.complete", "reminder.cancel", "segment.view",
    "report.view_team", "report.view_revenue", "report.view_debt",
    "audit.view_all",
  ],
  sales: [
    "customer.view_own", "customer.create", "customer.update",
    "supplier.view_all",
    "product.view",
    "inventory.view",
    "order.view_own", "order.create", "order.update_draft", "order.confirm",
    "payment.view_own", "payment.create",
    "debt.view_own",
    "activity.view_own", "activity.create", "reminder.view_own", "reminder.create", "reminder.update", "reminder.complete", "reminder.cancel", "segment.view",
    "report.view_own",
    "audit.view_own",
  ],
  warehouse: [
    "product.view",
    "inventory.view", "inventory.import_stock", "inventory.export", "inventory.adjust", "inventory.view_transactions",
    "order.view_all",
    "purchase.view_all", "purchase.confirm",
    "audit.view_own",
  ],
  accountant: [
    "customer.view_all",
    "supplier.view_all",
    "purchase.view_all",
    "product.view",
    "order.view_all", "order.export",
    "payment.view_all", "payment.create", "payment.update", "payment.cancel",
    "supplier_payment.create", "supplier_payment.cancel",
    "debt.view_all",
    "segment.view",
    "report.view_debt", "report.view_revenue",
    "audit.view_own",
  ],
};

export const DEFAULT_ROLES = [
  { code: "admin", name: "Admin", description: "Chủ cửa hàng — toàn quyền hệ thống" },
  { code: "manager", name: "Manager", description: "Quản lý — vận hành đội, không quản trị hệ thống" },
  { code: "sales", name: "Sales", description: "Nhân viên bán hàng — chỉ dữ liệu của mình" },
  { code: "warehouse", name: "Warehouse", description: "Nhân viên kho — sản phẩm và tồn kho" },
  { code: "accountant", name: "Accountant", description: "Kế toán / Thu ngân — tiền và công nợ" },
];
