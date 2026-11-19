import {
  Building2, CalendarClock, FileSpreadsheet, FolderOpen, History, LayoutDashboard, Megaphone, Plane, Shuffle, Trophy, Users, Wallet,
} from "lucide-react";
import type { ModuleKey } from "@/lib/permissions";

export const NAV: { href: string; label: string; module: ModuleKey; icon: typeof Users; group: string }[] = [
  { href: "/", label: "Tổng quan", module: "dashboard", icon: LayoutDashboard, group: "Điều hành" },
  { href: "/khach-hang", label: "Khách hàng (CRM)", module: "leads", icon: Users, group: "Tuyển sinh" },
  { href: "/phan-bo", label: "Phân bổ tự động", module: "assignment", icon: Shuffle, group: "Tuyển sinh" },
  { href: "/lich-hen", label: "Lịch hẹn & chăm sóc", module: "appointments", icon: CalendarClock, group: "Tuyển sinh" },
  { href: "/ho-so", label: "Hồ sơ du học", module: "cases", icon: FolderOpen, group: "Hồ sơ" },
  { href: "/visa", label: "Tiến độ visa", module: "visa", icon: Plane, group: "Hồ sơ" },
  { href: "/tai-chinh", label: "Tài chính & công nợ", module: "finance", icon: Wallet, group: "Tài chính" },
  { href: "/kpi", label: "KPI nhân viên", module: "kpi", icon: Trophy, group: "Báo cáo" },
  { href: "/marketing", label: "Nguồn & quảng cáo", module: "marketing", icon: Megaphone, group: "Báo cáo" },
  { href: "/chi-nhanh", label: "Chi nhánh & phân quyền", module: "branches", icon: Building2, group: "Hệ thống" },
  { href: "/du-lieu", label: "Nhập / xuất dữ liệu", module: "data", icon: FileSpreadsheet, group: "Hệ thống" },
  { href: "/nhat-ky", label: "Nhật ký hoạt động", module: "audit", icon: History, group: "Hệ thống" },
];
