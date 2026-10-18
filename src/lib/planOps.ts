// عمليات الكتابة على جداول الخطة التشغيلية (تُعيد نص الخطأ أو null عند النجاح)
import { supabase } from './supabase'
import type { KpiValue } from './plans'

type Table = 'op_goals' | 'op_initiatives' | 'op_activities'
const msg = (e: { message: string } | null) => (e ? e.message : null)

export async function addRow(
  table: Table,
  row: Record<string, unknown>,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.from(table).insert(row).select('id').single()
  return { id: (data as { id: string } | null)?.id ?? null, error: msg(error) }
}

export async function patchRow(table: Table | 'op_plans', id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from(table).update(patch).eq('id', id)
  return msg(error)
}

export async function deleteRow(table: Table | 'op_plans', id: string) {
  const { error } = await supabase.from(table).delete().eq('id', id)
  return msg(error)
}

/** يبدّل موضعي عنصرين متجاورين. */
export async function swapPositions(
  table: Table,
  a: { id: string; position: number },
  b: { id: string; position: number },
) {
  // نضمن اختلاف القيمتين حتى لو تساوتا في بيانات قديمة
  const pa = a.position === b.position ? b.position + 1 : b.position
  const e1 = await patchRow(table, a.id, { position: pa })
  const e2 = await patchRow(table, b.id, { position: a.position })
  return e1 ?? e2
}

export async function linkKpi(activityId: string, indicatorId: string, position: number) {
  const { error } = await supabase
    .from('op_activity_kpis')
    .insert({ activity_id: activityId, indicator_id: indicatorId, position })
  return msg(error)
}
export async function unlinkKpi(activityId: string, indicatorId: string) {
  const { error } = await supabase
    .from('op_activity_kpis')
    .delete()
    .eq('activity_id', activityId)
    .eq('indicator_id', indicatorId)
  return msg(error)
}

export async function upsertValue(
  planId: string,
  indicatorId: string,
  patch: Partial<Omit<KpiValue, 'plan_id' | 'indicator_id'>>,
) {
  const { error } = await supabase
    .from('op_kpi_values')
    .upsert({ plan_id: planId, indicator_id: indicatorId, ...patch }, { onConflict: 'plan_id,indicator_id' })
  return msg(error)
}
