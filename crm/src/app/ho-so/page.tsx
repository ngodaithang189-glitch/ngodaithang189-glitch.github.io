"use client";
import { FolderOpen, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import {
  Avatar, Badge, Button, Card, Drawer, Empty, Field, PageHeader, Progress, Select, Table, inputCls, td, th,
} from "@/components/ui";
import { DOC_STATUS, PROGRAM_LABEL, VISA_MAP, VISA_STAGES } from "@/lib/constants";
import { fmtDate, fmtDateTime, normalize, vnd } from "@/lib/format";
import { can, canSeeMoney, scopeCases } from "@/lib/permissions";
import { useStore } from "@/lib/store";
import type { DocStatus, StudentCase } from "@/lib/types";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CasesPage />
    </Suspense>
  );
}

const docProgress = (c: StudentCase) => c.documents.filter((d) => d.status === "verified").length / c.documents.length;

function CasesPage() {
  const { db, me } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get("open");
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("");
  const [program, setProgram] = useState("");
  const [stage, setStage] = useState("");
  const [officer, setOfficer] = useState("");

  const all = scopeCases(db, me);
  const staffName = (id: string) => db.staff.find((s) => s.id === id)?.fullName ?? "—";
  const officers = db.staff.filter((s) => s.role === "case_officer");

  const rows = useMemo(() => {
    const n = normalize(q.trim());
    return all
      .filter((c) => !n || normalize(`${c.fullName} ${c.code} ${c.school}`).includes(n))
      .filter((c) => !branch || c.branchId === branch)
      .filter((c) => !program || c.program === program)
      .filter((c) => !stage || c.visaStage === stage)
      .filter((c) => !officer || c.caseOfficerId === officer)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [all, q, branch, program, stage, officer]);

  const opened = openId ? db.cases.find((c) => c.id === openId) : undefined;
  const setOpen = (id?: string) => router.replace(id ? `/ho-so?open=${id}` : "/ho-so", { scroll: false });

  const missingTotal = all.reduce((s, c) => s + c.documents.filter((d) => d.status === "missing" || d.status === "rejected").length, 0);

  return (
    <>
      <PageHeader title="Hồ sơ du học" desc={`${all.length} hồ sơ · ${missingTotal} giấy tờ còn thiếu hoặc cần bổ sung`} />

      <Card className="mb-4 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên, mã hồ sơ, trường…" className={inputCls + " pl-9"} aria-label="Tìm hồ sơ" />
          </div>
          <Select value={branch} onChange={setBranch} placeholder="Tất cả chi nhánh" options={db.branches.map((b) => ({ value: b.id, label: b.name }))} />
          <Select value={program} onChange={setProgram} placeholder="Tất cả chương trình" options={Object.entries(PROGRAM_LABEL).map(([value, label]) => ({ value, label }))} />
          <Select value={stage} onChange={setStage} placeholder="Mọi tiến độ visa" options={VISA_STAGES.map((s) => ({ value: s.key, label: s.label }))} />
          <Select value={officer} onChange={setOfficer} placeholder="Mọi cán bộ hồ sơ" options={officers.map((s) => ({ value: s.id, label: s.fullName }))} />
        </div>
      </Card>

      <Card>
        {rows.length === 0 ? <Empty icon={<FolderOpen size={32} />} /> : (
          <>
            {/* Mobile: thẻ */}
            <div className="divide-y divide-slate-100 md:hidden">
              {rows.map((c) => {
                const missing = c.documents.filter((d) => d.status !== "verified" && d.status !== "submitted").length;
                return (
                  <button key={c.id} onClick={() => setOpen(c.id)} className="block w-full px-4 py-3 text-left hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-800">{c.fullName}</p>
                      <Badge className={VISA_MAP[c.visaStage].color}>{VISA_MAP[c.visaStage].label}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{c.code} · {c.school} · {c.intake}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={docProgress(c)} />
                      <span className="shrink-0 text-xs text-slate-500">{missing ? `thiếu ${missing}` : "đủ"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            {/* Desktop: bảng */}
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <th className={th}>Hồ sơ</th><th className={th}>Chương trình / Trường</th><th className={th}>Kỳ</th>
                    <th className={th}>Giấy tờ</th><th className={th}>Visa</th><th className={th}>Cán bộ hồ sơ</th><th className={th}>Cập nhật</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const verified = c.documents.filter((d) => d.status === "verified").length;
                    const missing = c.documents.filter((d) => d.status === "missing" || d.status === "rejected").length;
                    return (
                      <tr key={c.id} onClick={() => setOpen(c.id)} className="cursor-pointer hover:bg-slate-50">
                        <td className={td}><p className="font-medium text-slate-800">{c.fullName}</p><p className="text-xs text-slate-500">{c.code}</p></td>
                        <td className={td}><p>{PROGRAM_LABEL[c.program]}</p><p className="text-xs text-slate-500">{c.school}</p></td>
                        <td className={td}>{c.intake}</td>
                        <td className={td + " w-44"}>
                          <Progress value={verified / c.documents.length} />
                          <p className="mt-1 text-xs text-slate-500">{verified}/{c.documents.length} đã duyệt{missing ? <span className="text-rose-600"> · thiếu {missing}</span> : null}</p>
                        </td>
                        <td className={td}><Badge className={VISA_MAP[c.visaStage].color}>{VISA_MAP[c.visaStage].label}</Badge></td>
                        <td className={td}><span className="flex items-center gap-2"><Avatar name={staffName(c.caseOfficerId)} size={24} />{staffName(c.caseOfficerId)}</span></td>
                        <td className={td + " text-xs text-slate-500"}>{fmtDate(c.updatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </Card>

      {opened && <CaseDrawer key={opened.id} c={opened} onClose={() => setOpen()} />}
    </>
  );
}

function CaseDrawer({ c, onClose }: { c: StudentCase; onClose: () => void }) {
  const { db, me, actions } = useStore();
  const writable = can(me.role, "cases", "write");
  const [form, setForm] = useState({ school: c.school, intake: c.intake, caseOfficerId: c.caseOfficerId, visaStage: c.visaStage });
  const lead = db.leads.find((l) => l.id === c.leadId);
  const staffName = (id: string) => db.staff.find((s) => s.id === id)?.fullName ?? "—";
  const invoices = db.invoices.filter((i) => i.caseId === c.id);
  const paidOf = (id: string) => db.payments.filter((p) => p.invoiceId === id).reduce((s, p) => s + p.amount, 0);
  const total = invoices.reduce((s, i) => s + i.amount, 0);
  const paid = invoices.reduce((s, i) => s + paidOf(i.id), 0);
  const history = db.audit.filter((a) => a.entityId === c.id || a.entityId === c.leadId).slice(0, 20);
  const dirty = form.school !== c.school || form.intake !== c.intake || form.caseOfficerId !== c.caseOfficerId || form.visaStage !== c.visaStage;

  return (
    <Drawer open onClose={onClose} title={`${c.fullName} · ${c.code}`}
      subtitle={<span className="flex flex-wrap items-center gap-2"><Badge className={VISA_MAP[c.visaStage].color}>{VISA_MAP[c.visaStage].label}</Badge>{PROGRAM_LABEL[c.program]} · Visa {c.visaType}</span>}>
      <section className="grid gap-3 sm:grid-cols-2">
        <Info label="Tư vấn viên" value={staffName(c.counselorId)} />
        <Info label="Chi nhánh" value={db.branches.find((b) => b.id === c.branchId)?.name ?? "—"} />
        <Info label="Ngày mở hồ sơ" value={fmtDate(c.createdAt)} />
        <Info label="Dự kiến xuất cảnh" value={fmtDate(c.expectedDeparture)} />
        {lead && (
          <div className="sm:col-span-2">
            <Link href={`/khach-hang?open=${lead.id}`} className="text-sm font-medium text-brand-600 hover:underline">Xem khách hàng {lead.code} · {lead.phone} →</Link>
          </div>
        )}
      </section>

      <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-800">Thông tin xử lý</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Trường"><input className={inputCls} value={form.school} disabled={!writable} onChange={(e) => setForm({ ...form, school: e.target.value })} /></Field>
        <Field label="Kỳ nhập học"><input className={inputCls} value={form.intake} disabled={!writable} onChange={(e) => setForm({ ...form, intake: e.target.value })} /></Field>
        <Field label="Cán bộ hồ sơ">
          {writable ? <Select value={form.caseOfficerId} onChange={(v) => setForm({ ...form, caseOfficerId: v })} options={db.staff.filter((s) => s.role === "case_officer").map((s) => ({ value: s.id, label: s.fullName }))} />
            : <input className={inputCls} value={staffName(c.caseOfficerId)} disabled />}
        </Field>
        <Field label="Tiến độ visa">
          {writable ? <Select value={form.visaStage} onChange={(v) => setForm({ ...form, visaStage: v as StudentCase["visaStage"] })} options={VISA_STAGES.map((s) => ({ value: s.key, label: s.label }))} />
            : <input className={inputCls} value={VISA_MAP[c.visaStage].label} disabled />}
        </Field>
      </div>
      {writable && (
        <div className="mt-3 flex justify-end">
          <Button disabled={!dirty} onClick={() => actions.updateCase(c.id, form)}>Lưu thay đổi</Button>
        </div>
      )}

      <h3 className="mb-1 mt-6 text-sm font-semibold text-slate-800">Danh mục giấy tờ</h3>
      <p className="mb-2 text-xs text-amber-700">Danh mục mang tính tham khảo – cần cập nhật theo yêu cầu chính thức của trường/ĐSQ tại từng thời điểm.</p>
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {c.documents.map((d) => (
          <div key={d.key} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm text-slate-800">{d.label}</p>
              <p className="text-xs text-slate-400">{d.updatedAt ? `Cập nhật ${fmtDate(d.updatedAt)}` : "Chưa nộp"}</p>
            </div>
            {writable ? (
              <select aria-label={`Trạng thái ${d.label}`} value={d.status} onChange={(e) => actions.setDocStatus(c.id, d.key, e.target.value as DocStatus)}
                className={"h-8 rounded-md border-0 px-2 text-xs font-medium " + DOC_STATUS[d.status].color}>
                {Object.entries(DOC_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            ) : <Badge className={DOC_STATUS[d.status].color}>{DOC_STATUS[d.status].label}</Badge>}
          </div>
        ))}
      </div>

      {canSeeMoney(me.role) && (
        <>
          <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-800">Tài chính hồ sơ</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Info label="Phải thu" value={vnd(total)} />
            <Info label="Đã thu" value={<span className="text-emerald-600">{vnd(paid)}</span>} />
            <Info label="Còn lại" value={<span className={total - paid > 0 ? "text-rose-600" : ""}>{vnd(total - paid)}</span>} />
          </div>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {invoices.map((i) => <li key={i.id} className="flex justify-between gap-2"><span>{i.code} · {i.note ?? i.feeType}</span><span>{vnd(paidOf(i.id))} / {vnd(i.amount)}</span></li>)}
          </ul>
        </>
      )}

      <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-800">Lịch sử thay đổi</h3>
      {history.length === 0 ? <p className="text-sm text-slate-400">Chưa có thay đổi nào được ghi nhận.</p> : (
        <ol className="space-y-2">
          {history.map((a) => (
            <li key={a.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <p className="text-slate-700">{a.summary}</p>
              {a.changes?.map((ch, i) => <p key={i} className="text-xs text-slate-500">{ch.field}: {ch.from} → <b>{ch.to}</b></p>)}
              <p className="mt-0.5 text-xs text-slate-400">{staffName(a.actorId)} · {fmtDateTime(a.at)}</p>
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
