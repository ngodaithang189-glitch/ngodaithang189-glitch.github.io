"use client";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Avatar, Badge, Button, Card, Empty, PageHeader, Select, Table, cx, inputCls, td, th } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/constants";
import { fmtDateTime, normalize } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { AuditLog } from "@/lib/types";

const ACTION: Record<AuditLog["action"], { label: string; cls: string }> = {
  create: { label: "Tạo mới", cls: "bg-emerald-100 text-emerald-700" },
  update: { label: "Cập nhật", cls: "bg-sky-100 text-sky-700" },
  delete: { label: "Xóa", cls: "bg-rose-100 text-rose-700" },
  assign: { label: "Phân bổ", cls: "bg-indigo-100 text-indigo-700" },
  import: { label: "Nhập file", cls: "bg-violet-100 text-violet-700" },
  export: { label: "Xuất file", cls: "bg-amber-100 text-amber-800" },
  login: { label: "Đăng nhập", cls: "bg-slate-100 text-slate-700" },
  payment: { label: "Thanh toán", cls: "bg-teal-100 text-teal-700" },
};

const ENTITY: Record<AuditLog["entity"], string> = {
  lead: "Khách hàng", interaction: "Chăm sóc", appointment: "Lịch hẹn", case: "Hồ sơ", invoice: "Hóa đơn",
  payment: "Thanh toán", staff: "Nhân sự", assignment: "Phân bổ", system: "Hệ thống",
};

const PAGE = 50;

export default function AuditPage() {
  const { db, me } = useStore();
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const visibleStaff = useMemo(
    () => (me.role === "director" ? db.staff : db.staff.filter((s) => s.branchId === me.branchId)),
    [db.staff, me],
  );
  const staffIds = useMemo(() => new Set(visibleStaff.map((s) => s.id)), [visibleStaff]);

  const rows = useMemo(() => {
    const n = normalize(q.trim());
    const fromT = from ? new Date(from + "T00:00:00").getTime() : -Infinity;
    const toT = to ? new Date(to + "T23:59:59").getTime() : Infinity;
    return db.audit
      .filter((a) => staffIds.has(a.actorId))
      .filter((a) => (!actor || a.actorId === actor) && (!action || a.action === action) && (!entity || a.entity === entity))
      .filter((a) => { const t = new Date(a.at).getTime(); return t >= fromT && t <= toT; })
      .filter((a) => !n || normalize(a.summary + " " + (a.changes ?? []).map((c) => `${c.field} ${c.from} ${c.to}`).join(" ")).includes(n))
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [db.audit, staffIds, actor, action, entity, from, to, q]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const shown = rows.slice(cur * PAGE, cur * PAGE + PAGE);
  const reset = () => { setActor(""); setAction(""); setEntity(""); setFrom(""); setTo(""); setQ(""); setPage(0); };
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const set = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(0); };

  return (
    <div className="space-y-4">
      <PageHeader title="Nhật ký hoạt động" desc={me.role === "director" ? "Ai đã làm gì, lúc nào, thay đổi dữ liệu gì – toàn hệ thống." : "Hoạt động của nhân sự thuộc chi nhánh của thầy/cô."} />

      <Card className="p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => set(setQ)(e.target.value)} placeholder="Tìm nội dung, tên khách, trường dữ liệu…" className={cx(inputCls, "pl-9")} aria-label="Tìm trong nhật ký" />
          </div>
          <Select value={actor} onChange={set(setActor)} placeholder="Mọi người thực hiện" options={visibleStaff.map((s) => ({ value: s.id, label: s.fullName }))} />
          <Select value={action} onChange={set(setAction)} placeholder="Mọi hành động" options={Object.entries(ACTION).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Select value={entity} onChange={set(setEntity)} placeholder="Mọi đối tượng" options={Object.entries(ENTITY).map(([k, v]) => ({ value: k, label: v }))} />
          <Button variant="ghost" onClick={reset}>Xóa bộ lọc</Button>
          <label className="flex items-center gap-2 text-xs text-slate-500 lg:col-span-2">Từ ngày
            <input type="date" value={from} onChange={(e) => set(setFrom)(e.target.value)} className={inputCls} />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-500 lg:col-span-2">Đến ngày
            <input type="date" value={to} onChange={(e) => set(setTo)(e.target.value)} className={inputCls} />
          </label>
        </div>
      </Card>

      <Card>
        {shown.length === 0 ? <Empty text="Không có hoạt động phù hợp" /> : (
          <Table>
            <thead>
              <tr><th className={cx(th, "w-8")}></th><th className={th}>Thời gian</th><th className={th}>Người thực hiện</th><th className={th}>Hành động</th><th className={th}>Đối tượng</th><th className={th}>Nội dung</th></tr>
            </thead>
            <tbody>
              {shown.map((a) => {
                const s = db.staff.find((x) => x.id === a.actorId);
                const has = !!a.changes?.length;
                const isOpen = open.has(a.id);
                return (
                  <Fragment key={a.id}>
                    <tr className={cx(has && "cursor-pointer", "hover:bg-slate-50/60")} onClick={() => has && toggle(a.id)}>
                      <td className={td}>
                        {has && <button aria-expanded={isOpen} aria-label="Xem chi tiết thay đổi" className="text-slate-400" onClick={(e) => { e.stopPropagation(); toggle(a.id); }}>
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>}
                      </td>
                      <td className={cx(td, "whitespace-nowrap tabular-nums text-slate-500")}>{fmtDateTime(a.at)}</td>
                      <td className={td}>
                        <div className="flex items-center gap-2">
                          <Avatar name={s?.fullName ?? "?"} size={24} />
                          <div className="leading-tight"><p className="text-sm font-medium text-slate-800">{s?.fullName ?? a.actorId}</p>{s && <p className="text-[11px] text-slate-400">{ROLE_LABEL[s.role]}</p>}</div>
                        </div>
                      </td>
                      <td className={td}><Badge className={ACTION[a.action].cls}>{ACTION[a.action].label}</Badge></td>
                      <td className={cx(td, "whitespace-nowrap")}>{ENTITY[a.entity]}</td>
                      <td className={td}>{a.summary}{has && <span className="ml-1 text-xs text-slate-400">({a.changes!.length} trường)</span>}</td>
                    </tr>
                    {has && isOpen && (
                      <tr>
                        <td className="border-b border-slate-100 bg-slate-50/70" colSpan={6}>
                          <ul className="space-y-1 px-12 py-2.5 text-sm">
                            {a.changes!.map((c, i) => (
                              <li key={i} className="flex flex-wrap items-center gap-1.5">
                                <span className="font-medium text-slate-700">{c.field}:</span>
                                <span className="rounded bg-rose-50 px-1.5 text-rose-700 line-through decoration-rose-300">{c.from || "—"}</span>
                                <span className="text-slate-400">→</span>
                                <span className="rounded bg-emerald-50 px-1.5 text-emerald-700">{c.to || "—"}</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
        )}
        <div className="flex items-center justify-between gap-2 px-4 py-3 text-sm text-slate-500">
          <span>{rows.length} hoạt động · Trang {cur + 1}/{pages}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Trước</Button>
            <Button variant="secondary" size="sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Sau</Button>
          </div>
        </div>
      </Card>
      <p className="text-xs text-slate-400">Nhật ký chỉ được ghi thêm, không ai sửa hoặc xóa được (ở bản chính thức được bảo vệ bằng trigger và RLS trên cơ sở dữ liệu).</p>
    </div>
  );
}
