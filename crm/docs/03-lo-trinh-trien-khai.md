# Lộ trình triển khai theo giai đoạn

Nguyên tắc: làm từng giai đoạn nhỏ, thầy duyệt + kiểm thử xong mới sang giai đoạn sau.

| GĐ | Nội dung | Sản phẩm bàn giao | Tiêu chí nghiệm thu |
|---|---|---|---|
| 1 | Phân tích + kiến trúc + **demo dữ liệu giả lập** (hiện tại) | Tài liệu docs/, lược đồ SQL, bản demo 12 phân hệ | Thầy thao tác được trên PC & điện thoại, chốt danh sách điều chỉnh |
| 2 | CRM thật + đăng nhập + phân quyền | Supabase project, Auth + MFA, RLS, CRM/phân bổ/lịch hẹn chạy dữ liệu thật | Tư vấn viên chỉ thấy khách của mình (kiểm thử bằng API trực tiếp); nhập 1 file khách cũ thành công |
| 3 | Hồ sơ du học + visa + lưu trữ file | Checklist giấy tờ theo chương trình, upload scan, Kanban visa | File chỉ mở qua signed URL; mọi thay đổi có nhật ký |
| 4 | Tài chính | Khoản thu theo đợt, thanh toán, công nợ, phiếu thu PDF | Số liệu công nợ khớp đối chiếu kế toán 1 tháng |
| 5 | Báo cáo, KPI, marketing | Dashboard số liệu thật, KPI theo công thức thầy duyệt, ROI kênh quảng cáo | Báo cáo tháng xuất được, số liệu khớp đối chiếu thủ công |
| 6 | Nhập/xuất Excel, Google Sheets, tích hợp | Đồng bộ Sheets, webhook Zalo OA / FB Lead Ads → tạo lead | Lead từ quảng cáo vào hệ thống và được phân bổ trong vòng vài phút |
| 7 | Kiểm thử chức năng, bảo mật, hiệu năng | Bộ test tự động, rà soát RLS, CSP, kiểm thử tải, diễn tập phục hồi | Không còn lỗi nghiêm trọng; khôi phục bản sao lưu thành công |
| 8 | Đào tạo & go-live | Hướng dẫn sử dụng theo vai trò, video ngắn, chuyển dữ liệu cũ | Nhân viên tự thao tác công việc hằng ngày; vận hành song song 2 tuần rồi chuyển hẳn |

## Checklist để thầy duyệt bản demo

- [ ] Tổng quan: các chỉ số và biểu đồ đã đúng thứ thầy cần xem mỗi sáng chưa? Thiếu chỉ số nào?
- [ ] Khách hàng: các giai đoạn (Mới → Đã ký HĐ / Dừng) có khớp quy trình thực tế không?
- [ ] Thử kéo thả Kanban, thêm khách mới, ghi lịch sử chăm sóc, đặt lịch hẹn.
- [ ] Phân bổ tự động: chiến lược nào phù hợp nhất với công ty?
- [ ] Hồ sơ: danh mục giấy tờ có đủ cho từng chương trình (D-4-1, D-2, D-4-6, E-9)? *(cần đối chiếu yêu cầu chính thức hiện hành)*
- [ ] Tài chính: cách chia đợt thu phí đã đúng chưa?
- [ ] KPI: công thức tính có phù hợp không?
- [ ] Đổi vai trò (góc trên bên phải) để xem mỗi nhân viên thấy gì – phân quyền đã hợp lý chưa?
- [ ] Trên điện thoại: có thao tác thuận tiện không?
- [ ] Trả lời các câu hỏi ở mục “Yêu cầu còn thiếu” trong `01-phan-tich-nghiep-vu.md`.
