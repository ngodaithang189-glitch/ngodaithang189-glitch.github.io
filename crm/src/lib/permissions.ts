// Ma trận phân quyền theo vai trò + phạm vi dữ liệu theo chi nhánh.
// Ở bản thật, quy tắc phạm vi dữ liệu được thực thi bằng Row Level Security (RLS)
// trên Supabase (xem supabase/migrations/0002_rls.sql); giao diện chỉ ẩn/hiện cho dễ dùng.
import type { DB, Lead, Role, Staff, StudentCase } from "./types";

export type ModuleKey =
  | "dashboard" | "leads" | "assignment" | "appointments" | "cases" | "visa"
  | "finance" | "kpi" | "marketing" | "branches" | "data" | "audit";

export type Access = "none" | "read" | "write";

export const PERMISSIONS: Record<Role, Record<ModuleKey, Access>> = {
  director: {
    dashboard: "write", leads: "write", assignment: "write", appointments: "write", cases: "write", visa: "write",
    finance: "write", kpi: "write", marketing: "write", branches: "write", data: "write", audit: "read",
  },
  branch_manager: {
    dashboard: "read", leads: "write", assignment: "write", appointments: "write", cases: "write", visa: "write",
    finance: "read", kpi: "read", marketing: "read", branches: "read", data: "write", audit: "read",
  },
  counselor: {
    dashboard: "read", leads: "write", assignment: "none", appointments: "write", cases: "read", visa: "read",
    finance: "none", kpi: "read", marketing: "none", branches: "none", data: "none", audit: "none",
  },
  accountant: {
    dashboard: "read", leads: "none", assignment: "none", appointments: "none", cases: "read", visa: "read",
    finance: "write", kpi: "none", marketing: "read", branches: "none", data: "write", audit: "none",
  },
  case_officer: {
    dashboard: "read", leads: "none", assignment: "none", appointments: "read", cases: "write", visa: "write",
    finance: "none", kpi: "none", marketing: "none", branches: "none", data: "none", audit: "none",
  },
};

export const can = (role: Role, mod: ModuleKey, need: Access = "read") => {
  const a = PERMISSIONS[role][mod];
  return need === "read" ? a !== "none" : a === "write";
};

/** Có được xem số liệu tài chính (doanh thu, công nợ) hay không */
export const canSeeMoney = (role: Role) => role === "director" || role === "accountant" || role === "branch_manager";

export function scopeLeads(db: DB, me: Staff): Lead[] {
  switch (me.role) {
    case "director": return db.leads;
    case "branch_manager": return db.leads.filter((l) => l.branchId === me.branchId);
    case "counselor": return db.leads.filter((l) => l.ownerId === me.id);
    default: return [];
  }
}

export function scopeCases(db: DB, me: Staff): StudentCase[] {
  switch (me.role) {
    case "director":
    case "accountant": return db.cases;
    case "branch_manager": return db.cases.filter((c) => c.branchId === me.branchId);
    case "counselor": return db.cases.filter((c) => c.counselorId === me.id);
    case "case_officer": return db.cases.filter((c) => c.caseOfficerId === me.id);
  }
}

export function scopeStaff(db: DB, me: Staff): Staff[] {
  if (me.role === "director" || me.role === "accountant") return db.staff;
  if (me.role === "branch_manager") return db.staff.filter((s) => s.branchId === me.branchId);
  return db.staff.filter((s) => s.id === me.id);
}
