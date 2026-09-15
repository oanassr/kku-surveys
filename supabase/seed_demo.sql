-- ============================================================================
-- بيانات تجريبية: أقسام + برامج + نشر استطلاع مفتوح (للاختبار)
-- شغّلها بعد schema.sql و seed_surveys.sql
-- ============================================================================
do $$
declare
  col uuid;
  dep_acc uuid;
  dep_ba uuid;
  prog_acc uuid;
  prog_hr uuid;
  student_survey uuid;
begin
  -- الكلية موجودة من schema.sql
  select id into col from colleges where name_ar = 'كلية إدارة الأعمال' limit 1;
  if col is null then
    insert into colleges (name_ar, name_en) values ('كلية إدارة الأعمال', 'College of Business') returning id into col;
  end if;

  -- أقسام
  select id into dep_acc from departments where college_id = col and name_ar = 'قسم المحاسبة' limit 1;
  if dep_acc is null then
    insert into departments (college_id, name_ar, name_en) values (col, 'قسم المحاسبة', 'Accounting') returning id into dep_acc;
  end if;

  select id into dep_ba from departments where college_id = col and name_ar = 'قسم إدارة الأعمال' limit 1;
  if dep_ba is null then
    insert into departments (college_id, name_ar, name_en) values (col, 'قسم إدارة الأعمال', 'Business Administration') returning id into dep_ba;
  end if;

  -- برامج
  select id into prog_acc from programs where department_id = dep_acc and name_ar = 'ماجستير العلوم في المحاسبة' limit 1;
  if prog_acc is null then
    insert into programs (department_id, name_ar, name_en, degree, language)
    values (dep_acc, 'ماجستير العلوم في المحاسبة', 'MSc in Accounting', 'master', 'ar') returning id into prog_acc;
  end if;

  select id into prog_hr from programs where department_id = dep_ba and name_ar = 'بكالوريوس إدارة الموارد البشرية' limit 1;
  if prog_hr is null then
    insert into programs (department_id, name_ar, name_en, degree, language)
    values (dep_ba, 'بكالوريوس إدارة الموارد البشرية', 'BSc Human Resources', 'bachelor', 'ar') returning id into prog_hr;
  end if;

  -- نشر استطلاع الطلاب (ماجستير) لبرنامج المحاسبة — مفتوح الآن لمدة 30 يومًا
  select id into student_survey from survey_templates
    where audience = 'student' and title_ar = 'استطلاع رأي الطلاب حول جودة البرنامج' limit 1;

  if student_survey is not null and not exists (
    select 1 from survey_runs where survey_id = student_survey and program_id = prog_acc and year = extract(year from now())
  ) then
    insert into survey_runs (survey_id, program_id, year, term, opens_at, closes_at, status)
    values (student_survey, prog_acc, extract(year from now())::int, 'annual', now() - interval '1 day', now() + interval '30 day', 'open');
  end if;
end $$;
