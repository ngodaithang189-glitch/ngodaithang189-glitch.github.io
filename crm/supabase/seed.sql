-- Dữ liệu mẫu GIẢ LẬP cho môi trường phát triển. Không phải chi nhánh thật.
-- Tài khoản người dùng tạo qua Supabase Auth, sau đó thêm dòng vào bảng profiles.
insert into branches (id, name, city, address) values
  ('00000000-0000-0000-0000-000000000001', '[DEMO] Trụ sở Hà Nội', 'Hà Nội', 'Địa chỉ giả lập'),
  ('00000000-0000-0000-0000-000000000002', '[DEMO] Chi nhánh Hải Phòng', 'Hải Phòng', 'Địa chỉ giả lập'),
  ('00000000-0000-0000-0000-000000000003', '[DEMO] Chi nhánh Nghệ An', 'Nghệ An', 'Địa chỉ giả lập')
on conflict (id) do nothing;
