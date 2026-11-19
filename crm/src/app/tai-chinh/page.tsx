"use client";
import { Banknote, CircleAlert, Plus, Receipt, Search, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, axisProps, tooltipStyle } from "@/components/charts";
import {
  Badge, Button, Card, CardHeader, Empty, Field, Modal, PageHeader, Select, StatCard, Table, Tabs, inputCls, td, th,
} from "@/components/ui";
import { FEE_LABEL } from "@/lib/constants";
import { fmtDate, lastMonths, monthKey, monthLabel, normalize, vnd, vndShort } from "@/lib/format";
import { can } from "@/lib/permissions";
import { useStore } from "@/lib/store";
import type { FeeType, Invoice, Payment } from "@/lib/types";

type Status = "paid" | "partial" | "unpaid" | "overdue";
const STATUS: Record<Status, { label: string; color: string }> = {
  paid: { label: "Đã thu đủ", color: "bg-emerald-100 text-emerald-700" },
  partial: { label: "Thu một phần", color: "bg-amber-100 text-amber-800" },
  unpaid: { label: "Chưa thu", color: "bg-slate-100 text-slate-700" },
  overdue: { label: "Quá hạn", color: "bg-rose-100 text-rose-700" },
};
const METHOD: Record<Payment["method"], string> = { cash: "Tiền mặt", bank_transfer: "Chuyển khoản", card: "Thẻ" };

