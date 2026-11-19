"use client";
import { CircleAlert, CircleCheck, Database, Download, FileSpreadsheet, Sheet, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Badge, Button, Card, CardHeader, PageHeader, Table, cx, td, th } from "@/components/ui";
import { CHANNEL_LABEL, FEE_LABEL, PROGRAM_LABEL, STAGE_MAP, VISA_MAP } from "@/lib/constants";
import { downloadText, parseCSV, toCSV } from "@/lib/csv";
import { fmtDate, normalize } from "@/lib/format";
import { can, canSeeMoney, scopeCases, scopeLeads } from "@/lib/permissions";
import { useStore } from "@/lib/store";
import type { Lead, Program, SourceChannel } from "@/lib/types";

const TEMPLATE_HEADERS = ["Họ tên", "Điện thoại", "Email", "Tỉnh/TP", "Chương trình", "Nguồn", "Ghi chú"];
const FIELD_BY_HEADER: Record<string, keyof Row> = {
  "ho ten": "fullName", "ho va ten": "fullName", "ten": "fullName",
  "dien thoai": "phone", "so dien thoai": "phone", "sdt": "phone",
  "email": "email", "tinh/tp": "province", "tinh": "province", "tinh thanh": "province",
  "chuong trinh": "program", "nguon": "channel", "ghi chu": "notes",
};

interface Row { fullName: string; phone: string; email: string; province: string; program: string; channel: string; notes: string }
interface Parsed extends Row { line: number; errors: string[]; programKey: Program; channelKey: SourceChannel; phoneNorm: string }

