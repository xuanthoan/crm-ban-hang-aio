// Nhãn hiển thị tiếng Việt cho mã/trạng thái và định dạng ngày hiển thị.
// CHỈ đổi text người dùng nhìn thấy. Mọi value gửi API, mã đơn, SKU,
// ID, tên người dùng, email đều giữ nguyên mã gốc.
// labelFor(map, code) trả về chính mã đó khi mã chưa có trong map,
// nên mã mới xuất hiện sau này không bao giờ bị hiển thị trống.

export function labelFor(map: Record<string, string>, code: string | null | undefined): string {
  if (!code) return "";
  return map[code] ?? code;
}

// "2026-10-30" (hoặc phần ngày của chuỗi ISO) -> "30/10/2026".
// Giữ nguyên ngữ nghĩa ngày như code cũ dùng slice(0, 10): chỉ đổi
// thứ tự hiển thị, không đổi múi giờ hay ngày.
export function isoToVnDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = iso.slice(0, 10).split("-");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return "";
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// "2026-10-30T06:41:00.000Z" -> "30/10/2026 13:41" (giờ địa phương,
// giống hành vi toLocaleString() trước đây, chỉ cố định dạng dd/mm/yyyy).
export function isoToVnDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return isoToVnDate(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Trạng thái đơn (chuyển từ STATUS_LABELS cũ trong orders.tsx).
export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "Nháp (đang giữ tồn)",
  confirmed: "Đã xác nhận (đã trừ kho)",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

// Trạng thái thanh toán của đơn (unpaid/partial/paid).
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Chưa thanh toán",
  partial: "Thanh toán một phần",
  paid: "Đã thanh toán",
};

// Trạng thái của một dòng payment.
export const PAYMENT_RECORD_LABELS: Record<string, string> = {
  active: "Đang hoạt động",
  cancelled: "Đã hủy",
};

// Loại hoạt động chăm sóc.
export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: "Gọi điện",
  zalo: "Zalo",
  facebook: "Facebook",
  email: "Email",
  visit: "Ghé thăm",
  consultation: "Tư vấn",
  quote: "Báo giá",
  close: "Chốt đơn",
  reschedule: "Hẹn lại",
  refuse: "Từ chối",
  after_sales: "Chăm sóc sau bán",
  payment_reminder: "Nhắc thanh toán",
  complaint: "Khiếu nại",
  internal_note: "Ghi chú nội bộ",
  other: "Khác",
};

// Kết quả hoạt động chăm sóc.
export const ACTIVITY_RESULT_LABELS: Record<string, string> = {
  contacted: "Đã liên hệ",
  no_answer: "Không nghe máy",
  wrong_number: "Sai số",
  interested: "Quan tâm",
  not_interested: "Không quan tâm",
  callback: "Hẹn gọi lại",
  quoted: "Đã báo giá",
  closed: "Đã chốt",
  refused: "Đã từ chối",
  need_followup: "Cần theo dõi",
  payment_reminded: "Đã nhắc thanh toán",
  resolved: "Đã xử lý",
  other: "Khác",
};

// Loại nhắc việc.
export const REMINDER_TYPE_LABELS: Record<string, string> = {
  callback: "Gọi lại",
  message: "Nhắn tin",
  after_sales: "Chăm sóc sau bán",
  birthday: "Sinh nhật",
  payment: "Thanh toán",
  complaint: "Khiếu nại",
  delivery: "Giao hàng",
  check_order: "Kiểm tra đơn",
  other: "Khác",
};

// Nhóm lọc nhắc việc (nút all/overdue/due_today/upcoming/done/cancelled).
export const REMINDER_GROUP_LABELS: Record<string, string> = {
  all: "Tất cả",
  overdue: "Quá hạn",
  due_today: "Hôm nay",
  upcoming: "Sắp tới",
  done: "Đã xong",
  cancelled: "Đã hủy",
};

// Trạng thái nhắc việc.
export const REMINDER_STATUS_LABELS: Record<string, string> = {
  pending: "Đang chờ",
  done: "Đã xong",
  cancelled: "Đã hủy",
};

// Nhóm thời gian của nhắc việc (timeGroup do backend tính).
export const TIME_GROUP_LABELS: Record<string, string> = {
  overdue: "Quá hạn",
  due_today: "Hôm nay",
  upcoming: "Sắp tới",
  done: "Đã xong",
  cancelled: "Đã hủy",
  other: "Khác",
};

