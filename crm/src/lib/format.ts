export const vnd = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " đ";

export const vndShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, "") + " tỷ";
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + " tr";
  if (a >= 1e3) return Math.round(n / 1e3) + "k";
  return String(Math.round(n));
};

export const pct = (x: number, digits = 0) => (x * 100).toFixed(digits) + "%";

export const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export const fmtDateTime = (s?: string) =>
  s ? new Date(s).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

export const fmtTime = (s: string) => new Date(s).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

export function relative(s?: string, now = Date.now()) {
  if (!s) return "—";
  const d = new Date(s).getTime() - now;
  const abs = Math.abs(d);
  const unit = abs < 3600000 ? [Math.round(abs / 60000), "phút"] : abs < 86400000 ? [Math.round(abs / 3600000), "giờ"] : [Math.round(abs / 86400000), "ngày"];
  return d < 0 ? `${unit[0]} ${unit[1]} trước` : `${unit[0]} ${unit[1]} nữa`;
}

/** Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu: "nguyen" khớp "Nguyễn" */
export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const monthKey = (s: string) => {
  const d = new Date(s);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  return `T${Number(m)}/${y.slice(2)}`;
};

export const lastMonths = (n: number, now = new Date()) => {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
};

export const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
