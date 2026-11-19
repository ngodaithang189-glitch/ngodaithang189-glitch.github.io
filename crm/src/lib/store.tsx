"use client";
// Kho dữ liệu phía trình duyệt cho bản DEMO (lưu ở localStorage).
// Mọi thao tác ghi đều đi qua các "action" bên dưới và tự sinh nhật ký (audit log).
// Giai đoạn 5 sẽ thay phần thân các action bằng lời gọi Supabase (server actions),
// giữ nguyên chữ ký hàm để giao diện không phải sửa.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { planAssignment } from "./assignment";
import { DOC_TEMPLATE, STAGE_MAP, VISA_MAP } from "./constants";
import { uid } from "./format";
import { generateMockDB } from "./mock-data";
import type {
  Appointment, AssignmentSettings, AuditLog, DB, DocStatus, Interaction, Invoice, Lead, LeadStage, Payment,
  Staff, StudentCase, VisaStage,
} from "./types";

const STORAGE_KEY = "duhocth-crm-demo-v1";
const ME_KEY = "duhocth-crm-demo-me";

type Toast = { id: string; text: string; tone: "success" | "error" | "info" };

const FIELD_LABEL: Record<string, string> = {
  fullName: "Họ tên", phone: "Điện thoại", email: "Email", province: "Tỉnh/TP", program: "Chương trình",
  stage: "Trạng thái", ownerId: "Phụ trách", branchId: "Chi nhánh", priority: "Ưu tiên", channel: "Nguồn",
  targetIntake: "Kỳ nhập học", koreanLevel: "Trình độ tiếng Hàn", notes: "Ghi chú", nextFollowUpAt: "Hẹn chăm sóc",
  school: "Trường", intake: "Kỳ nhập học", visaStage: "Tiến độ visa", caseOfficerId: "Cán bộ hồ sơ", contractValue: "Giá trị HĐ",
  monthlyTarget: "Chỉ tiêu tháng", active: "Hoạt động", role: "Vai trò", maxActiveLeads: "Tải tối đa",
};

function diff<T extends object>(before: T, patch: Partial<T>) {
  return Object.entries(patch)
    .filter(([k, v]) => String((before as Record<string, unknown>)[k] ?? "") !== String(v ?? ""))
    .map(([k, v]) => ({ field: FIELD_LABEL[k] ?? k, from: String((before as Record<string, unknown>)[k] ?? "—"), to: String(v ?? "—") }));
}

