# DU HỌC TH – CRM & MANAGEMENT

Phần mềm quản trị nội bộ cho DU HỌC TH: tuyển sinh, chăm sóc khách hàng, hồ sơ du học, tiến độ visa, tài chính, KPI và báo cáo.

> **Giai đoạn hiện tại: Bản DEMO** – dùng **dữ liệu giả lập**, lưu tạm trong trình duyệt (localStorage). Không nhập thông tin khách hàng thật vào bản demo.

## Công nghệ
Next.js (App Router) · TypeScript · Tailwind CSS · Recharts · (giai đoạn 2) Supabase PostgreSQL + Auth + Storage · triển khai Vercel.

## Chạy trên máy

```bash
cd crm
npm install
npm run dev        # mở http://localhost:3000
npm run build      # kiểm tra bản build production
```

Yêu cầu Node.js 20 trở lên.

## Tài khoản demo
Không cần đăng nhập. Ở góc trên bên phải có ô **đổi tài khoản demo** để xem giao diện theo từng vai trò:
Giám đốc · Quản lý chi nhánh · Tư vấn viên · Kế toán · Xử lý hồ sơ. Menu và dữ liệu thay đổi theo quyền.
Nút **“Khôi phục dữ liệu mẫu”** ở cuối thanh menu tạo lại bộ dữ liệu giả lập mới.

## Cấu trúc thư mục

```
crm/
├─ src/app/          # Các trang (mỗi phân hệ một route)
├─ src/components/   # AppShell, thành phần giao diện dùng chung
├─ src/lib/          # types, phân quyền, phân bổ, kho dữ liệu demo, dữ liệu giả lập
├─ supabase/         # migrations SQL (lược đồ + RLS) và seed
└─ docs/             # Tài liệu phân tích, kiến trúc, lộ trình
```

## Triển khai lên Vercel
1. Vào vercel.com → **Add New Project** → chọn repository này trên GitHub.
2. **Root Directory**: `crm`. Framework: Next.js (tự nhận).
3. Bản demo **không cần biến môi trường**. Bấm Deploy.
4. Từ giai đoạn 2: thêm `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` trong *Project Settings → Environment Variables* (xem `.env.example`).

## Bảo mật
- Không bao giờ commit `.env.local` hay API key (đã có trong `.gitignore`).
- `SUPABASE_SERVICE_ROLE_KEY` chỉ dùng phía server.
- Phân quyền thật được thực thi bằng Row Level Security trong `supabase/migrations/0002_rls.sql`.

## Tài liệu
- [Bước 1 – Phân tích nghiệp vụ](docs/01-phan-tich-nghiep-vu.md)
- [Bước 2 – Kiến trúc hệ thống & CSDL](docs/02-kien-truc-he-thong.md)
- [Lộ trình triển khai & checklist duyệt demo](docs/03-lo-trinh-trien-khai.md)

> Thông tin visa, học phí, học bổng, quy định trong phần mềm chỉ mang tính minh họa – cần xác minh với nguồn chính thức. Phần mềm không cam kết kết quả visa hay việc làm.
