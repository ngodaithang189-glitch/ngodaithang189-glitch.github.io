// Bộ sinh dữ liệu GIẢ LẬP phục vụ demo. Toàn bộ tên người, số điện thoại, số tiền
// đều là ngẫu nhiên, không phản ánh khách hàng hay số liệu thật của doanh nghiệp.
import { DOC_TEMPLATE, PROVINCES } from "./constants";
import type {
  Appointment, AuditLog, Branch, Campaign, DB, Interaction, Invoice, Lead, LeadStage, Payment, Program,
  SourceChannel, Staff, StudentCase, VisaStage,
} from "./types";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HO = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Đỗ", "Ngô", "Dương", "Lý"];
const DEM = ["Văn", "Thị", "Đức", "Minh", "Thu", "Hải", "Ngọc", "Quang", "Thanh", "Phương", "Gia", "Bảo"];
const TEN = ["An", "Bình", "Châu", "Dũng", "Giang", "Hà", "Hiếu", "Hùng", "Huyền", "Khánh", "Linh", "Long",
  "Mai", "Nam", "Nhung", "Phúc", "Quân", "Sơn", "Tâm", "Thảo", "Trang", "Tuấn", "Vy", "Yến", "Đạt", "Hương"];

const SCHOOLS = ["ĐH Kyung Hee", "ĐH Hanyang", "ĐH Sejong", "ĐH Konkuk", "ĐH Dong-A", "ĐH Keimyung",
  "ĐH Quốc gia Chungbuk", "ĐH Quốc gia Pukyong", "ĐH Woosong", "ĐH Daejin", "Cao đẳng Yeungjin"];

const INTAKES = ["03/2027", "06/2027", "09/2027", "12/2026"];

const DAY = 86400000;

