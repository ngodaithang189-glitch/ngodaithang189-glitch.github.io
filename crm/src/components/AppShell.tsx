"use client";
import { Bell, GraduationCap, LogOut, Menu, RotateCcw, Search, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ROLE_LABEL } from "@/lib/constants";
import { normalize } from "@/lib/format";
import { can, scopeLeads } from "@/lib/permissions";
import { StoreProvider, useStore } from "@/lib/store";
import { NAV } from "./nav";
import { Avatar, cx } from "./ui";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <Shell>{children}</Shell>
    </StoreProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const store = useStore();
  if (!store.db || !store.me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        <div className="flex items-center gap-3"><span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" /> Đang tải dữ liệu…</div>
      </div>
    );
  }
  return <Loaded>{children}</Loaded>;
}

function Loaded({ children }: { children: React.ReactNode }) {
  const { db, me, setMe, actions, toasts } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [showBell, setShowBell] = useState(false);

  const current = NAV.filter((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)))[0];
  const allowed = !current || can(me.role, current.module);
  const groups = useMemo(() => {
    const g = new Map<string, typeof NAV>();
    NAV.filter((n) => can(me.role, n.module)).forEach((n) => g.set(n.group, [...(g.get(n.group) ?? []), n]));
    return [...g.entries()];
  }, [me.role]);

  const overdue = useMemo(() => {
    const now = Date.now();
    return scopeLeads(db, me)
      .filter((l) => l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() < now && !["contract", "lost"].includes(l.stage))
      .sort((a, b) => a.nextFollowUpAt!.localeCompare(b.nextFollowUpAt!));
  }, [db, me]);

  const results = useMemo(() => {
    if (q.trim().length < 2) return [];
    const n = normalize(q.trim());
    const leads = (can(me.role, "leads") ? scopeLeads(db, me) : [])
      .filter((l) => normalize(`${l.fullName} ${l.phone} ${l.code}`).includes(n)).slice(0, 6)
      .map((l) => ({ key: l.id, label: l.fullName, sub: `${l.code} · ${l.phone}`, href: `/khach-hang?open=${l.id}` }));
    const cases = (can(me.role, "cases") ? db.cases : [])
      .filter((c) => normalize(`${c.fullName} ${c.code} ${c.school}`).includes(n)).slice(0, 4)
      .map((c) => ({ key: c.id, label: c.fullName, sub: `Hồ sơ ${c.code} · ${c.school}`, href: `/ho-so?open=${c.id}` }));
    return [...leads, ...cases];
  }, [q, db, me]);

  const demoUsers = db.staff.filter((s) => ["st-gd", "st-ql2", "st-tv1", "st-kt1", "st-hs1"].includes(s.id));
  const branchName = db.branches.find((b) => b.id === me.branchId)?.name;

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white"><GraduationCap size={20} /></span>
        <div className="leading-tight">
          <p className="text-sm font-bold text-slate-900">DU HỌC TH</p>
          <p className="text-[11px] font-medium text-slate-500">CRM & Management</p>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {groups.map(([g, items]) => (
          <div key={g}>
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g}</p>
            {items.map((n) => {
              const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
                  className={cx("mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition",
                    active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")}>
                  <n.icon size={18} className={active ? "text-brand-600" : "text-slate-400"} />
                  {n.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 p-3">
        <button onClick={() => { if (confirm("Tạo lại toàn bộ dữ liệu giả lập? Các thay đổi demo sẽ mất.")) actions.resetDemo(); }}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100">
          <RotateCcw size={14} /> Khôi phục dữ liệu mẫu
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-72 bg-white" onClick={(e) => e.stopPropagation()}>{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <div className="bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-800">
          Bản DEMO – toàn bộ số liệu là <b>dữ liệu giả lập</b>, lưu tạm trên trình duyệt của thầy. Không nhập thông tin khách hàng thật.
        </div>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Mở menu"><Menu size={20} /></button>
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên, SĐT, mã khách, mã hồ sơ…"
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100" />
            {q && <button className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setQ("")} aria-label="Xóa"><X size={16} /></button>}
            {q.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-12 z-30 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {results.length === 0 ? <p className="px-4 py-3 text-sm text-slate-400">Không tìm thấy kết quả</p> : results.map((r) => (
                  <button key={r.key} onClick={() => { router.push(r.href); setQ(""); }} className="block w-full px-4 py-2.5 text-left hover:bg-slate-50">
                    <p className="text-sm font-medium text-slate-800">{r.label}</p>
                    <p className="text-xs text-slate-500">{r.sub}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setShowBell((v) => !v)} className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Thông báo">
                <Bell size={20} />
                {overdue.length > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{overdue.length > 99 ? "99+" : overdue.length}</span>}
              </button>
              {showBell && (
                <div className="absolute right-0 top-12 z-30 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  <p className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">Quá hạn chăm sóc ({overdue.length})</p>
                  <div className="max-h-80 overflow-y-auto">
                    {overdue.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">Không có khách quá hạn 🎉</p>}
                    {overdue.slice(0, 15).map((l) => (
                      <Link key={l.id} href={`/khach-hang?open=${l.id}`} onClick={() => setShowBell(false)} className="block px-4 py-2 hover:bg-slate-50">
                        <p className="text-sm font-medium text-slate-800">{l.fullName}</p>
                        <p className="text-xs text-rose-600">Hẹn chăm sóc: {new Date(l.nextFollowUpAt!).toLocaleDateString("vi-VN")}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 py-1 pl-1.5 pr-1">
              <Avatar name={me.fullName} />
              <div className="hidden leading-tight md:block">
                <p className="max-w-[160px] truncate text-xs font-semibold text-slate-800">{me.fullName}</p>
                <p className="text-[11px] text-slate-500">{ROLE_LABEL[me.role]} · {branchName}</p>
              </div>
              <select value={me.id} onChange={(e) => setMe(e.target.value)} title="Đổi tài khoản demo để xem phân quyền"
                className="h-8 max-w-[34px] cursor-pointer rounded-md border-0 bg-slate-100 text-xs text-transparent md:max-w-none md:text-slate-700">
                {demoUsers.map((s) => <option key={s.id} value={s.id} className="text-slate-800">{ROLE_LABEL[s.role]} – {s.fullName}</option>)}
              </select>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
          {allowed ? children : (
            <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <ShieldCheck className="mx-auto text-slate-400" size={40} />
              <h2 className="mt-3 text-lg font-semibold text-slate-800">Không có quyền truy cập</h2>
              <p className="mt-1 text-sm text-slate-500">Vai trò <b>{ROLE_LABEL[me.role]}</b> không được phép xem phân hệ này.</p>
              <Link href="/" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600"><LogOut size={14} /> Về trang tổng quan</Link>
            </div>
          )}
        </main>
      </div>

      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={cx("pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg",
            t.tone === "success" ? "bg-emerald-600" : t.tone === "error" ? "bg-rose-600" : "bg-slate-800")}>{t.text}</div>
        ))}
      </div>
    </div>
  );
}
