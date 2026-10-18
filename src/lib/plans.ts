// ============================================================================
// الخطط التشغيلية: برنامج ← أهداف ← مبادرات ← أنشطة ← مؤشرات أداء
// أنواع + جلب + منطق التقدير + السرد الآلي + التغذية من الاستطلاعات + نسخ خطة
// ============================================================================
import { supabase } from './supabase'
import { buildReport, type ReportData } from './report'
import { fetchIndicatorLinks, fetchRunsForIndicator } from './indicatorReport'
import type { DegreeLevel, Indicator, KpiDirection, MeasureType } from './types'

export const LEVELS = [
  { key: 'university', label: 'الجامعة' },
  { key: 'college', label: 'الكلية' },
  { key: 'department', label: 'القسم' },
] as const
export type LevelKey = (typeof LEVELS)[number]['key']

export interface PlanContext {
  missions?: Partial<Record<LevelKey | 'program', string>>
  lists?: Partial<Record<LevelKey, string[]>>
}

export interface OpPlan {
  id: string
  program_id: string
  year_label: string
  target_year_label: string | null
  title: string | null
  intro: string | null
  context: PlanContext
  status: 'draft' | 'final'
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface OpGoal {
  id: string
  plan_id: string
  position: number
  text_ar: string
  aligns: Partial<Record<LevelKey, number[]>>
}
export interface OpInitiative {
  id: string
  goal_id: string
  position: number
  text_ar: string
}
export interface OpActivity {
  id: string
  initiative_id: string
  position: number
  text_ar: string
  executor: string | null
  budget: string | null
}
export interface KpiValue {
  plan_id: string
  indicator_id: string
  actual: string | null
  benchmark: string | null
  target: string | null
  new_target: string | null
  source: 'manual' | 'survey'
  run_id: string | null
  narrative: string | null
}

export type ActivityNode = OpActivity & { kpiIds: string[] }
export type InitiativeNode = OpInitiative & { activities: ActivityNode[] }
export type GoalNode = OpGoal & { initiatives: InitiativeNode[] }

export interface ProgramInfo {
  id: string
  name_ar: string
  degree: DegreeLevel
  department_id: string
  department?: { name_ar: string; college?: { name_ar: string } | null } | null
}

export interface PlanFull {
  plan: OpPlan
  program: ProgramInfo
  goals: GoalNode[]
  kpis: Map<string, Indicator>
  values: Map<string, KpiValue>
}

export type DbError = { message: string; code?: string } | null
/** هل الخطأ بسبب عدم تشغيل patch_operational_plans.sql؟ */
export function isMissingTables(e: DbError | undefined): boolean {
  if (!e) return false
  return /does not exist|schema cache|42P01|PGRST205|could not find the table/i.test(`${e.code ?? ''} ${e.message}`)
}

const byPos = <T extends { position: number }>(a: T, b: T) => a.position - b.position

export async function fetchPlanFull(planId: string): Promise<{ data: PlanFull | null; error: DbError }> {
  const { data: plan, error } = await supabase.from('op_plans').select('*').eq('id', planId).single()
  if (error || !plan) return { data: null, error: error as DbError }
  const p = plan as OpPlan
  const { data: program } = await supabase
    .from('programs')
    .select('*, department:departments(name_ar, college:colleges(name_ar))')
    .eq('id', p.program_id)
    .single()

  const { data: goalRows } = await supabase.from('op_goals').select('*').eq('plan_id', planId).order('position')
  const goals = ((goalRows as OpGoal[]) ?? []).sort(byPos)
  const gids = goals.map((g) => g.id)
  const { data: initRows } = gids.length
    ? await supabase.from('op_initiatives').select('*').in('goal_id', gids).order('position')
    : { data: [] }
  const inits = ((initRows as OpInitiative[]) ?? []).sort(byPos)
  const iids = inits.map((i) => i.id)
  const { data: actRows } = iids.length
    ? await supabase.from('op_activities').select('*').in('initiative_id', iids).order('position')
    : { data: [] }
  const acts = ((actRows as OpActivity[]) ?? []).sort(byPos)
  const aids = acts.map((a) => a.id)
  const { data: linkRows } = aids.length
    ? await supabase.from('op_activity_kpis').select('*').in('activity_id', aids).order('position')
    : { data: [] }
  const links = ((linkRows as { activity_id: string; indicator_id: string; position: number }[]) ?? []).sort(byPos)

  const { data: valRows } = await supabase.from('op_kpi_values').select('*').eq('plan_id', planId)
  const values = new Map<string, KpiValue>(((valRows as KpiValue[]) ?? []).map((v) => [v.indicator_id, v]))

  const kpiIds = [...new Set([...links.map((l) => l.indicator_id), ...values.keys()])]
  const { data: indRows } = kpiIds.length
    ? await supabase.from('indicators').select('*').in('id', kpiIds)
    : { data: [] }
  const kpis = new Map<string, Indicator>(((indRows as Indicator[]) ?? []).map((i) => [i.id, i]))

  const goalNodes: GoalNode[] = goals.map((g) => ({
    ...g,
    aligns: g.aligns ?? {},
    initiatives: inits
      .filter((i) => i.goal_id === g.id)
      .map((i) => ({
        ...i,
        activities: acts
          .filter((a) => a.initiative_id === i.id)
          .map((a) => ({ ...a, kpiIds: links.filter((l) => l.activity_id === a.id).map((l) => l.indicator_id) })),
      })),
  }))
  return {
    data: { plan: { ...p, context: p.context ?? {} }, program: program as ProgramInfo, goals: goalNodes, kpis, values },
    error: null,
  }
}

/** كل مؤشرات الأداء (kind=kpi) لبرنامج معيّن — لاختيارها داخل الخطة. */
export async function fetchProgramKpis(programId: string): Promise<Indicator[]> {
  const { data } = await supabase
    .from('indicators')
    .select('*')
    .eq('program_id', programId)
    .eq('kind', 'kpi')
    .order('created_at')
  return (data as Indicator[]) ?? []
}

// ---------------------------------------------------------------------------
// ترقيم مؤشرات الأداء بحسب الدرجة العلمية
// ---------------------------------------------------------------------------
export const CODE_PREFIX: Record<DegreeLevel, string> = {
  bachelor: 'KPI-P-',
  master: 'KPI-PG-',
  phd: 'KPI-PG-',
}
/** يقترح الرمز التالي بحسب الدرجة وأكبر رقم موجود في البرنامج. */
export function nextKpiCode(degree: DegreeLevel, existing: { code: string | null }[]): string {
  const prefix = CODE_PREFIX[degree]
  let max = 0
  for (const e of existing) {
    const m = e.code?.match(/(\d+)\s*$/)
    if (e.code?.startsWith(prefix) && m) max = Math.max(max, Number(m[1]))
  }
  return `${prefix}${max + 1}`
}

// ---------------------------------------------------------------------------
// القيم والتقدير
// ---------------------------------------------------------------------------
export function normDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٫,]/g, '.')
    .replace(/٪/g, '%')
}
/** يحوّل نص القيمة إلى رقم إن أمكن (يدعم النسبة %)، وإلا null (مثل 1:6.7 أو -). */
export function parseNum(s: string | null | undefined): number | null {
  if (s == null) return null
  const t = normDigits(String(s)).trim().replace(/%$/, '').trim()
  if (!/^[-+]?\d+(\.\d+)?$/.test(t)) return null
  return Number(t)
}
export const isBlank = (s: string | null | undefined) => s == null || s.trim() === '' || s.trim() === '-'

