-- ============================================================================
-- ترقيع: الخطط التشغيلية (برنامج ← أهداف ← مبادرات ← أنشطة ← مؤشرات أداء)
-- شغّله مرة واحدة في Supabase → SQL Editor.
--
-- إضافي بالكامل (لا يعدّل ولا يحذف شيئًا من الاستطلاعات الحالية):
--   • أعمدة اختيارية جديدة في جدول indicators (ترقيم/نوع قياس/طريقة حساب…)
--   • جداول جديدة op_* مع سياسات RLS: المدير كل شيء، المنسّق برامجه فقط، المجهول لا شيء.
-- آمن لإعادة التشغيل أكثر من مرة.
-- ============================================================================

-- (1) مؤشرات الأداء: خصائص إضافية (كلها اختيارية فلا تتأثر المؤشرات القائمة) -------
alter table indicators add column if not exists degree_level text
  check (degree_level in ('bachelor', 'master', 'phd'));
alter table indicators add column if not exists measure_type text not null default 'survey'
  check (measure_type in ('survey', 'manual'));           -- من استطلاع أم إدخال يدوي
alter table indicators add column if not exists calc_method text;   -- كيفية حساب المؤشر
alter table indicators add column if not exists direction text not null default 'up'
  check (direction in ('up', 'down', 'none'));            -- الأفضل: أعلى / أقل / لا يُقارَن
alter table indicators add column if not exists unit text;
alter table indicators add column if not exists evidence_url text;  -- رابط الأدلة

