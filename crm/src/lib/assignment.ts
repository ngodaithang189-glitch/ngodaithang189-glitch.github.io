// Thuật toán phân bổ khách hàng tự động – hàm thuần, dễ kiểm thử và dễ chuyển
// sang Supabase Edge Function / Postgres function ở giai đoạn sau.
import type { AssignmentSettings, DB, Lead, Staff } from "./types";

export interface AssignmentResult {
  leadId: string;
  staffId: string;
  reason: string;
}

const ACTIVE_STAGES = new Set(["new", "contacted", "consulting", "interested"]);

export function activeLoad(db: DB, staffId: string) {
  return db.leads.filter((l) => l.ownerId === staffId && ACTIVE_STAGES.has(l.stage)).length;
}

export function conversionRate(db: DB, staffId: string) {
  const mine = db.leads.filter((l) => l.ownerId === staffId);
  const closed = mine.filter((l) => l.stage === "contract").length;
  const decided = mine.filter((l) => l.stage === "contract" || l.stage === "lost").length;
  return decided ? closed / decided : 0;
}

/** Gợi ý chi nhánh theo tỉnh của khách (đơn giản: trùng thành phố, mặc định trụ sở) */
export function branchForProvince(db: DB, province: string) {
  const near: Record<string, string> = { "Hà Tĩnh": "Nghệ An", "Thanh Hóa": "Nghệ An", "Quảng Ninh": "Hải Phòng", "Hải Dương": "Hải Phòng", "Thái Bình": "Hải Phòng" };
  const city = near[province] ?? province;
  return db.branches.find((b) => b.city === city)?.id ?? db.branches[0].id;
}

export function planAssignment(db: DB, leads: Lead[], s: AssignmentSettings): { results: AssignmentResult[]; lastIndex: Record<string, number> } {
  const counselors = db.staff.filter((x) => x.role === "counselor" && x.active);
  const load = new Map(counselors.map((c) => [c.id, activeLoad(db, c.id)]));
  const lastIndex = { ...s.lastIndex };
  const results: AssignmentResult[] = [];

  for (const lead of leads) {
    const branchId = s.strategy === "by_branch" ? branchForProvince(db, lead.province) : lead.branchId;
    let pool: Staff[] = s.respectBranch || s.strategy === "by_branch" ? counselors.filter((c) => c.branchId === branchId) : counselors;
    if (s.respectCapacity) pool = pool.filter((c) => (load.get(c.id) ?? 0) < c.maxActiveLeads);
    if (!pool.length) continue;

    let chosen: Staff;
    let reason: string;
    if (s.strategy === "least_load") {
      chosen = [...pool].sort((a, b) => (load.get(a.id)! - load.get(b.id)!))[0];
      reason = `Đang chăm sóc ít khách nhất (${load.get(chosen.id)} khách)`;
    } else if (s.strategy === "performance") {
      // Điểm = tỷ lệ chốt * 0.7 + (1 - tải/tải tối đa) * 0.3 để tránh dồn hết cho 1 người
      const score = (c: Staff) => conversionRate(db, c.id) * 0.7 + (1 - (load.get(c.id)! / c.maxActiveLeads)) * 0.3;
      chosen = [...pool].sort((a, b) => score(b) - score(a))[0];
      reason = `Tỷ lệ chốt ${(conversionRate(db, chosen.id) * 100).toFixed(0)}%, tải ${load.get(chosen.id)}/${chosen.maxActiveLeads}`;
    } else {
      const key = s.strategy === "by_branch" || s.respectBranch ? branchId : "all";
      const idx = ((lastIndex[key] ?? -1) + 1) % pool.length;
      lastIndex[key] = idx;
      chosen = pool[idx];
      reason = s.strategy === "by_branch" ? `Khu vực ${lead.province} → xoay vòng trong chi nhánh` : "Đến lượt theo vòng xoay";
    }
    load.set(chosen.id, (load.get(chosen.id) ?? 0) + 1);
    results.push({ leadId: lead.id, staffId: chosen.id, reason });
  }
  return { results, lastIndex };
}
