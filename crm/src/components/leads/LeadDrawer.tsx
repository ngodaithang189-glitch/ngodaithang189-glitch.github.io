"use client";
import { CalendarPlus, FolderOpen, MessageCircle, Pencil, Phone, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, Badge, Button, Drawer, Field, Select, Tabs, cx, inputCls } from "@/components/ui";
import { CHANNEL_LABEL, INTERACTION_LABEL, PROGRAM_LABEL, STAGES, STAGE_MAP } from "@/lib/constants";
import { fmtDate, fmtDateTime, relative } from "@/lib/format";
import { can } from "@/lib/permissions";
import { useStore } from "@/lib/store";
import type { InteractionType, LeadStage } from "@/lib/types";
import { LeadForm } from "./LeadForm";

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function LeadDrawer({ leadId, onClose }: { leadId: string | null; onClose: () => void }) {
  const { db, me, actions } = useStore();
  const lead = db.leads.find((l) => l.id === leadId);
  const [tab, setTab] = useState<"care" | "appt" | "history">("care");
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState<InteractionType>("call");
  const [content, setContent] = useState("");
  const [result, setResult] = useState("Tích cực");
  const [next, setNext] = useState(() => toLocalInput(new Date(Date.now() + 2 * 86400000)));
  const [apTitle, setApTitle] = useState("Tư vấn trực tiếp cùng phụ huynh");
  const [apAt, setApAt] = useState(() => { const d = new Date(Date.now() + 86400000); d.setHours(9, 0, 0, 0); return toLocalInput(d); });
  const [apLoc, setApLoc] = useState<"office" | "online" | "phone">("office");

  const timeline = useMemo(() => {
    if (!lead) return [];
    const its = db.interactions.filter((i) => i.leadId === lead.id).map((i) => ({ kind: "it" as const, at: i.createdAt, i }));
    const aps = db.appointments.filter((a) => a.leadId === lead.id).map((a) => ({ kind: "ap" as const, at: a.startAt, a }));
    return [...its, ...aps].sort((a, b) => b.at.localeCompare(a.at));
  }, [db.interactions, db.appointments, lead]);
  const logs = useMemo(() => db.audit.filter((a) => a.entityId === leadId), [db.audit, leadId]);

  if (!lead) return null;
  const writable = can(me.role, "leads", "write");
  const isManager = me.role === "director" || me.role === "branch_manager";
  const staffName = (id?: string) => db.staff.find((s) => s.id === id)?.fullName ?? "Chưa phân công";
  const relatedCase = db.cases.find((c) => c.leadId === lead.id);
  const overdue = lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) < new Date() && !["contract", "lost"].includes(lead.stage);

  const changeStage = (stage: LeadStage) => {
    if (stage === lead.stage) return;
    if (stage === "lost") {
      const reason = prompt("Lý do dừng chăm sóc? (VD: Chi phí cao, Chọn đơn vị khác…)");
      if (reason === null) return;
      actions.updateLead(lead.id, { stage, lostReason: reason || "Không rõ" });
      return;
    }
    if (stage === "contract" && !confirm(`Xác nhận ${lead.fullName} đã ký hợp đồng? Hệ thống sẽ tự mở hồ sơ du học và hóa đơn phí dịch vụ.`)) return;
    actions.updateLead(lead.id, { stage });
  };

  const saveCare = () => {
    if (!content.trim()) return;
    actions.addInteraction({ leadId: lead.id, type, content: content.trim(), result }, next ? new Date(next).toISOString() : undefined);
    setContent("");
  };

  return (
    <Drawer open onClose={onClose}
      title={<span className="flex items-center gap-2">{lead.fullName} <Badge className={STAGE_MAP[lead.stage].color}>{STAGE_MAP[lead.stage].label}</Badge></span>}
      subtitle={<>{lead.code} · {PROGRAM_LABEL[lead.program]} · tạo {fmtDate(lead.createdAt)}</>}>
      <div className="flex flex-wrap gap-2">
        <a href={`tel:${lead.phone}`}><Button size="sm" variant="secondary"><Phone size={14} /> Gọi {lead.phone}</Button></a>
        <a href={`https://zalo.me/${lead.phone.replace(/^0/, "84")}`} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="secondary"><MessageCircle size={14} /> Zalo</Button></a>
        {writable && <Button size="sm" variant="secondary" onClick={() => setEditing(true)}><Pencil size={14} /> Sửa thông tin</Button>}
        {relatedCase && <Link href={`/ho-so?open=${relatedCase.id}`}><Button size="sm" variant="secondary"><FolderOpen size={14} /> Hồ sơ {relatedCase.code}</Button></Link>}
        {isManager && (
          <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => { if (confirm(`Xóa khách hàng ${lead.fullName}? Thao tác được ghi vào nhật ký.`)) { actions.deleteLead(lead.id); onClose(); } }}>
            <Trash2 size={14} /> Xóa
          </Button>
        )}
      </div>

      {writable && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-slate-500">Chuyển giai đoạn</p>
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((s) => (
              <button key={s.key} onClick={() => changeStage(s.key)}
                className={cx("rounded-full border px-3 py-1 text-xs font-medium transition", lead.stage === s.key ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-300")}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
        {[
          ["Điện thoại", lead.phone], ["Email", lead.email ?? "—"], ["Năm sinh", lead.birthYear ?? "—"],
          ["Tỉnh/TP", lead.province], ["Kỳ nhập học", lead.targetIntake ?? "—"], ["Tiếng Hàn", lead.koreanLevel ?? "—"],
          ["Nguồn", CHANNEL_LABEL[lead.channel]], ["Chiến dịch", db.campaigns.find((c) => c.id === lead.campaignId)?.name ?? "—"],
          ["Chi nhánh", db.branches.find((b) => b.id === lead.branchId)?.name ?? "—"],
        ].map(([k, v]) => (
          <div key={String(k)} className="min-w-0"><dt className="text-xs text-slate-500">{k}</dt><dd className="truncate font-medium text-slate-800">{v}</dd></div>
        ))}
        <div className="min-w-0">
          <dt className="text-xs text-slate-500">Phụ trách</dt>
          {isManager ? (
            <select value={lead.ownerId ?? ""} onChange={(e) => actions.updateLead(lead.id, { ownerId: e.target.value || undefined })}
              className="mt-0.5 w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 text-sm">
              <option value="">Chưa phân công</option>
              {db.staff.filter((s) => s.role === "counselor" && s.branchId === lead.branchId).map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
          ) : <dd className="truncate font-medium text-slate-800">{staffName(lead.ownerId)}</dd>}
        </div>
        <div><dt className="text-xs text-slate-500">Lần liên hệ cuối</dt><dd className="font-medium text-slate-800">{relative(lead.lastContactAt)}</dd></div>
        <div><dt className="text-xs text-slate-500">Hẹn chăm sóc</dt><dd className={cx("font-medium", overdue ? "text-rose-600" : "text-slate-800")}>{fmtDateTime(lead.nextFollowUpAt)}{overdue && " (quá hạn)"}</dd></div>
        {lead.lostReason && <div className="col-span-2 sm:col-span-3"><dt className="text-xs text-slate-500">Lý do dừng</dt><dd className="font-medium text-rose-700">{lead.lostReason}</dd></div>}
        {lead.notes && <div className="col-span-2 sm:col-span-3"><dt className="text-xs text-slate-500">Ghi chú</dt><dd className="whitespace-pre-line text-slate-700">{lead.notes}</dd></div>}
      </dl>

      <div className="mt-5">
        <Tabs value={tab} onChange={setTab} items={[{ value: "care", label: "Chăm sóc" }, { value: "appt", label: "Đặt lịch hẹn" }, { value: "history", label: `Lịch sử sửa (${logs.length})` }]} />
      </div>

      {tab === "care" && writable && (
        <div className="mt-3 rounded-xl border border-slate-200 p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Select value={type} onChange={(v) => setType(v as InteractionType)} options={Object.entries(INTERACTION_LABEL).map(([value, label]) => ({ value, label }))} />
            <Select value={result} onChange={setResult} options={["Tích cực", "Cần theo dõi", "Chưa phản hồi", "Từ chối"].map((x) => ({ value: x, label: x }))} />
            <input type="datetime-local" className={inputCls} value={next} onChange={(e) => setNext(e.target.value)} title="Hẹn chăm sóc lần tới" />
          </div>
          <textarea className={inputCls + " mt-2 h-20 py-2"} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Nội dung trao đổi với khách / phụ huynh…" />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">Ô ngày giờ = lịch nhắc chăm sóc lần tới</span>
            <Button size="sm" onClick={saveCare} disabled={!content.trim()}><Save size={14} /> Lưu chăm sóc</Button>
          </div>
        </div>
      )}

      {tab === "appt" && (
        writable ? (
          <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
            <Field label="Nội dung"><input className={inputCls} value={apTitle} onChange={(e) => setApTitle(e.target.value)} /></Field>
            <Field label="Thời gian"><input type="datetime-local" className={inputCls} value={apAt} onChange={(e) => setApAt(e.target.value)} /></Field>
            <Field label="Hình thức">
              <Select value={apLoc} onChange={(v) => setApLoc(v as typeof apLoc)} options={[{ value: "office", label: "Tại văn phòng" }, { value: "online", label: "Online (Zoom/Meet)" }, { value: "phone", label: "Gọi điện" }]} />
            </Field>
            <div className="flex items-end">
              <Button className="w-full" onClick={() => actions.addAppointment({ leadId: lead.id, staffId: lead.ownerId ?? me.id, title: apTitle, startAt: new Date(apAt).toISOString(), location: apLoc })}>
                <CalendarPlus size={16} /> Đặt lịch
              </Button>
            </div>
          </div>
        ) : <p className="mt-3 text-sm text-slate-500">Bạn chỉ có quyền xem.</p>
      )}

      {tab !== "history" ? (
        <ol className="relative mt-4 space-y-4 border-l border-slate-200 pl-5">
          {timeline.length === 0 && <p className="text-sm text-slate-400">Chưa có lịch sử chăm sóc.</p>}
          {timeline.map((t) => t.kind === "it" ? (
            <li key={t.i.id} className="relative">
              <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge className="bg-brand-50 text-brand-700">{INTERACTION_LABEL[t.i.type]}</Badge>
                <span>{fmtDateTime(t.i.createdAt)}</span><span>·</span>
                <span className="inline-flex items-center gap-1"><Avatar name={staffName(t.i.staffId)} size={16} />{staffName(t.i.staffId)}</span>
                {t.i.result && <Badge>{t.i.result}</Badge>}
              </div>
              <p className="mt-1 text-sm text-slate-700">{t.i.content}</p>
            </li>
          ) : (
            <li key={t.a.id} className="relative">
              <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-amber-500" />
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge className="bg-amber-50 text-amber-700">Lịch hẹn</Badge><span>{fmtDateTime(t.a.startAt)}</span>
                <Badge className={t.a.status === "done" ? "bg-emerald-50 text-emerald-700" : t.a.status === "missed" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}>
                  {{ scheduled: "Sắp tới", done: "Đã gặp", missed: "Lỡ hẹn", cancelled: "Đã hủy" }[t.a.status]}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-700">{t.a.title}</p>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="mt-4 space-y-3">
          {logs.length === 0 && <p className="text-sm text-slate-400">Chưa có chỉnh sửa nào được ghi nhận.</p>}
          {logs.map((l) => (
            <li key={l.id} className="rounded-lg border border-slate-100 p-3 text-sm">
              <p className="text-xs text-slate-500">{fmtDateTime(l.at)} · {staffName(l.actorId)}</p>
              <p className="font-medium text-slate-800">{l.summary}</p>
              {l.changes?.map((c, i) => <p key={i} className="text-xs text-slate-600">{c.field}: <s className="text-slate-400">{c.from}</s> → <b>{c.to}</b></p>)}
            </li>
          ))}
        </ul>
      )}

      {editing && <LeadForm open onClose={() => setEditing(false)} initial={lead} />}
    </Drawer>
  );
}