export type KpiStatus = 'achieved' | 'below' | 'nodata' | 'na'
export function kpiStatus(
  kpi: { direction?: KpiDirection } | undefined,
  v: Pick<KpiValue, 'actual' | 'target'> | undefined | null,
): KpiStatus {
  if (!v || isBlank(v.actual)) return 'nodata'
  const a = parseNum(v.actual)
  const t = parseNum(v.target)
  const dir = kpi?.direction ?? 'up'
  if (a == null || t == null || dir === 'none') return 'na'
  if (dir === 'down') return a <= t ? 'achieved' : 'below'
  return a >= t ? 'achieved' : 'below'
}
export const STATUS_META: Record<KpiStatus, { label: string; color: string }> = {
  achieved: { label: 'محقق', color: 'var(--color-rate-5)' },
  below: { label: 'دون المستهدف', color: 'var(--color-rate-1)' },
  nodata: { label: 'بلا قيمة', color: '#94a3b8' },
  na: { label: 'غير قابل للمقارنة', color: '#64748b' },
}

/** كل مؤشرات الخطة (فريدة) بترتيب ظهورها. */
export function planKpiIds(goals: GoalNode[]): string[] {
  const out: string[] = []
  for (const g of goals)
    for (const i of g.initiatives)
      for (const a of i.activities) for (const k of a.kpiIds) if (!out.includes(k)) out.push(k)
  return out
}
export function goalKpiIds(g: GoalNode): string[] {
  const out: string[] = []
  for (const i of g.initiatives)
    for (const a of i.activities) for (const k of a.kpiIds) if (!out.includes(k)) out.push(k)
  return out
}

