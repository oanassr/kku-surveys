-- ============================================================================
-- ترقيع: صلاحيات المنسّق (بناء استطلاعات ومؤشرات مقيّدة ببرامجه)
-- شغّله مرة واحدة في Supabase → SQL Editor
-- ============================================================================

-- (1) أعمدة مالك المؤشر + البرنامج
alter table indicators add column if not exists program_id uuid references programs(id) on delete set null;
alter table indicators add column if not exists created_by uuid references profiles(id);

-- (2) دوال مساعدة للملكية -----------------------------------------------------
create or replace function owns_survey(p_survey uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from survey_templates s where s.id = p_survey and s.created_by = auth.uid()
  );
$$;

create or replace function owns_axis(p_axis uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select owns_survey((select survey_id from survey_axes where id = p_axis));
$$;

create or replace function can_edit_indicator(p_indicator uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from indicators i where i.id = p_indicator
      and (i.created_by = auth.uid()
           or (i.program_id is not null and coordinates_program(i.program_id)))
  );
$$;

-- (3) استطلاعات: المنسّق ينشئ ويحرّر ما أنشأه؛ الأدمن كل شيء ----------------
drop policy if exists survey_templates_admin on survey_templates;
drop policy if exists survey_templates_insert on survey_templates;
drop policy if exists survey_templates_update on survey_templates;
drop policy if exists survey_templates_delete on survey_templates;
create policy survey_templates_insert on survey_templates for insert
  with check (is_admin() or (auth.uid() is not null and created_by = auth.uid()));
create policy survey_templates_update on survey_templates for update
  using (owns_survey(id)) with check (owns_survey(id));
create policy survey_templates_delete on survey_templates for delete
  using (owns_survey(id));

-- محاور
drop policy if exists survey_axes_admin on survey_axes;
drop policy if exists survey_axes_write on survey_axes;
create policy survey_axes_write on survey_axes for all
  using (owns_survey(survey_id)) with check (owns_survey(survey_id));

-- فقرات
drop policy if exists survey_questions_admin on survey_questions;
drop policy if exists survey_questions_write on survey_questions;
create policy survey_questions_write on survey_questions for all
  using (owns_axis(axis_id)) with check (owns_axis(axis_id));

-- (4) مؤشرات/أهداف/مبادرات: المنسّق ينشئ لبرامجه ويحرّر ما أنشأه ------------
drop policy if exists indicators_admin on indicators;
drop policy if exists indicators_insert on indicators;
drop policy if exists indicators_update on indicators;
drop policy if exists indicators_delete on indicators;
create policy indicators_insert on indicators for insert
  with check (
    is_admin()
    or (created_by = auth.uid()
        and program_id is not null
        and coordinates_program(program_id))
  );
create policy indicators_update on indicators for update
  using (can_edit_indicator(id)) with check (can_edit_indicator(id));
create policy indicators_delete on indicators for delete
  using (can_edit_indicator(id));

-- ربط المحاور/الفقرات بالمؤشر: من يملك تحرير المؤشر
drop policy if exists axis_indicators_admin on axis_indicators;
drop policy if exists axis_indicators_write on axis_indicators;
create policy axis_indicators_write on axis_indicators for all
  using (can_edit_indicator(indicator_id)) with check (can_edit_indicator(indicator_id));

drop policy if exists question_indicators_admin on question_indicators;
drop policy if exists question_indicators_write on question_indicators;
create policy question_indicators_write on question_indicators for all
  using (can_edit_indicator(indicator_id)) with check (can_edit_indicator(indicator_id));
