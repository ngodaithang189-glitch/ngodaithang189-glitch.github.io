"use client";
import { CalendarClock, Check, MapPin, Phone, Video, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, Badge, Button, Card, CardHeader, Empty, PageHeader, Select, StatCard, Tabs, cx } from "@/components/ui";
import { STAGE_MAP } from "@/lib/constants";
import { fmtTime, relative, sameDay } from "@/lib/format";
import { can, scopeLeads } from "@/lib/permissions";
import { useStore } from "@/lib/store";
import type { Appointment } from "@/lib/types";

const STATUS: Record<Appointment["status"], { label: string; cls: string }> = {
  scheduled: { label: "Sắp tới", cls: "bg-brand-50 text-brand-700" },
  done: { label: "Đã gặp", cls: "bg-emerald-50 text-emerald-700" },
  missed: { label: "Lỡ hẹn", cls: "bg-rose-50 text-rose-700" },
  cancelled: { label: "Đã hủy", cls: "bg-slate-100 text-slate-500" },
};
const LOC = { office: { label: "Văn phòng", icon: MapPin }, online: { label: "Online", icon: Video }, phone: { label: "Gọi điện", icon: Phone } };

export default function AppointmentsPage() {
  const { db, me, actions } = useStore();
  const [tab, setTab] = useState<"week" | "followup">("week");
  const [staff, setStaff] = useState("");
  const writable = can(me.role, "appointments", "write");
  const now = new Date();

  const leads = useMemo(() => {
    // Cán bộ hồ sơ được xem lịch của khách trong chi nhánh mình
    if (me.role === "case_officer") return db.leads.filter((l) => l.branchId === me.branchId);
    return scopeLeads(db, me);
  }, [db, me]);
  const leadMap = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const appts = db.appointments.filter((a) => leadMap.has(a.leadId) && (!staff || a.staffId === staff));

  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() + i - 1); d.setHours(0, 0, 0, 0); return d; });
  const followups = leads
    .filter((l) => l.nextFollowUpAt && !["contract", "lost"].includes(l.stage) && (!staff || l.ownerId === staff))
    .sort((a, b) => a.nextFollowUpAt!.localeCompare(b.nextFollowUpAt!));
  const overdue = followups.filter((l) => new Date(l.nextFollowUpAt!) < now);
  const today = appts.filter((a) => sameDay(new Date(a.startAt), now));
  const week = appts.filter((a) => { const t = new Date(a.startAt).getTime(); return t >= days[0].getTime() && t < days[6].getTime() + 86400000; });
  const missed = appts.filter((a) => a.status === "missed").length;
  const staffName = (id?: string) => db.staff.find((s) => s.id === id)?.fullName ?? "—";
  const staffOptions = db.staff.filter((s) => s.role === "counselor" && (me.role === "director" || s.branchId === me.branchId));

  return (
    <>
      <PageHeader title="Lịch hẹn & chăm sóc" desc="Lịch gặp khách trong tuần và danh sách nhắc chăm sóc theo hạn"
        actions={me.role !== "counselor" && <Select value={staff} onChange={setStaff} placeholder="Tất cả nhân viên" className="w-56" options={staffOptions.map((s) => ({ value: s.id, label: s.fullName }))} />} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Lịch hẹn hôm nay" value={today.length} icon={<CalendarClock size={16} />} />
        <StatCard label="Lịch hẹn 7 ngày" value={week.length} tone="slate" />
        <StatCard label="Quá hạn chăm sóc" value={overdue.length} tone="rose" sub="cần gọi lại ngay" />
        <StatCard label="Lỡ hẹn (lũy kế)" value={missed} tone="amber" />
      </div>

      <div className="mb-3"><Tabs value={tab} onChange={setTab} items={[{ value: "week", label: "Lịch tuần" }, { value: "followup", label: `Nhắc chăm sóc (${followups.length})` }]} /></div>

      {tab === "week" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          {days.map((d) => {
            const items = appts.filter((a) => sameDay(new Date(a.startAt), d)).sort((a, b) => a.startAt.localeCompare(b.startAt));
            const isToday = sameDay(d, now);
            return (
              <Card key={d.toISOString()} className={cx("flex flex-col", isToday && "ring-2 ring-brand-500")}>
                <div className={cx("border-b border-slate-100 px-3 py-2", isToday && "bg-brand-50")}>
                  <p className="text-xs font-semibold uppercase text-slate-500">{d.toLocaleDateString("vi-VN", { weekday: "long" })}</p>
                  <p className="text-sm font-bold text-slate-800">{d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}{isToday && " · Hôm nay"}</p>
                </div>
                <div className="flex-1 space-y-2 p-2">
                  {items.length === 0 && <p className="py-4 text-center text-xs text-slate-400">Trống</p>}
                  {items.map((a) => {
                    const l = leadMap.get(a.leadId)!;
                    const L = LOC[a.location];
                    return (
                      <div key={a.id} className="rounded-lg border border-slate-200 p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold tabular-nums text-brand-700">{fmtTime(a.startAt)}</span>
                          <Badge className={STATUS[a.status].cls}>{STATUS[a.status].label}</Badge>
                        </div>
                        <Link href={`/khach-hang?open=${l.id}`} className="mt-1 block truncate text-sm font-medium text-slate-800 hover:text-brand-700">{l.fullName}</Link>
                        <p className="truncate text-slate-500">{a.title}</p>
                        <p className="mt-1 flex items-center gap-1 text-slate-400"><L.icon size={12} /> {L.label} · {staffName(a.staffId)}</p>
                        {writable && a.status === "scheduled" && (
                          <div className="mt-2 flex gap-1">
                            <Button size="sm" variant="secondary" className="h-7 flex-1 px-1" onClick={() => actions.setAppointmentStatus(a.id, "done")}><Check size={12} /> Đã gặp</Button>
                            <Button size="sm" variant="ghost" className="h-7 px-1.5 text-rose-600" onClick={() => actions.setAppointmentStatus(a.id, "missed")} title="Lỡ hẹn"><X size={12} /></Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardHeader title="Danh sách nhắc chăm sóc" subtitle="Sắp xếp theo hạn – đỏ là đã quá hạn" />
          <ul className="divide-y divide-slate-100">
            {followups.length === 0 && <Empty />}
            {followups.slice(0, 100).map((l) => {
              const late = new Date(l.nextFollowUpAt!) < now;
              return (
                <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={staffName(l.ownerId)} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/khach-hang?open=${l.id}`} className="block truncate text-sm font-medium text-slate-800 hover:text-brand-700">{l.fullName}</Link>
                    <p className="truncate text-xs text-slate-500">{l.phone} · {staffName(l.ownerId)}</p>
                  </div>
                  <Badge className={STAGE_MAP[l.stage].color}>{STAGE_MAP[l.stage].label}</Badge>
                  <span className={cx("w-28 shrink-0 text-right text-xs font-medium", late ? "text-rose-600" : "text-slate-500")}>{relative(l.nextFollowUpAt)}</span>
                  <a href={`tel:${l.phone}`} className="hidden sm:block"><Button size="sm" variant="secondary"><Phone size={13} /> Gọi</Button></a>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
