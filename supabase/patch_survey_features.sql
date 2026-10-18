-- ============================================================================
-- ترقيع: أسئلة مفتوحة + حذف آمن للنشرات الفارغة
-- شغّله مرة واحدة في Supabase → SQL Editor (آمن لإعادة التشغيل).
--
-- إضافي بالكامل ولا يغيّر شيئًا من البيانات أو الروابط الحالية:
--   • survey_questions.kind: 'likert' (الافتراضي لكل الأسئلة الحالية) أو 'text' (سؤال مفتوح)
--   • جدول answer_texts منفصل للإجابات النصية — جدول answers لا يُمسّ
--   • دالة delete_run_if_empty: تحذف النشر فقط إن لم تكن عليه أي استجابة (فحص ذرّي)
-- ============================================================================

-- (1) نوع السؤال ----------------------------------------------------------------
alter table survey_questions add column if not exists kind text not null default 'likert'
  check (kind in ('likert', 'text'));

-- (2) الإجابات المفتوحة ----------------------------------------------------------
create table if not exists answer_texts (
  id          uuid primary key default gen_random_uuid(),
  response_id uuid not null references responses(id) on delete cascade,
  question_id uuid not null references survey_questions(id) on delete cascade,
  text_value  text not null check (char_length(text_value) between 1 and 2000),
  created_at  timestamptz not null default now(),
  unique (response_id, question_id)
);
create index if not exists idx_answer_texts_response on answer_texts(response_id);
create index if not exists idx_answer_texts_question on answer_texts(question_id);

alter table answer_texts enable row level security;

-- المستفيد المجهول: إدراج فقط أثناء فترة إتاحة نشر مفتوح (نفس منطق answers)
drop policy if exists answer_texts_insert on answer_texts;
create policy answer_texts_insert on answer_texts for insert
  with check (response_run_open(response_id));

-- القراءة: المدير أو منسّق البرنامج
drop policy if exists answer_texts_read on answer_texts;
create policy answer_texts_read on answer_texts for select
  using (exists (
    select 1 from responses r
    where r.id = response_id and (is_admin() or coordinates_run(r.run_id))
  ));

-- (3) حذف نشر بلا استجابات (ذرّي) -------------------------------------------------
create or replace function delete_run_if_empty(p_run uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_program uuid;
  n int;
begin
  -- نقفل صف النشر أولًا فلا يمكن لاستجابة جديدة أن تتسلل أثناء الفحص والحذف
  select program_id into v_program from survey_runs where id = p_run for update;
  if v_program is null then
    return false;
  end if;
  if not (is_admin() or coordinates_program(v_program)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from survey_runs
  where id = p_run and not exists (select 1 from responses where run_id = p_run);
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke execute on function delete_run_if_empty(uuid) from public, anon;
grant execute on function delete_run_if_empty(uuid) to authenticated;