export default function FinancePage() {
  const { db, me } = useStore();
  const writable = can(me.role, "finance", "write");
  const [tab, setTab] = useState<"debt" | "payments">("debt");
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("");
  const [fee, setFee] = useState("");
  const [status, setStatus] = useState("");
  const [payFor, setPayFor] = useState<Invoice | null>(null);
  const [creating, setCreating] = useState(false);

  // Phạm vi: quản lý chi nhánh chỉ thấy hồ sơ của chi nhánh mình
  const cases = me.role === "branch_manager" ? db.cases.filter((c) => c.branchId === me.branchId) : db.cases;
  const caseMap = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);
  const invoices = db.invoices.filter((i) => caseMap.has(i.caseId));
  const invIds = new Set(invoices.map((i) => i.id));
  const payments = db.payments.filter((p) => invIds.has(p.invoiceId));

  const paidMap = useMemo(() => {
    const m = new Map<string, number>();
    payments.forEach((p) => m.set(p.invoiceId, (m.get(p.invoiceId) ?? 0) + p.amount));
    return m;
  }, [payments]);

  const now = Date.now();
  const rows = invoices.map((i) => {
    const paid = paidMap.get(i.id) ?? 0;
    const remaining = Math.max(0, i.amount - paid);
    const st: Status = remaining <= 0 ? "paid" : new Date(i.dueDate).getTime() < now ? "overdue" : paid > 0 ? "partial" : "unpaid";
    return { inv: i, c: caseMap.get(i.caseId)!, paid, remaining, st };
  });

  const total = rows.reduce((s, r) => s + r.inv.amount, 0);
  const collected = rows.reduce((s, r) => s + Math.min(r.paid, r.inv.amount), 0);
  const overdue = rows.filter((r) => r.st === "overdue");
  const overdueAmt = overdue.reduce((s, r) => s + r.remaining, 0);

  const months = lastMonths(6);
  const chart = months.map((m) => ({ month: monthLabel(m), value: payments.filter((p) => monthKey(p.paidAt) === m).reduce((s, p) => s + p.amount, 0) }));

  const n = normalize(q.trim());
  const filtered = rows
    .filter((r) => !n || normalize(`${r.c.fullName} ${r.c.code} ${r.inv.code}`).includes(n))
    .filter((r) => !branch || r.c.branchId === branch)
    .filter((r) => !fee || r.inv.feeType === fee)
    .filter((r) => !status || r.st === status)
    .sort((a, b) => ({ overdue: 0, partial: 1, unpaid: 2, paid: 3 }[a.st] - { overdue: 0, partial: 1, unpaid: 2, paid: 3 }[b.st]) || a.inv.dueDate.localeCompare(b.inv.dueDate));

  const payRows = [...payments].sort((a, b) => b.paidAt.localeCompare(a.paidAt))
    .map((p) => { const inv = invoices.find((i) => i.id === p.invoiceId)!; return { p, inv, c: caseMap.get(inv.caseId)! }; })
    .filter((r) => !n || normalize(`${r.c.fullName} ${r.c.code} ${r.inv.code} ${r.p.reference ?? ""}`).includes(n))
    .filter((r) => !branch || r.c.branchId === branch);

  const staffName = (id: string) => db.staff.find((s) => s.id === id)?.fullName ?? "—";

  return (
    <>
      <PageHeader title="Tài chính & công nợ" desc="Phí dịch vụ, học phí thu hộ, công nợ và lịch sử thanh toán"
        actions={writable && <Button onClick={() => setCreating(true)}><Plus size={16} /> Tạo khoản thu</Button>} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Tổng phải thu" value={vndShort(total)} sub={`${invoices.length} khoản`} icon={<Receipt size={16} />} />
        <StatCard label="Đã thu" value={vndShort(collected)} sub={total ? `${((collected / total) * 100).toFixed(0)}% tổng phải thu` : undefined} icon={<Banknote size={16} />} tone="green" />
        <StatCard label="Công nợ" value={vndShort(total - collected)} icon={<Wallet size={16} />} tone="amber" />
        <StatCard label="Quá hạn" value={vndShort(overdueAmt)} sub={`${overdue.length} khoản`} icon={<CircleAlert size={16} />} tone="rose" />
      </div>

      <Card className="mb-4">
        <CardHeader title="Doanh thu thực thu theo tháng" subtitle="6 tháng gần nhất (dữ liệu giả lập)" />
        <div className="h-64 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v: number) => vndShort(v)} width={56} />
              <Tooltip {...tooltipStyle} formatter={(v) => [vnd(Number(v)), "Đã thu"]} cursor={{ fill: "#f1f5f9" }} />
              <Bar dataKey="value" fill={CHART.primary} radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-3 lg:flex-row lg:items-center">
          <Tabs value={tab} onChange={setTab} items={[{ value: "debt", label: "Công nợ" }, { value: "payments", label: "Lịch sử thanh toán" }]} />
          <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên, mã HS, mã HĐ…" className={inputCls + " pl-9"} aria-label="Tìm kiếm" />
            </div>
            {me.role !== "branch_manager" && <Select value={branch} onChange={setBranch} placeholder="Tất cả chi nhánh" options={db.branches.map((b) => ({ value: b.id, label: b.name }))} />}
            {tab === "debt" && <Select value={fee} onChange={setFee} placeholder="Mọi loại phí" options={Object.entries(FEE_LABEL).map(([value, label]) => ({ value, label }))} />}
            {tab === "debt" && <Select value={status} onChange={setStatus} placeholder="Mọi trạng thái" options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))} />}
          </div>
        </div>

        {tab === "debt" ? (filtered.length === 0 ? <Empty /> : (
          <Table>
            <thead>
              <tr>
                <th className={th}>Hóa đơn</th><th className={th}>Học sinh</th><th className={th}>Loại phí</th>
                <th className={th + " text-right"}>Số tiền</th><th className={th + " text-right"}>Đã thu</th><th className={th + " text-right"}>Còn lại</th>
                <th className={th}>Hạn</th><th className={th}>Trạng thái</th>{writable && <th className={th} />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.inv.id} className="hover:bg-slate-50">
                  <td className={td}><p className="font-medium text-slate-800">{r.inv.code}</p>{r.inv.note && <p className="text-xs text-slate-500">{r.inv.note}</p>}</td>
                  <td className={td}><p>{r.c.fullName}</p><p className="text-xs text-slate-500">{r.c.code}</p></td>
                  <td className={td}>{FEE_LABEL[r.inv.feeType]}</td>
                  <td className={td + " text-right tabular-nums"}>{vnd(r.inv.amount)}</td>
                  <td className={td + " text-right tabular-nums text-emerald-700"}>{vnd(r.paid)}</td>
                  <td className={td + " text-right tabular-nums font-medium"}>{vnd(r.remaining)}</td>
                  <td className={td + " whitespace-nowrap text-xs"}>{fmtDate(r.inv.dueDate)}</td>
                  <td className={td}><Badge className={STATUS[r.st].color}>{STATUS[r.st].label}</Badge></td>
                  {writable && <td className={td}>{r.remaining > 0 && <Button size="sm" variant="secondary" onClick={() => setPayFor(r.inv)}>Ghi nhận thu</Button>}</td>}
                </tr>
              ))}
            </tbody>
          </Table>
        )) : (payRows.length === 0 ? <Empty /> : (
          <Table>
            <thead>
              <tr>
                <th className={th}>Ngày</th><th className={th}>Hóa đơn</th><th className={th}>Học sinh</th>
                <th className={th + " text-right"}>Số tiền</th><th className={th}>Hình thức</th><th className={th}>Mã GD</th><th className={th}>Người thu</th>
              </tr>
            </thead>
            <tbody>
              {payRows.map(({ p, inv, c }) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className={td + " whitespace-nowrap text-xs"}>{fmtDate(p.paidAt)}</td>
                  <td className={td}>{inv.code} <span className="text-xs text-slate-500">· {FEE_LABEL[inv.feeType]}</span></td>
                  <td className={td}>{c.fullName}</td>
                  <td className={td + " text-right font-medium tabular-nums text-emerald-700"}>{vnd(p.amount)}</td>
                  <td className={td}>{METHOD[p.method]}</td>
                  <td className={td + " text-xs text-slate-500"}>{p.reference ?? "—"}</td>
                  <td className={td + " text-xs"}>{staffName(p.receivedBy)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ))}
      </Card>

      {payFor && <PaymentModal inv={payFor} remaining={Math.max(0, payFor.amount - (paidMap.get(payFor.id) ?? 0))} onClose={() => setPayFor(null)} />}
      {creating && <InvoiceModal caseOptions={cases.map((c) => ({ value: c.id, label: `${c.code} – ${c.fullName}` }))} onClose={() => setCreating(false)} />}
    </>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

function PaymentModal({ inv, remaining, onClose }: { inv: Invoice; remaining: number; onClose: () => void }) {
  const { actions } = useStore();
  const [amount, setAmount] = useState(String(remaining));
  const [method, setMethod] = useState<Payment["method"]>("bank_transfer");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(today());
  const amt = Number(amount);
  const valid = amt > 0 && amt <= remaining && !!date;
  const submit = () => {
    if (!valid) return;
    actions.addPayment({ invoiceId: inv.id, amount: amt, method, reference: reference || undefined, paidAt: new Date(date + "T09:00:00").toISOString() });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={`Ghi nhận thu – ${inv.code}`}
      footer={<><Button variant="secondary" onClick={onClose}>Hủy</Button><Button disabled={!valid} onClick={submit}>Lưu thanh toán</Button></>}>
      <p className="mb-3 text-sm text-slate-600">Còn phải thu: <b>{vnd(remaining)}</b></p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Số tiền (đ)" required hint={amt > remaining ? "Vượt số còn phải thu" : vnd(amt || 0)}>
          <input type="number" min={0} className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Ngày thu" required><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Hình thức"><Select value={method} onChange={(v) => setMethod(v as Payment["method"])} options={Object.entries(METHOD).map(([value, label]) => ({ value, label }))} /></Field>
        <Field label="Mã giao dịch / số phiếu"><input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="VD: FT2611…" /></Field>
      </div>
    </Modal>
  );
}

function InvoiceModal({ caseOptions, onClose }: { caseOptions: { value: string; label: string }[]; onClose: () => void }) {
  const { actions } = useStore();
  const [caseId, setCaseId] = useState("");
  const [feeType, setFeeType] = useState<FeeType>("service");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(today());
  const [note, setNote] = useState("");
  const valid = !!caseId && Number(amount) > 0 && !!dueDate;
  const submit = () => {
    if (!valid) return;
    actions.addInvoice({ caseId, feeType, amount: Number(amount), dueDate: new Date(dueDate + "T23:59:00").toISOString(), note: note || undefined });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="Tạo khoản thu mới"
      footer={<><Button variant="secondary" onClick={onClose}>Hủy</Button><Button disabled={!valid} onClick={submit}>Tạo khoản thu</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Hồ sơ" required><Select value={caseId} onChange={setCaseId} placeholder="Chọn hồ sơ…" options={caseOptions} /></Field></div>
        <Field label="Loại phí"><Select value={feeType} onChange={(v) => setFeeType(v as FeeType)} options={Object.entries(FEE_LABEL).map(([value, label]) => ({ value, label }))} /></Field>
        <Field label="Số tiền (đ)" required hint={Number(amount) ? vnd(Number(amount)) : undefined}><input type="number" min={0} className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Hạn thanh toán" required><input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        <Field label="Ghi chú"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
