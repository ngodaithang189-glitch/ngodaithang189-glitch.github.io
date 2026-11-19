"use client";
import { Building2, Pencil, Search, ShieldCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { NAV } from "@/components/nav";
import { Avatar, Badge, Button, Card, CardHeader, Field, Modal, PageHeader, Select, Table, cx, inputCls, td, th } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/constants";
import { vndShort, normalize } from "@/lib/format";
import { PERMISSIONS, can, canSeeMoney, type Access } from "@/lib/permissions";
import { useStore } from "@/lib/store";
import type { Role, Staff } from "@/lib/types";

const ROLES = Object.keys(ROLE_LABEL) as Role[];

const ACCESS_CELL: Record<Access, { label: string; cls: string }> = {
  write: { label: "Toàn quyền", cls: "bg-emerald-100 text-emerald-700" },
  read: { label: "Chỉ xem", cls: "bg-sky-100 text-sky-700" },
  none: { label: "—", cls: "bg-transparent text-slate-300" },
};

const SCOPE: { role: Role; text: string }[] = [
  { role: "director", text: "Toàn hệ thống: mọi chi nhánh, khách hàng, hồ sơ, tài chính." },
  { role: "branch_manager", text: "Chỉ dữ liệu thuộc chi nhánh mình quản lý." },
  { role: "counselor", text: "Chỉ khách hàng mình phụ trách và hồ sơ của khách đó." },
  { role: "accountant", text: "Dữ liệu tài chính (hóa đơn, thanh toán, công nợ) toàn hệ thống; hồ sơ chỉ xem." },
  { role: "case_officer", text: "Chỉ hồ sơ du học / visa được giao xử lý." },
];

export default function BranchesPage() {
  const { db, me, actions } = useStore();
  const writable = can(me.role, "branches", "write");
  const money = canSeeMoney(me.role);
  const [branch, setBranch] = useState(me.role === "director" ? "" : me.branchId);
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Staff | null>(null);

  const branchStats = useMemo(() => {
    const paid = new Map<string, number>();
    for (const p of db.payments) {
      const inv = db.invoices.find((i) => i.id === p.invoiceId);
      const c = inv && db.cases.find((x) => x.id === inv.caseId);
      if (c) paid.set(c.branchId, (paid.get(c.branchId) ?? 0) + p.amount);
    }
    return db.branches
      .filter((b) => me.role === "director" || me.role === "accountant" || b.id === me.branchId)
      .map((b) => ({
        b,
        manager: db.staff.find((s) => s.id === b.managerId),
        staff: db.staff.filter((s) => s.branchId === b.id && s.active).length,
        leads: db.leads.filter((l) => l.branchId === b.id).length,
        cases: db.cases.filter((c) => c.branchId === b.id).length,
        revenue: paid.get(b.id) ?? 0,
      }));
  }, [db, me]);

  const staff = useMemo(() => {
    const n = normalize(q.trim());
    return db.staff
      .filter((s) => me.role === "director" || s.branchId === me.branchId)
      .filter((s) => (!branch || s.branchId === branch) && (!role || s.role === role))
      .filter((s) => !n || normalize(`${s.fullName} ${s.phone} ${s.email}`).includes(n));
  }, [db.staff, me, branch, role, q]);

  const moduleLabel = (m: string) => NAV.find((n) => n.module === m)?.label ?? m;

  return (
    <div className="space-y-6">
      <PageHeader title="Chi nhánh & phân quyền" desc="Quản lý chi nhánh, nhân sự, vai trò và phạm vi truy cập dữ liệu." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {branchStats.map(({ b, manager, staff: ns, leads, cases, revenue }) => (
          <Card key={b.id} className="p-4">
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-brand-50 p-2 text-brand-600"><Building2 size={20} /></span>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{b.name}</p>
                <p className="text-xs text-slate-500">{b.city} · Quản lý: {manager?.fullName ?? "Chưa có"}</p>
              </div>
            </div>
            <div className={cx("mt-4 grid gap-2 text-center", money ? "grid-cols-4" : "grid-cols-3")}>
              {[["Nhân sự", ns], ["Khách hàng", leads], ["Hồ sơ", cases], ...(money ? [["Đã thu", vndShort(revenue)]] : [])].map(([k, v]) => (
                <div key={String(k)} className="rounded-lg bg-slate-50 py-2">
                  <p className="text-base font-bold tabular-nums text-slate-900">{v}</p>
                  <p className="text-[11px] text-slate-500">{k}</p>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title={<span className="inline-flex items-center gap-2"><Users size={16} /> Nhân sự ({staff.length})</span>} subtitle={writable ? "Bấm biểu tượng bút để sửa vai trò, chi nhánh, chỉ tiêu." : "Chế độ chỉ xem"} />
        <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên, SĐT, email…" className={cx(inputCls, "pl-9")} aria-label="Tìm nhân sự" />
          </div>
          {me.role === "director" && (
            <Select value={branch} onChange={setBranch} placeholder="Tất cả chi nhánh" options={db.branches.map((b) => ({ value: b.id, label: b.name }))} />
          )}
          <Select value={role} onChange={setRole} placeholder="Tất cả vai trò" options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
        </div>
        <Table>
          <thead>
            <tr>
              <th className={th}>Nhân viên</th><th className={th}>Vai trò</th><th className={th}>Chi nhánh</th>
              <th className={th}>Liên hệ</th><th className={th}>Chỉ tiêu/tháng</th><th className={th}>Tải tối đa</th><th className={th}>Trạng thái</th>
              {writable && <th className={th}></th>}
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/60">
                <td className={td}><div className="flex items-center gap-2"><Avatar name={s.fullName} /><span className="font-medium text-slate-800">{s.fullName}</span></div></td>
                <td className={td}><Badge className="bg-brand-50 text-brand-700">{ROLE_LABEL[s.role]}</Badge></td>
                <td className={td}>{db.branches.find((b) => b.id === s.branchId)?.name}</td>
                <td className={td}><p>{s.phone}</p><p className="text-xs text-slate-400">{s.email}</p></td>
                <td className={cx(td, "tabular-nums")}>{s.role === "counselor" ? `${s.monthlyTarget} HĐ` : "—"}</td>
                <td className={cx(td, "tabular-nums")}>{s.role === "counselor" ? s.maxActiveLeads : "—"}</td>
                <td className={td}>{s.active ? <Badge className="bg-emerald-100 text-emerald-700">Hoạt động</Badge> : <Badge className="bg-slate-100 text-slate-500">Tạm khóa</Badge>}</td>
                {writable && (
                  <td className={td}>
                    <button onClick={() => setEditing(s)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600" aria-label={`Sửa ${s.fullName}`}><Pencil size={16} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader title={<span className="inline-flex items-center gap-2"><ShieldCheck size={16} /> Ma trận phân quyền theo vai trò</span>} subtitle="Quyền truy cập từng phân hệ. Có thể đổi tài khoản demo ở góc trên bên phải để trải nghiệm." />
        <Table>
          <thead>
            <tr>
              <th className={th}>Phân hệ</th>
              {ROLES.map((r) => <th key={r} className={cx(th, "text-center", r === me.role && "text-brand-700")}>{ROLE_LABEL[r]}</th>)}
            </tr>
          </thead>
          <tbody>
            {(Object.keys(PERMISSIONS.director) as (keyof typeof PERMISSIONS.director)[]).map((m) => (
              <tr key={m}>
                <td className={cx(td, "font-medium text-slate-800")}>{moduleLabel(m)}</td>
                {ROLES.map((r) => {
                  const a = ACCESS_CELL[PERMISSIONS[r][m]];
                  return <td key={r} className={cx(td, "text-center", r === me.role && "bg-brand-50/40")}><Badge className={a.cls}>{a.label}</Badge></td>;
                })}
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-800">Phạm vi dữ liệu</p>
            <ul className="space-y-1.5 text-sm text-slate-600">
              {SCOPE.map((s) => <li key={s.role}><b className="text-slate-800">{ROLE_LABEL[s.role]}:</b> {s.text}</li>)}
            </ul>
          </div>
          <div className="rounded-lg border border-brand-100 bg-brand-50/60 p-3 text-sm text-slate-700">
            <p className="font-semibold text-brand-800">Bảo mật ở bản chính thức</p>
            <p className="mt-1">Giao diện chỉ ẩn/hiện cho dễ dùng. Ở bản thật, phạm vi dữ liệu được thực thi tại cơ sở dữ liệu bằng
              <b> Row Level Security (RLS) của Supabase</b>: kể cả gọi API trực tiếp, người dùng cũng không đọc được dữ liệu ngoài phạm vi của mình.
              Mọi thay đổi quyền đều được ghi vào nhật ký hoạt động.</p>
          </div>
        </div>
      </Card>

      {editing && <EditStaff staff={editing} onClose={() => setEditing(null)} onSave={(p) => { actions.updateStaff(editing.id, p); setEditing(null); }} branches={db.branches} canChangeBranch={me.role === "director"} />}
    </div>
  );
}

function EditStaff({ staff, onClose, onSave, branches, canChangeBranch }: {
  staff: Staff; onClose: () => void; onSave: (p: Partial<Staff>) => void; branches: { id: string; name: string }[]; canChangeBranch: boolean;
}) {
  const [f, setF] = useState({ role: staff.role, branchId: staff.branchId, active: staff.active, monthlyTarget: staff.monthlyTarget, maxActiveLeads: staff.maxActiveLeads });
  const isDirector = staff.role === "director";
  return (
    <Modal open onClose={onClose} title={`Sửa nhân sự – ${staff.fullName}`}
      footer={<><Button variant="secondary" onClick={onClose}>Hủy</Button><Button onClick={() => onSave(f)}>Lưu thay đổi</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Vai trò">
          <Select value={f.role} onChange={(v) => setF({ ...f, role: v as Role })} options={ROLES.filter((r) => isDirector || r !== "director").map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
        </Field>
        <Field label="Chi nhánh" hint={canChangeBranch ? undefined : "Chỉ Giám đốc được điều chuyển chi nhánh"}>
          <select disabled={!canChangeBranch} value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })} className={cx(inputCls, "disabled:bg-slate-50")}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="Chỉ tiêu hợp đồng/tháng">
          <input type="number" min={0} value={f.monthlyTarget} onChange={(e) => setF({ ...f, monthlyTarget: Math.max(0, Number(e.target.value)) })} className={inputCls} />
        </Field>
        <Field label="Số khách tối đa đang chăm sóc" hint="Dùng cho phân bổ tự động">
          <input type="number" min={0} value={f.maxActiveLeads} onChange={(e) => setF({ ...f, maxActiveLeads: Math.max(0, Number(e.target.value)) })} className={inputCls} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
          <input type="checkbox" checked={f.active} disabled={isDirector} onChange={(e) => setF({ ...f, active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
          Tài khoản đang hoạt động (bỏ chọn để tạm khóa đăng nhập)
        </label>
      </div>
    </Modal>
  );
}