const today = () => new Date().toISOString().slice(0, 10);
const normPhone = (p: string) => p.replace(/[\s.\-()]/g, "").replace(/^\+?84/, "0");
const PHONE_RE = /^0(3|5|7|8|9)\d{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mapProgram(s: string): Program {
  const n = normalize(s);
  if (n.includes("eps") || n.includes("lao dong") || n.includes("e-9")) return "lao_dong_eps";
  if (n.includes("cao hoc") || n.includes("thac si")) return "cao_hoc";
  if (n.includes("dai hoc")) return "dai_hoc";
  if (n.includes("nghe")) return "nghe";
  return "du_hoc_tieng";
}
function mapChannel(s: string): SourceChannel {
  const n = normalize(s.trim());
  if (!n) return "website";
  const hit = (Object.entries(CHANNEL_LABEL) as [SourceChannel, string][]).find(([k, v]) => normalize(v) === n || k === n);
  if (hit) return hit[0];
  if (n.includes("facebook") || n === "fb") return "facebook_ads";
  if (n.includes("tiktok")) return "tiktok_ads";
  if (n.includes("google")) return "google_ads";
  if (n.includes("zalo")) return "zalo";
  if (n.includes("gioi thieu")) return "referral";
  return "website";
}

export default function DataPage() {
  const { db, me, actions, toast } = useStore();
  const leadsOk = can(me.role, "leads", "write");
  const money = canSeeMoney(me.role);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<Parsed[] | null>(null);

  const staffName = (id?: string) => db.staff.find((s) => s.id === id)?.fullName ?? "";
  const branchName = (id: string) => db.branches.find((b) => b.id === id)?.name ?? "";
  const cases = scopeCases(db, me);

  const exportLeads = () => {
    const rows = scopeLeads(db, me);
    downloadText(`khach-hang_${today()}.csv`, toCSV(
      ["Mã KH", "Họ tên", "Điện thoại", "Email", "Năm sinh", "Tỉnh/TP", "Chương trình", "Kỳ nhập học", "Tiếng Hàn", "Nguồn", "Chi nhánh", "Phụ trách", "Trạng thái", "Ưu tiên", "Ngày tạo", "Liên hệ gần nhất", "Hẹn chăm sóc"],
      rows.map((l) => [l.code, l.fullName, l.phone, l.email, l.birthYear, l.province, PROGRAM_LABEL[l.program], l.targetIntake, l.koreanLevel, CHANNEL_LABEL[l.channel], branchName(l.branchId), staffName(l.ownerId), STAGE_MAP[l.stage].label, l.priority, fmtDate(l.createdAt), fmtDate(l.lastContactAt), fmtDate(l.nextFollowUpAt)]),
    ));
    actions.logExport("khách hàng", rows.length);
  };
  const exportCases = () => {
    downloadText(`ho-so_${today()}.csv`, toCSV(
      ["Mã HS", "Học sinh", "Chương trình", "Trường", "Kỳ nhập học", "Loại visa", "Tiến độ visa", "Giấy tờ đã duyệt", "Tư vấn viên", "Cán bộ hồ sơ", "Chi nhánh", ...(money ? ["Giá trị HĐ"] : []), "Cập nhật"],
      cases.map((c) => [c.code, c.fullName, PROGRAM_LABEL[c.program], c.school, c.intake, c.visaType, VISA_MAP[c.visaStage].label,
        `${c.documents.filter((d) => d.status === "verified").length}/${c.documents.length}`, staffName(c.counselorId), staffName(c.caseOfficerId), branchName(c.branchId),
        ...(money ? [c.contractValue] : []), fmtDate(c.updatedAt)]),
    ));
    actions.logExport("hồ sơ", cases.length);
  };
  const caseIds = new Set(cases.map((c) => c.id));
  const invoices = db.invoices.filter((i) => caseIds.has(i.caseId));
  const exportDebt = () => {
    const rows = invoices.map((i) => {
      const c = db.cases.find((x) => x.id === i.caseId);
      const paid = db.payments.filter((p) => p.invoiceId === i.id).reduce((s, p) => s + p.amount, 0);
      return [i.code, c?.code, c?.fullName, FEE_LABEL[i.feeType], i.amount, paid, i.amount - paid, fmtDate(i.dueDate), i.amount - paid <= 0 ? "Đã thu đủ" : new Date(i.dueDate) < new Date() ? "Quá hạn" : "Chưa đến hạn", i.note];
    });
    downloadText(`cong-no_${today()}.csv`, toCSV(["Mã hóa đơn", "Mã HS", "Học sinh", "Loại phí", "Số tiền", "Đã thu", "Còn nợ", "Hạn thanh toán", "Tình trạng", "Ghi chú"], rows));
    actions.logExport("công nợ", rows.length);
  };
  const exportPayments = () => {
    const ivIds = new Set(invoices.map((i) => i.id));
    const pays = db.payments.filter((p) => ivIds.has(p.invoiceId));
    downloadText(`thanh-toan_${today()}.csv`, toCSV(["Ngày thu", "Mã hóa đơn", "Học sinh", "Số tiền", "Hình thức", "Mã giao dịch", "Người thu"],
      pays.map((p) => {
        const inv = db.invoices.find((i) => i.id === p.invoiceId);
        const c = db.cases.find((x) => x.id === inv?.caseId);
        return [fmtDate(p.paidAt), inv?.code, c?.fullName, p.amount, { cash: "Tiền mặt", bank_transfer: "Chuyển khoản", card: "Thẻ" }[p.method], p.reference, staffName(p.receivedBy)];
      })));
    actions.logExport("thanh toán", pays.length);
  };
  const backup = () => {
    downloadText(`sao-luu-demo_${today()}.json`, JSON.stringify(db, null, 2), "application/json");
    actions.logExport("sao lưu toàn bộ (JSON)", db.leads.length);
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast("File quá lớn (tối đa 5MB)", "error"); return; }
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCSV(String(reader.result ?? ""));
      if (rows.length < 2) { toast("File không có dữ liệu", "error"); setParsed(null); return; }
      const header = rows[0].map((h) => FIELD_BY_HEADER[normalize(h.trim())]);
      if (!header.includes("fullName") || !header.includes("phone")) {
        toast("Thiếu cột bắt buộc “Họ tên” hoặc “Điện thoại”. Hãy dùng file mẫu.", "error"); setParsed(null); return;
      }
      const existing = new Set(db.leads.map((l) => normPhone(l.phone)));
      const seen = new Set<string>();
      const out: Parsed[] = rows.slice(1, 2001).map((r, i) => {
        const row: Row = { fullName: "", phone: "", email: "", province: "", program: "", channel: "", notes: "" };
        header.forEach((k, j) => { if (k) row[k] = (r[j] ?? "").trim().slice(0, 500); });
        const phoneNorm = normPhone(row.phone);
        const errors: string[] = [];
        if (!row.fullName) errors.push("Thiếu họ tên");
        if (!row.phone) errors.push("Thiếu SĐT");
        else if (!PHONE_RE.test(phoneNorm)) errors.push("SĐT không hợp lệ");
        else if (existing.has(phoneNorm)) errors.push("Trùng SĐT đã có trong hệ thống");
        else if (seen.has(phoneNorm)) errors.push("Trùng SĐT trong file");
        if (row.email && !EMAIL_RE.test(row.email)) errors.push("Email sai định dạng");
        if (phoneNorm) seen.add(phoneNorm);
        return { ...row, line: i + 2, errors, phoneNorm, programKey: mapProgram(row.program), channelKey: mapChannel(row.channel) };
      });
      setParsed(out);
    };
    reader.onerror = () => toast("Không đọc được file", "error");
    reader.readAsText(f, "utf-8");
  };

  const valid = useMemo(() => parsed?.filter((p) => !p.errors.length) ?? [], [parsed]);
  const doImport = () => {
    const rows: Omit<Lead, "id" | "code" | "createdAt">[] = valid.map((p) => ({
      fullName: p.fullName, phone: p.phoneNorm, email: p.email || undefined, province: p.province || "Chưa rõ",
      program: p.programKey, channel: p.channelKey, branchId: me.branchId, stage: "new", priority: "medium",
      notes: p.notes || undefined, tags: [], ownerId: me.role === "counselor" ? me.id : undefined,
    }));
    actions.importLeads(rows);
    setParsed(null); setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const ExportBtn = ({ label, desc, onClick, count }: { label: string; desc: string; onClick: () => void; count: number }) => (
    <button onClick={onClick} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40">
      <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600"><FileSpreadsheet size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        <span className="block text-xs text-slate-500">{desc} · {count} dòng</span>
      </span>
      <Download size={16} className="text-slate-400" />
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Nhập / xuất dữ liệu" desc="Xuất báo cáo ra Excel, nhập danh sách khách hàng hàng loạt, đồng bộ Google Sheets." />

      <Card>
        <CardHeader title="Xuất dữ liệu ra Excel (CSV)" subtitle="File mã hóa UTF-8, mở trực tiếp bằng Excel không lỗi font. Chỉ xuất dữ liệu trong phạm vi quyền của thầy/cô." />
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {can(me.role, "leads") && <ExportBtn label="Danh sách khách hàng" desc="Toàn bộ thông tin CRM" onClick={exportLeads} count={scopeLeads(db, me).length} />}
          <ExportBtn label="Hồ sơ du học" desc="Tiến độ hồ sơ & visa" onClick={exportCases} count={cases.length} />
          {money && <ExportBtn label="Công nợ" desc="Phải thu, đã thu, còn nợ" onClick={exportDebt} count={invoices.length} />}
          {money && <ExportBtn label="Lịch sử thanh toán" desc="Các khoản đã thu" onClick={exportPayments} count={db.payments.filter((p) => invoices.some((i) => i.id === p.invoiceId)).length} />}
        </div>
      </Card>

      {leadsOk && (
        <Card>
          <CardHeader title="Nhập khách hàng từ file" subtitle="Hỗ trợ CSV từ Excel hoặc Google Sheets. Hệ thống kiểm tra SĐT, trùng lặp trước khi nhập và tự phân bổ cho tư vấn viên."
            action={<Button variant="secondary" size="sm" onClick={() => downloadText("mau-nhap-khach-hang.csv", toCSV(TEMPLATE_HEADERS, [["Nguyễn Văn A", "0912345678", "a@example.com", "Hà Nội", "Du học tiếng", "Facebook Ads", "Quan tâm kỳ tháng 3"]]))}><Download size={14} /> Tải file mẫu</Button>} />
          <div className="p-4">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center hover:border-brand-300 hover:bg-brand-50/40">
              <Upload className="text-brand-500" size={28} />
              <span className="text-sm font-medium text-slate-700">{fileName || "Bấm để chọn file .csv"}</span>
              <span className="text-xs text-slate-400">Cột bắt buộc: Họ tên, Điện thoại. Tối đa 2.000 dòng / 5MB mỗi lần.</span>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>

            {parsed && (
              <div className="mt-4">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                  <Badge className="bg-slate-100 text-slate-700">{parsed.length} dòng</Badge>
                  <Badge className="bg-emerald-100 text-emerald-700">{valid.length} hợp lệ</Badge>
                  {parsed.length - valid.length > 0 && <Badge className="bg-rose-100 text-rose-700">{parsed.length - valid.length} lỗi (sẽ bỏ qua)</Badge>}
                  <div className="ml-auto flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => { setParsed(null); setFileName(""); if (fileRef.current) fileRef.current.value = ""; }}>Hủy</Button>
                    <Button size="sm" disabled={!valid.length} onClick={doImport}>Nhập {valid.length} khách hàng</Button>
                  </div>
                </div>
                <div className="max-h-[420px] overflow-auto rounded-lg border border-slate-200">
                  <Table>
                    <thead><tr>{["Dòng", "Họ tên", "Điện thoại", "Tỉnh/TP", "Chương trình", "Nguồn", "Kiểm tra"].map((h) => <th key={h} className={cx(th, "sticky top-0")}>{h}</th>)}</tr></thead>
                    <tbody>
                      {parsed.map((p) => (
                        <tr key={p.line} className={p.errors.length ? "bg-rose-50/60" : ""}>
                          <td className={cx(td, "text-slate-400")}>{p.line}</td>
                          <td className={td}>{p.fullName || <i className="text-slate-400">trống</i>}</td>
                          <td className={cx(td, "tabular-nums")}>{p.phone}</td>
                          <td className={td}>{p.province}</td>
                          <td className={td}>{PROGRAM_LABEL[p.programKey]}</td>
                          <td className={td}>{CHANNEL_LABEL[p.channelKey]}</td>
                          <td className={td}>
                            {p.errors.length
                              ? <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600"><CircleAlert size={14} /> {p.errors.join("; ")}</span>
                              : <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><CircleCheck size={14} /> Hợp lệ</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600"><Sheet size={20} /></span>
            <div>
              <p className="flex items-center gap-2 font-semibold text-slate-800">Đồng bộ Google Sheets <Badge className="bg-amber-100 text-amber-800">Sắp có – giai đoạn 6</Badge></p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                <li>Đồng bộ 2 chiều qua Google Sheets API, chạy phía máy chủ bằng tài khoản dịch vụ (service account).</li>
                <li>Khóa truy cập lưu trong biến môi trường Vercel, không nằm trong mã nguồn hay trình duyệt.</li>
                <li>Tự động kéo lead từ sheet form quảng cáo về CRM theo lịch.</li>
              </ul>
              <p className="mt-2 text-sm text-slate-600"><b>Hiện tại:</b> trong Google Sheets chọn <i>Tệp → Tải xuống → CSV</i> rồi nhập file ở mục trên.</p>
            </div>
          </div>
        </Card>
        {me.role === "director" && (
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-brand-50 p-2 text-brand-600"><Database size={20} /></span>
              <div className="flex-1">
                <p className="font-semibold text-slate-800">Sao lưu dữ liệu</p>
                <p className="mt-1 text-sm text-slate-600">Tải toàn bộ dữ liệu demo về máy dưới dạng JSON.</p>
                <Button className="mt-3" size="sm" onClick={backup}><Download size={14} /> Sao lưu dữ liệu demo</Button>
                <p className="mt-3 text-xs text-slate-500"><b>Khôi phục từ file:</b> ở bản chính thức, việc sao lưu tự động hằng ngày và khôi phục theo thời điểm do Supabase đảm nhiệm
                  (chỉ Giám đốc được yêu cầu khôi phục). Bản demo dùng nút “Khôi phục dữ liệu mẫu” ở thanh bên.</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
