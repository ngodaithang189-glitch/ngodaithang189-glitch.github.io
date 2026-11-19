"use client";
// Bảng màu & tiện ích biểu đồ dùng chung (Recharts). Giữ đồng bộ tông xanh dương.
export const CHART = {
  primary: "#2563eb",
  primarySoft: "#93c5fd",
  green: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  slate: "#94a3b8",
  grid: "#eef2f7",
  axis: "#64748b",
  // Thứ tự màu cho các nhóm phân loại (nguồn khách, chi nhánh…)
  series: ["#2563eb", "#0ea5e9", "#6366f1", "#14b8a6", "#f59e0b", "#94a3b8", "#8b5cf6", "#f43f5e", "#64748b"],
};

export const axisProps = { stroke: CHART.axis, fontSize: 11, tickLine: false, axisLine: false } as const;

export const tooltipStyle = {
  contentStyle: { borderRadius: 10, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(15,23,42,.08)", fontSize: 12 },
  labelStyle: { color: "#0f172a", fontWeight: 600 },
} as const;