// Loại giao dịch kho (transactionType).
export const INVENTORY_TX_LABELS: Record<string, string> = {
  initial: "Nhập tồn ban đầu",
  import: "Nhập kho",
  export: "Xuất kho",
  adjustment_increase: "Điều chỉnh tăng",
  adjustment_decrease: "Điều chỉnh giảm",
  set: "Đặt tồn tuyệt đối",
  order_confirmed: "Trừ kho khi xác nhận đơn",
  order_cancelled: "Hoàn kho khi hủy đơn",
  return: "Hoàn kho khi trả hàng",
};

// Hành động audit (lập từ các action: "..." trong backend/src).
// Action nào chưa có trong map sẽ hiển thị nguyên mã nhờ labelFor.
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  login_success: "Đăng nhập thành công",
  login_failed: "Đăng nhập thất bại",
  logout: "Đăng xuất",
  otp_resent: "Gửi lại mã OTP",
  password_changed: "Đổi mật khẩu",
  password_reset: "Đặt lại mật khẩu",
  user_created: "Tạo người dùng",
  user_locked: "Khóa người dùng",
  user_unlocked: "Mở khóa người dùng",
  settings_changed: "Đổi cài đặt hệ thống",
  customer_created: "Tạo khách hàng",
  customer_updated: "Cập nhật khách hàng",
  customer_deactivated: "Ngừng hoạt động khách hàng",
  customer_hard_deleted: "Xóa cứng khách hàng",
  customer_phone_added: "Thêm số điện thoại",
  customer_phone_removed: "Xóa số điện thoại",
  customer_primary_changed: "Đổi số chính",
  customer_tag_added: "Gắn tag cho khách",
  customer_tag_removed: "Gỡ tag khỏi khách",
  child_created: "Thêm con",
  child_updated: "Cập nhật thông tin con",
  child_deleted: "Xóa thông tin con",
  tag_created: "Tạo tag",
  tag_updated: "Cập nhật tag",
  tag_deactivated: "Ngừng tag",
  "category.create": "Tạo danh mục",
  "product.create": "Tạo sản phẩm",
  "product.update": "Cập nhật sản phẩm",
  "product.deactivate": "Ngừng bán sản phẩm",
  "product.hard_delete": "Xóa cứng sản phẩm",
  "product.price_change": "Đổi giá bán",
  "variant.create": "Tạo biến thể (SKU)",
  "variant.update": "Cập nhật biến thể (SKU)",
  "variant.deactivate": "Ngừng bán biến thể",
  "variant.hard_delete": "Xóa cứng biến thể",
  "order.create": "Tạo đơn hàng",
  "order.update_draft": "Sửa đơn nháp",
  "order.confirm": "Xác nhận đơn hàng",
  "order.complete": "Hoàn thành đơn hàng",
  "order.cancel": "Hủy đơn hàng",
  "order.return": "Trả hàng",
  "order.hard_delete": "Xóa cứng đơn hàng",
  "payment.create": "Tạo payment",
  "payment.cancel": "Hủy payment",
  "reminder.create": "Tạo nhắc việc",
  "reminder.update": "Cập nhật nhắc việc",
  "reminder.complete": "Hoàn thành nhắc việc",
  "reminder.cancel": "Hủy nhắc việc",
  "import.confirm": "Xác nhận nhập dữ liệu",
  export: "Xuất dữ liệu",
  "inventory.initial": "Nhập tồn ban đầu",
  "inventory.import": "Nhập kho",
  "inventory.export": "Xuất kho",
  "inventory.adjust": "Điều chỉnh kho",
};

// Loại thực thể trong audit (entityType).
export const ENTITY_TYPE_LABELS: Record<string, string> = {
  category: "Danh mục",
  customer: "Khách hàng",
  customer_tag: "Tag khách hàng",
  export: "Xuất dữ liệu",
  import: "Nhập dữ liệu",
  inventory: "Kho",
  order: "Đơn hàng",
  payment: "Thanh toán",
  product: "Sản phẩm",
  reminder: "Nhắc việc",
  system_setting: "Cài đặt hệ thống",
  user: "Người dùng",
  variant: "Biến thể (SKU)",
};

// Phạm vi dữ liệu trong dashboard (scope do backend trả).
export const SCOPE_LABELS: Record<string, string> = {
  all: "Toàn hệ thống",
  team: "Team (tính như toàn hệ thống)",
  own: "Cá nhân",
  none: "Không có phạm vi",
};
