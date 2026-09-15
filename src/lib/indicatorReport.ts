import { supabase } from './supabase'
import { buildReport, type AxisStat, type ReportData } from './report'
import { bandFor, meanToPercent } from './ratings'
import type { Indicator, SurveyRun } from './types'

function avg(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export interface IndicatorLinks {
  axisIds: Set<string>
  questionIds: Set<string>
}

/** يجلب المحاور والفقرات المرتبطة بمؤشر. */
export async function fetchIndicatorLinks(indicatorId: string): Promise<IndicatorLinks> {
  const [{ data: ax }, { data: qs }] = await Promise.all([
    supabase.from('axis_indicators').select('axis_id').eq('indicator_id', indicatorId),
    supabase.from('question_indicators').select('question_id').eq('indicator_id', indicatorId),
  ])
  return {
    axisIds: new Set((ax ?? []).map((r: { axis_id: string }) => r.axis_id)),
    questionIds: new Set((qs ?? []).map((r: { question_id: string }) => r.question_id)),
  }
}

/** النشرات (runs) التي تحتوي على عناصر مرتبطة بهذا المؤشر. */
export async function fetchRunsForIndicator(
  links: IndicatorLinks,
): Promise<(SurveyRun & { survey: { title_ar: string }; program: { name_ar: string } })[]> {
  // نجد survey_ids من المحاور/الفقرات المرتبطة
  const surveyIds = new Set<string>()
  if (links.axisIds.size) {
    const { data } = await supabase
      .from('survey_axes')
      .select('survey_id')
      .in('id', [...links.axisIds])
    ;(data ?? []).forEach((r: { survey_id: string }) => surveyIds.add(r.survey_id))
  }
  if (links.questionIds.size) {
    const { data } = await supabase
      .from('survey_questions')
      .select('axis_id')
      .in('id', [...links.questionIds])
    const axisIds = (data ?? []).map((r: { axis_id: string }) => r.axis_id)
    if (axisIds.length) {
      const { data: ax } = await supabase.from('survey_axes').select('survey_id').in('id', axisIds)
      ;(ax ?? []).forEach((r: { survey_id: string }) => surveyIds.add(r.survey_id))
    }
  }
  if (!surveyIds.size) return []
  const { data: runs } = await supabase
    .from('survey_runs')
    .select('*, survey:survey_templates(title_ar), program:programs(name_ar)')
    .in('survey_id', [...surveyIds])
    .order('created_at', { ascending: false })
  return (runs as unknown as (SurveyRun & {
    survey: { title_ar: string }
    program: { name_ar: string }
  })[]) ?? []
}

export interface IndicatorReport {
  indicator: Indicator
  report: ReportData // مُرشّح على عناصر المؤشر (متوافق مع تصدير Word)
  itemCount: number
}

/**
 * يبني تقرير قياس المؤشر لنشر معيّن:
 * يعيد استخدام buildReport ثم يُبقي فقط الفقرات المرتبطة (مباشرة أو عبر محور مرتبط).
 */
export async function buildIndicatorReport(
  indicatorId: string,
  runId: string,
): Promise<IndicatorReport | null> {
  const [{ data: indicator }, links, base] = await Promise.all([
    supabase.from('indicators').select('*').eq('id', indicatorId).single(),
    fetchIndicatorLinks(indicatorId),
    buildReport(runId),
  ])
  if (!indicator || !base) return null

  // رشّح المحاور/الفقرات
  const axes: AxisStat[] = base.axes
    .map((ax) => {
      const axisLinked = links.axisIds.has(ax.id)
      const questions = ax.questions.filter((q) => axisLinked || links.questionIds.has(q.id))
      if (!questions.length) return null
      const m = avg(questions.map((q) => q.meanAll).filter((x): x is number => x != null))
      return {
        ...ax,
        questions,
        meanAll: m,
        percentAll: meanToPercent(m),
        band: bandFor(m),
      } as AxisStat
    })
    .filter((a): a is AxisStat => a !== null)

  const allQ = axes.flatMap((a) => a.questions).filter((q) => q.meanAll != null)
  const overallMean = avg(allQ.map((q) => q.meanAll as number))
  const sorted = [...allQ].sort((a, b) => (b.meanAll ?? 0) - (a.meanAll ?? 0))

  const ind = indicator as Indicator
  const kindLabel =
    ind.kind === 'kpi' ? 'مؤشر أداء' : ind.kind === 'objective' ? 'هدف' : 'مبادرة'

  const report: ReportData = {
    ...base,
    survey: {
      ...base.survey,
      title_ar: `قياس ${kindLabel}: ${ind.name_ar}`,
      title_en: ind.name_en,
    },
    axes,
    overallMean,
    overallPercent: meanToPercent(overallMean),
    strengths: sorted.slice(0, 5),
    weaknesses: sorted.slice(-5).reverse(),
  }

  return { indicator: ind, report, itemCount: allQ.length }
}
