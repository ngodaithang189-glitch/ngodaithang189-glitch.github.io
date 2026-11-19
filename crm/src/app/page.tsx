"use client";
import { AlertTriangle, CalendarClock, FileCheck2, FolderOpen, HandCoins, Plane, TrendingUp, UserPlus, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { CHART, axisProps, tooltipStyle } from "@/components/charts";
import { Avatar, Badge, Card, CardHeader, Empty, PageHeader, Progress, Select, StatCard } from "@/components/ui";
import { CHANNEL_LABEL, STAGES, VISA_MAP } from "@/lib/constants";
import { fmtTime, lastMonths, monthKey, monthLabel, pct, relative, sameDay, vndShort } from "@/lib/format";
import { canSeeMoney, scopeCases, scopeLeads } from "@/lib/permissions";
import { useStore } from "@/lib/store";

export default function DashboardPage() {
  const { db, me } = useStore();
  const [branch, setBranch] = useState("");
  const money = canSeeMoney(me.role);
  const now = new Date();

  const d = useMemo(() => {
    const byBranch = <T extends { branchId: string }>(arr: T[]) => (branch ? arr.filter((x) => x.branchId === branch) : arr);
    const leads = byBranch(scopeLeads(db, me));
    const cases = byBranch(scopeCases(db, me));
    const caseIds = new Set(cases.map((c) => c.id));
    const invoices = db.invoices.filter((i) => caseIds.has(i.caseId));
    const invIds = new Set(invoices.map((i) => i.id));
    const payments = db.payments.filter((p) => invIds.has(p.invoiceId));

    const thisM = monthKey(now.toISOString());
    const prevM = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString());
    const leadsIn = (m: string) => leads.filter((l) => monthKey(l.createdAt) === m).length;
    const casesIn = (m: string) => cases.filter((c) => monthKey(c.createdAt) === m).length;
    const revIn = (m: string) => payments.filter((p) => monthKey(p.paidAt) === m).reduce((s, p) => s + p.amount, 0);
    const trend = (a: number, b: number) => (b ? ((a - b) / b) * 100 : undefined);

    const decided = leads.filter((l) => l.stage === "contract" || l.stage === "lost").length;
    const conv = decided ? leads.filter((l) => l.stage === "contract").length / decided : 0;
    const totalDue = invoices.reduce((s, i) => s + i.amount, 0);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const overdueDebt = invoices.filter((i) => new Date(i.dueDate) < now).reduce((s, i) => {
      const paid = payments.filter((p) => p.invoiceId === i.id).reduce((a, p) => a + p.amount, 0);
      return s + Math.max(0, i.amount - paid);
    }, 0);
    const processing = cases.filter((c) => !["approved", "rejected", "departed"].includes(c.visaStage)).length;
    const ok = cases.filter((c) => c.visaStage === "approved" || c.visaStage === "departed").length;
    const fail = cases.filter((c) => c.visaStage === "rejected").length;

    const months = lastMonths(6, now).map((m) => ({ m: monthLabel(m), "Khách mới": leadsIn(m), "Hợp đồng": casesIn(m), "Doanh thu": revIn(m) }));
    const funnel = STAGES.filter((s) => s.key !== "lost").map((s) => ({ name: s.label, value: leads.filter((l) => l.stage === s.key).length }));
    const channels = Object.entries(CHANNEL_LABEL).map(([k, label]) => ({
      name: label,
      "Khách": leads.filter((l) => l.channel === k).length,
      "Hợp đồng": leads.filter((l) => l.channel === k && l.stage === "contract").length,
    })).filter((x) => x.Khách > 0).sort((a, b) => b.Khách - a.Khách);
    const branchRev = db.branches.filter((b) => !branch || b.id === branch).map((b) => {
      const ids = new Set(cases.filter((c) => c.branchId === b.id).map((c) => c.id));
      const inv = invoices.filter((i) => ids.has(i.caseId));
      const invSet = new Set(inv.map((i) => i.id));
      const paid = payments.filter((p) => invSet.has(p.invoiceId)).reduce((s, p) => s + p.amount, 0);
      return { name: b.name.replace("Chi nhánh ", "CN "), "Đã thu": paid, "Còn nợ": Math.max(0, inv.reduce((s, i) => s + i.amount, 0) - paid) };
    });

    const leadIds = new Set(leads.map((l) => l.id));
    const todayAppts = db.appointments.filter((a) => leadIds.has(a.leadId) && sameDay(new Date(a.startAt), now)).sort((a, b) => a.startAt.localeCompare(b.startAt));
    const overdue = leads.filter((l) => l.nextFollowUpAt && new Date(l.nextFollowUpAt) < now && !["contract", "lost"].includes(l.stage))
      .sort((a, b) => a.nextFollowUpAt!.localeCompare(b.nextFollowUpAt!));
    const unassigned = leads.filter((l) => !l.ownerId).length;

    const counselors = db.staff.filter((s) => s.role === "counselor" && (!branch || s.branchId === branch) && (me.role !== "counselor" || s.id === me.id));
    const top = counselors.map((s) => {
      const contracts = cases.filter((c) => c.counselorId === s.id && monthKey(c.createdAt) === thisM).length;
      return { s, contracts, rate: s.monthlyTarget ? contracts / s.monthlyTarget : 0, leads: leads.filter((l) => l.ownerId === s.id && monthKey(l.createdAt) === thisM).length };
    }).sort((a, b) => b.contracts - a.contracts || b.leads - a.leads).slice(0, 5);

    const attention = cases.filter((c) => !["approved", "departed", "rejected"].includes(c.visaStage))
      .map((c) => ({ c, missing: c.documents.filter((x) => x.status === "missing" || x.status === "rejected").length }))
      .filter((x) => x.missing > 0).sort((a, b) => b.missing - a.missing).slice(0, 5);

    return {
      kpi: {
        newLeads: leadsIn(thisM), newLeadsTrend: trend(leadsIn(thisM), leadsIn(prevM)),
        contracts: casesIn(thisM), contractsTrend: trend(casesIn(thisM), casesIn(prevM)),
        rev: revIn(thisM), revTrend: trend(revIn(thisM), revIn(prevM)),
        conv, debt: totalDue - totalPaid, overdueDebt, processing, visaRate: ok + fail ? ok / (ok + fail) : 0, ok, fail,
      },
      months, funnel, channels, branchRev, todayAppts, overdue, unassigned, top, attention,
    };
  }, [db, me, branch]); // eslint-disable-line react-hooks/exhaustive-deps

  const leadName = (id: string) => db.leads.find((l) => l.id === id)?.fullName ?? "—";
  const staffName = (id?: string) => db.staff.find((s) => s.id === id)?.fullName ?? "—";
  const greeting = now.getHours() < 12 ? "Chào buổi sáng" : now.getHours() < 18 ? "Chào buổi chiều" : "Chào buổi tối";

  return (
    <>
      <PageHeader
        title={`${greeting}, ${me.fullName.replace(/\s*\(.*\)/, "")}`}
        desc={`Tình hình tuyển sinh & hồ sơ tháng ${now.getMonth() + 1}/${now.getFullYear()} – cập nhật theo thời gian thực`}
        actions={me.role === "director" && (
          <Select value={branch} onChange={setBranch} placeholder="Tất cả chi nhánh" className="w-52"
            options={db.branches.map((b) => ({ value: b.id, label: b.name }))} />
        )}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Khách hàng mới tháng này" value={d.kpi.newLeads} trend={d.kpi.newLeadsTrend} sub="so với tháng trước" icon={<UserPlus size={16} />} />
        <StatCard label="Hợp đồng mới tháng này" value={d.kpi.contracts} trend={d.kpi.contractsTrend} sub="so với tháng trước" icon={<FileCheck2 size={16} />} tone="green" />
        <StatCard label="Tỷ lệ chuyển đổi" value={pct(d.kpi.conv)} sub="HĐ / (HĐ + dừng)" icon={<TrendingUp size={16} />} />
        {money ? (
          <StatCard label="Doanh thu đã thu tháng này" value={vndShort(d.kpi.rev)} trend={d.kpi.revTrend} sub="so với tháng trước" icon={<HandCoins size={16} />} tone="green" />
        ) : (
          <StatCard label="Khách quá hạn chăm sóc" value={d.overdue.length} sub="cần liên hệ ngay" icon={<AlertTriangle size={16} />} tone="rose" />
        )}
        {money && <StatCard label="Công nợ phải thu" value={vndShort(d.kpi.debt)} sub={<>quá hạn <b className="text-rose-600">{vndShort(d.kpi.overdueDebt)}</b></>} icon={<Wallet size={16} />} tone="amber" />}
        <StatCard label="Hồ sơ đang xử lý" value={d.kpi.processing} sub="chưa có kết quả visa" icon={<FolderOpen size={16} />} tone="slate" />
        <StatCard label="Tỷ lệ đỗ visa" value={pct(d.kpi.visaRate)} sub={`${d.kpi.ok} đỗ · ${d.kpi.fail} trượt`} icon={<Plane size={16} />} tone="green" />
        {money && <StatCard label="Khách quá hạn chăm sóc" value={d.overdue.length} sub={`${d.unassigned} khách chưa phân công`} icon={<AlertTriangle size={16} />} tone="rose" />}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Khách hàng mới & hợp đồng theo tháng" subtitle="6 tháng gần nhất" />
          <div className="h-72 p-3">
            <ResponsiveContainer>
              <ComposedChart data={d.months} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="m" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Khách mới" fill={CHART.primarySoft} radius={[6, 6, 0, 0]} maxBarSize={36} />
                <Line dataKey="Hợp đồng" stroke={CHART.green} strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Phễu tuyển sinh" subtitle="Số khách đang ở mỗi giai đoạn" />
          <div className="space-y-3 p-4">
            {d.funnel.map((f, i) => {
              const max = Math.max(...d.funnel.map((x) => x.value), 1);
              return (
                <div key={f.name}>
                  <div className="mb-1 flex justify-between text-xs"><span className="font-medium text-slate-600">{f.name}</span><span className="font-semibold tabular-nums text-slate-800">{f.value}</span></div>
                  <div className="h-6 overflow-hidden rounded-md bg-slate-100">
                    <div className="h-full rounded-md" style={{ width: `${(f.value / max) * 100}%`, background: CHART.series[i % CHART.series.length], opacity: 0.85 }} />
                  </div>
                </div>
              );
            })}
            <Link href="/khach-hang?view=kanban" className="block pt-1 text-xs font-medium text-brand-600 hover:underline">Mở bảng Kanban →</Link>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Hiệu quả nguồn khách" subtitle="Số khách và hợp đồng theo kênh" action={<Link href="/marketing" className="text-xs font-medium text-brand-600">Chi tiết</Link>} />
          <div className="h-72 p-3">
            <ResponsiveContainer>
              <BarChart data={d.channels} layout="vertical" margin={{ top: 4, right: 12, left: 24, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={CHART.grid} />
                <XAxis type="number" {...axisProps} allowDecimals={false} />
                <YAxis type="category" dataKey="name" {...axisProps} width={110} />
                <Tooltip {...tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Khách" fill={CHART.primarySoft} radius={[0, 4, 4, 0]} maxBarSize={14} />
                <Bar dataKey="Hợp đồng" fill={CHART.primary} radius={[0, 4, 4, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        {money ? (
          <Card>
            <CardHeader title="Doanh thu & công nợ theo chi nhánh" subtitle="Lũy kế các hồ sơ" action={<Link href="/tai-chinh" className="text-xs font-medium text-brand-600">Chi tiết</Link>} />
            <div className="h-72 p-3">
              <ResponsiveContainer>
                <BarChart data={d.branchRev} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="name" {...axisProps} />
                  <YAxis {...axisProps} tickFormatter={vndShort} />
                  <Tooltip {...tooltipStyle} formatter={(v) => vndShort(Number(v))} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Đã thu" stackId="a" fill={CHART.primary} maxBarSize={48} />
                  <Bar dataKey="Còn nợ" stackId="a" fill={CHART.amber} radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        ) : (
          <Card>
            <CardHeader title="Hồ sơ cần bổ sung giấy tờ" />
            <AttentionList items={d.attention} />
          </Card>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader title="Lịch hẹn hôm nay" subtitle={`${d.todayAppts.length} lịch`} action={<Link href="/lich-hen" className="text-xs font-medium text-brand-600">Tất cả</Link>} />
          <ul className="divide-y divide-slate-100">
            {d.todayAppts.length === 0 && <Empty text="Hôm nay chưa có lịch hẹn" icon={<CalendarClock size={22} />} />}
            {d.todayAppts.slice(0, 6).map((a) => (
              <li key={a.id} className="flex gap-3 px-4 py-2.5">
                <span className="mt-0.5 w-11 shrink-0 text-xs font-semibold tabular-nums text-brand-700">{fmtTime(a.startAt)}</span>
                <div className="min-w-0">
                  <Link href={`/khach-hang?open=${a.leadId}`} className="block truncate text-sm font-medium text-slate-800 hover:text-brand-700">{leadName(a.leadId)}</Link>
                  <p className="truncate text-xs text-slate-500">{a.title} · {staffName(a.staffId)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Quá hạn chăm sóc" subtitle="Cần liên hệ lại ngay" action={<Badge className="bg-rose-50 text-rose-700">{d.overdue.length}</Badge>} />
          <ul className="divide-y divide-slate-100">
            {d.overdue.length === 0 && <Empty text="Không có khách quá hạn" />}
            {d.overdue.slice(0, 6).map((l) => (
              <li key={l.id} className="px-4 py-2.5">
                <Link href={`/khach-hang?open=${l.id}`} className="block truncate text-sm font-medium text-slate-800 hover:text-brand-700">{l.fullName}</Link>
                <p className="truncate text-xs text-slate-500"><span className="text-rose-600">{relative(l.nextFollowUpAt)}</span> · {staffName(l.ownerId)}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Top tư vấn viên tháng này" subtitle="Theo số hợp đồng" action={<Link href="/kpi" className="text-xs font-medium text-brand-600">KPI</Link>} />
          <ul className="divide-y divide-slate-100">
            {d.top.length === 0 && <Empty />}
            {d.top.map((t, i) => (
              <li key={t.s.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-4 text-xs font-bold text-slate-400">{i + 1}</span>
                <Avatar name={t.s.fullName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{t.s.fullName}</p>
                  <div className="mt-1 flex items-center gap-2"><Progress value={t.rate} /><span className="shrink-0 text-[11px] tabular-nums text-slate-500">{t.contracts}/{t.s.monthlyTarget} HĐ</span></div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        {money ? (
          <Card>
            <CardHeader title="Hồ sơ cần bổ sung giấy tờ" action={<Link href="/ho-so" className="text-xs font-medium text-brand-600">Hồ sơ</Link>} />
            <AttentionList items={d.attention} />
          </Card>
        ) : (
          <Card>
            <CardHeader title="Gợi ý hôm nay" />
            <ul className="space-y-2 p-4 text-sm text-slate-600">
              <li>• Gọi lại {Math.min(d.overdue.length, 5)} khách quá hạn chăm sóc trước 10h.</li>
              <li>• Cập nhật kết quả sau mỗi cuộc gọi để hệ thống nhắc lịch tiếp theo.</li>
              <li>• Khách “Quan tâm cao” nên được hẹn gặp trực tiếp cùng phụ huynh.</li>
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}

function AttentionList({ items }: { items: { c: { id: string; fullName: string; code: string; visaStage: keyof typeof VISA_MAP }; missing: number }[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.length === 0 && <Empty text="Hồ sơ đầy đủ" />}
      {items.map(({ c, missing }) => (
        <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
          <div className="min-w-0">
            <Link href={`/ho-so?open=${c.id}`} className="block truncate text-sm font-medium text-slate-800 hover:text-brand-700">{c.fullName}</Link>
            <p className="text-xs text-slate-500">{c.code} · {VISA_MAP[c.visaStage].label}</p>
          </div>
          <Badge className="bg-amber-50 text-amber-700">Thiếu {missing}</Badge>
        </li>
      ))}
    </ul>
  );
}