-- (2) الجداول ---------------------------------------------------------------------
create table if not exists op_plans (
  id                uuid primary key default gen_random_uuid(),
  program_id        uuid not null references programs(id) on delete cascade,
  year_label        text not null,              -- عام الخطة، مثل: 1446 هـ أو 2025/2026
  target_year_label text,                       -- عام المستهدفات الجديدة، مثل: 1447 هـ
  title             text,
  intro             text,                       -- مقدمة الخطة (تُصدَّر في Word)
  context           jsonb not null default '{}'::jsonb,  -- الرسائل وأهداف الجامعة/الكلية/القسم
  status            text not null default 'draft' check (status in ('draft', 'final')),
  created_by        uuid references profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists uq_op_plans_program_year on op_plans(program_id, year_label);

create table if not exists op_goals (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references op_plans(id) on delete cascade,
  position   int  not null default 0,
  text_ar    text not null,
  aligns     jsonb not null default '{}'::jsonb,  -- مواءمة الهدف: {university:[0,2], college:[1], department:[]}
  created_at timestamptz not null default now()
);
create index if not exists idx_op_goals_plan on op_goals(plan_id);

create table if not exists op_initiatives (
  id         uuid primary key default gen_random_uuid(),
  goal_id    uuid not null references op_goals(id) on delete cascade,
  position   int  not null default 0,
  text_ar    text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_op_initiatives_goal on op_initiatives(goal_id);

create table if not exists op_activities (
  id            uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references op_initiatives(id) on delete cascade,
  position      int  not null default 0,
  text_ar       text not null,
  executor      text,      -- الجهة المنفذة
  budget        text,      -- الميزانية التقديرية
  created_at    timestamptz not null default now()
);
create index if not exists idx_op_activities_init on op_activities(initiative_id);

-- ربط النشاط بمؤشرات الأداء التي تقيس تقدّمه
create table if not exists op_activity_kpis (
  activity_id  uuid not null references op_activities(id) on delete cascade,
  indicator_id uuid not null references indicators(id) on delete cascade,
  position     int  not null default 0,
  primary key (activity_id, indicator_id)
);
create index if not exists idx_op_activity_kpis_ind on op_activity_kpis(indicator_id);

-- قيم المؤشر ضمن خطة معيّنة (تتكرر المؤشرات عبر الأنشطة بقيمة واحدة)
create table if not exists op_kpi_values (
  plan_id      uuid not null references op_plans(id) on delete cascade,
  indicator_id uuid not null references indicators(id) on delete cascade,
  actual       text,        -- الأداء الفعلي
  benchmark    text,        -- المقارنة المرجعية الداخلية
  target       text,        -- الأداء المستهدف
  new_target   text,        -- الأداء المستهدف الجديد
  source       text not null default 'manual' check (source in ('manual', 'survey')),
  run_id       uuid references survey_runs(id) on delete set null,  -- نشر الاستطلاع المغذّي
  narrative    text,        -- سرد التقرير (يُولَّد آليًا ويمكن تعديله)
  updated_at   timestamptz not null default now(),
  primary key (plan_id, indicator_id)
);

-- (3) تحديث updated_at تلقائيًا -------------------------------------------------
create or replace function op_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_op_plans_touch on op_plans;
create trigger trg_op_plans_touch before update on op_plans
  for each row execute function op_touch_updated_at();
drop trigger if exists trg_op_kpi_values_touch on op_kpi_values;
create trigger trg_op_kpi_values_touch before update on op_kpi_values
  for each row execute function op_touch_updated_at();

-- (4) دوال الصلاحية (SECURITY DEFINER لتفادي تكرار RLS) ---------------------------
create or replace function can_edit_plan(p_plan uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from op_plans pl where pl.id = p_plan and coordinates_program(pl.program_id)
  );
$$;
create or replace function can_edit_goal(p_goal uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select can_edit_plan((select plan_id from op_goals where id = p_goal));
$$;
create or replace function can_edit_initiative(p_init uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select can_edit_goal((select goal_id from op_initiatives where id = p_init));
$$;
create or replace function can_edit_activity(p_act uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select can_edit_initiative((select initiative_id from op_activities where id = p_act));
$$;

-- (5) RLS: لا وصول للمجهول؛ المدير الكل؛ المنسّق خططه فقط -----------------------
alter table op_plans          enable row level security;
alter table op_goals          enable row level security;
alter table op_initiatives    enable row level security;
alter table op_activities     enable row level security;
alter table op_activity_kpis  enable row level security;
alter table op_kpi_values     enable row level security;

drop policy if exists op_plans_all on op_plans;
drop policy if exists op_plans_select on op_plans;
drop policy if exists op_plans_insert on op_plans;
drop policy if exists op_plans_update on op_plans;
drop policy if exists op_plans_delete on op_plans;
create policy op_plans_select on op_plans for select
  using (is_admin() or coordinates_program(program_id));
create policy op_plans_insert on op_plans for insert
  with check (is_admin() or (coordinates_program(program_id) and created_by = auth.uid()));
create policy op_plans_update on op_plans for update
  using (is_admin() or coordinates_program(program_id))
  with check (is_admin() or coordinates_program(program_id));
create policy op_plans_delete on op_plans for delete
  using (is_admin() or coordinates_program(program_id));

drop policy if exists op_goals_all on op_goals;
create policy op_goals_all on op_goals for all
  using (can_edit_plan(plan_id)) with check (can_edit_plan(plan_id));

drop policy if exists op_initiatives_all on op_initiatives;
create policy op_initiatives_all on op_initiatives for all
  using (can_edit_goal(goal_id)) with check (can_edit_goal(goal_id));

drop policy if exists op_activities_all on op_activities;
create policy op_activities_all on op_activities for all
  using (can_edit_initiative(initiative_id)) with check (can_edit_initiative(initiative_id));

drop policy if exists op_activity_kpis_all on op_activity_kpis;
create policy op_activity_kpis_all on op_activity_kpis for all
  using (can_edit_activity(activity_id)) with check (can_edit_activity(activity_id));

drop policy if exists op_kpi_values_all on op_kpi_values;
create policy op_kpi_values_all on op_kpi_values for all
  using (can_edit_plan(plan_id)) with check (can_edit_plan(plan_id));
