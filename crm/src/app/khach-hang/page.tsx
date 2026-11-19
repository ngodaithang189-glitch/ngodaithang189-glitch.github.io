"use client";
import { ArrowUpDown, Download, Filter, LayoutList, Plus, SquareKanban, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { LeadDrawer } from "@/components/leads/LeadDrawer";
import { LeadForm } from "@/components/leads/LeadForm";
import { Avatar, Badge, Button, Card, Empty, PageHeader, Select, Table, Tabs, cx, inputCls, td, th } from "@/components/ui";
import { CHANNEL_LABEL, PROGRAM_LABEL, STAGES, STAGE_MAP } from "@/lib/constants";
import { downloadText, toCSV } from "@/lib/csv";
import { fmtDate, normalize, relative } from "@/lib/format";
import { can, scopeLeads } from "@/lib/permissions";
import { useStore } from "@/lib/store";
import type { Lead, LeadStage } from "@/lib/types";

const PRIORITY: Record<Lead["priority"], { label: string; cls: string }> = {
  high: { label: "Cao", cls: "bg-rose-50 text-rose-700" },
  medium: { label: "TB", cls: "bg-slate-100 text-slate-600" },
  low: { label: "Thấp", cls: "bg-slate-50 text-slate-400" },
};

type Filters = { stage: string; channel: string; program: string; branch: string; owner: string; priority: string; period: string; overdue: boolean; unassigned: boolean };
const EMPTY: Filters = { stage: "", channel: "", program: "", branch: "", owner: "", priority: "", period: "", overdue: false, unassigned: false };
const PAGE = 20;

export default function Page() {
  return <Suspense><LeadsPage /></Suspense>;
}

function LeadsPage() {
  const { db, me, actions } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const [view, setView] = useState<"table" | "kanban">(params.get("view") === "kanban" ? "kanban" : "table");
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filters>(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<"createdAt" | "nextFollowUpAt">("createdAt");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(params.get("open"));

  useEffect(() => { setOpenId(params.get("open")); }, [params]);
  useEffect(() => { setPage(1); }, [q, f, sort]);

  const writable = can(me.role, "leads", "write");
  const base = scopeLeads(db, me);
  const staffName = (id?: string) => db.staff.find((s) => s.id === id)?.fullName;

  const list = useMemo(() => {
    const now = Date.now();
    const n = normalize(q.trim());
    return base.filter((l) => {
      if (n && !normalize(`${l.fullName} ${l.phone} ${l.code} ${l.email ?? ""} ${l.province}`).includes(n)) return false;
      if (f.stage && l.stage !== f.stage) return false;
      if (f.channel && l.channel !== f.channel) return false;
      if (f.program && l.program !== f.program) return false;
      if (f.branch && l.branchId !== f.branch) return false;
      if (f.owner && l.ownerId !== f.owner) return false;
      if (f.priority && l.priority !== f.priority) return false;
      if (f.period && now - new Date(l.createdAt).getTime() > Number(f.period) * 86400000) return false;
      if (f.overdue && !(l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() < now && !["contract", "lost"].includes(l.stage))) return false;
      if (f.unassigned && l.ownerId) return false;
      return true;
    }).sort((a, b) => sort === "createdAt" ? b.createdAt.localeCompare(a.createdAt) : (a.nextFollowUpAt ?? "9").localeCompare(b.nextFollowUpAt ?? "9"));
  }, [base, q, f, sort]);

  const activeFilters = Object.entries(f).filter(([, v]) => v).length;
  const owners = db.staff.filter((s) => s.role === "counselor" && (me.role === "director" || s.branchId === me.branchId));

  const exportCsv = () => {
    const headers = ["Mã KH", "Họ tên", "Điện thoại", "Email", "Tỉnh/TP", "Chương trình", "Nguồn", "Giai đoạn", "Phụ trách", "Ngày tạo", "Hẹn chăm sóc"];
    const rows = list.map((l) => [l.code, l.fullName, l.phone, l.email ?? "", l.province, PROGRAM_LABEL[l.program], CHANNEL_LABEL[l.channel], STAGE_MAP[l.stage].label, staffName(l.ownerId) ?? "", fmtDate(l.createdAt), fmtDate(l.nextFollowUpAt)]);
    downloadText(`khach-hang-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(headers, rows));
    actions.logExport("khách hàng (bộ lọc hiện tại)", rows.length);
  };

  const open = (id: string | null) => {
    setOpenId(id);
    router.replace(id ? `/khach-hang?open=${id}${view === "kanban" ? "&view=kanban" : ""}` : `/khach-hang${view === "kanban" ? "?view=kanban" : ""}`, { scroll: false });
  };

  return (
    <>
      <PageHeader title="Khách hàng tiềm năng" desc={`${base.length} khách trong phạm vi của bạn · tìm kiếm không cần gõ dấu`}
        actions={<>
          {can(me.role, "data", "write") && <Button variant="secondary" onClick={exportCsv}><Download size={16} /> Xuất Excel (CSV)</Button>}
          {writable && <Button onClick={() => setAdding(true)}><Plus size={16} /> Thêm khách hàng</Button>}
        </>}
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, SĐT, mã KH, email, tỉnh…" className={inputCls + " md:max-w-sm"} />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={f.stage} onChange={(v) => setF({ ...f, stage: v })} placeholder="Mọi giai đoạn" className="w-40" options={STAGES.map((s) => ({ value: s.key, label: s.label }))} />
            <Button variant={activeFilters ? "primary" : "secondary"} onClick={() => setShowFilters((v) => !v)}>
              <Filter size={16} /> Bộ lọc{activeFilters ? ` (${activeFilters})` : ""}
            </Button>
            {activeFilters > 0 && <Button variant="ghost" onClick={() => setF(EMPTY)}><X size={14} /> Xóa lọc</Button>}
          </div>
          <div className="flex items-center gap-2 md:ml-auto">
            {view === "table" && (
              <Button variant="ghost" size="sm" onClick={() => setSort(sort === "createdAt" ? "nextFollowUpAt" : "createdAt")}>
                <ArrowUpDown size={14} /> {sort === "createdAt" ? "Mới nhất" : "Hẹn chăm sóc gần nhất"}
              </Button>
            )}
            <Tabs value={view} onChange={setView} items={[{ value: "table", label: <><LayoutList size={15} /> Bảng</> }, { value: "kanban", label: <><SquareKanban size={15} /> Kanban</> }]} />
          </div>
        </div>
        {showFilters && (
          <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={f.channel} onChange={(v) => setF({ ...f, channel: v })} placeholder="Mọi nguồn" options={Object.entries(CHANNEL_LABEL).map(([value, label]) => ({ value, label }))} />
            <Select value={f.program} onChange={(v) => setF({ ...f, program: v })} placeholder="Mọi chương trình" options={Object.entries(PROGRAM_LABEL).map(([value, label]) => ({ value, label }))} />
            {me.role === "director" && <Select value={f.branch} onChange={(v) => setF({ ...f, branch: v })} placeholder="Mọi chi nhánh" options={db.branches.map((b) => ({ value: b.id, label: b.name }))} />}
            {me.role !== "counselor" && <Select value={f.owner} onChange={(v) => setF({ ...f, owner: v })} placeholder="Mọi nhân viên" options={owners.map((s) => ({ value: s.id, label: s.fullName }))} />}
            <Select value={f.priority} onChange={(v) => setF({ ...f, priority: v })} placeholder="Mọi mức ưu tiên" options={[{ value: "high", label: "Ưu tiên cao" }, { value: "medium", label: "Trung bình" }, { value: "low", label: "Thấp" }]} />
            <Select value={f.period} onChange={(v) => setF({ ...f, period: v })} placeholder="Mọi thời gian" options={[{ value: "7", label: "7 ngày qua" }, { value: "30", label: "30 ngày qua" }, { value: "90", label: "90 ngày qua" }]} />
            <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={f.overdue} onChange={(e) => setF({ ...f, overdue: e.target.checked })} className="h-4 w-4 accent-brand-600" /> Quá hạn chăm sóc</label>
            {me.role !== "counselor" && <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={f.unassigned} onChange={(e) => setF({ ...f, unassigned: e.target.checked })} className="h-4 w-4 accent-brand-600" /> Chưa phân công</label>}
          </div>
        )}
      </Card>

      {view === "table" ? (
        <Card>
          {/* Điện thoại: danh sách thẻ */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {list.length === 0 && <Empty />}
            {list.slice((page - 1) * PAGE, page * PAGE).map((l) => (
              <li key={l.id}>
                <button onClick={() => open(l.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800">{l.fullName}</p>
                    <p className="text-xs text-slate-500">{l.phone} · {PROGRAM_LABEL[l.program]}</p>
                    <p className="mt-1 text-xs text-slate-400">{staffName(l.ownerId) ?? "Chưa phân công"} · {relative(l.createdAt)}</p>
                  </div>
                  <Badge className={STAGE_MAP[l.stage].color}>{STAGE_MAP[l.stage].label}</Badge>
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <Table>
              <thead><tr>
                <th className={th}>Khách hàng</th><th className={th}>Chương trình</th><th className={th}>Nguồn</th><th className={th}>Giai đoạn</th>
                <th className={th}>Phụ trách</th><th className={th}>Liên hệ cuối</th><th className={th}>Hẹn chăm sóc</th><th className={th}>Ưu tiên</th>
              </tr></thead>
              <tbody>
                {list.slice((page - 1) * PAGE, page * PAGE).map((l) => {
                  const overdue = l.nextFollowUpAt && new Date(l.nextFollowUpAt) < new Date() && !["contract", "lost"].includes(l.stage);
                  return (
                    <tr key={l.id} onClick={() => open(l.id)} className="cursor-pointer hover:bg-brand-50/40">
                      <td className={td}><p className="font-medium text-slate-800">{l.fullName}</p><p className="text-xs text-slate-500">{l.code} · {l.phone}</p></td>
                      <td className={td}>{PROGRAM_LABEL[l.program]}</td>
                      <td className={td}>{CHANNEL_LABEL[l.channel]}</td>
                      <td className={td}><Badge className={STAGE_MAP[l.stage].color}>{STAGE_MAP[l.stage].label}</Badge></td>
                      <td className={td}>{l.ownerId ? <span className="inline-flex items-center gap-1.5"><Avatar name={staffName(l.ownerId)!} size={22} /><span className="truncate">{staffName(l.ownerId)}</span></span> : <span className="text-amber-600">Chưa phân công</span>}</td>
                      <td className={td + " whitespace-nowrap text-xs"}>{relative(l.lastContactAt)}</td>
                      <td className={cx(td, "whitespace-nowrap text-xs", overdue && "font-semibold text-rose-600")}>{l.nextFollowUpAt && !["contract", "lost"].includes(l.stage) ? relative(l.nextFollowUpAt) : "—"}</td>
                      <td className={td}><Badge className={PRIORITY[l.priority].cls}>{PRIORITY[l.priority].label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {list.length === 0 && <Empty />}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>{list.length} kết quả</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Trước</Button>
              <span className="tabular-nums">{page}/{Math.max(1, Math.ceil(list.length / PAGE))}</span>
              <Button size="sm" variant="secondary" disabled={page * PAGE >= list.length} onClick={() => setPage(page + 1)}>Sau</Button>
            </div>
          </div>
        </Card>
      ) : (
        <Kanban leads={list} onOpen={open} writable={writable} />
      )}

      {adding && <LeadForm open onClose={() => setAdding(false)} />}
      {openId && <LeadDrawer key={openId} leadId={openId} onClose={() => open(null)} />}
    </>
  );
}

function Kanban({ leads, onOpen, writable }: { leads: Lead[]; onOpen: (id: string) => void; writable: boolean }) {
  const { db, actions } = useStore();
  const [over, setOver] = useState<LeadStage | null>(null);
  const staffName = (id?: string) => db.staff.find((s) => s.id === id)?.fullName ?? "Chưa phân công";

  const move = (id: string, stage: LeadStage) => {
    const l = leads.find((x) => x.id === id);
    if (!l || l.stage === stage) return;
    if (stage === "lost") {
      const reason = prompt("Lý do dừng chăm sóc?");
      if (reason === null) return;
      actions.updateLead(id, { stage, lostReason: reason || "Không rõ" });
    } else if (stage === "contract") {
      if (confirm(`Xác nhận ${l.fullName} đã ký hợp đồng? Hệ thống sẽ tự mở hồ sơ và hóa đơn.`)) actions.updateLead(id, { stage });
    } else actions.updateLead(id, { stage });
  };

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-3">
        {STAGES.map((s) => {
          const col = leads.filter((l) => l.stage === s.key);
          return (
            <div key={s.key}
              onDragOver={(e) => { if (writable) { e.preventDefault(); setOver(s.key); } }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => { e.preventDefault(); setOver(null); move(e.dataTransfer.getData("text/plain"), s.key); }}
              className={cx("flex w-72 flex-col rounded-xl border bg-slate-100/70 transition", over === s.key ? "border-brand-400 bg-brand-50" : "border-transparent")}>
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><span className={cx("h-2 w-2 rounded-full", s.dot)} />{s.label}</span>
                <span className="rounded-full bg-white px-2 text-xs font-semibold text-slate-500">{col.length}</span>
              </div>
              <div className="flex max-h-[calc(100vh-300px)] min-h-[120px] flex-col gap-2 overflow-y-auto px-2 pb-2">
                {col.slice(0, 60).map((l) => (
                  <div key={l.id} draggable={writable} onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)}
                    className="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-brand-300" onClick={() => onOpen(l.id)}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800">{l.fullName}</p>
                      {l.priority === "high" && <Badge className={PRIORITY.high.cls}>Ưu tiên</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{PROGRAM_LABEL[l.program]}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span className="inline-flex min-w-0 items-center gap-1"><Avatar name={staffName(l.ownerId)} size={18} /><span className="truncate">{staffName(l.ownerId)}</span></span>
                      <span>{CHANNEL_LABEL[l.channel]}</span>
                    </div>
                    {writable && (
                      <select aria-label="Chuyển giai đoạn" value={l.stage} onClick={(e) => e.stopPropagation()} onChange={(e) => move(l.id, e.target.value as LeadStage)}
                        className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 lg:hidden">
                        {STAGES.map((x) => <option key={x.key} value={x.key}>→ {x.label}</option>)}
                      </select>
                    )}
                  </div>
                ))}
                {col.length > 60 && <p className="py-1 text-center text-xs text-slate-400">+{col.length - 60} khách – dùng bộ lọc để thu hẹp</p>}
                {col.length === 0 && <p className="py-6 text-center text-xs text-slate-400">Kéo thả khách vào đây</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
