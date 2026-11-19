-- 0002_rls.sql: Row Level Security theo vai trò & chi nhánh + trigger nhật ký
-- Khớp phạm vi trong src/lib/permissions.ts.
-- Lưu ý: không đặt tên hàm current_role() vì trùng từ khóa SQL CURRENT_ROLE -> dùng app_role()/app_branch().

-- ===== Hàm trợ giúp =====
create or replace function app_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active
$$;

create or replace function app_branch() returns uuid
language sql stable security definer set search_path = public as $$
  select branch_id from profiles where id = auth.uid() and active
$$;

create or replace function is_director() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_role() = 'director', false)
$$;

-- Người dùng có được xem khách hàng này không
create or replace function can_see_lead(l_branch uuid, l_owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case app_role()
    when 'director' then true
    when 'branch_manager' then l_branch = app_branch()
    when 'counselor' then l_owner = auth.uid()
    else false
  end
$$;

create or replace function can_see_case(c_branch uuid, c_counselor uuid, c_officer uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case app_role()
    when 'director' then true
    when 'accountant' then true
    when 'branch_manager' then c_branch = app_branch()
    when 'counselor' then c_counselor = auth.uid()
    when 'case_officer' then c_officer = auth.uid()
    else false
  end
$$;

-- ===== Bật RLS =====
alter table branches enable row level security;
alter table profiles enable row level security;
alter table campaigns enable row level security;
alter table leads enable row level security;
alter table interactions enable row level security;
alter table appointments enable row level security;
alter table student_cases enable row level security;
alter table case_documents enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;
alter table audit_logs enable row level security;
alter table assignment_settings enable row level security;

-- ===== Chi nhánh =====
create policy branches_select on branches for select to authenticated using (app_role() is not null);
create policy branches_write on branches for all to authenticated using (is_director()) with check (is_director());

-- ===== Nhân sự =====
create policy profiles_select on profiles for select to authenticated using (
  id = auth.uid()
  or app_role() in ('director', 'accountant')
  or (app_role() = 'branch_manager' and branch_id = app_branch())
);
create policy profiles_write on profiles for all to authenticated using (is_director()) with check (is_director());

-- ===== Chiến dịch =====
create policy campaigns_select on campaigns for select to authenticated
  using (app_role() in ('director', 'branch_manager', 'accountant'));
create policy campaigns_write on campaigns for all to authenticated using (is_director()) with check (is_director());

-- ===== Khách hàng =====
create policy leads_select on leads for select to authenticated
  using (deleted_at is null and can_see_lead(branch_id, owner_id));
create policy leads_insert on leads for insert to authenticated with check (
  app_role() = 'director'
  or (app_role() = 'branch_manager' and branch_id = app_branch())
  or (app_role() = 'counselor' and branch_id = app_branch() and (owner_id is null or owner_id = auth.uid()))
);
create policy leads_update on leads for update to authenticated
  using (can_see_lead(branch_id, owner_id))
  with check (
    app_role() = 'director'
    or (app_role() = 'branch_manager' and branch_id = app_branch())
    or (app_role() = 'counselor' and owner_id = auth.uid())   -- tư vấn không tự chuyển khách cho người khác
  );
-- Không cho DELETE cứng; xóa mềm qua cột deleted_at (chỉ giám đốc/quản lý)
-- Không cấp quyền DELETE: khách hàng chỉ được xóa mềm (cập nhật cột deleted_at) để giữ lịch sử và nhật ký.
-- Xóa vĩnh viễn (theo yêu cầu của chủ thể dữ liệu) thực hiện qua quy trình riêng bằng service role phía server.

-- ===== Lịch sử tư vấn & lịch hẹn: theo quyền xem khách =====
create policy interactions_select on interactions for select to authenticated using (
  exists (select 1 from leads l where l.id = lead_id and can_see_lead(l.branch_id, l.owner_id))
);
create policy interactions_insert on interactions for insert to authenticated with check (
  staff_id = auth.uid()
  and exists (select 1 from leads l where l.id = lead_id and can_see_lead(l.branch_id, l.owner_id))
);

create policy appointments_select on appointments for select to authenticated using (
  staff_id = auth.uid()
  or exists (select 1 from leads l where l.id = lead_id and can_see_lead(l.branch_id, l.owner_id))
  or (app_role() = 'case_officer' and exists (
        select 1 from student_cases c where c.lead_id = appointments.lead_id and c.case_officer_id = auth.uid()))
);
create policy appointments_write on appointments for all to authenticated
  using (exists (select 1 from leads l where l.id = lead_id and can_see_lead(l.branch_id, l.owner_id)))
  with check (exists (select 1 from leads l where l.id = lead_id and can_see_lead(l.branch_id, l.owner_id)));

-- ===== Hồ sơ du học =====
create policy cases_select on student_cases for select to authenticated
  using (can_see_case(branch_id, counselor_id, case_officer_id));
create policy cases_insert on student_cases for insert to authenticated with check (
  app_role() = 'director'
  or (app_role() in ('branch_manager', 'counselor') and branch_id = app_branch())
);
create policy cases_update on student_cases for update to authenticated
  using (
    app_role() = 'director'
    or (app_role() = 'branch_manager' and branch_id = app_branch())
    or (app_role() = 'case_officer' and case_officer_id = auth.uid())
  )
  with check (
    app_role() = 'director'
    or (app_role() = 'branch_manager' and branch_id = app_branch())
    or (app_role() = 'case_officer' and case_officer_id = auth.uid())
  );

create policy docs_select on case_documents for select to authenticated using (
  exists (select 1 from student_cases c where c.id = case_id and can_see_case(c.branch_id, c.counselor_id, c.case_officer_id))
);
create policy docs_write on case_documents for all to authenticated
  using (exists (select 1 from student_cases c where c.id = case_id and (
    app_role() = 'director'
    or (app_role() = 'branch_manager' and c.branch_id = app_branch())
    or (app_role() = 'case_officer' and c.case_officer_id = auth.uid()))))
  with check (exists (select 1 from student_cases c where c.id = case_id and (
    app_role() = 'director'
    or (app_role() = 'branch_manager' and c.branch_id = app_branch())
    or (app_role() = 'case_officer' and c.case_officer_id = auth.uid()))));

-- ===== Tài chính: giám đốc & kế toán ghi; quản lý chi nhánh chỉ xem =====
create policy invoices_select on invoices for select to authenticated using (
  app_role() in ('director', 'accountant')
  or (app_role() = 'branch_manager' and exists (
        select 1 from student_cases c where c.id = case_id and c.branch_id = app_branch()))
);
create policy invoices_insert on invoices for insert to authenticated
  with check (app_role() in ('director', 'accountant'));
create policy invoices_update on invoices for update to authenticated
  using (app_role() in ('director', 'accountant'))
  with check (app_role() in ('director', 'accountant'));

create policy payments_select on payments for select to authenticated using (
  app_role() in ('director', 'accountant')
  or (app_role() = 'branch_manager' and exists (
        select 1 from invoices i join student_cases c on c.id = i.case_id
        where i.id = invoice_id and c.branch_id = app_branch()))
);
-- Thanh toán chỉ được thêm, không sửa/xóa (điều chỉnh bằng bút toán âm ở giai đoạn 4)
create policy payments_insert on payments for insert to authenticated
  with check (app_role() in ('director', 'accountant') and received_by = auth.uid());

-- ===== Nhật ký: chỉ đọc cho giám đốc / quản lý; chỉ thêm, không ai sửa/xóa =====
create policy audit_select on audit_logs for select to authenticated using (
  app_role() = 'director'
  or (app_role() = 'branch_manager' and exists (
        select 1 from profiles p where p.id = actor_id and p.branch_id = app_branch()))
);
create policy audit_insert on audit_logs for insert to authenticated
  with check (actor_id = auth.uid());
-- Không tạo policy UPDATE/DELETE => bị từ chối với mọi người dùng.
revoke update, delete, truncate on audit_logs from authenticated, anon;

-- ===== Cấu hình phân bổ =====
create policy assign_select on assignment_settings for select to authenticated
  using (app_role() in ('director', 'branch_manager'));
create policy assign_update on assignment_settings for update to authenticated
  using (app_role() in ('director', 'branch_manager'))
  with check (app_role() in ('director', 'branch_manager'));

-- ===== Trigger nhật ký tự động =====
create or replace function audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_changes jsonb;
begin
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(n.key, jsonb_build_object('from', v_old -> n.key, 'to', n.value)), '{}'::jsonb)
      into v_changes
    from jsonb_each(v_new) n
    where n.key <> 'updated_at' and (v_old -> n.key) is distinct from n.value;
    if v_changes = '{}'::jsonb then
      return new;
    end if;
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id, summary, old_data, new_data, changes)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(v_new ->> 'id', v_old ->> 'id'),
    tg_op || ' ' || tg_table_name,
    v_old, v_new, v_changes
  );
  return coalesce(new, old);
end $$;

create trigger audit_leads after insert or update or delete on leads for each row execute function audit_trigger();
create trigger audit_cases after insert or update or delete on student_cases for each row execute function audit_trigger();
create trigger audit_invoices after insert or update or delete on invoices for each row execute function audit_trigger();
create trigger audit_payments after insert or update or delete on payments for each row execute function audit_trigger();

-- ===== Storage: bucket private cho file hồ sơ =====
-- Tạo bucket "ho-so" (public = false) trong Supabase Dashboard hoặc:
-- insert into storage.buckets (id, name, public) values ('ho-so', 'ho-so', false);
-- Truy cập file chỉ qua signed URL do server tạo sau khi kiểm tra can_see_case().
