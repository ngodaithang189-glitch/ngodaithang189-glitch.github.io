-- DU HỌC TH – CRM & MANAGEMENT
-- 0001_init.sql: lược đồ dữ liệu (khớp src/lib/types.ts)

create extension if not exists pgcrypto;

-- ===== Enum =====
create type app_role as enum ('director', 'branch_manager', 'counselor', 'accountant', 'case_officer');
create type program_type as enum ('du_hoc_tieng', 'dai_hoc', 'cao_hoc', 'nghe', 'lao_dong_eps');
create type lead_stage as enum ('new', 'contacted', 'consulting', 'interested', 'contract', 'lost');
create type source_channel as enum ('facebook_ads', 'tiktok_ads', 'google_ads', 'zalo', 'website', 'referral', 'event', 'walk_in', 'school_partner');
create type lead_priority as enum ('high', 'medium', 'low');
create type interaction_type as enum ('call', 'zalo', 'meeting', 'email', 'sms', 'note');
create type appointment_location as enum ('office', 'online', 'phone');
create type appointment_status as enum ('scheduled', 'done', 'missed', 'cancelled');
create type doc_status as enum ('missing', 'submitted', 'verified', 'rejected');
create type visa_stage as enum ('preparing', 'school_applied', 'admission', 'visa_submitted', 'interview', 'approved', 'rejected', 'departed');
create type fee_type as enum ('service', 'tuition', 'dormitory', 'insurance', 'translation', 'other');
create type payment_method as enum ('cash', 'bank_transfer', 'card');
create type assignment_strategy as enum ('round_robin', 'least_load', 'performance', 'by_branch');

-- ===== Hàm tiện ích =====
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Chuẩn hóa SĐT: bỏ ký tự không phải số, +84/84 -> 0
create or replace function normalize_phone(p text) returns text
language sql immutable as $$
  select case
    when p is null then null
    else regexp_replace(regexp_replace(p, '\D', '', 'g'), '^84', '0')
  end
$$;

-- ===== Chi nhánh =====
create table branches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  city        text not null,
  address     text,
  manager_id  uuid,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ===== Hồ sơ người dùng (liên kết auth.users) =====
