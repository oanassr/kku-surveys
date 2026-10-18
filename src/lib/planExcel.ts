// استيراد/تصدير جدول الخطة التشغيلية عبر إكسل (نفس أعمدة جدول الخطة في Word)
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { supabase } from './supabase'
import { addRow, linkKpi, upsertValue } from './planOps'
import { isBlank, type GoalNode, type PlanFull } from './plans'
import type { Indicator } from './types'

const HEADERS = [
  'الهدف',
  'المبادرة',
  'النشاط',
  'الجهة المنفذة',
  'مؤشر الأداء',
  'رمز المؤشر',
  'الأداء الفعلي',
  'المقارنة المرجعية الداخلية',
  'الأداء المستهدف',
  'الأداء المستهدف الجديد',
  'الميزانية التقديرية',
  'كيفية الحساب',
  'نوع القياس (استطلاع/يدوي)',
]

export interface ParsedPlanRow {
  goal: string
  initiative: string
  activity: string
  executor: string
  kpi: string
  code: string
  actual: string
  benchmark: string
  target: string
  new_target: string
  budget: string
  calc: string
  type: string
}

const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim()
const norm = (s: string) => clean(s).replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')

export function downloadPlanTemplate() {
  const rows = [
    HEADERS,
    ['تأهيل متخصصين بقدرات أكاديمية ومهارية عالية', 'تحديث البرامج الأكاديمية ومراجعة المناهج', 'مراجعة وتحديث المنهج بما يتوافق مع سوق العمل', 'لجنة الخطط والمناهج', 'تقويم الطلاب لجودة التعلم في البرنامج', 'KPI-PG-1', '4.5', '4.2', '4.7', '4.8', 'تحدد من قبل البرنامج', 'متوسط تقدير الطلاب على مقياس من خمس مستويات في مسح سنوي', 'استطلاع'],
    ['', '', '', '', 'رضا المستفيدين عن مصادر التعلم', 'KPI-PG-14', '4.1', '3.9', '4.0', '4.3', '', '', 'استطلاع'],
    ['', 'تعزيز الخدمات المهنية للطلاب', 'تطوير الخدمات الطلابية', 'وحدة الخدمات الطلابية', 'نسبة الطلاب المشاركين في الأنشطة', 'KPI-PG-40', '60', '45', '70', '75', '', 'النسبة المئوية للمشاركين إلى الإجمالي', 'يدوي'],
    ['ملاحظة: اترك الخلايا المكررة فارغة (الهدف/المبادرة/النشاط) وستُملأ تلقائيًا من الصف السابق. يمكنك لصق جدول الخطة من Word مباشرة بنفس ترتيب الأعمدة.'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [34, 34, 38, 22, 34, 12, 12, 14, 12, 14, 22, 40, 16].map((wch) => ({ wch }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'الخطة التشغيلية')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([out], { type: 'application/octet-stream' }), 'قالب_الخطة_التشغيلية.xlsx')
}

/** تصدير الخطة الحالية في جدول مسطّح (قابل لإعادة الاستيراد). */
export function downloadPlanSheet(full: PlanFull) {
  const rows: (string | number)[][] = [HEADERS]
  full.goals.forEach((g) => {
    g.initiatives.forEach((i) => {
      i.activities.forEach((a) => {
        const ks = a.kpiIds.length ? a.kpiIds : [null]
        ks.forEach((kid) => {
          const k = kid ? full.kpis.get(kid) : undefined
          const v = kid ? full.values.get(kid) : undefined
          rows.push([
            g.text_ar,
            i.text_ar,
            a.text_ar,
            a.executor ?? '',
            k?.name_ar ?? '',
            k?.code ?? '',
            v?.actual ?? '',
            v?.benchmark ?? '',
            v?.target ?? '',
            v?.new_target ?? '',
            a.budget ?? '',
            k?.calc_method ?? '',
            k ? (k.measure_type === 'manual' ? 'يدوي' : 'استطلاع') : '',
          ])
        })
      })
    })
  })
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [34, 34, 38, 22, 34, 12, 12, 14, 12, 14, 22, 40, 16].map((wch) => ({ wch }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'الخطة التشغيلية')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([out], { type: 'application/octet-stream' }), `الخطة_التشغيلية_${full.plan.year_label}.xlsx`)
}

/** يحلّل الملف: يطابق الأعمدة بالأسماء (يدعم جدول Word ذا العشرة أعمدة) ويملأ الخلايا المدمجة. */
export async function parsePlanWorkbook(file: File): Promise<ParsedPlanRow[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false })
  if (!raw.length) return []

  // صف العناوين = أول صف يحوي «مؤشر» و«المبادر»
  let hi = raw.findIndex((r) => {
    const t = (r as unknown[]).map(clean).join('|')
    return /مؤشر/.test(t) && /(المبادر|النشاط|الأنشطة)/.test(t)
  })
  const hdr = hi >= 0 ? (raw[hi] as unknown[]).map(clean) : HEADERS
  if (hi < 0) hi = -1
  const find = (test: (h: string) => boolean) => hdr.findIndex(test)
  const col = {
    goal: find((h) => /^الهدف/.test(h)),
    initiative: find((h) => /المبادر/.test(h)),
    activity: find((h) => /(النشاط|الأنشطة)/.test(h)),
    executor: find((h) => /الجهة/.test(h)),
    kpi: find((h) => /مؤشر/.test(h) && !/رمز/.test(h)),
    code: find((h) => /رمز/.test(h)),
    actual: find((h) => /الفعلي/.test(h)),
    benchmark: find((h) => /المرجعي/.test(h)),
    target: find((h) => /المستهدف/.test(h) && !/الجديد/.test(h)),
    new_target: find((h) => /المستهدف/.test(h) && /الجديد/.test(h)),
    budget: find((h) => /الميزاني/.test(h)),
    calc: find((h) => /(كيفية|الحساب)/.test(h)),
    type: find((h) => /نوع القياس/.test(h)),
  }
  const cell = (r: unknown[], i: number) => (i >= 0 ? clean(r[i]) : '')

  const out: ParsedPlanRow[] = []
  let last = { goal: '', initiative: '', activity: '', executor: '', budget: '' }
  for (const r0 of raw.slice(hi + 1)) {
    const r = r0 as unknown[]
    if (r.every((c) => clean(c) === '')) continue
    const row: ParsedPlanRow = {
      goal: cell(r, col.goal),
      initiative: cell(r, col.initiative),
      activity: cell(r, col.activity),
      executor: cell(r, col.executor),
      kpi: cell(r, col.kpi),
      code: cell(r, col.code),
      actual: cell(r, col.actual),
      benchmark: cell(r, col.benchmark),
      target: cell(r, col.target),
      new_target: cell(r, col.new_target),
      budget: cell(r, col.budget),
      calc: cell(r, col.calc),
      type: cell(r, col.type),
    }
    // سطر ملاحظة (خلية واحدة فقط بلا مؤشر/نشاط)
    if (!row.kpi && !row.code && !row.activity && !row.initiative) continue
    // ملء الخلايا المدمجة من الصف السابق
    if (!row.goal) row.goal = last.goal
    else last = { goal: row.goal, initiative: '', activity: '', executor: '', budget: '' }
    if (!row.initiative) row.initiative = last.initiative
    else last = { ...last, initiative: row.initiative, activity: '', executor: '', budget: '' }
    if (!row.activity) {
      row.activity = last.activity
      if (!row.executor) row.executor = last.executor
      if (!row.budget) row.budget = last.budget
    } else last = { ...last, activity: row.activity, executor: row.executor, budget: row.budget }
    out.push(row)
  }
  return out
}

