"use client";
import { CircleCheck, Clock, Plane, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, Card, PageHeader, StatCard, cx } from "@/components/ui";
import { PROGRAM_LABEL, VISA_STAGES } from "@/lib/constants";
import { fmtDate, pct } from "@/lib/format";
import { can, scopeCases } from "@/lib/permissions";
import { useStore } from "@/lib/store";
import type { VisaStage } from "@/lib/types";

export default function VisaPage() {
  const { db, me, actions } = useStore();
  const writable = can(me.role, "visa", "write");
  const cases = scopeCases(db, me);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<VisaStage | null>(null);

  const count = (s: VisaStage[]) => cases.filter((c) => s.includes(c.visaStage)).length;
  const ok = count(["approved", "departed"]);
  const rejected = count(["rejected"]);
  const processing = count(["preparing", "school_applied", "admission", "visa_submitted", "interview"]);
  const rate = ok + rejected ? ok / (ok + rejected) : 0;

  const move = (id: string, stage: VisaStage) => {
    const c = cases.find((x) => x.id === id);
    if (c && c.visaStage !== stage) actions.updateCase(id, { visaStage: stage });
  };

  return (
    <>
      <PageHeader title="Tiến độ visa" desc={writable ? "Kéo thả thẻ giữa các cột (máy tính) hoặc chọn bước mới ngay trên thẻ (điện thoại)." : "Chế độ chỉ xem."} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Đang xử lý" value={processing} icon={<Clock size={16} />} />
        <StatCard label="Đỗ visa / đã xuất cảnh" value={ok} icon={<CircleCheck size={16} />} tone="green" />
        <StatCard label="Trượt visa" value={rejected} icon={<TriangleAlert size={16} />} tone="rose" />
        <StatCard label="Tỷ lệ đỗ" value={pct(rate)} sub="trên hồ sơ đã có kết quả" icon={<Plane size={16} />} tone="amber" />
      </div>

      <p className="mb-3 text-xs text-slate-500">Lưu ý: số liệu chỉ phản ánh tiến độ nội bộ. Kết quả visa do cơ quan có thẩm quyền quyết định – DU HỌC TH không cam kết kết quả visa.</p>

      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        <div className="flex gap-3" style={{ minWidth: VISA_STAGES.length * 260 }}>
          {VISA_STAGES.map((st) => {
            const items = cases.filter((c) => c.visaStage === st.key);
            return (
              <div key={st.key}
                onDragOver={(e) => { if (writable) { e.preventDefault(); setOver(st.key); } }}
                onDragLeave={() => setOver((o) => (o === st.key ? null : o))}
                onDrop={(e) => { e.preventDefault(); if (dragId) move(dragId, st.key); setDragId(null); setOver(null); }}
                className={cx("flex w-64 shrink-0 flex-col rounded-xl border bg-slate-100/70 transition", over === st.key ? "border-brand-400 bg-brand-50" : "border-slate-200")}>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <Badge className={st.color}>{st.label}</Badge>
                  <span className="text-xs font-semibold text-slate-500">{items.length}</span>
                </div>
                <div className="flex max-h-[65vh] min-h-24 flex-col gap-2 overflow-y-auto px-2 pb-2">
                  {items.map((c) => (
                    <Card key={c.id} draggable={writable}
                      onDragStart={() => setDragId(c.id)} onDragEnd={() => { setDragId(null); setOver(null); }}
                      className={cx("p-3", writable && "cursor-grab active:cursor-grabbing", dragId === c.id && "opacity-50")}>
                      <Link href={`/ho-so?open=${c.id}`} className="text-sm font-medium text-slate-800 hover:text-brand-700">{c.fullName}</Link>
                      <p className="text-xs text-slate-500">{c.code} · {c.visaType}</p>
                      <p className="mt-1 truncate text-xs text-slate-600">{c.school}</p>
                      <p className="text-xs text-slate-400">{PROGRAM_LABEL[c.program]} · Kỳ {c.intake}</p>
                      {c.expectedDeparture && <p className="mt-1 text-xs text-teal-700">Bay dự kiến {fmtDate(c.expectedDeparture)}</p>}
                      {writable && (
                        <select aria-label={`Chuyển bước cho ${c.fullName}`} value={c.visaStage} onChange={(e) => move(c.id, e.target.value as VisaStage)}
                          className="mt-2 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700">
                          {VISA_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                      )}
                    </Card>
                  ))}
                  {items.length === 0 && <p className="py-6 text-center text-xs text-slate-400">Trống</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