create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text not null,
  role              app_role not null default 'counselor',
  branch_id         uuid not null references branches(id),
  phone             text,
  email             text,
  active            boolean not null default true,
  monthly_target    int not null default 0 check (monthly_target >= 0),
  max_active_leads  int not null default 40 check (max_active_leads >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index profiles_branch_idx on profiles(branch_id);
create index profiles_role_idx on profiles(role);

alter table branches add constraint branches_manager_fk foreign key (manager_id) references profiles(id) on delete set null;

-- ===== Chiến dịch quảng cáo =====
create table campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  channel     source_channel not null,
  start_date  date not null,
  end_date    date,
  budget      numeric(14,0) not null default 0 check (budget >= 0),
  spent       numeric(14,0) not null default 0 check (spent >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ===== Khách hàng tiềm năng =====
create table leads (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  full_name         text not null,
  phone             text not null,
  phone_normalized  text generated always as (normalize_phone(phone)) stored,
  email             text,
  birth_year        int check (birth_year between 1950 and 2100),
  province          text,
  program           program_type not null,
  target_intake     text,
  korean_level      text,
  channel           source_channel not null,
  campaign_id       uuid references campaigns(id) on delete set null,
  branch_id         uuid not null references branches(id),
  owner_id          uuid references profiles(id) on delete set null,
  stage             lead_stage not null default 'new',
  priority          lead_priority not null default 'medium',
  lost_reason       text,
  notes             text,
  tags              text[] not null default '{}',
  consent_at        timestamptz,          -- thời điểm khách đồng ý xử lý dữ liệu cá nhân
  deleted_at        timestamptz,          -- xóa mềm
  last_contact_at   timestamptz,
  next_follow_up_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- Chống trùng SĐT với khách chưa bị xóa
create unique index leads_phone_unique on leads(phone_normalized) where deleted_at is null;
create index leads_owner_idx on leads(owner_id);
create index leads_branch_idx on leads(branch_id);
create index leads_stage_idx on leads(stage);
create index leads_created_idx on leads(created_at desc);
create index leads_follow_up_idx on leads(next_follow_up_at) where stage not in ('contract', 'lost');

-- ===== Lịch sử tư vấn =====
create table interactions (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  staff_id    uuid not null references profiles(id),
  type        interaction_type not null,
  content     text not null,
  result      text,
  created_at  timestamptz not null default now()
);
create index interactions_lead_idx on interactions(lead_id, created_at desc);

-- ===== Lịch hẹn =====
create table appointments (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  staff_id    uuid not null references profiles(id),
  title       text not null,
  start_at    timestamptz not null,
  location    appointment_location not null default 'office',
  status      appointment_status not null default 'scheduled',
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index appointments_staff_idx on appointments(staff_id, start_at);
create index appointments_lead_idx on appointments(lead_id);

-- ===== Hồ sơ du học =====
create table student_cases (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  lead_id             uuid not null unique references leads(id),
  full_name           text not null,
  branch_id           uuid not null references branches(id),
  counselor_id        uuid not null references profiles(id),
  case_officer_id     uuid references profiles(id),
  program             program_type not null,
  school              text,
  intake              text,
  visa_type           text,
  visa_stage          visa_stage not null default 'preparing',
  contract_value      numeric(14,0) not null default 0 check (contract_value >= 0),
  passport_no_enc     bytea,          -- mã hóa bằng pgcrypto, không lưu dạng rõ
  expected_departure  date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index cases_branch_idx on student_cases(branch_id);
create index cases_counselor_idx on student_cases(counselor_id);
create index cases_officer_idx on student_cases(case_officer_id);
create index cases_stage_idx on student_cases(visa_stage);

create table case_documents (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references student_cases(id) on delete cascade,
  doc_key       text not null,
  label         text not null,
  status        doc_status not null default 'missing',
  storage_path  text,                 -- đường dẫn trong bucket private "ho-so"
  note          text,
  updated_at    timestamptz not null default now(),
  unique (case_id, doc_key)
);

-- ===== Tài chính =====
create table invoices (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  case_id     uuid not null references student_cases(id) on delete restrict,
  fee_type    fee_type not null,
  amount      numeric(14,0) not null check (amount > 0),
  due_date    date not null,
  note        text,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index invoices_case_idx on invoices(case_id);
create index invoices_due_idx on invoices(due_date);

create table payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references invoices(id) on delete restrict,
  amount       numeric(14,0) not null check (amount > 0),
  method       payment_method not null,
  paid_at      timestamptz not null default now(),
  received_by  uuid not null references profiles(id),
  reference    text,
  created_at   timestamptz not null default now()
);
create index payments_invoice_idx on payments(invoice_id);
create index payments_paid_idx on payments(paid_at desc);

-- ===== Nhật ký =====
create table audit_logs (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid references profiles(id),
  action      text not null,      -- create | update | delete | assign | import | export | login | payment
  entity      text not null,
  entity_id   text,
  summary     text,
  old_data    jsonb,
  new_data    jsonb,
  changes     jsonb
);
create index audit_at_idx on audit_logs(at desc);
create index audit_entity_idx on audit_logs(entity, entity_id);

-- ===== Cấu hình phân bổ (1 dòng) =====
create table assignment_settings (
  id                    boolean primary key default true check (id),
  strategy              assignment_strategy not null default 'round_robin',
  respect_branch        boolean not null default true,
  respect_capacity      boolean not null default true,
  auto_assign_new_leads boolean not null default true,
  sla_hours             int not null default 2 check (sla_hours > 0),
  last_index            jsonb not null default '{}',
  updated_at            timestamptz not null default now()
);
insert into assignment_settings default values;

-- ===== Trigger updated_at =====
create trigger t_branches_updated before update on branches for each row execute function set_updated_at();
create trigger t_profiles_updated before update on profiles for each row execute function set_updated_at();
create trigger t_campaigns_updated before update on campaigns for each row execute function set_updated_at();
create trigger t_leads_updated before update on leads for each row execute function set_updated_at();
create trigger t_appointments_updated before update on appointments for each row execute function set_updated_at();
create trigger t_cases_updated before update on student_cases for each row execute function set_updated_at();
create trigger t_docs_updated before update on case_documents for each row execute function set_updated_at();
create trigger t_invoices_updated before update on invoices for each row execute function set_updated_at();
create trigger t_assign_updated before update on assignment_settings for each row execute function set_updated_at();

-- ===== View: số dư từng khoản thu =====
create view invoice_balances with (security_invoker = true) as
select
  i.id as invoice_id,
  i.code,
  i.case_id,
  c.branch_id,
  i.fee_type,
  i.amount,
  coalesce(sum(p.amount), 0)::numeric(14,0) as paid,
  (i.amount - coalesce(sum(p.amount), 0))::numeric(14,0) as balance,
  i.due_date,
  (i.due_date < current_date and i.amount > coalesce(sum(p.amount), 0)) as overdue
from invoices i
join student_cases c on c.id = i.case_id
left join payments p on p.invoice_id = i.id
group by i.id, c.branch_id;
