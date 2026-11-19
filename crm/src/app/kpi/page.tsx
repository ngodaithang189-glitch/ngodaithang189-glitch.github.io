"use client";
import { Medal, Target, Trophy, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, axisProps, tooltipStyle } from "@/components/charts";
import { Avatar, Badge, Card, CardHeader, Empty, PageHeader, Progress, Select, StatCard, Table, Tabs, cx, td, th } from "@/components/ui";
import { pct, vndShort } from "@/lib/format";
import { canSeeMoney, scopeStaff } from "@/lib/permissions";
import { useStore } from "@/lib/store";

type Period = "this" | "last" | "3m";

function range(p: Period) {
  const n = new Date();
  if (p === "this") return { from: new Date(n.getFullYear(), n.getMonth(), 1), to: n, months: 1 };
  if (p === "last") return { from: new Date(n.getFullYear(), n.getMonth() - 1, 1), to: new Date(n.getFullYear(), n.getMonth(), 1), months: 1 };
  return { from: new Date(n.getFullYear(), n.getMonth() - 2, 1), to: n, months: 3 };
}

export default function KpiPage() {
  const { db, me, actions } = useStore();
  const [period, setPeriod] = useState<Period>("this");
  const [branch, setBranch] = useState("");
  const money = canSeeMoney(me.role);
  const isDirector = me.role === "director";

  const rows = useMemo(() => {
    const { from, to, months } = range(period);
    const inP = (s?: string) => !!s && new Date(s) >= from && new Date(s) < to;
    return scopeStaff(db, me)
      .filter((s) => s.role === "counselor" && (!branch || s.branchId === branch))
      .map((s) => {
        const leads = db.leads.filter((l) => l.ownerId === s.id && inP(l.createdAt));
        const contacted = leads.filter((l) => l.lastContactAt || l.stage !== "new").length;
        const inters = db.interactions.filter((i) => i.staffId === s.id && inP(i.createdAt)).length;
        const cases = db.cases.filter((c) => c.counselorId === s.id && inP(c.createdAt));
        const lost = leads.filter((l) => l.stage === "lost").length;
        const target = s.monthlyTarget * months;
        // Thời gian phản hồi: từ lúc tạo khách tới lần chăm sóc đầu tiên
        const resp = leads.map((l) => {
          const first = db.interactions.filter((i) => i.leadId === l.id).reduce<string | undefined>((m, i) => (!m || i.createdAt < m ? i.createdAt : m), undefined);
          return first ? (new Date(first).getTime() - new Date(l.createdAt).getTime()) / 3600000 : undefined;
        }).filter((x): x is number => x !== undefined && x >= 0);
        return {
          s, leads: leads.length, contacted, inters, contracts: cases.length, target,
          done: target ? cases.length / target : 0,
          conv: cases.length + lost ? cases.length / (cases.length + lost) : 0,
          revenue: cases.reduce((a, c) => a + c.contractValue, 0),
          resp: resp.length ? resp.reduce((a, b) => a + b, 0) / resp.length : undefined,
        };
      })
      .sort((a, b) => b.contracts - a.contracts || b.done - a.done);
  }, [db, me, period, branch]);

  const totals = rows.reduce((t, r) => ({ leads: t.leads + r.leads, contracts: t.contracts + r.contracts, target: t.target + r.target, revenue: t.revenue + r.revenue }), { leads: 0, contracts: 0, target: 0, revenue: 0 });
  const medal = ["bg-amber-100 text-amber-800", "bg-slate-200 text-slate-700", "bg-orange-100 text-orange-800"];
  const shortName = (n: string) => n.split(" ").slice(-2).join(" ");

  return (
    <div>
      <PageHeader title="KPI & hiệu suất nhân viên" desc="Đo lường kết quả tuyển sinh theo từng tư vấn viên so với chỉ tiêu."
        actions={
          <>
            {(isDirector || me.role === "accountant") && (
              <Select className="w-48" value={branch} onChange={setBranch} placeholder="Tất cả chi nhánh" options={db.branches.map((b) => ({ value: b.id, label: b.name }))} />
            )}
            <Tabs value={period} onChange={setPeriod} items={[{ value: "this", label: "Tháng này" }, { value: "last", label: "Tháng trước" }, { value: "3m", label: "3 tháng" }]} />
          </>
        } />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Khách được giao" value={totals.leads} icon={<Users size={16} />} />
        <StatCard label="Hợp đồng ký mới" value={totals.contracts} icon={<Trophy size={16} />} tone="green" />
        <StatCard label="Hoàn thành chỉ tiêu" value={totals.target ? pct(totals.contracts / totals.target) : "—"} sub={`${totals.contracts}/${totals.target} HĐ`} icon={<Target size={16} />} tone="amber" />
        {money
          ? <StatCard label="Doanh số hợp đồng" value={vndShort(totals.revenue)} icon={<Medal size={16} />} tone="slate" />
          : <StatCard label="Tỷ lệ chuyển đổi TB" value={rows.length ? pct(rows.reduce((a, r) => a + r.conv, 0) / rows.length) : "—"} icon={<Medal size={16} />} tone="slate" />}
      </div>

      {rows.length > 1 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {rows.slice(0, 3).map((r, i) => (
            <Card key={r.s.id} className="flex items-center gap-3 p-4">
              <span className={cx("flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold", medal[i])}>{i + 1}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{r.s.fullName}</p>
                <p className="text-xs text-slate-500">{r.contracts} HĐ · đạt {pct(r.done)} chỉ tiêu</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-5">
        <CardHeader title="Hợp đồng so với chỉ tiêu" subtitle="Theo kỳ đang chọn" />
        <div className="h-72 p-3">
          {rows.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows.map((r) => ({ name: shortName(r.s.fullName), "Hợp đồng": r.contracts, "Chỉ tiêu": r.target }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip {...tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Hợp đồng" fill={CHART.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Chỉ tiêu" fill={CHART.primarySoft} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card className="mt-5">
        <CardHeader title="Bảng KPI chi tiết" subtitle={isDirector ? "Giám đốc có thể sửa chỉ tiêu tháng trực tiếp trong bảng" : "Tỷ lệ chuyển đổi = HĐ / (HĐ + khách dừng) trong kỳ"} />
        {rows.length === 0 ? <Empty /> : (
          <Table>
            <thead>
              <tr>
                <th className={th}>#</th><th className={th}>Tư vấn viên</th><th className={th}>Khách nhận</th><th className={th}>Đã liên hệ</th>
                <th className={th}>Lượt chăm sóc</th><th className={th}>Hợp đồng</th><th className={th}>Chỉ tiêu/tháng</th><th className={th}>Hoàn thành</th>
                <th className={th}>Chuyển đổi</th>{money && <th className={th}>Doanh số HĐ</th>}<th className={th}>Phản hồi TB</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.s.id}>
                  <td className={td}>{i < 3 && rows.length > 1 ? <Badge className={medal[i]}>{i + 1}</Badge> : i + 1}</td>
                  <td className={td}>
                    <span className="flex items-center gap-2"><Avatar name={r.s.fullName} size={26} />
                      <span><span className="block font-medium text-slate-800">{r.s.fullName}</span><span className="text-xs text-slate-500">{db.branches.find((b) => b.id === r.s.branchId)?.name}</span></span>
                    </span>
                  </td>
                  <td className={cx(td, "tabular-nums")}>{r.leads}</td>
                  <td className={cx(td, "tabular-nums")}>{r.contacted}</td>
                  <td className={cx(td, "tabular-nums")}>{r.inters}</td>
                  <td className={cx(td, "font-semibold tabular-nums text-slate-900")}>{r.contracts}</td>
                  <td className={td}>
                    {isDirector ? (
                      <input type="number" min={0} max={50} aria-label={`Chỉ tiêu tháng của ${r.s.fullName}`} defaultValue={r.s.monthlyTarget}
                        onBlur={(e) => { const v = Math.max(0, Number(e.target.value) || 0); if (v !== r.s.monthlyTarget) actions.updateStaff(r.s.id, { monthlyTarget: v }); }}
                        className="h-8 w-16 rounded-md border border-slate-200 px-2 text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
                    ) : <span className="tabular-nums">{r.s.monthlyTarget}</span>}
                  </td>
                  <td className={cx(td, "w-36")}>
                    <span className="text-xs font-medium tabular-nums">{pct(r.done)}</span>
                    <Progress value={r.done} className="mt-1" />
                  </td>
                  <td className={cx(td, "tabular-nums")}>{pct(r.conv)}</td>
                  {money && <td className={cx(td, "tabular-nums")}>{vndShort(r.revenue)}</td>}
                  <td className={cx(td, "tabular-nums")}>{r.resp === undefined ? "—" : r.resp < 24 ? `${r.resp.toFixed(1)} giờ` : `${(r.resp / 24).toFixed(1)} ngày`}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
