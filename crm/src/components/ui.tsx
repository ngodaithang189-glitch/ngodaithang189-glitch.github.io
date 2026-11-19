"use client";
// Bộ thành phần giao diện dùng chung – giữ đồng bộ phong cách xanh dương / trắng / xám nhạt.
import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect } from "react";

export const cx = clsx;

export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-xl border border-slate-200 bg-white shadow-card", className)} {...p}>{children}</div>;
}

export function CardHeader({ title, subtitle, action }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, desc, actions }: { title: string; desc?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
        {desc && <p className="mt-1 text-sm text-slate-500">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
export function Button({ variant = "primary", size = "md", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" }) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-xs" : "h-10 px-3.5 text-sm",
        variant === "primary" && "bg-brand-600 text-white hover:bg-brand-700",
        variant === "secondary" && "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100",
        variant === "danger" && "bg-rose-600 text-white hover:bg-rose-700",
        className,
      )}
      {...p}
    />
  );
}

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", className ?? "bg-slate-100 text-slate-700")}>{children}</span>;
}

export const inputCls = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

export function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}{required && <span className="text-rose-500"> *</span>}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function Select({ value, onChange, options, className, placeholder }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string; placeholder?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={cx(inputCls, "pr-8", className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function useEsc(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [open, onClose]);
}

export function Modal({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  useEsc(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className={cx("flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Đóng"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, subtitle }: { open: boolean; onClose: () => void; title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode }) {
  useEsc(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onMouseDown={onClose}>
      <aside className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-900">{title}</h2>
            {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Đóng"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}

export function StatCard({ label, value, sub, icon, tone = "brand", trend }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode; tone?: "brand" | "green" | "amber" | "rose" | "slate"; trend?: number;
}) {
  const toneCls = { brand: "bg-brand-50 text-brand-600", green: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", rose: "bg-rose-50 text-rose-600", slate: "bg-slate-100 text-slate-600" }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {icon && <span className={cx("rounded-lg p-1.5", toneCls)}>{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
        {trend !== undefined && (
          <span className={cx("font-semibold", trend >= 0 ? "text-emerald-600" : "text-rose-600")}>{trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(0)}%</span>
        )}
        {sub}
      </div>
    </Card>
  );
}

export function Empty({ text = "Không có dữ liệu phù hợp", icon }: { text?: string; icon?: React.ReactNode }) {
  return <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-slate-400">{icon}{text}</div>;
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: React.ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
      {items.map((it) => (
        <button key={it.value} onClick={() => onChange(it.value)}
          className={cx("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition", value === it.value ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** invert = true khi "càng đầy càng đáng lo" (tải công việc, ngân sách đã tiêu) */
export function Progress({ value, className, invert }: { value: number; className?: string; invert?: boolean }) {
  const v = Math.max(0, Math.min(1, value));
  if (invert) {
    return (
      <div className={cx("h-1.5 w-full overflow-hidden rounded-full bg-slate-100", className)}>
        <div className={cx("h-full rounded-full", v >= 0.9 ? "bg-rose-500" : v >= 0.7 ? "bg-amber-500" : "bg-brand-500")} style={{ width: `${v * 100}%` }} />
      </div>
    );
  }
  return (
    <div className={cx("h-1.5 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div className={cx("h-full rounded-full", v >= 1 ? "bg-emerald-500" : v >= 0.6 ? "bg-brand-500" : v >= 0.3 ? "bg-amber-500" : "bg-rose-400")} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const parts = name.replace(/\(.*\)/, "").trim().split(/\s+/);
  const initials = (parts.length > 1 ? parts[parts.length - 2][0] + parts[parts.length - 1][0] : parts[0][0]).toUpperCase();
  const hues = ["bg-brand-100 text-brand-700", "bg-sky-100 text-sky-700", "bg-indigo-100 text-indigo-700", "bg-teal-100 text-teal-700", "bg-slate-200 text-slate-700"];
  const h = hues[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % hues.length];
  return <span className={cx("inline-flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", h)} style={{ width: size, height: size }}>{initials}</span>;
}

/** Bảng có cuộn ngang trên điện thoại */
export function Table({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">{children}</table></div>;
}
export const th = "whitespace-nowrap border-b border-slate-100 bg-slate-50/70 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500";
export const td = "border-b border-slate-100 px-3 py-2.5 align-middle text-slate-700";