export function generateMockDB(seed = 20261119, now = Date.now()): DB {
  const r = mulberry32(seed);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)];
  const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const iso = (t: number) => new Date(t).toISOString();
  const name = () => `${pick(HO)} ${pick(DEM)} ${pick(TEN)}`;
  const phone = () => `09${int(10, 99)}${String(int(0, 999999)).padStart(6, "0")}`;
  const weighted = <T,>(items: [T, number][]) => {
    const total = items.reduce((s, [, w]) => s + w, 0);
    let x = r() * total;
    for (const [v, w] of items) { if ((x -= w) <= 0) return v; }
    return items[0][0];
  };

  const branches: Branch[] = [
    { id: "br-hn", name: "Trụ sở Hà Nội", city: "Hà Nội" },
    { id: "br-hp", name: "Chi nhánh Hải Phòng", city: "Hải Phòng" },
    { id: "br-na", name: "Chi nhánh Nghệ An", city: "Nghệ An" },
  ];

  const staffSpec: [string, Staff["role"], string][] = [
    ["st-gd", "director", "br-hn"],
    ["st-ql1", "branch_manager", "br-hn"], ["st-ql2", "branch_manager", "br-hp"], ["st-ql3", "branch_manager", "br-na"],
    ["st-tv1", "counselor", "br-hn"], ["st-tv2", "counselor", "br-hn"], ["st-tv3", "counselor", "br-hn"],
    ["st-tv4", "counselor", "br-hp"], ["st-tv5", "counselor", "br-hp"],
    ["st-tv6", "counselor", "br-na"], ["st-tv7", "counselor", "br-na"],
    ["st-kt1", "accountant", "br-hn"], ["st-hs1", "case_officer", "br-hn"], ["st-hs2", "case_officer", "br-na"],
  ];
  const staff: Staff[] = staffSpec.map(([id, role, branchId]) => ({
    id, role, branchId,
    fullName: id === "st-gd" ? "Thầy Thắng (Giám đốc)" : name(),
    phone: phone(),
    email: `${id}@demo.duhocth.local`,
    active: true,
    monthlyTarget: role === "counselor" ? int(4, 8) : 0,
    maxActiveLeads: role === "counselor" ? 40 : 0,
  }));
  branches[0].managerId = "st-ql1"; branches[1].managerId = "st-ql2"; branches[2].managerId = "st-ql3";
  const counselors = staff.filter((s) => s.role === "counselor");
  const officers = staff.filter((s) => s.role === "case_officer");

  const campaigns: Campaign[] = [
    { id: "cp-1", name: "FB – Du học tiếng kỳ 03/2027", channel: "facebook_ads", startDate: iso(now - 120 * DAY), budget: 60e6, spent: 48.5e6 },
    { id: "cp-2", name: "FB – Lao động EPS", channel: "facebook_ads", startDate: iso(now - 90 * DAY), budget: 40e6, spent: 31.2e6 },
    { id: "cp-3", name: "TikTok – Vlog du học sinh", channel: "tiktok_ads", startDate: iso(now - 75 * DAY), budget: 30e6, spent: 22.8e6 },
    { id: "cp-4", name: "Google – Từ khóa du học Hàn", channel: "google_ads", startDate: iso(now - 150 * DAY), budget: 45e6, spent: 41.0e6 },
    { id: "cp-5", name: "Hội thảo THPT tháng 10", channel: "event", startDate: iso(now - 40 * DAY), endDate: iso(now - 38 * DAY), budget: 15e6, spent: 14.2e6 },
  ];
  const campaignByChannel = (c: SourceChannel) => campaigns.filter((x) => x.channel === c);

  const leads: Lead[] = [];
  const interactions: Interaction[] = [];
  const appointments: Appointment[] = [];
  const N = 180;
  for (let i = 0; i < N; i++) {
    const createdT = now - Math.pow(r(), 1.3) * 180 * DAY;
    const channel = weighted<SourceChannel>([["facebook_ads", 30], ["tiktok_ads", 14], ["google_ads", 12], ["zalo", 10],
      ["website", 8], ["referral", 12], ["event", 6], ["walk_in", 4], ["school_partner", 4]]);
    const program = weighted<Program>([["du_hoc_tieng", 45], ["dai_hoc", 15], ["cao_hoc", 5], ["nghe", 10], ["lao_dong_eps", 25]]);
    const branch = weighted([[branches[0], 50], [branches[1], 25], [branches[2], 25]] as [Branch, number][]);
    const ageDays = (now - createdT) / DAY;
    let stage: LeadStage;
    if (ageDays < 3) stage = weighted<LeadStage>([["new", 70], ["contacted", 30]]);
    else stage = weighted<LeadStage>([["new", 5], ["contacted", 20], ["consulting", 25], ["interested", 15], ["contract", 18], ["lost", 17]]);
    const branchCounselors = counselors.filter((c) => c.branchId === branch.id);
    const unassigned = stage === "new" && r() < 0.45;
    const owner = unassigned ? undefined : pick(branchCounselors);
    const camps = campaignByChannel(channel);
    const lead: Lead = {
      id: `ld-${i + 1}`,
      code: `KH${String(1000 + i + 1)}`,
      fullName: name(),
      phone: phone(),
      email: r() < 0.5 ? `khach${i + 1}@example.com` : undefined,
      birthYear: program === "lao_dong_eps" ? int(1990, 2004) : int(2003, 2009),
      province: r() < 0.6 ? branch.city : pick(PROVINCES),
      program,
      targetIntake: pick(INTAKES),
      koreanLevel: pick(["Chưa học", "Chưa học", "Sơ cấp", "TOPIK 1", "TOPIK 2", "TOPIK 3"]),
      channel,
      campaignId: camps.length ? pick(camps).id : undefined,
      branchId: branch.id,
      ownerId: owner?.id,
      stage,
      priority: weighted([["high", 25], ["medium", 50], ["low", 25]] as ["high" | "medium" | "low", number][]),
      lostReason: stage === "lost" ? pick(["Chi phí cao", "Gia đình chưa đồng ý", "Chọn đơn vị khác", "Không liên lạc được", "Hoãn kế hoạch"]) : undefined,
      tags: r() < 0.3 ? [pick(["Học bổng", "Phụ huynh quyết định", "Cần vay vốn", "Đã có TOPIK", "Gấp"])] : [],
      createdAt: iso(createdT),
    };
    if (owner) {
      const nInter = stage === "new" ? 0 : int(1, 5);
      let t = createdT + int(1, 20) * 3600000;
      for (let k = 0; k < nInter && t < now; k++) {
        const type = pick(["call", "call", "zalo", "zalo", "meeting", "note"] as const);
        interactions.push({
          id: `it-${interactions.length + 1}`, leadId: lead.id, staffId: owner.id, type,
          content: pick([
            "Giới thiệu chương trình, gửi thông tin chi phí tham khảo qua Zalo.",
            "Khách hỏi về điều kiện chứng minh tài chính và thời gian xử lý.",
            "Phụ huynh muốn gặp trực tiếp để trao đổi thêm.",
            "Tư vấn lộ trình học tiếng trước khi nộp hồ sơ.",
            "Khách đang so sánh với đơn vị khác, cần gửi thêm thông tin trường.",
            "Gọi không nghe máy, đã nhắn Zalo hẹn gọi lại.",
          ]),
          result: pick(["Tích cực", "Cần theo dõi", "Chưa phản hồi", undefined]),
          createdAt: iso(t),
        });
        lead.lastContactAt = iso(t);
        t += int(1, 12) * DAY;
      }
      if (!["contract", "lost"].includes(stage)) {
        const due = now + (r() * 10 - 3) * DAY;
        lead.nextFollowUpAt = iso(due);
        if (r() < 0.5) {
          const start = new Date(now + int(-2, 7) * DAY);
          start.setHours(int(8, 17), pick([0, 30]), 0, 0);
          appointments.push({
            id: `ap-${appointments.length + 1}`, leadId: lead.id, staffId: owner.id,
            title: pick(["Tư vấn trực tiếp cùng phụ huynh", "Gọi lại báo chi phí", "Hẹn kiểm tra tiếng Hàn đầu vào", "Hướng dẫn chuẩn bị giấy tờ"]),
            startAt: start.toISOString(),
            location: pick(["office", "online", "phone"] as const),
            status: start.getTime() < now ? pick(["done", "done", "missed"] as const) : "scheduled",
          });
        }
      }
    }
    leads.push(lead);
  }

  // Hồ sơ du học từ các lead đã ký hợp đồng
  const cases: StudentCase[] = [];
  const invoices: Invoice[] = [];
  const payments: Payment[] = [];
  const accountant = staff.find((s) => s.role === "accountant")!;
  leads.filter((l) => l.stage === "contract").forEach((l, idx) => {
    const created = new Date(l.lastContactAt ?? l.createdAt).getTime();
    const age = (now - created) / DAY;
    const visaStage: VisaStage =
      age < 15 ? "preparing" : age < 35 ? pick(["preparing", "school_applied"] as const)
      : age < 70 ? pick(["school_applied", "admission", "visa_submitted"] as const)
      : pick(["visa_submitted", "interview", "approved", "approved", "rejected", "departed"] as const);
    const progress = { preparing: 0.3, school_applied: 0.6, admission: 0.75, visa_submitted: 0.95, interview: 1, approved: 1, rejected: 1, departed: 1 }[visaStage];
    const isEps = l.program === "lao_dong_eps";
    const contractValue = isEps ? int(4, 7) * 10e6 : int(6, 12) * 10e6;
    const c: StudentCase = {
      id: `hs-${idx + 1}`, code: `HS${String(2600 + idx + 1)}`, leadId: l.id, fullName: l.fullName,
      branchId: l.branchId, counselorId: l.ownerId!, caseOfficerId: pick(officers).id, program: l.program,
      school: isEps ? "Chương trình EPS" : pick(SCHOOLS), intake: l.targetIntake ?? pick(INTAKES),
      visaType: { du_hoc_tieng: "D-4-1", dai_hoc: "D-2", cao_hoc: "D-2", nghe: "D-4-6", lao_dong_eps: "E-9" }[l.program],
      visaStage,
      documents: DOC_TEMPLATE.map((d) => {
        const x = r();
        const status = x < progress ? (r() < 0.85 ? "verified" : "submitted") : x < progress + 0.08 ? "rejected" : "missing";
        return { ...d, status, updatedAt: status === "missing" ? undefined : iso(created + int(1, Math.max(2, Math.floor(age))) * DAY) };
      }),
      contractValue,
      createdAt: iso(created), updatedAt: iso(Math.min(now, created + int(1, 30) * DAY)),
      expectedDeparture: ["approved", "departed"].includes(visaStage) ? iso(now + int(-20, 60) * DAY) : undefined,
    };
    cases.push(c);
    // Hóa đơn: phí dịch vụ chia 2 đợt + dịch thuật
    const inv1: Invoice = { id: `iv-${invoices.length + 1}`, code: `HD${5000 + invoices.length + 1}`, caseId: c.id, feeType: "service", amount: Math.round(contractValue * 0.5), dueDate: iso(created + 3 * DAY), createdAt: iso(created), note: "Đợt 1 – ký hợp đồng" };
    invoices.push(inv1);
    const inv2: Invoice = { id: `iv-${invoices.length + 1}`, code: `HD${5000 + invoices.length + 1}`, caseId: c.id, feeType: "service", amount: contractValue - inv1.amount, dueDate: iso(created + 45 * DAY), createdAt: iso(created), note: "Đợt 2 – khi có thư mời / kết quả" };
    invoices.push(inv2);
    const inv3: Invoice = { id: `iv-${invoices.length + 1}`, code: `HD${5000 + invoices.length + 1}`, caseId: c.id, feeType: "translation", amount: int(15, 40) * 1e5, dueDate: iso(created + 20 * DAY), createdAt: iso(created) };
    invoices.push(inv3);
    const pay = (inv: Invoice, ratio: number, t: number) => {
      if (ratio <= 0 || t > now) return;
      payments.push({ id: `pm-${payments.length + 1}`, invoiceId: inv.id, amount: Math.round(inv.amount * ratio), method: pick(["bank_transfer", "bank_transfer", "cash"] as const), paidAt: iso(t), receivedBy: accountant.id, reference: `FT${int(10000000, 99999999)}` });
    };
    pay(inv1, r() < 0.9 ? 1 : 0.5, created + int(0, 3) * DAY);
    if (age > 45) pay(inv2, r() < 0.65 ? 1 : r() < 0.5 ? 0.5 : 0, created + int(40, 60) * DAY);
    if (age > 20) pay(inv3, r() < 0.8 ? 1 : 0, created + int(15, 25) * DAY);
  });

  const audit: AuditLog[] = [
    { id: "au-1", at: iso(now - 2 * 3600000), actorId: "st-gd", action: "login", entity: "system", summary: "Đăng nhập hệ thống" },
    { id: "au-2", at: iso(now - 26 * 3600000), actorId: "st-kt1", action: "payment", entity: "payment", summary: "Ghi nhận thanh toán đợt 1 – phí dịch vụ" },
    { id: "au-3", at: iso(now - 30 * 3600000), actorId: "st-ql1", action: "assign", entity: "assignment", summary: "Phân bổ 6 khách hàng mới theo chiến lược Xoay vòng" },
  ];

  return {
    branches, staff, campaigns, leads, interactions, appointments, cases, invoices, payments, audit,
    assignment: { strategy: "round_robin", respectBranch: true, respectCapacity: true, autoAssignNewLeads: true, slaHours: 2, lastIndex: {} },
  };
}
