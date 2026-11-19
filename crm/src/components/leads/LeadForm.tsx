"use client";
import { useMemo, useState } from "react";
import { Button, Field, Modal, Select, inputCls } from "@/components/ui";
import { CHANNEL_LABEL, PROGRAM_LABEL, PROVINCES } from "@/lib/constants";
import { useStore } from "@/lib/store";
import type { Lead, Program, SourceChannel } from "@/lib/types";

export const PHONE_RE = /^(0|\+84)(3|5|7|8|9)\d{8}$/;
export const cleanPhone = (p: string) => p.replace(/[\s.\-()]/g, "");

type FormState = {
  fullName: string; phone: string; email: string; birthYear: string; province: string; program: Program;
  targetIntake: string; koreanLevel: string; channel: SourceChannel; campaignId: string; branchId: string;
  ownerId: string; priority: Lead["priority"]; notes: string;
};

export function LeadForm({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Lead }) {
  const { db, me, actions } = useStore();
  const isEdit = !!initial;
  const [f, setF] = useState<FormState>(() => ({
    fullName: initial?.fullName ?? "", phone: initial?.phone ?? "", email: initial?.email ?? "",
    birthYear: initial?.birthYear ? String(initial.birthYear) : "", province: initial?.province ?? db.branches.find((b) => b.id === me.branchId)?.city ?? "Hà Nội",
    program: initial?.program ?? "du_hoc_tieng", targetIntake: initial?.targetIntake ?? "", koreanLevel: initial?.koreanLevel ?? "Chưa học",
    channel: initial?.channel ?? "facebook_ads", campaignId: initial?.campaignId ?? "", branchId: initial?.branchId ?? me.branchId,
    ownerId: initial?.ownerId ?? (me.role === "counselor" ? me.id : ""), priority: initial?.priority ?? "medium", notes: initial?.notes ?? "",
  }));
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const phone = cleanPhone(f.phone);
  const errors = {
    fullName: f.fullName.trim().length < 2 ? "Vui lòng nhập họ tên" : "",
    phone: !PHONE_RE.test(phone) ? "Số điện thoại chưa đúng định dạng (VD: 0912345678)" : "",
    email: f.email && !/^\S+@\S+\.\S+$/.test(f.email) ? "Email chưa đúng định dạng" : "",
  };
  const duplicate = useMemo(() => {
    if (!PHONE_RE.test(phone)) return undefined;
    const n = phone.replace(/^\+84/, "0");
    return db.leads.find((l) => l.id !== initial?.id && cleanPhone(l.phone).replace(/^\+84/, "0") === n);
  }, [phone, db.leads, initial?.id]);
  const valid = !errors.fullName && !errors.phone && !errors.email;

  const counselors = db.staff.filter((s) => s.role === "counselor" && s.branchId === f.branchId);
  const canChooseBranch = me.role === "director";
  const canChooseOwner = me.role === "director" || me.role === "branch_manager";

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    const data = {
      fullName: f.fullName.trim().replace(/\s+/g, " "), phone, email: f.email.trim() || undefined,
      birthYear: f.birthYear ? Number(f.birthYear) : undefined, province: f.province, program: f.program,
      targetIntake: f.targetIntake || undefined, koreanLevel: f.koreanLevel, channel: f.channel, campaignId: f.campaignId || undefined,
      branchId: f.branchId, ownerId: f.ownerId || undefined, priority: f.priority, notes: f.notes.trim() || undefined,
    };
    if (isEdit) actions.updateLead(initial!.id, data);
    else actions.addLead(data);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Sửa thông tin – ${initial!.fullName}` : "Thêm khách hàng mới"} wide
      footer={<><Button variant="secondary" onClick={onClose}>Hủy</Button><Button onClick={submit}>{isEdit ? "Lưu thay đổi" : "Thêm khách hàng"}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Họ và tên" required>
          <input className={inputCls} value={f.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Nguyễn Văn A" autoFocus />
          {touched && errors.fullName && <span className="mt-1 block text-xs text-rose-600">{errors.fullName}</span>}
        </Field>
        <Field label="Số điện thoại" required>
          <input className={inputCls} value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0912 345 678" inputMode="tel" />
          {touched && errors.phone && <span className="mt-1 block text-xs text-rose-600">{errors.phone}</span>}
          {duplicate && <span className="mt-1 block text-xs text-amber-700">⚠ Trùng SĐT với {duplicate.fullName} ({duplicate.code}) – kiểm tra trước khi lưu.</span>}
        </Field>
        <Field label="Email"><input className={inputCls} value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="email@vidu.com" inputMode="email" />
          {touched && errors.email && <span className="mt-1 block text-xs text-rose-600">{errors.email}</span>}</Field>
        <Field label="Năm sinh"><input className={inputCls} value={f.birthYear} onChange={(e) => set("birthYear", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2007" inputMode="numeric" /></Field>
        <Field label="Tỉnh / Thành phố">
          <Select value={f.province} onChange={(v) => set("province", v)} options={PROVINCES.map((p) => ({ value: p, label: p }))} />
        </Field>
        <Field label="Chương trình quan tâm">
          <Select value={f.program} onChange={(v) => set("program", v as Program)} options={Object.entries(PROGRAM_LABEL).map(([value, label]) => ({ value, label }))} />
        </Field>
        <Field label="Kỳ nhập học dự kiến"><input className={inputCls} value={f.targetIntake} onChange={(e) => set("targetIntake", e.target.value)} placeholder="03/2027" /></Field>
        <Field label="Trình độ tiếng Hàn">
          <Select value={f.koreanLevel} onChange={(v) => set("koreanLevel", v)} options={["Chưa học", "Sơ cấp", "TOPIK 1", "TOPIK 2", "TOPIK 3", "TOPIK 4+"].map((x) => ({ value: x, label: x }))} />
        </Field>
        <Field label="Nguồn khách">
          <Select value={f.channel} onChange={(v) => { set("channel", v as SourceChannel); set("campaignId", ""); }} options={Object.entries(CHANNEL_LABEL).map(([value, label]) => ({ value, label }))} />
        </Field>
        <Field label="Chiến dịch">
          <Select value={f.campaignId} onChange={(v) => set("campaignId", v)} placeholder="— Không —" options={db.campaigns.filter((c) => c.channel === f.channel).map((c) => ({ value: c.id, label: c.name }))} />
        </Field>
        {canChooseBranch && (
          <Field label="Chi nhánh">
            <Select value={f.branchId} onChange={(v) => { set("branchId", v); set("ownerId", ""); }} options={db.branches.map((b) => ({ value: b.id, label: b.name }))} />
          </Field>
        )}
        {canChooseOwner && (
          <Field label="Nhân viên phụ trách" hint={!isEdit ? "Để trống → hệ thống tự phân bổ theo cấu hình" : undefined}>
            <Select value={f.ownerId} onChange={(v) => set("ownerId", v)} placeholder="— Tự động phân bổ —" options={counselors.map((s) => ({ value: s.id, label: s.fullName }))} />
          </Field>
        )}
        <Field label="Mức ưu tiên">
          <Select value={f.priority} onChange={(v) => set("priority", v as Lead["priority"])} options={[{ value: "high", label: "Cao" }, { value: "medium", label: "Trung bình" }, { value: "low", label: "Thấp" }]} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Ghi chú"><textarea className={inputCls + " h-20 py-2"} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Nhu cầu, hoàn cảnh gia đình, thời gian tiện liên hệ…" /></Field>
        </div>
      </div>
      {!isEdit && <p className="mt-3 text-xs text-slate-400">Khi lưu, khách sẽ được gắn với chi nhánh và ghi vào nhật ký hoạt động.</p>}
    </Modal>
  );
}
