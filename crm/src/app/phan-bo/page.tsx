"use client";
import { AlertTriangle, CheckCircle2, Eye, Save, Shuffle } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, Badge, Button, Card, CardHeader, Empty, Field, PageHeader, Progress, Table, cx, inputCls, td, th } from "@/components/ui";
import { activeLoad, conversionRate, planAssignment, type AssignmentResult } from "@/lib/assignment";
import { CHANNEL_LABEL, PROGRAM_LABEL, STRATEGY_LABEL } from "@/lib/constants";
import { pct, relative } from "@/lib/format";
import { can } from "@/lib/permissions";
import { useStore } from "@/lib/store";
import type { AssignmentSettings, AssignmentStrategy } from "@/lib/types";

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {desc && <span className="mt-0.5 block text-xs text-slate-500">{desc}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className={cx("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-brand-600" : "bg-slate-300")}>
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </label>
  );
}

export default function AssignmentPage() {
  const { db, me, actions } = useStore();
  const writable = can(me.role, "assignment", "write");
  const [form, setForm] = useState<AssignmentSettings>(db.assignment);
  const [preview, setPreview] = useState<{ results: AssignmentResult[]; lastIndex: Record<string, number> } | null>(null);
  const dirty = JSON.stringify({ ...form, lastIndex: 0 }) !== JSON.stringify({ ...db.assignment, lastIndex: 0 });

  const inScope = (branchId: string) => me.role === "director" || branchId === me.branchId;
  const unassigned = useMemo(
    () => db.leads.filter((l) => !l.ownerId && l.stage !== "lost" && l.stage !== "contract" && inScope(l.branchId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db.leads, me],
  );
  const counselors = db.staff.filter((s) => s.role === "counselor" && inScope(s.branchId));
  const staffName = (id?: string) => db.staff.find((s) => s.id === id)?.fullName ?? "—";
  const branchName = (id: string) => db.branches.find((b) => b.id === id)?.name ?? id;

  const now = Date.now();
  const slaViolations = db.leads.filter((l) => l.stage === "new" && !l.lastContactAt && inScope(l.branchId)
    && now - new Date(l.createdAt).getTime() > db.assignment.slaHours * 3600000)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const runPreview = () => setPreview(planAssignment(db, unassigned, { ...form, lastIndex: db.assignment.lastIndex }));
  const confirm = () => {
    if (!preview?.results.length) return;
    actions.applyAssignment(preview.results, preview.lastIndex);
    setPreview(null);
  };

  return (
    <div>
      <PageHeader title="Phân bổ khách hàng tự động"
        desc="Thiết lập quy tắc chia khách cho tư vấn viên, xem trước kết quả trước khi áp dụng."
        actions={writable && (
          <>
            <Button variant="secondary" onClick={runPreview} disabled={!unassigned.length}><Eye size={16} /> Xem trước phân bổ</Button>
            <Button onClick={confirm} disabled={!preview?.results.length}><CheckCircle2 size={16} /> Xác nhận phân bổ{preview ? ` (${preview.results.length})` : ""}</Button>
          </>
        )} />

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Cấu hình phân bổ" subtitle="Áp dụng cho khách mới nhập tay, nhập từ file và khi bấm phân bổ hàng loạt"
            action={writable && <Button size="sm" disabled={!dirty} onClick={() => actions.saveAssignmentSettings({ ...form, lastIndex: db.assignment.lastIndex })}><Save size={14} /> Lưu cấu hình</Button>} />
          <div className="space-y-4 p-4">
            <fieldset disabled={!writable}>
              <legend className="mb-2 text-xs font-medium text-slate-600">Chiến lược chia khách</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(STRATEGY_LABEL) as AssignmentStrategy[]).map((k) => (
                  <label key={k} className={cx("flex cursor-pointer gap-3 rounded-lg border p-3 transition",
                    form.strategy === k ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-slate-200 hover:bg-slate-50")}>
                    <input type="radio" name="strategy" className="mt-1 accent-brand-600" checked={form.strategy === k}
                      onChange={() => { setForm({ ...form, strategy: k }); setPreview(null); }} />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">{STRATEGY_LABEL[k].label}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{STRATEGY_LABEL[k].desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className={cx("grid gap-2 sm:grid-cols-2", !writable && "pointer-events-none opacity-70")}>
              <Toggle label="Chỉ chia trong cùng chi nhánh" desc="Khách thuộc chi nhánh nào giao cho tư vấn viên chi nhánh đó" checked={form.respectBranch} onChange={(v) => { setForm({ ...form, respectBranch: v }); setPreview(null); }} />
              <Toggle label="Giới hạn số khách tối đa" desc="Bỏ qua tư vấn viên đã đủ tải" checked={form.respectCapacity} onChange={(v) => { setForm({ ...form, respectCapacity: v }); setPreview(null); }} />
              <Toggle label="Tự động giao khách mới" desc="Khách vừa tạo / nhập file được giao ngay" checked={form.autoAssignNewLeads} onChange={(v) => setForm({ ...form, autoAssignNewLeads: v })} />
              <div className="rounded-lg border border-slate-200 p-3">
                <Field label="Thời hạn liên hệ lần đầu (SLA, giờ)" hint="Quá hạn sẽ hiện cảnh báo bên phải">
                  <input type="number" min={1} max={72} className={inputCls} value={form.slaHours}
                    onChange={(e) => setForm({ ...form, slaHours: Math.max(1, Number(e.target.value) || 1) })} />
                </Field>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-1.5"><AlertTriangle size={15} className="text-rose-500" /> Vi phạm SLA liên hệ</span>}
            subtitle={`Khách mới quá ${db.assignment.slaHours} giờ chưa được liên hệ`}
            action={<Badge className="bg-rose-100 text-rose-700">{slaViolations.length}</Badge>} />
          <div className="max-h-[340px] divide-y divide-slate-100 overflow-y-auto">
            {slaViolations.length === 0 ? <Empty text="Không có khách vi phạm 🎉" /> : slaViolations.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{l.fullName}</p>
                  <p className="truncate text-xs text-slate-500">{l.ownerId ? staffName(l.ownerId) : <span className="text-amber-600">Chưa giao</span>} · {branchName(l.branchId)}</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-rose-600">{relative(l.createdAt, now)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {preview && (
        <Card className="mt-5 border-brand-200">
          <CardHeader title={`Xem trước: ${preview.results.length}/${unassigned.length} khách sẽ được giao`}
            subtitle={preview.results.length < unassigned.length ? "Một số khách không có tư vấn viên phù hợp (hết tải hoặc chi nhánh không có người)" : "Kiểm tra rồi bấm Xác nhận phân bổ"}
            action={<Button size="sm" variant="ghost" onClick={() => setPreview(null)}>Hủy</Button>} />
          <Table>
            <thead><tr><th className={th}>Khách hàng</th><th className={th}>Chương trình</th><th className={th}>Tỉnh</th><th className={th}>→ Tư vấn viên</th><th className={th}>Lý do</th></tr></thead>
            <tbody>
              {preview.results.map((r) => {
                const l = db.leads.find((x) => x.id === r.leadId)!;
                return (
                  <tr key={r.leadId}>
                    <td className={td}><p className="font-medium text-slate-800">{l.fullName}</p><p className="text-xs text-slate-500">{l.code}</p></td>
                    <td className={td}>{PROGRAM_LABEL[l.program]}</td>
                    <td className={td}>{l.province}</td>
                    <td className={td}><span className="flex items-center gap-2"><Avatar name={staffName(r.staffId)} size={24} />{staffName(r.staffId)}</span></td>
                    <td className={cx(td, "text-xs text-slate-500")}>{r.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title={`Khách chưa được giao (${unassigned.length})`} subtitle="Sắp xếp theo thời gian tạo, cũ nhất lên đầu" />
          {unassigned.length === 0 ? <Empty icon={<Shuffle size={28} />} text="Tất cả khách đã có người phụ trách" /> : (
            <div className="max-h-[420px] overflow-y-auto">
              <Table>
                <thead><tr><th className={th}>Khách</th><th className={th}>Nguồn</th><th className={th}>Chi nhánh</th><th className={th}>Tạo lúc</th></tr></thead>
                <tbody>
                  {unassigned.map((l) => (
                    <tr key={l.id}>
                      <td className={td}><p className="font-medium text-slate-800">{l.fullName}</p><p className="text-xs text-slate-500">{l.province}</p></td>
                      <td className={td}>{CHANNEL_LABEL[l.channel]}</td>
                      <td className={td}>{branchName(l.branchId)}</td>
                      <td className={cx(td, "text-xs")}>{relative(l.createdAt, now)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Khối lượng công việc tư vấn viên" subtitle="Khách đang chăm sóc / tải tối đa · tỷ lệ chốt = HĐ / (HĐ + dừng)" />
          <Table>
            <thead><tr><th className={th}>Tư vấn viên</th><th className={th}>Chi nhánh</th><th className={th}>Đang chăm sóc</th><th className={th}>Tỷ lệ chốt</th></tr></thead>
            <tbody>
              {counselors.map((c) => {
                const load = activeLoad(db, c.id);
                return (
                  <tr key={c.id}>
                    <td className={td}><span className="flex items-center gap-2"><Avatar name={c.fullName} size={24} /><span className="font-medium text-slate-800">{c.fullName}</span></span></td>
                    <td className={cx(td, "text-xs")}>{branchName(c.branchId)}</td>
                    <td className={cx(td, "w-44")}>
                      <div className="flex items-center justify-between text-xs"><span className="tabular-nums">{load}/{c.maxActiveLeads}</span>{load >= c.maxActiveLeads && <Badge className="bg-rose-100 text-rose-700">Đủ tải</Badge>}</div>
                      <Progress invert value={load / c.maxActiveLeads} className="mt-1" />
                    </td>
                    <td className={cx(td, "tabular-nums")}>{pct(conversionRate(db, c.id))}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
