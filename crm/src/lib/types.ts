// Kiểu dữ liệu nghiệp vụ dùng chung.
// Khớp 1-1 với các bảng trong supabase/migrations/0001_init.sql để sau này thay
// lớp dữ liệu giả lập bằng Supabase mà không phải sửa giao diện.

export type Role = "director" | "branch_manager" | "counselor" | "accountant" | "case_officer";

export interface Branch {
  id: string;
  name: string;
  city: string;
  managerId?: string;
}

export interface Staff {
  id: string;
  fullName: string;
  role: Role;
  branchId: string;
  phone: string;
  email: string;
  active: boolean;
  /** Chỉ tiêu tuyển sinh (số hợp đồng) mỗi tháng */
  monthlyTarget: number;
  /** Số lead tối đa đang chăm sóc cùng lúc – dùng cho phân bổ theo tải */
  maxActiveLeads: number;
}

export type Program = "du_hoc_tieng" | "dai_hoc" | "cao_hoc" | "nghe" | "lao_dong_eps";

export type LeadStage =
  | "new"           // Mới
  | "contacted"     // Đã liên hệ
  | "consulting"    // Đang tư vấn
  | "interested"    // Quan tâm cao
  | "contract"      // Đã ký hợp đồng
  | "lost";         // Không tiếp tục

export type SourceChannel =
  | "facebook_ads" | "tiktok_ads" | "google_ads" | "zalo" | "website"
  | "referral" | "event" | "walk_in" | "school_partner";

export interface Campaign {
  id: string;
  name: string;
  channel: SourceChannel;
  startDate: string;
  endDate?: string;
  budget: number;
  spent: number;
}

export interface Lead {
  id: string;
  code: string;
  fullName: string;
  phone: string;
  email?: string;
  birthYear?: number;
  province: string;
  program: Program;
  targetIntake?: string; // Kỳ nhập học dự kiến, ví dụ "03/2027"
  koreanLevel?: string;  // Chưa học / TOPIK 1..6
  channel: SourceChannel;
  campaignId?: string;
  branchId: string;
  ownerId?: string;      // Nhân viên phụ trách
  stage: LeadStage;
  priority: "high" | "medium" | "low";
  lostReason?: string;
  notes?: string;
  tags: string[];
  createdAt: string;
  lastContactAt?: string;
  nextFollowUpAt?: string;
}

export type InteractionType = "call" | "zalo" | "meeting" | "email" | "sms" | "note";

export interface Interaction {
  id: string;
  leadId: string;
  staffId: string;
  type: InteractionType;
  content: string;
  result?: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  leadId: string;
  staffId: string;
  title: string;
  startAt: string;
  location: "office" | "online" | "phone";
  status: "scheduled" | "done" | "missed" | "cancelled";
  note?: string;
}

export type DocStatus = "missing" | "submitted" | "verified" | "rejected";

export interface StudentDocument {
  key: string;
  label: string;
  status: DocStatus;
  updatedAt?: string;
}

export type VisaStage =
  | "preparing"      // Chuẩn bị hồ sơ
  | "school_applied" // Nộp hồ sơ trường
  | "admission"      // Có thư mời / mã code
  | "visa_submitted" // Nộp hồ sơ ĐSQ
  | "interview"      // Phỏng vấn
  | "approved"       // Đỗ visa
  | "rejected"       // Trượt
  | "departed";      // Đã xuất cảnh

export interface StudentCase {
  id: string;
  code: string;
  leadId: string;
  fullName: string;
  branchId: string;
  counselorId: string;
  caseOfficerId: string;
  program: Program;
  school: string;
  intake: string;
  visaType: string;
  visaStage: VisaStage;
  documents: StudentDocument[];
  contractValue: number;
  createdAt: string;
  updatedAt: string;
  expectedDeparture?: string;
}

export type FeeType = "service" | "tuition" | "dormitory" | "insurance" | "translation" | "other";

export interface Invoice {
  id: string;
  code: string;
  caseId: string;
  feeType: FeeType;
  amount: number;
  dueDate: string;
  createdAt: string;
  note?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: "cash" | "bank_transfer" | "card";
  paidAt: string;
  receivedBy: string;
  reference?: string;
}

export interface AuditLog {
  id: string;
  at: string;
  actorId: string;
  action: "create" | "update" | "delete" | "assign" | "import" | "export" | "login" | "payment";
  entity: "lead" | "interaction" | "appointment" | "case" | "invoice" | "payment" | "staff" | "assignment" | "system";
  entityId?: string;
  summary: string;
  changes?: { field: string; from?: string; to?: string }[];
}

export type AssignmentStrategy = "round_robin" | "least_load" | "performance" | "by_branch";

export interface AssignmentSettings {
  strategy: AssignmentStrategy;
  respectBranch: boolean;
  respectCapacity: boolean;
  autoAssignNewLeads: boolean;
  slaHours: number; // Số giờ tối đa phải liên hệ lần đầu
  lastIndex: Record<string, number>;
}

export interface DB {
  branches: Branch[];
  staff: Staff[];
  campaigns: Campaign[];
  leads: Lead[];
  interactions: Interaction[];
  appointments: Appointment[];
  cases: StudentCase[];
  invoices: Invoice[];
  payments: Payment[];
  audit: AuditLog[];
  assignment: AssignmentSettings;
}