export interface PlanStats {
  goals: number
  initiatives: number
  activities: number
  kpis: number
  achieved: number
  below: number
  nodata: number
  na: number
  surveyFed: number
}
export function computeStats(full: Pick<PlanFull, 'goals' | 'kpis' | 'values'>): PlanStats {
  const ids = planKpiIds(full.goals)
  const st: PlanStats = {
    goals: full.goals.length,
    initiatives: full.goals.reduce((n, g) => n + g.initiatives.length, 0),
    activities: full.goals.reduce((n, g) => n + g.initiatives.reduce((m, i) => m + i.activities.length, 0), 0),
    kpis: ids.length,
    achieved: 0,
    below: 0,
    nodata: 0,
    na: 0,
    surveyFed: 0,
  }
  for (const id of ids) {
    const v = full.values.get(id)
    st[kpiStatus(full.kpis.get(id), v)]++
    if (v?.source === 'survey' && v.run_id) st.surveyFed++
  }
  return st
}

// ---------------------------------------------------------------------------
// السرد الآلي لكل مؤشر (قابل للتعديل ويُحفظ في narrative)
// ---------------------------------------------------------------------------
const show = (s: string | null | undefined) => (isBlank(s) ? '-' : String(s).trim())
function rel(a: number, b: number) {
  return a > b ? 'أعلى من' : a < b ? 'أقل من' : 'يساوي'
}
export function generateNarrative(
  kpi: Indicator,
  v: Pick<KpiValue, 'actual' | 'benchmark' | 'target' | 'new_target'> | undefined | null,
  targetYear: string | null,
): string {
  const calc =
    kpi.calc_method?.trim() ||
    (kpi.measure_type === 'manual'
      ? kpi.name_ar
      : `متوسط ${kpi.name_ar} على مقياس من خمس مستويات في مسح سنوي`)
  const head = `تم حساب ${calc}`
  const year = targetYear ? ` للعام ${targetYear}` : ''
  if (!v || isBlank(v.actual)) {
    return `${head}، ولم يتوفر مستوى الأداء الفعلي بعد (لا ينطبق)، ولذلك قررت لجنة قياس مؤشرات الأداء بالبرنامج متابعة القياس في الدورة القادمة${year}.`
  }
  const a = parseNum(v.actual)
  const t = parseNum(v.target)
  const b = parseNum(v.benchmark)
  const parts: string[] = [`مستوى الأداء الفعلي (${show(v.actual)})`]
  const tgt = a != null && t != null ? `${rel(a, t)} ` : 'مقابل '
  parts.push(`${tgt}مستوى الأداء المستهدف (${show(v.target)})`)
  const bm = a != null && b != null ? `${rel(a, b)} ` : 'ومقابل '
  parts.push(`${a != null && b != null ? 'و' : ''}${bm}مستوى الأداء المرجعي الداخلي (${show(v.benchmark)})`)
  const result = `${parts[0]} ${parts[1]} ${parts[2]}`
  let decision: string
  if (isBlank(v.new_target)) decision = 'مراجعة مستوى الأداء المستهدف'
  else if (parseNum(v.new_target) != null && parseNum(v.new_target) === t)
    decision = `الاحتفاظ بمستوى الأداء المستهدف (${show(v.target)})`
  else decision = `وضع مستوى أداء مستهدف جديد (${show(v.new_target)})`
  return `${head}، وكانت نتيجة القياس كالتالي: ${result}، ولذلك قررت لجنة قياس مؤشرات الأداء بالبرنامج ${decision}${year}.`
}

// ---------------------------------------------------------------------------
// التغذية المباشرة من نتائج الاستطلاعات
// ---------------------------------------------------------------------------
export interface SurveyMeasure {
  mean: number | null
  items: number // عدد الفقرات المرتبطة التي لها بيانات
  responses: number
}
const avg = (n: number[]) => (n.length ? n.reduce((a, b) => a + b, 0) / n.length : null)

/** يحسب قيمة كل (مؤشر، نشر) من الفقرات المرتبطة — يبني تقرير كل نشر مرة واحدة فقط. */
export async function measureFromRuns(
  reqs: { indicatorId: string; runId: string }[],
): Promise<Map<string, SurveyMeasure>> {
  const out = new Map<string, SurveyMeasure>()
  const reports = new Map<string, ReportData | null>()
  const links = new Map<string, Awaited<ReturnType<typeof fetchIndicatorLinks>>>()
  for (const { indicatorId, runId } of reqs) {
    if (!reports.has(runId)) reports.set(runId, await buildReport(runId))
    if (!links.has(indicatorId)) links.set(indicatorId, await fetchIndicatorLinks(indicatorId))
    const rep = reports.get(runId)
    const lk = links.get(indicatorId)!
    if (!rep) {
      out.set(`${indicatorId}|${runId}`, { mean: null, items: 0, responses: 0 })
      continue
    }
    const qs = rep.axes
      .flatMap((ax) => ax.questions.filter((q) => lk.axisIds.has(ax.id) || lk.questionIds.has(q.id)))
      .filter((q) => q.meanAll != null)
    out.set(`${indicatorId}|${runId}`, {
      mean: avg(qs.map((q) => q.meanAll as number)),
      items: qs.length,
      responses: rep.counts.total,
    })
  }
  return out
}

