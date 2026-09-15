-- ============================================================================
-- منصة استطلاعات الرأي — جامعة الملك خالد
-- مخطط قاعدة البيانات + سياسات الأمان (RLS)
-- شغّل هذا الملف كاملًا في: Supabase → SQL Editor
-- ============================================================================

-- ---------- Enums ----------------------------------------------------------
do $$ begin
  create type degree_level as enum ('bachelor', 'master', 'phd');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lang_code as enum ('ar', 'en');
exception when duplicate_object then null; end $$;

do $$ begin
  -- الجمهور المستهدف من الاستطلاع
  create type audience_type as enum (
    'student', 'graduate', 'faculty', 'employee', 'employer', 'trainee', 'supervision', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type run_status as enum ('draft', 'open', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type run_term as enum ('annual', 's1', 's2', 'summer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type campus_type as enum ('male', 'female');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_role as enum ('admin', 'coordinator');
exception when duplicate_object then null; end $$;

do $$ begin
  -- نوع المؤشر الذي يقيسه المحور/السؤال بشكل منفصل
  create type indicator_kind as enum ('kpi', 'objective', 'initiative');
exception when duplicate_object then null; end $$;

-- ---------- Org structure --------------------------------------------------
create table if not exists colleges (
  id         uuid primary key default gen_random_uuid(),
  name_ar    text not null,
  name_en    text,
  created_at timestamptz not null default now()
);

create table if not exists departments (
  id         uuid primary key default gen_random_uuid(),
  college_id uuid not null references colleges(id) on delete cascade,
  name_ar    text not null,
  name_en    text,
  created_at timestamptz not null default now()
);

create table if not exists programs (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  name_ar       text not null,
  name_en       text,
  degree        degree_level not null,
  language      lang_code not null default 'ar',
  created_at    timestamptz not null default now()
);
create index if not exists idx_departments_college on departments(college_id);
create index if not exists idx_programs_department on programs(department_id);

-- ---------- Users / roles --------------------------------------------------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  email      text,
  role       app_role not null default 'coordinator',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ربط المنسّق بالبرامج التي يشرف عليها (متعدد إلى متعدد)
create table if not exists program_coordinators (
  program_id uuid not null references programs(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  primary key (program_id, user_id)
);
create index if not exists idx_progcoord_user on program_coordinators(user_id);

-- ---------- Survey templates (المحاور والفقرات) ----------------------------
create table if not exists survey_templates (
  id           uuid primary key default gen_random_uuid(),
  title_ar     text not null,
  title_en     text,
  description  text,
  audience     audience_type not null default 'student',
  degree_level degree_level,                 -- null = يصلح لأي درجة
  language     lang_code not null default 'ar',
  is_active    boolean not null default true,
  is_recurring boolean not null default true,  -- يتكرر سنويًا غالبًا
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists survey_axes (
  id         uuid primary key default gen_random_uuid(),
  survey_id  uuid not null references survey_templates(id) on delete cascade,
  title_ar   text not null,
  title_en   text,
  position   int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_axes_survey on survey_axes(survey_id);

create table if not exists survey_questions (
  id         uuid primary key default gen_random_uuid(),
  axis_id    uuid not null references survey_axes(id) on delete cascade,
  text_ar    text not null,
  text_en    text,
  position   int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_questions_axis on survey_questions(axis_id);

-- ---------- Indicators (KPI / أهداف / مبادرات) -----------------------------
create table if not exists indicators (
  id         uuid primary key default gen_random_uuid(),
  kind       indicator_kind not null,
  code       text,
  name_ar    text not null,
  name_en    text,
  created_at timestamptz not null default now()
);

-- ربط المحور أو السؤال بمؤشر — للقياس المنفصل
create table if not exists axis_indicators (
  axis_id      uuid not null references survey_axes(id) on delete cascade,
  indicator_id uuid not null references indicators(id) on delete cascade,
  primary key (axis_id, indicator_id)
);
create table if not exists question_indicators (
  question_id  uuid not null references survey_questions(id) on delete cascade,
  indicator_id uuid not null references indicators(id) on delete cascade,
  primary key (question_id, indicator_id)
);

-- ---------- Survey runs (نشر استطلاع لبرنامج في دورة) ----------------------
create table if not exists survey_runs (
  id           uuid primary key default gen_random_uuid(),
  survey_id    uuid not null references survey_templates(id) on delete restrict,
  program_id   uuid not null references programs(id) on delete cascade,
  year         int not null,                  -- سنة القياس (تُقاس منفصلة سنويًا)
  term         run_term not null default 'annual',
  opens_at     timestamptz not null,
  closes_at    timestamptz not null,
  status       run_status not null default 'draft',
  access_token text not null unique default translate(encode(gen_random_bytes(9), 'base64'), '+/', '-_'),
  created_by   uuid references profiles(id),
  published_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_runs_program on survey_runs(program_id);
create index if not exists idx_runs_token on survey_runs(access_token);

-- ---------- Responses & answers -------------------------------------------
create table if not exists responses (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references survey_runs(id) on delete cascade,
  campus       campus_type not null,          -- مقر الطلاب / مقر الطالبات
  submitted_at timestamptz not null default now(),
  meta         jsonb not null default '{}'::jsonb
);
create index if not exists idx_responses_run on responses(run_id);

create table if not exists answers (
  id          uuid primary key default gen_random_uuid(),
  response_id uuid not null references responses(id) on delete cascade,
  question_id uuid not null references survey_questions(id) on delete cascade,
  value       smallint not null check (value between 1 and 5)
);
create index if not exists idx_answers_response on answers(response_id);
create index if not exists idx_answers_question on answers(question_id);

-- ---------- Improvement plans (نقاط القوة/الضعف + خطة التحسين) --------------
create table if not exists improvement_plans (
  run_id     uuid primary key references survey_runs(id) on delete cascade,
  strengths  text,
  weaknesses text,
  actions    text,           -- إجراءات التحسين للفصل القادم
  notes      text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Helper functions (SECURITY DEFINER) — لتفادي التكرار في السياسات
-- ============================================================================
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.is_active
  );
$$;

create or replace function coordinates_program(p_program uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from program_coordinators pc
    join profiles p on p.id = pc.user_id
    where pc.user_id = auth.uid() and pc.program_id = p_program and p.is_active
  );
$$;

create or replace function coordinates_run(p_run uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from survey_runs r
    join program_coordinators pc on pc.program_id = r.program_id
    where r.id = p_run and pc.user_id = auth.uid()
  );
$$;

-- هل النشر مفتوح الآن؟ (لضبط تعبئة المستفيد المجهول)
create or replace function run_is_open(p_run uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from survey_runs r
    where r.id = p_run and r.status = 'open'
      and now() between r.opens_at and r.closes_at
  );
$$;

-- إنشاء profile تلقائيًا عند تسجيل مستخدم جديد
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email, 'coordinator')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table colleges             enable row level security;
alter table departments          enable row level security;
alter table programs             enable row level security;
alter table profiles             enable row level security;
alter table program_coordinators enable row level security;
alter table survey_templates     enable row level security;
alter table survey_axes          enable row level security;
alter table survey_questions     enable row level security;
alter table indicators           enable row level security;
alter table axis_indicators      enable row level security;
alter table question_indicators  enable row level security;
alter table survey_runs          enable row level security;
alter table responses            enable row level security;
alter table answers              enable row level security;
alter table improvement_plans    enable row level security;

-- ---- Org structure: قراءة عامة، تعديل للمدير فقط ----
do $$
declare t text;
begin
  foreach t in array array['colleges','departments','programs'] loop
    execute format('drop policy if exists %I_read on %I', t, t);
    execute format('create policy %I_read on %I for select using (true)', t, t);
    execute format('drop policy if exists %I_admin on %I', t, t);
    execute format('create policy %I_admin on %I for all using (is_admin()) with check (is_admin())', t, t);
  end loop;
end $$;

-- ---- Profiles ----
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for select using (id = auth.uid() or is_admin());
drop policy if exists profiles_admin on profiles;
create policy profiles_admin on profiles for all using (is_admin()) with check (is_admin());
drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update using (id = auth.uid());

-- ---- program_coordinators ----
drop policy if exists pc_read on program_coordinators;
create policy pc_read on program_coordinators for select
  using (user_id = auth.uid() or is_admin());
drop policy if exists pc_admin on program_coordinators;
create policy pc_admin on program_coordinators for all
  using (is_admin()) with check (is_admin());

-- ---- Survey templates / axes / questions / indicators: قراءة عامة، تعديل للمدير ----
do $$
declare t text;
begin
  foreach t in array array[
    'survey_templates','survey_axes','survey_questions',
    'indicators','axis_indicators','question_indicators'
  ] loop
    execute format('drop policy if exists %I_read on %I', t, t);
    execute format('create policy %I_read on %I for select using (true)', t, t);
    execute format('drop policy if exists %I_admin on %I', t, t);
    execute format('create policy %I_admin on %I for all using (is_admin()) with check (is_admin())', t, t);
  end loop;
end $$;

-- ---- Survey runs ----
-- قراءة: عامة (المستفيد يحتاج قراءة النشر عبر الرابط) — لا يوجد سرّي هنا
drop policy if exists runs_read on survey_runs;
create policy runs_read on survey_runs for select using (true);
-- إنشاء/تعديل: المدير أو منسّق البرنامج
drop policy if exists runs_insert on survey_runs;
create policy runs_insert on survey_runs for insert
  with check (is_admin() or coordinates_program(program_id));
drop policy if exists runs_update on survey_runs;
create policy runs_update on survey_runs for update
  using (is_admin() or coordinates_program(program_id))
  with check (is_admin() or coordinates_program(program_id));
drop policy if exists runs_delete on survey_runs;
create policy runs_delete on survey_runs for delete
  using (is_admin() or coordinates_program(program_id));

-- ---- Responses: المستفيد المجهول يُدخل فقط أثناء فترة الإتاحة ----
drop policy if exists responses_insert on responses;
create policy responses_insert on responses for insert
  with check (run_is_open(run_id));
-- قراءة: المدير أو منسّق البرنامج (للتقارير والمتابعة)
drop policy if exists responses_read on responses;
create policy responses_read on responses for select
  using (is_admin() or coordinates_run(run_id));

-- ---- Answers: نفس منطق الردود ----
drop policy if exists answers_insert on answers;
create policy answers_insert on answers for insert
  with check (exists (
    select 1 from responses r where r.id = response_id and run_is_open(r.run_id)
  ));
drop policy if exists answers_read on answers;
create policy answers_read on answers for select
  using (exists (
    select 1 from responses r where r.id = response_id
      and (is_admin() or coordinates_run(r.run_id))
  ));

-- ---- Improvement plans: المدير أو منسّق البرنامج ----
drop policy if exists plans_all on improvement_plans;
create policy plans_all on improvement_plans for all
  using (is_admin() or coordinates_run(run_id))
  with check (is_admin() or coordinates_run(run_id));

-- ============================================================================
-- Seed: هيكل تنظيمي تجريبي + أنواع المؤشرات (يمكن حذفه لاحقًا)
-- ============================================================================
insert into colleges (name_ar, name_en)
select 'كلية إدارة الأعمال', 'College of Business'
where not exists (select 1 from colleges where name_ar = 'كلية إدارة الأعمال');
