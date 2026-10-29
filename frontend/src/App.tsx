import { useCallback, useEffect, useState } from "react";
import CustomersPage from "./customers";
import DebtsPage from "./debts";
import InventoryPage from "./inventory";
import OrdersPage from "./orders";
import ProductsPage from "./products";
import RemindersPage, { SegmentsPage } from "./care";
import { DashboardPage, ReportsPage } from "./dashboard";
import ImportExportPage from "./importExport";
import AuditPage from "./audit";

type HealthState = "loading" | "connected" | "not-connected";

interface UserInfo {
  id: string;
  username: string;
  email: string;
  fullName: string;
  status: string;
  role: string | null;
  roleName: string | null;
  requireOtp: boolean | null;
  permissions: string[];
}

const MODULES = [
  { name: "Khách hàng", note: "Nhiều số điện thoại, 1 số chính — theo quy tắc chốt cứng 4.1" },
  { name: "Sản phẩm / SKU", note: "SKU là đơn vị bán và trừ kho duy nhất" },
  { name: "Kho", note: "Mọi thay đổi kho đều có transaction, không tồn âm ở MVP" },
  { name: "Đơn hàng", note: "Dòng đơn bắt buộc có SKU + snapshot tại thời điểm bán" },
  { name: "Thanh toán / Công nợ", note: "paid_total tính từ payment đang active, không sửa tay" },
  { name: "Chăm sóc", note: "Nhắc việc, lịch sử chăm sóc khách hàng" },
  { name: "Báo cáo", note: "Dashboard và báo cáo theo SKU, đơn, công nợ" },
];

const API_BASE = import.meta.env.VITE_API_URL ?? "";
const TOKEN_KEY = "crm_token";

async function api(path: string, token: string | null, body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || `Lỗi ${res.status}`);
  }
  return data as Record<string, unknown>;
}

