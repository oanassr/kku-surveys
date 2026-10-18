// عمليات النشر: الحذف الآمن للنشرات التي لا استجابات عليها
import { supabase } from './supabase'

export type DeleteRunResult =
  | { ok: true }
  | { ok: false; reason: 'has_responses' | 'denied' | 'error'; message?: string }

/**
 * يحذف النشر فقط إن لم تكن عليه أي استجابة.
 * يستخدم الدالة الذرّية delete_run_if_empty (patch_survey_features.sql)، وإن لم تكن مُثبَّتة بعد
 * يرجع إلى فحص العدّاد ثم الحذف مع التأكد من أن الصف حُذف فعلًا.
 * تنبيه: حذف نشر يحذف رابطه ورمز QR فلا يعملان بعد ذلك.
 */
export async function deleteRunIfEmpty(runId: string): Promise<DeleteRunResult> {
  const { data, error } = await supabase.rpc('delete_run_if_empty', { p_run: runId })
  if (!error) return data === true ? { ok: true } : { ok: false, reason: 'has_responses' }
  if (/42501|not allowed/i.test(`${error.code ?? ''} ${error.message}`)) return { ok: false, reason: 'denied' }

  if (/function|schema cache|PGRST202/i.test(`${error.code ?? ''} ${error.message}`)) {
    const { count } = await supabase
      .from('responses')
      .select('id', { count: 'exact', head: true })
      .eq('run_id', runId)
    if ((count ?? 0) > 0) return { ok: false, reason: 'has_responses' }
    const { data: del, error: e2 } = await supabase.from('survey_runs').delete().eq('id', runId).select('id')
    if (e2) return { ok: false, reason: 'error', message: e2.message }
    return (del ?? []).length ? { ok: true } : { ok: false, reason: 'denied' }
  }
  return { ok: false, reason: 'error', message: error.message }
}
