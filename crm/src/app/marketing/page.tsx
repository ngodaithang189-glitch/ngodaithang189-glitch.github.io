"use client";
import { Info, Megaphone, PiggyBank, TrendingUp, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, axisProps, tooltipStyle } from "@/components/charts";
import { Card, CardHeader, Empty, PageHeader, Progress, Select, StatCard, Table, Tabs, cx, td, th } from "@/components/ui";
import { CHANNEL_LABEL } from "@/lib/constants";
import { lastMonths, monthKey, monthLabel, pct, vnd, vndShort } from "@/lib/format";
import { canSeeMoney } from "@/lib/permissions";
import { useStore } from "@/lib/store";
import type { SourceChannel } from "@/lib/types";

type Days = "30" | "90" | "180";

export default function MarketingPage() {
  const { db, me } = useStore();
  const [days, setDays] = useState<Days>("90");
  const [branch, setBranch] = useState(me.role === "branch_manager" ? me.branchId : "");
  const money = canSeeMoney(me.role);
  const lockBranch = me.role === "branch_manager";

  const data = useMemo(() => {
    const from = Date.now() - Number(days) * 86400000;
    const leads = db.leads.filter((l) => (!branch || l.branchId === branch) && new Date(l.createdAt).getTime() >= from);
    const leadIds = new Set(leads.map((l) => l.id));
    const cases = db.cases.filter((c) => leadIds.has(c.leadId));
    const leadById = new Map(db.leads.map((l) => [l.id, l]));
    // Chiến dịch có chạy trong khoảng thời gian đang xem
    const camps = db.campaigns.filter((c) => !c.endDate || new Date(c.endDate).getTime() >= from);

    const channels = (Object.keys(CHANNEL_LABEL) as SourceChannel[]).map((ch) => {
      const ls = leads.filter((l) => l.channel === ch);
      const cs = cases.filter((c) => leadById.get(c.leadId)?.channel === ch);
      const spent = camps.filter((c) => c.channel === ch).reduce((a, c) => a + c.spent, 0);
      const revenue = cs.reduce((a, c) => a + c.contractValue, 0);
      return {
        ch, label: CHANNEL_LABEL[ch], leads: ls.length, contracts: cs.length, conv: ls.length ? cs.length / ls.length : 0,
        spent, revenue, cpl: spent && ls.length ? spent / ls.length : undefined, cpa: spent && cs.length ? spent / cs.length : undefined,
        roi: spent ? (revenue - spent) / spent : undefined,
      };
    }).filter((r) => r.leads || r.spent).sort((a, b) => b.leads - a.leads);

    const months = lastMonths(6);
    const top = channels.slice(0, 4).map((c) => c.ch);
    const allRecent = db.leads.filter((l) => !branch || l.branchId === branch);
    const byMonth = months.map((m) => {
      const row: Record<string, string | number> = { month: monthLabel(m) };
      for (const ch of top) row[CHANNEL_LABEL[ch]] = allRecent.filter((l) => l.channel === ch && monthKey(l.createdAt) === m).length;
      row["Khác"] = allRecent.filter((l) => !top.includes(l.channel) && monthKey(l.createdAt) === m).length;
      return row;
    });

    const campaigns = camps.map((c) => {
      const ls = leads.filter((l) => l.campaignId === c.id);
      const cs = cases.filter((x) => leadById.get(x.leadId)?.campaignId === c.id);
      return { c, leads: ls.length, contracts: cs.length, cpl: ls.length ? c.spent / ls.length : undefined };
    });

    const totals = channels.reduce((t, r) => ({ leads: t.leads + r.leads, contracts: t.contracts + r.contracts, spent: t.spent + r.spent, revenue: t.revenue + r.revenue }), { leads: 0, contracts: 0, spent: 0, revenue: 0 });
    return { channels, byMonth, top, campaigns, totals };
  }, [db, days, branch]);

  const { channels, byMonth, top, campaigns, totals } = data;
  const seriesNames = [...top.map((c) => CHANNEL_LABEL[c]), "Khác"];
  const roiCls = (x?: number) => x === undefined ? "" : x >= 1 ? "text-emerald-600" : x >= 0 ? "text-amber-600" : "text-rose-600";

  return (
    <div>
      <PageHeader title="Nguồn khách & hiệu quả quảng cáo" desc="So sánh kênh nào mang về nhiều khách, nhiều hợp đồng và chi phí hợp lý nhất."
        actions={
          <>
            {!lockBranch && <Select className="w-48" value={branch} onChange={setBranch} placeholder="Tất cả chi nhánh" options={db.branches.map((b) => ({ value: b.id, label: b.name }))} />}
            <Tabs value={days} onChange={setDays} items={[{ value: "30", label: "30 ngày" }, { value: "90", label: "90 ngày" }, { value: "180", label: "180 ngày" }]} />
          </>
        } />

      <div className="mb-5 flex items-start gap-2 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2.5 text-xs text-brand-800">
        <Info size={15} className="mt-0.5 shrink-0" />
        <span>Chi phí quảng cáo hiện là <b>số liệu giả lập</b> nhập tay theo chiến dịch. Bản chính thức sẽ đồng bộ chi phí từ Facebook / TikTok / Google Ads và gắn mã chiến dịch (UTM) cho từng khách. Doanh số tính theo giá trị hợp đồng của khách có nguồn tương ứng.</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Khách mới trong kỳ" value={totals.leads} icon={<Users size={16} />} />
        <StatCard label="Hợp đồng từ khách trong kỳ" value={totals.contracts} sub={totals.leads ? `Chuyển đổi ${pct(totals.contracts / totals.leads, 1)}` : undefined} icon={<TrendingUp size={16} />} tone="green" />
        {money && <StatCard label="Chi phí quảng cáo" value={vndShort(totals.spent)} sub={totals.leads ? `CPL TB ${vndShort(totals.spent / totals.leads)}` : undefined} icon={<Megaphone size={16} />} tone="amber" />}
        {money && <StatCard label="ROI tổng" value={totals.spent ? pct((totals.revenue - totals.spent) / totals.spent) : "—"} sub={`Doanh số ${vndShort(totals.revenue)}`} icon={<PiggyBank size={16} />} tone="slate" />}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Cơ cấu khách theo nguồn" />
          <div className="h-72 p-2">
            {channels.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={channels.filter((c) => c.leads)} dataKey="leads" nameKey="label" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
                    {channels.filter((c) => c.leads).map((c, i) => <Cell key={c.ch} fill={CHART.series[i % CHART.series.length]} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v) => [`${v} khách`, ""]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="Khách mới theo tháng" subtitle="6 tháng gần nhất · 4 nguồn lớn nhất" />
          <div className="h-72 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byMonth} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip {...tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {seriesNames.map((n, i) => (
                  <Bar key={n} dataKey={n} stackId="a" fill={n === "Khác" ? CHART.slate : CHART.series[i]} radius={i === seriesNames.length - 1 ? [4, 4, 0, 0] : undefined} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader title="Hiệu quả theo kênh" subtitle="CPL = chi phí / khách · Chi phí/HĐ = chi phí / hợp đồng · ROI = (doanh số − chi phí) / chi phí" />
        {channels.length === 0 ? <Empty /> : (
          <Table>
            <thead>
              <tr>
                <th className={th}>Kênh</th><th className={th}>Khách</th><th className={th}>Hợp đồng</th><th className={th}>Chuyển đổi</th>
                {money && <><th className={th}>Chi phí</th><th className={th}>CPL</th><th className={th}>Chi phí/HĐ</th><th className={th}>Doanh số HĐ</th><th className={th}>ROI</th></>}
              </tr>
            </thead>
            <tbody>
              {channels.map((r, i) => (
                <tr key={r.ch}>
                  <td className={td}><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART.series[i % CHART.series.length] }} /><span className="font-medium text-slate-800">{r.label}</span></span></td>
                  <td className={cx(td, "tabular-nums")}>{r.leads}</td>
                  <td className={cx(td, "tabular-nums")}>{r.contracts}</td>
                  <td className={cx(td, "tabular-nums")}>{pct(r.conv, 1)}</td>
                  {money && <>
                    <td className={cx(td, "tabular-nums")}>{r.spent ? vndShort(r.spent) : <span className="text-slate-400">0 (tự nhiên)</span>}</td>
                    <td className={cx(td, "tabular-nums")}>{r.cpl ? vndShort(r.cpl) : "—"}</td>
                    <td className={cx(td, "tabular-nums")}>{r.cpa ? vndShort(r.cpa) : "—"}</td>
                    <td className={cx(td, "tabular-nums")}>{vndShort(r.revenue)}</td>
                    <td className={cx(td, "font-semibold tabular-nums", roiCls(r.roi))}>{r.roi === undefined ? "—" : pct(r.roi)}</td>
                  </>}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card className="mt-5">
        <CardHeader title="Chiến dịch quảng cáo" subtitle="Ngân sách đã tiêu và số khách mang về trong kỳ" />
        {campaigns.length === 0 ? <Empty text="Không có chiến dịch trong kỳ" /> : (
          <Table>
            <thead>
              <tr>
                <th className={th}>Chiến dịch</th><th className={th}>Kênh</th>{money && <th className={th}>Ngân sách / đã tiêu</th>}
                <th className={th}>Khách</th><th className={th}>Hợp đồng</th>{money && <th className={th}>CPL</th>}
              </tr>
            </thead>
            <tbody>
              {campaigns.map(({ c, leads, contracts, cpl }) => (
                <tr key={c.id}>
                  <td className={td}><p className="font-medium text-slate-800">{c.name}</p><p className="text-xs text-slate-500">Từ {new Date(c.startDate).toLocaleDateString("vi-VN")}{c.endDate ? ` đến ${new Date(c.endDate).toLocaleDateString("vi-VN")}` : " · đang chạy"}</p></td>
                  <td className={td}>{CHANNEL_LABEL[c.channel]}</td>
                  {money && (
                    <td className={cx(td, "w-56")}>
                      <div className="flex justify-between text-xs tabular-nums"><span>{vndShort(c.spent)}</span><span className="text-slate-400">/ {vndShort(c.budget)}</span></div>
                      <Progress invert value={c.spent / c.budget} className="mt-1" />
                    </td>
                  )}
                  <td className={cx(td, "tabular-nums")}>{leads}</td>
                  <td className={cx(td, "tabular-nums")}>{contracts}</td>
                  {money && <td className={cx(td, "tabular-nums")} title={cpl ? vnd(cpl) : undefined}>{cpl ? vndShort(cpl) : "—"}</td>}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