export interface KpiRunOption {
  id: string
  label: string
}
/** نشرات استطلاعات برنامج الخطة التي تحتوي فقرات مرتبطة بالمؤشر. */
export async function listRunsForKpi(indicatorId: string, programId: string): Promise<KpiRunOption[]> {
  const lk = await fetchIndicatorLinks(indicatorId)
  const runs = await fetchRunsForIndicator(lk)
  const termAr: Record<string, string> = { annual: 'سنوي', s1: 'الأول', s2: 'الثاني', summer: 'الصيفي' }
  return runs
    .filter((r) => r.program_id === programId)
    .map((r) => ({ id: r.id, label: `${r.survey.title_ar} — ${r.year} ${termAr[r.term] ?? r.term}` }))
}

export const fmtVal = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? '' : String(Math.round(n * 100) / 100)

// ---------------------------------------------------------------------------
// إنشاء خطة جديدة (مع نسخ هيكل خطة سابقة وترحيل المستهدفات)
// ---------------------------------------------------------------------------
export interface NewPlanInput {
  program_id: string
  year_label: string
  target_year_label: string | null
  title: string | null
  created_by: string | null
  copyFrom?: string | null
}
export async function createPlan(inp: NewPlanInput): Promise<{ id: string | null; error: string | null }> {
  const base = {
    program_id: inp.program_id,
    year_label: inp.year_label.trim(),
    target_year_label: inp.target_year_label?.trim() || null,
    title: inp.title?.trim() || null,
    created_by: inp.created_by,
  }
  let extra: Partial<OpPlan> = {}
  let src: PlanFull | null = null
  if (inp.copyFrom) {
    const r = await fetchPlanFull(inp.copyFrom)
    src = r.data
    if (src) extra = { intro: src.plan.intro, context: src.plan.context }
  }
  const { data, error } = await supabase.from('op_plans').insert({ ...base, ...extra }).select('id').single()
  if (error || !data) {
    const dup = /duplicate|unique|23505/i.test(error?.message ?? '')
    return { id: null, error: dup ? 'توجد خطة لهذا البرنامج بالعام نفسه.' : (error?.message ?? 'تعذّر الإنشاء') }
  }
  const planId = (data as { id: string }).id
  if (src) await cloneStructure(src, planId)
  return { id: planId, error: null }
}

async function cloneStructure(src: PlanFull, planId: string) {
  for (const g of src.goals) {
    const { data: ng } = await supabase
      .from('op_goals')
      .insert({ plan_id: planId, position: g.position, text_ar: g.text_ar, aligns: g.aligns })
      .select('id')
      .single()
    if (!ng) continue
    for (const i of g.initiatives) {
      const { data: ni } = await supabase
        .from('op_initiatives')
        .insert({ goal_id: (ng as { id: string }).id, position: i.position, text_ar: i.text_ar })
        .select('id')
        .single()
      if (!ni) continue
      for (const a of i.activities) {
        const { data: na } = await supabase
          .from('op_activities')
          .insert({
            initiative_id: (ni as { id: string }).id,
            position: a.position,
            text_ar: a.text_ar,
            executor: a.executor,
            budget: a.budget,
          })
          .select('id')
          .single()
        if (!na) continue
        const rows = a.kpiIds.map((k, idx) => ({
          activity_id: (na as { id: string }).id,
          indicator_id: k,
          position: idx,
        }))
        if (rows.length) await supabase.from('op_activity_kpis').insert(rows)
      }
    }
  }
  // ترحيل: المستهدف الجديد ← مستهدف، والأداء الفعلي السابق ← مرجعية داخلية
  const vals = [...src.values.values()].map((v) => ({
    plan_id: planId,
    indicator_id: v.indicator_id,
    benchmark: isBlank(v.actual) ? v.benchmark : v.actual,
    target: isBlank(v.new_target) ? v.target : v.new_target,
    source: v.source,
    run_id: null,
  }))
  if (vals.length) await supabase.from('op_kpi_values').insert(vals)
}

export const OPS_HELP = {
  measure: { survey: 'من استطلاع رأي', manual: 'إدخال يدوي' } as Record<MeasureType, string>,
}