function useStoreImpl() {
  const [db, setDb] = useState<DB | null>(null);
  const [meId, setMeId] = useState<string>("st-gd");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dbRef = useRef<DB | null>(null);
  dbRef.current = db;

  useEffect(() => {
    let loaded: DB | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) loaded = JSON.parse(raw) as DB;
      const m = localStorage.getItem(ME_KEY);
      if (m) setMeId(m);
    } catch { /* bỏ qua: chế độ ẩn danh hoặc bị chặn lưu trữ */ }
    setDb(loaded ?? generateMockDB());
  }, []);

  useEffect(() => {
    if (!db) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch { /* ignore */ }
  }, [db]);

  const toast = useCallback((text: string, tone: Toast["tone"] = "success") => {
    const id = uid("t");
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  /** Áp dụng thay đổi + ghi nhật ký trong cùng một bước */
  const commit = useCallback((fn: (d: DB) => Omit<AuditLog, "id" | "at" | "actorId">[] | void) => {
    setDb((prev) => {
      if (!prev) return prev;
      const next: DB = structuredClone(prev);
      const logs = fn(next) || [];
      const now = new Date().toISOString();
      next.audit = [...logs.map((l) => ({ ...l, id: uid("au"), at: now, actorId: meIdRef.current })), ...next.audit].slice(0, 2000);
      return next;
    });
  }, []);
  const meIdRef = useRef(meId);
  meIdRef.current = meId;

  const setMe = useCallback((id: string) => {
    setMeId(id);
    try { localStorage.setItem(ME_KEY, id); } catch { /* ignore */ }
  }, []);

  const me: Staff | undefined = db?.staff.find((s) => s.id === meId) ?? db?.staff[0];

  const actions = useMemo(() => {
    const createCaseFromLead = (d: DB, lead: Lead): StudentCase => {
      const now = new Date().toISOString();
      const officer = d.staff.find((s) => s.role === "case_officer" && s.branchId === lead.branchId) ?? d.staff.find((s) => s.role === "case_officer")!;
      const isEps = lead.program === "lao_dong_eps";
      const c: StudentCase = {
        id: uid("hs"), code: `HS${2600 + d.cases.length + 1}`, leadId: lead.id, fullName: lead.fullName, branchId: lead.branchId,
        counselorId: lead.ownerId ?? meIdRef.current, caseOfficerId: officer.id, program: lead.program,
        school: isEps ? "Chương trình EPS" : "Chưa chọn trường", intake: lead.targetIntake ?? "Chưa xác định",
        visaType: { du_hoc_tieng: "D-4-1", dai_hoc: "D-2", cao_hoc: "D-2", nghe: "D-4-6", lao_dong_eps: "E-9" }[lead.program],
        visaStage: "preparing", documents: DOC_TEMPLATE.map((x) => ({ ...x, status: "missing" as DocStatus })),
        contractValue: isEps ? 50e6 : 80e6, createdAt: now, updatedAt: now,
      };
      d.cases.unshift(c);
      const due = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
      d.invoices.push(
        { id: uid("iv"), code: `HD${5000 + d.invoices.length + 1}`, caseId: c.id, feeType: "service", amount: c.contractValue / 2, dueDate: due(3), createdAt: now, note: "Đợt 1 – ký hợp đồng" },
        { id: uid("iv"), code: `HD${5000 + d.invoices.length + 2}`, caseId: c.id, feeType: "service", amount: c.contractValue / 2, dueDate: due(45), createdAt: now, note: "Đợt 2 – khi có thư mời / kết quả" },
      );
      return c;
    };

    return {
      resetDemo() {
        setDb(generateMockDB(Math.floor(Math.random() * 1e9)));
        toast("Đã khôi phục bộ dữ liệu mẫu mới", "info");
      },

      addLead(input: Omit<Lead, "id" | "code" | "createdAt" | "tags" | "stage"> & { tags?: string[]; stage?: LeadStage }) {
        const cur = dbRef.current;
        const willAuto = !!cur && !input.ownerId && cur.assignment.autoAssignNewLeads;
        const preview = willAuto ? planAssignment(cur!, [{ ...input, id: "tmp", code: "", createdAt: "", tags: [], stage: "new" }], cur!.assignment).results[0] : undefined;
        const assignedName = preview ? cur!.staff.find((s) => s.id === preview.staffId)?.fullName ?? "" : "";
        commit((d) => {
          const lead: Lead = { tags: [], stage: "new", ...input, id: uid("ld"), code: `KH${1000 + d.leads.length + 1}`, createdAt: new Date().toISOString() };
          const logs: Omit<AuditLog, "id" | "at" | "actorId">[] = [{ action: "create", entity: "lead", entityId: lead.id, summary: `Tạo khách hàng ${lead.fullName} (${lead.code})` }];
          if (!lead.ownerId && d.assignment.autoAssignNewLeads) {
            const { results, lastIndex } = planAssignment(d, [lead], d.assignment);
            if (results[0]) {
              lead.ownerId = results[0].staffId;
              d.assignment.lastIndex = lastIndex;
              const who = d.staff.find((s) => s.id === lead.ownerId)?.fullName ?? "";
              logs.push({ action: "assign", entity: "assignment", entityId: lead.id, summary: `Tự động giao ${lead.fullName} cho ${who}: ${results[0].reason}` });
            }
          }
          d.leads.unshift(lead);
          return logs;
        });
        toast(assignedName ? `Đã thêm khách hàng và tự động giao cho ${assignedName}` : "Đã thêm khách hàng");
      },

      updateLead(id: string, patch: Partial<Lead>) {
        const before = dbRef.current?.leads.find((x) => x.id === id);
        const opensCase = !!before && before.stage !== "contract" && patch.stage === "contract" && !dbRef.current!.cases.some((c) => c.leadId === id);
        commit((d) => {
          const l = d.leads.find((x) => x.id === id);
          if (!l) return;
          const changes = diff(l, patch).map((c) =>
            c.field === "Trạng thái" ? { ...c, from: STAGE_MAP[c.from as LeadStage]?.label ?? c.from, to: STAGE_MAP[c.to as LeadStage]?.label ?? c.to }
            : c.field === "Phụ trách" ? { ...c, from: d.staff.find((s) => s.id === c.from)?.fullName ?? c.from, to: d.staff.find((s) => s.id === c.to)?.fullName ?? c.to } : c);
          if (!changes.length) return;
          const wasContract = l.stage === "contract";
          Object.assign(l, patch);
          const logs: Omit<AuditLog, "id" | "at" | "actorId">[] = [{ action: "update", entity: "lead", entityId: id, summary: `Cập nhật khách hàng ${l.fullName}`, changes }];
          if (!wasContract && l.stage === "contract" && !d.cases.some((c) => c.leadId === l.id)) {
            const c = createCaseFromLead(d, l);
            logs.push({ action: "create", entity: "case", entityId: c.id, summary: `Tự động mở hồ sơ ${c.code} và 2 hóa đơn phí dịch vụ cho ${l.fullName}` });
          }
          return logs;
        });
        toast(opensCase ? "Đã ký HĐ → hệ thống tự mở hồ sơ du học và hóa đơn" : "Đã lưu thay đổi");
      },

      deleteLead(id: string) {
        commit((d) => {
          const l = d.leads.find((x) => x.id === id);
          d.leads = d.leads.filter((x) => x.id !== id);
          return [{ action: "delete", entity: "lead", entityId: id, summary: `Xóa khách hàng ${l?.fullName ?? id}` }];
        });
        toast("Đã xóa khách hàng", "info");
      },

      addInteraction(input: Omit<Interaction, "id" | "createdAt" | "staffId">, nextFollowUpAt?: string) {
        commit((d) => {
          const it: Interaction = { ...input, id: uid("it"), staffId: meIdRef.current, createdAt: new Date().toISOString() };
          d.interactions.unshift(it);
          const l = d.leads.find((x) => x.id === input.leadId);
          if (l) {
            l.lastContactAt = it.createdAt;
            if (nextFollowUpAt) l.nextFollowUpAt = nextFollowUpAt;
            if (l.stage === "new") l.stage = "contacted";
          }
          return [{ action: "create", entity: "interaction", entityId: it.id, summary: `Ghi nhận chăm sóc ${l?.fullName ?? ""}: ${input.content.slice(0, 60)}` }];
        });
        toast("Đã lưu lịch sử chăm sóc");
      },

      addAppointment(input: Omit<Appointment, "id" | "status">) {
        commit((d) => {
          const ap: Appointment = { ...input, id: uid("ap"), status: "scheduled" };
          d.appointments.push(ap);
          const l = d.leads.find((x) => x.id === input.leadId);
          if (l) l.nextFollowUpAt = input.startAt;
          return [{ action: "create", entity: "appointment", entityId: ap.id, summary: `Đặt lịch hẹn "${ap.title}" với ${l?.fullName ?? ""}` }];
        });
        toast("Đã đặt lịch hẹn");
      },

      setAppointmentStatus(id: string, status: Appointment["status"]) {
        commit((d) => {
          const a = d.appointments.find((x) => x.id === id);
          if (!a) return;
          const from = a.status;
          a.status = status;
          return [{ action: "update", entity: "appointment", entityId: id, summary: `Cập nhật lịch hẹn "${a.title}"`, changes: [{ field: "Trạng thái", from, to: status }] }];
        });
      },

      saveAssignmentSettings(s: Partial<AssignmentSettings>) {
        commit((d) => {
          d.assignment = { ...d.assignment, ...s };
          return [{ action: "update", entity: "assignment", summary: "Cập nhật cấu hình phân bổ tự động" }];
        });
        toast("Đã lưu cấu hình phân bổ");
      },

      applyAssignment(results: { leadId: string; staffId: string; reason: string }[], lastIndex?: Record<string, number>) {
        commit((d) => {
          for (const r of results) {
            const l = d.leads.find((x) => x.id === r.leadId);
            if (l) l.ownerId = r.staffId;
          }
          if (lastIndex) d.assignment.lastIndex = lastIndex;
          return [{ action: "assign", entity: "assignment", summary: `Phân bổ ${results.length} khách hàng theo chiến lược ${d.assignment.strategy}` }];
        });
        toast(`Đã phân bổ ${results.length} khách hàng`);
      },

      updateCase(id: string, patch: Partial<StudentCase>) {
        commit((d) => {
          const c = d.cases.find((x) => x.id === id);
          if (!c) return;
          const changes = diff(c, patch).map((x) => x.field === "Tiến độ visa" ? { ...x, from: VISA_MAP[x.from as VisaStage]?.label ?? x.from, to: VISA_MAP[x.to as VisaStage]?.label ?? x.to } : x);
          if (!changes.length) return;
          Object.assign(c, patch, { updatedAt: new Date().toISOString() });
          return [{ action: "update", entity: "case", entityId: id, summary: `Cập nhật hồ sơ ${c.code} – ${c.fullName}`, changes }];
        });
        toast("Đã cập nhật hồ sơ");
      },

      setDocStatus(caseId: string, key: string, status: DocStatus) {
        commit((d) => {
          const c = d.cases.find((x) => x.id === caseId);
          const doc = c?.documents.find((x) => x.key === key);
          if (!c || !doc) return;
          const from = doc.status;
          doc.status = status;
          doc.updatedAt = new Date().toISOString();
          c.updatedAt = doc.updatedAt;
          return [{ action: "update", entity: "case", entityId: caseId, summary: `Hồ sơ ${c.code}: giấy tờ "${doc.label}"`, changes: [{ field: "Trạng thái giấy tờ", from, to: status }] }];
        });
      },

      addInvoice(input: Omit<Invoice, "id" | "code" | "createdAt">) {
        commit((d) => {
          const inv: Invoice = { ...input, id: uid("iv"), code: `HD${5000 + d.invoices.length + 1}`, createdAt: new Date().toISOString() };
          d.invoices.push(inv);
          return [{ action: "create", entity: "invoice", entityId: inv.id, summary: `Tạo hóa đơn ${inv.code}` }];
        });
        toast("Đã tạo khoản phải thu");
      },

      addPayment(input: Omit<Payment, "id" | "receivedBy">) {
        commit((d) => {
          const p: Payment = { ...input, id: uid("pm"), receivedBy: meIdRef.current };
          d.payments.push(p);
          const inv = d.invoices.find((x) => x.id === input.invoiceId);
          return [{ action: "payment", entity: "payment", entityId: p.id, summary: `Thu ${new Intl.NumberFormat("vi-VN").format(p.amount)} đ cho hóa đơn ${inv?.code ?? ""}` }];
        });
        toast("Đã ghi nhận thanh toán");
      },

      importLeads(rows: Omit<Lead, "id" | "code" | "createdAt">[]) {
        commit((d) => {
          const now = new Date().toISOString();
          const newLeads = rows.map((r, i) => ({ ...r, id: uid("ld"), code: `KH${1000 + d.leads.length + i + 1}`, createdAt: now }));
          if (d.assignment.autoAssignNewLeads) {
            const { results, lastIndex } = planAssignment(d, newLeads.filter((l) => !l.ownerId), d.assignment);
            for (const r of results) { const l = newLeads.find((x) => x.id === r.leadId); if (l) l.ownerId = r.staffId; }
            d.assignment.lastIndex = lastIndex;
          }
          d.leads = [...newLeads, ...d.leads];
          return [{ action: "import", entity: "lead", summary: `Nhập ${rows.length} khách hàng từ file` }];
        });
        toast(`Đã nhập ${rows.length} khách hàng`);
      },

      logExport(what: string, count: number) {
        commit(() => [{ action: "export", entity: "system", summary: `Xuất ${count} dòng dữ liệu ${what}` }]);
      },

      updateStaff(id: string, patch: Partial<Staff>) {
        commit((d) => {
          const s = d.staff.find((x) => x.id === id);
          if (!s) return;
          const changes = diff(s, patch);
          if (!changes.length) return;
          Object.assign(s, patch);
          return [{ action: "update", entity: "staff", entityId: id, summary: `Cập nhật nhân sự ${s.fullName}`, changes }];
        });
        toast("Đã cập nhật nhân sự");
      },
    };
  }, [commit, toast]);

  return { db, me, meId, setMe, actions, toasts, toast };
}

type StoreValue = ReturnType<typeof useStoreImpl>;
const Ctx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const v = useStoreImpl();
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

/** Dùng trong các trang: chỉ gọi sau khi AppShell đảm bảo db đã sẵn sàng */
export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore phải nằm trong StoreProvider");
  return v as StoreValue & { db: DB; me: Staff };
}
