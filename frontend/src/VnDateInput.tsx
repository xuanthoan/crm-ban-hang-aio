import { useEffect, useState } from "react";

// Ngày sinh luôn hiển thị dạng dd/mm/yyyy (Việt Nam).
// Không dùng <input type="date"> của trình duyệt: nó hiển thị theo vùng
// của Windows/trình duyệt (mm/dd/yyyy trên máy đang để vùng Mỹ), dù
// trang đã đặt lang="vi", nên người dùng nhập dd/mm/yyyy đã lưu sai
// (năm 0001, 0007, hoặc ngày con bị rớt thành rỗng).
// VnDateInput dưới đây là ô lịch riêng của ứng dụng: luôn hiện
// dd/mm/yyyy, có nút lịch để chọn ngày/tháng/năm, và vẫn gõ tay được.
// Trong form, dateOfBirth giữ chuỗi ISO (yyyy-mm-dd) như backend nhận;
// chỉ phần hiển thị mới đổi sang dd/mm/yyyy.
export function isoToVnDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = iso.slice(0, 10).split("-");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return "";
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Gõ tay cũng được: chấp nhận dd/mm/yyyy, d/m/yyyy, hoặc 8 chữ số
// liền nhau như 25022021. Dùng setFullYear để năm < 100 (ví dụ 0001
// từ dữ liệu cũ) không bị JavaScript cộng thêm 1900 như new Date(y,…).
export function parseVnDateInput(text: string): { iso: string | null; error?: string } {
  const v = text.trim();
  if (!v) return { iso: null };
  const digits = v.replace(/\D/g, "");
  let d: number;
  let m: number;
  let y: number;
  if (/^\d{8}$/.test(digits)) {
    d = parseInt(digits.slice(0, 2), 10);
    m = parseInt(digits.slice(2, 4), 10);
    y = parseInt(digits.slice(4, 8), 10);
  } else {
    const match = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(v);
    if (!match) return { iso: null, error: `Ngày "${v}" chưa đúng dạng dd/mm/yyyy.` };
    d = parseInt(match[1], 10);
    m = parseInt(match[2], 10);
    y = parseInt(match[3], 10);
  }
  const date = new Date(0);
  date.setFullYear(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return { iso: null, error: `Ngày "${v}" không tồn tại trên lịch.` };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date > today) return { iso: null, error: `Ngày sinh "${v}" không được là ngày tương lai.` };
  return { iso: `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
}

export function formatVnDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length === 0) return "";
  // Gõ ngày 1 chữ số rồi gõ "/" tay thì giữ dấu "/" đó.
  if (digits.length === 1) return raw.includes("/") ? `${digits}/` : digits;
  // Gõ xong "20" thì hiện ngay "20/", gõ xong "10" thì hiện ngay "20/10/".
  if (digits.length === 2) return `${digits}/`;
  if (digits.length === 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  if (digits.length === 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function VnDateInput({ value, onChange, required }: { value: string; onChange: (iso: string) => void; required?: boolean }) {
  const [text, setText] = useState(isoToVnDate(value));
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const initial = value ? new Date(`${value.slice(0, 10)}T00:00:00`) : new Date();
  const initialYear = initial.getFullYear();
  const clampedYear = initialYear >= 1900 && initialYear <= new Date().getFullYear() ? initialYear : new Date().getFullYear();
  const [viewYear, setViewYear] = useState(clampedYear);
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  // Khi mở lại form với khách khác, đồng bộ ô hiển thị theo giá trị mới.
  useEffect(() => {
    setText(isoToVnDate(value));
    setError("");
    setOpen(false);
  }, [value]);

  function openCalendar() {
    const base = value ? new Date(`${value.slice(0, 10)}T00:00:00`) : new Date();
    const y = base.getFullYear();
    setViewYear(y >= 1900 && y <= new Date().getFullYear() ? y : new Date().getFullYear());
    setViewMonth(base.getMonth());
    setOpen((o) => !o);
  }

  function handleBlur() {
    const parsed = parseVnDateInput(text);
    if (parsed.error) {
      setError(`${parsed.error} Hãy chọn trên lịch hoặc nhập lại.`);
      setText(isoToVnDate(value));
      return;
    }
    setError("");
    onChange(parsed.iso ?? "");
  }

  const firstWeekday = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // thứ 2 đầu tuần
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const thisYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = thisYear; y >= 1900; y--) years.push(y);

  return (
    <span className="relative block">
      <span className="flex gap-1">
        <input
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/yyyy"
          required={required}
          className="mt-1 w-full rounded border p-2"
          value={text}
          onChange={(e) => {
            const raw = e.target.value;
            // Phím xóa lùi vừa xóa dấu "/" thì xóa luôn chữ số trước nó,
            // nếu không ô sẽ hiện lại "/" và người dùng không xóa được.
            if (raw === text.slice(0, -1) && text.endsWith("/")) {
              setText(formatVnDateInput(raw.slice(0, -1)));
            } else {
              setText(formatVnDateInput(raw));
            }
            setError("");
          }}
          onBlur={handleBlur}
        />
        <button type="button" onClick={openCalendar} className="mt-1 rounded border px-2 py-1" title="Chọn ngày trên lịch">
          📅
        </button>
      </span>
      {error && <span className="block text-sm text-red-700">{error}</span>}
      {open && (
        <span className="absolute left-0 top-full z-10 mt-1 block w-72 rounded border bg-white p-2 shadow">
          <span className="flex items-center gap-1">
            <button
              type="button"
              className="rounded border px-2 py-1"
              onClick={() => {
                const d = new Date(viewYear, viewMonth - 1, 1);
                setViewYear(d.getFullYear());
                setViewMonth(d.getMonth());
              }}
            >
              ‹
            </button>
            <select className="rounded border p-1" value={viewMonth} onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}>
              {["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"].map(
                (label, i) => (
                  <option key={i} value={i}>
                    {label}
                  </option>
                ),
              )}
            </select>
            <select className="rounded border p-1" value={viewYear} onChange={(e) => setViewYear(parseInt(e.target.value, 10))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded border px-2 py-1"
              onClick={() => {
                const d = new Date(viewYear, viewMonth + 1, 1);
                setViewYear(d.getFullYear());
                setViewMonth(d.getMonth());
              }}
            >
              ›
            </button>
          </span>
          <span className="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-gray-500">
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </span>
          <span className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const selected = value.slice(0, 10) === iso;
              return (
                <button
                  key={day}
                  type="button"
                  className={`rounded border px-1 py-1 text-sm ${selected ? "bg-blue-600 text-white" : ""}`}
                  onClick={() => {
                    onChange(iso);
                    setText(isoToVnDate(iso));
                    setError("");
                    setOpen(false);
                  }}
                >
                  {day}
                </button>
              );
            })}
          </span>
          <button type="button" onClick={() => setOpen(false)} className="mt-2 rounded border px-3 py-1">
            Đóng
          </button>
        </span>
      )}
    </span>
  );
}