export default function App() {
  const [health, setHealth] = useState<HealthState>("loading");
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<UserInfo | null>(null);
  const [step, setStep] = useState<"login" | "otp">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpChallengeId, setOtpChallengeId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [otpMode, setOtpMode] = useState("");
  const [section, setSection] = useState<"home" | "customers" | "products" | "inventory" | "orders" | "debts" | "reminders" | "segments" | "dashboard" | "reports" | "importExport" | "audit">("home");
  const [otpModeDraft, setOtpModeDraft] = useState("off");
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [otpDevLog, setOtpDevLog] = useState(false);

  const loadMe = useCallback(async (t: string) => {
    try {
      const data = await api("/api/auth/me", t);
      setUser(data.user as UserInfo);
      return true;
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
      return false;
    }
  }, []);

  const loadSettings = useCallback(async (t: string) => {
    try {
      const data = await api("/api/admin/settings", t);
      const s = data.settings as { otp_mode: string; smtp_configured: boolean; otp_dev_log: boolean };
      setOtpMode(s.otp_mode);
      setOtpModeDraft(s.otp_mode);
      setSmtpConfigured(s.smtp_configured);
      setOtpDevLog(s.otp_dev_log);
    } catch {
      // Not an admin / no permission: settings panel simply stays hidden.
    }
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((res) => setHealth(res.ok ? "connected" : "not-connected"))
      .catch(() => setHealth("not-connected"));
  }, []);

  useEffect(() => {
    if (token) {
      loadMe(token).then((ok) => {
        if (ok) loadSettings(token);
      });
    }
  }, [token, loadMe, loadSettings]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const data = await api("/api/auth/login", null, { username, password });
      if (data.otp_required) {
        setOtpChallengeId(data.otp_challenge_id as string);
        setMaskedEmail(data.masked_email as string);
        setStep("otp");
        setInfo(`Đã gửi mã OTP qua email tới ${data.masked_email as string}. Mã hết hạn sau 5 phút.`);
      } else {
        const t = data.token as string;
        localStorage.setItem(TOKEN_KEY, t);
        setToken(t);
        setPassword("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api("/api/auth/verify-otp", null, { otp_challenge_id: otpChallengeId, code: otpCode });
      const t = data.token as string;
      localStorage.setItem(TOKEN_KEY, t);
      setToken(t);
      setStep("login");
      setOtpCode("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mã OTP không đúng.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResendOtp() {
    setError("");
    setInfo("");
    try {
      const data = await api("/api/auth/resend-otp", null, { otp_challenge_id: otpChallengeId });
      setOtpChallengeId(data.otp_challenge_id as string);
      setInfo("Đã gửi lại mã OTP mới. Mã cũ không còn hiệu lực.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi lại được mã.");
    }
  }

  function handleLogout() {
    // MVP logout is client-side: the JWT itself is stateless. See README.
    if (token) api("/api/auth/logout", token).catch(() => undefined);
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setStep("login");
    setInfo("Đã đăng xuất.");
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    const form = e.target as HTMLFormElement;
    const current = (form.elements.namedItem("current_password") as HTMLInputElement).value;
    const next = (form.elements.namedItem("new_password") as HTMLInputElement).value;
    const confirm = (form.elements.namedItem("confirm_password") as HTMLInputElement).value;
    if (next !== confirm) {
      setError("Mật khẩu mới nhập lại không khớp.");
      return;
    }
    try {
      await api("/api/auth/change-password", token, { current_password: current, new_password: next });
      setInfo("Đã đổi mật khẩu.");
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đổi mật khẩu thất bại.");
    }
  }

  async function handleSaveOtpMode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/settings/otp-mode`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp_mode: otpModeDraft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { message?: string }).message || `Lỗi ${res.status}`);
      setOtpMode(otpModeDraft);
      setInfo(`Đã đổi chế độ OTP hệ thống thành: ${otpModeDraft === "off" ? "Tắt (chỉ mật khẩu)" : "Bắt buộc OTP qua email"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu cấu hình thất bại.");
    }
  }

  const canAdminOtp = user?.permissions.includes("settings.update_otp");
  const canViewSettings = user?.permissions.includes("settings.view");
  const canViewCustomers =
    user?.permissions.includes("customer.view_all") || user?.permissions.includes("customer.view_own");
  const canViewProducts = user?.permissions.includes("product.view");
  const canViewInventory = user?.permissions.includes("inventory.view");
  const canViewOrders =
    user?.permissions.includes("order.view_all") || user?.permissions.includes("order.view_own");
  const canViewDebts =
    user?.permissions.includes("debt.view_all") || user?.permissions.includes("debt.view_own");
  const canViewReminders =
    user?.permissions.includes("reminder.view_all") || user?.permissions.includes("reminder.view_own");
  const canViewSegments = user?.permissions.includes("segment.view");
  const canViewReports =
    user?.permissions.includes("report.view_all") ||
    user?.permissions.includes("report.view_team") ||
    user?.permissions.includes("report.view_own") ||
    user?.permissions.includes("inventory.view");
  const canViewImportExport =
    user?.permissions.includes("customer.import") ||
    user?.permissions.includes("product.import") ||
    user?.permissions.includes("customer.export") ||
    user?.permissions.includes("product.export") ||
    user?.permissions.includes("order.export") ||
    user?.permissions.includes("inventory.view");
  const canViewAudit =
    user?.permissions.includes("audit.view_all") || user?.permissions.includes("audit.view_own");

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">CRM_Ban_Hang</h1>
      <p className="mt-2 text-gray-600">
        Trạng thái backend:{" "}
        <strong>
          {health === "loading" && "Đang kiểm tra…"}
          {health === "connected" && "Đã kết nối (/api/health trả về ok)"}
          {health === "not-connected" && "Chưa kết nối — hãy chạy backend rồi tải lại trang"}
        </strong>
      </p>

      {error && <p className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
      {info && <p className="mt-4 rounded border border-green-300 bg-green-50 p-3 text-green-800">{info}</p>}

      {!user && step === "login" && (
        <form onSubmit={handleLogin} className="mt-6 space-y-3 rounded border p-4">
          <h2 className="text-lg font-semibold">Đăng nhập</h2>
          <label className="block">
            Tên đăng nhập hoặc email
            <input className="mt-1 w-full rounded border p-2" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label className="block">
            Mật khẩu
            <input type="password" className="mt-1 w-full rounded border p-2" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button disabled={busy} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
          <p className="text-sm text-gray-500">
            Mặc định chỉ cần tên đăng nhập + mật khẩu. Nếu admin bật OTP qua email, bạn sẽ được chuyển sang bước nhập mã.
          </p>
        </form>
      )}

      {!user && step === "otp" && (
        <form onSubmit={handleVerifyOtp} className="mt-6 space-y-3 rounded border p-4">
          <h2 className="text-lg font-semibold">Nhập mã OTP qua email</h2>
          <p className="text-sm text-gray-600">Mã đã gửi tới {maskedEmail}. Mã gồm 6 số, hết hạn sau 5 phút, sai quá 5 lần phải đăng nhập lại.</p>
          <label className="block">
            Mã OTP
            <input className="mt-1 w-full rounded border p-2 tracking-widest" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required />
          </label>
          <div className="flex gap-2">
            <button disabled={busy} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">Xác nhận mã</button>
            <button type="button" onClick={handleResendOtp} className="rounded border px-4 py-2">Gửi lại mã</button>
            <button type="button" onClick={() => { setStep("login"); setError(""); }} className="rounded border px-4 py-2">Quay lại đăng nhập</button>
          </div>
        </form>
      )}

      {user && (
        <section className="mt-6 space-y-4">
          <div className="rounded border p-4">
            <p>
              Xin chào <strong>{user.fullName}</strong> ({user.username}) — vai trò: <strong>{user.roleName ?? user.role}</strong>
            </p>
            <p className="text-sm text-gray-500">Email: {user.email} · Yêu cầu OTP riêng: {user.requireOtp === null ? "Theo hệ thống" : user.requireOtp ? "Luôn yêu cầu" : "Không yêu cầu"}</p>
            <button onClick={handleLogout} className="mt-3 rounded border px-4 py-2">Đăng xuất</button>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setSection("home")} className="rounded border px-4 py-2">Tổng quan</button>
            {canViewCustomers && (
              <button onClick={() => setSection("customers")} className="rounded border px-4 py-2">Khách hàng</button>
            )}
            {canViewProducts && (
              <button onClick={() => setSection("products")} className="rounded border px-4 py-2">Sản phẩm / SKU</button>
            )}
            {canViewInventory && (
              <button onClick={() => setSection("inventory")} className="rounded border px-4 py-2">Kho</button>
            )}
            {canViewOrders && (
              <button onClick={() => setSection("orders")} className="rounded border px-4 py-2">Đơn hàng</button>
            )}
            {canViewDebts && (
              <button onClick={() => setSection("debts")} className="rounded border px-4 py-2">Công nợ</button>
            )}
            {canViewReminders && (
              <button onClick={() => setSection("reminders")} className="rounded border px-4 py-2">Nhắc việc</button>
            )}
            {canViewSegments && (
              <button onClick={() => setSection("segments")} className="rounded border px-4 py-2">Phân đoạn</button>
            )}
            {canViewReports && (
              <button onClick={() => setSection("dashboard")} className="rounded border px-4 py-2">Dashboard</button>
            )}
            {canViewReports && (
              <button onClick={() => setSection("reports")} className="rounded border px-4 py-2">Báo cáo</button>
            )}
            {canViewImportExport && (
              <button onClick={() => setSection("importExport")} className="rounded border px-4 py-2">Import / Export</button>
            )}
            {canViewAudit && (
              <button onClick={() => setSection("audit")} className="rounded border px-4 py-2">Nhật ký Audit</button>
            )}
          </div>

          {section === "dashboard" && canViewReports ? (
            <DashboardPage token={token ?? ""} />
          ) : section === "reports" && canViewReports ? (
            <ReportsPage token={token ?? ""} />
          ) : section === "segments" && canViewSegments ? (
            <SegmentsPage token={token ?? ""} permissions={user.permissions} />
          ) : section === "reminders" && canViewReminders ? (
            <RemindersPage token={token ?? ""} permissions={user.permissions} />
          ) : section === "debts" && canViewDebts ? (
            <DebtsPage token={token ?? ""} permissions={user.permissions} />
          ) : section === "orders" && canViewOrders ? (
            <OrdersPage token={token ?? ""} permissions={user.permissions} />
          ) : section === "inventory" && canViewInventory ? (
            <InventoryPage token={token ?? ""} permissions={user.permissions} />
          ) : section === "products" && canViewProducts ? (
            <ProductsPage token={token ?? ""} permissions={user.permissions} />
          ) : section === "importExport" && canViewImportExport ? (
            <ImportExportPage token={token ?? ""} permissions={user.permissions} />
          ) : section === "audit" && canViewAudit ? (
            <AuditPage token={token ?? ""} />
          ) : section === "customers" && canViewCustomers ? (
            <CustomersPage token={token ?? ""} permissions={user.permissions} />
          ) : (
            <>
          {canViewSettings && (
            <div className="rounded border p-4">
              <h2 className="text-lg font-semibold">Cấu hình OTP (dành cho admin)</h2>
              <p className="text-sm text-gray-600">
                Chế độ hiện tại: <strong>{otpMode === "email" ? "Bắt buộc OTP qua email" : "Tắt — chỉ cần mật khẩu"}</strong>
                {" · "}SMTP đã cấu hình: {smtpConfigured ? "Có" : "Chưa"}
                {" · "}Chế độ dev OTP: {otpDevLog ? "BẬT (chỉ dev local)" : "Tắt"}
              </p>
              {canAdminOtp && (
                <form onSubmit={handleSaveOtpMode} className="mt-3 flex items-center gap-2">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="otp_mode" value="off" checked={otpModeDraft === "off"} onChange={() => setOtpModeDraft("off")} /> Chỉ mật khẩu
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="otp_mode" value="email" checked={otpModeDraft === "email"} onChange={() => setOtpModeDraft("email")} /> OTP qua email
                  </label>
                  <button className="rounded bg-blue-600 px-4 py-2 text-white">Lưu</button>
                </form>
              )}
              <p className="mt-2 text-sm text-gray-500">
                OTP qua điện thoại/SMS chưa có trong sprint này vì chưa có nhà cung cấp SMS — hệ thống sẽ từ chối nếu ai đó cố đặt chế độ đó.
                Admin cũng có thể đặt yêu cầu OTP riêng cho từng người dùng qua API (xem README).
              </p>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3 rounded border p-4">
            <h2 className="text-lg font-semibold">Đổi mật khẩu</h2>
            <label className="block">Mật khẩu hiện tại<input type="password" name="current_password" className="mt-1 w-full rounded border p-2" required /></label>
            <label className="block">Mật khẩu mới (ít nhất 8 ký tự)<input type="password" name="new_password" className="mt-1 w-full rounded border p-2" required /></label>
            <label className="block">Nhập lại mật khẩu mới<input type="password" name="confirm_password" className="mt-1 w-full rounded border p-2" required /></label>
            <button className="rounded bg-blue-600 px-4 py-2 text-white">Đổi mật khẩu</button>
          </form>

          <div>
            <h2 className="mt-2 text-lg font-semibold">Các module sẽ làm</h2>
            <p className="text-sm text-gray-500">Menu dưới đây chỉ là giao diện — mọi quyền vẫn do backend kiểm tra (quy tắc chốt cứng §6).</p>
            <ul className="mt-2 space-y-2">
              {MODULES.map((m) => (
                <li key={m.name} className="rounded border p-3">
                  <strong>{m.name}</strong>
                  <span className="text-gray-500"> — {m.note}</span>
                </li>
              ))}
            </ul>
          </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