export interface ImportSummary {
  goals: number
  initiatives: number
  activities: number
  kpisCreated: number
  links: number
  values: number
}

const guessSurvey = (name: string) => /(رضا|تقويم|تقييم|استطلاع)/.test(name)
const guessDirection = (name: string, vals: string[]): 'up' | 'down' | 'none' =>
  vals.some((v) => v.includes(':')) ? 'none' : /تسرب/.test(name) ? 'down' : 'up'

/** يطبّق الصفوف على الخطة: يطابق الموجود بالنص ويُنشئ الناقص، ثم يربط المؤشرات ويضع القيم. */
export async function importPlanRows(
  full: PlanFull,
  programKpis: Indicator[],
  rows: ParsedPlanRow[],
  uid: string | undefined,
  defaultGoalId?: string,
): Promise<ImportSummary> {
  const sum: ImportSummary = { goals: 0, initiatives: 0, activities: 0, kpisCreated: 0, links: 0, values: 0 }
  const goals: GoalNode[] = JSON.parse(JSON.stringify(full.goals))
  const kpis = [...programKpis]

  for (const row of rows) {
    // ---- الهدف
    let g = row.goal ? goals.find((x) => norm(x.text_ar) === norm(row.goal)) : undefined
    if (!g && !row.goal) g = goals.find((x) => x.id === defaultGoalId) ?? goals[0]
    if (!g) {
      const { id } = await addRow('op_goals', {
        plan_id: full.plan.id,
        position: goals.length,
        text_ar: row.goal || `الهدف ${goals.length + 1}`,
      })
      if (!id) continue
      g = { id, plan_id: full.plan.id, position: goals.length, text_ar: row.goal || `الهدف ${goals.length + 1}`, aligns: {}, initiatives: [] }
      goals.push(g)
      sum.goals++
    }
    // ---- المبادرة
    const iText = row.initiative || 'مبادرة بلا عنوان'
    let ini = g.initiatives.find((x) => norm(x.text_ar) === norm(iText))
    if (!ini) {
      const { id } = await addRow('op_initiatives', { goal_id: g.id, position: g.initiatives.length, text_ar: iText })
      if (!id) continue
      ini = { id, goal_id: g.id, position: g.initiatives.length, text_ar: iText, activities: [] }
      g.initiatives.push(ini)
      sum.initiatives++
    }
    // ---- النشاط
    const aText = row.activity || 'نشاط بلا عنوان'
    let act = ini.activities.find((x) => norm(x.text_ar) === norm(aText))
    if (!act) {
      const { id } = await addRow('op_activities', {
        initiative_id: ini.id,
        position: ini.activities.length,
        text_ar: aText,
        executor: row.executor || null,
        budget: row.budget || null,
      })
      if (!id) continue
      act = { id, initiative_id: ini.id, position: ini.activities.length, text_ar: aText, executor: row.executor || null, budget: row.budget || null, kpiIds: [] }
      ini.activities.push(act)
      sum.activities++
    }
    // ---- المؤشر
    if (!row.kpi && !row.code) continue
    let k = kpis.find(
      (x) => (row.code ? x.code === row.code : true) && (row.kpi ? norm(x.name_ar) === norm(row.kpi) : true),
    )
    if (!k) {
      const measure = row.type ? (/(يدوي|manual)/i.test(row.type) ? 'manual' : 'survey') : guessSurvey(row.kpi) ? 'survey' : 'manual'
      const { data } = await supabase
        .from('indicators')
        .insert({
          kind: 'kpi',
          code: row.code || null,
          name_ar: row.kpi || row.code,
          program_id: full.program.id,
          created_by: uid,
          degree_level: full.program.degree,
          measure_type: measure,
          calc_method: row.calc || null,
          direction: guessDirection(row.kpi, [row.actual, row.target]),
        })
        .select('*')
        .single()
      if (!data) continue
      k = data as Indicator
      kpis.push(k)
      sum.kpisCreated++
    }
    if (!act.kpiIds.includes(k.id)) {
      const err = await linkKpi(act.id, k.id, act.kpiIds.length)
      if (!err) {
        act.kpiIds.push(k.id)
        sum.links++
      }
    }
    const patch: Record<string, string> = {}
    if (!isBlank(row.actual) || row.actual === '-') patch.actual = row.actual
    if (row.benchmark) patch.benchmark = row.benchmark
    if (row.target) patch.target = row.target
    if (row.new_target) patch.new_target = row.new_target
    if (Object.keys(patch).length) {
      const err = await upsertValue(full.plan.id, k.id, patch)
      if (!err) sum.values++
    }
  }
  return sum
}

