import type {
  AssignmentStrategy, DocStatus, FeeType, InteractionType, LeadStage, Program, Role, SourceChannel, VisaStage,
} from "./types";

export const ROLE_LABEL: Record<Role, string> = {
  director: "Giám đốc",
  branch_manager: "Quản lý chi nhánh",
  counselor: "Tư vấn viên",
  accountant: "Kế toán",
  case_officer: "Xử lý hồ sơ",
};

export const PROGRAM_LABEL: Record<Program, string> = {
  du_hoc_tieng: "Du học tiếng (D-4-1)",
  dai_hoc: "Đại học (D-2)",
  cao_hoc: "Cao học (D-2)",
  nghe: "Du học nghề (D-4-6)",
  lao_dong_eps: "Lao động EPS (E-9)",
};

export const STAGES: { key: LeadStage; label: string; color: string; dot: string }[] = [
  { key: "new", label: "Mới", color: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
  { key: "contacted", label: "Đã liên hệ", color: "bg-sky-100 text-sky-700", dot: "bg-sky-500" },
  { key: "consulting", label: "Đang tư vấn", color: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500" },
  { key: "interested", label: "Quan tâm cao", color: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  { key: "contract", label: "Đã ký HĐ", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  { key: "lost", label: "Dừng", color: "bg-rose-100 text-rose-700", dot: "bg-rose-400" },
];
export const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.key, s])) as Record<LeadStage, (typeof STAGES)[number]>;

export const CHANNEL_LABEL: Record<SourceChannel, string> = {
  facebook_ads: "Facebook Ads",
  tiktok_ads: "TikTok Ads",
  google_ads: "Google Ads",
  zalo: "Zalo OA",
  website: "Website",
  referral: "Giới thiệu",
  event: "Hội thảo / Sự kiện",
  walk_in: "Khách đến VP",
  school_partner: "Trường THPT liên kết",
};

export const VISA_STAGES: { key: VisaStage; label: string; color: string }[] = [
  { key: "preparing", label: "Chuẩn bị hồ sơ", color: "bg-slate-100 text-slate-700" },
  { key: "school_applied", label: "Đã nộp trường", color: "bg-sky-100 text-sky-700" },
  { key: "admission", label: "Có thư mời", color: "bg-indigo-100 text-indigo-700" },
  { key: "visa_submitted", label: "Đã nộp ĐSQ", color: "bg-violet-100 text-violet-700" },
  { key: "interview", label: "Phỏng vấn", color: "bg-amber-100 text-amber-800" },
  { key: "approved", label: "Đỗ visa", color: "bg-emerald-100 text-emerald-700" },
  { key: "rejected", label: "Trượt visa", color: "bg-rose-100 text-rose-700" },
  { key: "departed", label: "Đã xuất cảnh", color: "bg-teal-100 text-teal-700" },
];
export const VISA_MAP = Object.fromEntries(VISA_STAGES.map((s) => [s.key, s])) as Record<VisaStage, (typeof VISA_STAGES)[number]>;

export const DOC_STATUS: Record<DocStatus, { label: string; color: string }> = {
  missing: { label: "Chưa có", color: "bg-slate-100 text-slate-600" },
  submitted: { label: "Đã nộp", color: "bg-sky-100 text-sky-700" },
  verified: { label: "Đã duyệt", color: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Cần bổ sung", color: "bg-rose-100 text-rose-700" },
};

/** Danh mục giấy tờ mẫu – danh sách thật phải cập nhật theo yêu cầu của trường và ĐSQ tại từng thời điểm. */
export const DOC_TEMPLATE: { key: string; label: string }[] = [
  { key: "passport", label: "Hộ chiếu" },
  { key: "id_card", label: "CCCD + Giấy khai sinh" },
  { key: "transcript", label: "Học bạ / Bảng điểm" },
  { key: "diploma", label: "Bằng tốt nghiệp" },
  { key: "topik", label: "Chứng chỉ TOPIK (nếu có)" },
  { key: "finance", label: "Chứng minh tài chính" },
  { key: "family", label: "Giấy tờ gia đình" },
  { key: "health", label: "Giấy khám sức khỏe" },
  { key: "photo", label: "Ảnh thẻ" },
  { key: "translation", label: "Dịch thuật công chứng" },
];

export const FEE_LABEL: Record<FeeType, string> = {
  service: "Phí dịch vụ",
  tuition: "Học phí (thu hộ)",
  dormitory: "Ký túc xá",
  insurance: "Bảo hiểm",
  translation: "Dịch thuật",
  other: "Khác",
};

export const INTERACTION_LABEL: Record<InteractionType, string> = {
  call: "Gọi điện",
  zalo: "Nhắn Zalo",
  meeting: "Gặp trực tiếp",
  email: "Email",
  sms: "SMS",
  note: "Ghi chú",
};

export const STRATEGY_LABEL: Record<AssignmentStrategy, { label: string; desc: string }> = {
  round_robin: { label: "Xoay vòng", desc: "Chia lần lượt cho từng tư vấn viên, đều nhau." },
  least_load: { label: "Theo khối lượng", desc: "Ưu tiên người đang chăm sóc ít khách nhất." },
  performance: { label: "Theo hiệu suất", desc: "Ưu tiên người có tỷ lệ chốt hợp đồng cao, có giới hạn tải." },
  by_branch: { label: "Theo khu vực", desc: "Gán về chi nhánh gần tỉnh của khách, rồi xoay vòng trong chi nhánh." },
};

export const PROVINCES = [
  "Hà Nội", "Hải Phòng", "Nghệ An", "Thanh Hóa", "Hải Dương", "Nam Định", "Thái Bình", "Bắc Ninh",
  "Hưng Yên", "Hà Tĩnh", "Quảng Ninh", "Phú Thọ", "Ninh Bình", "Vĩnh Phúc", "Bắc Giang",
];
