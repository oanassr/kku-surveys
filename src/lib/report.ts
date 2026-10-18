import { supabase } from './supabase'
import { fetchSurveyWithAxes } from './queries'
import { bandFor, meanToPercent, needsDevelopment, type RatingBand } from './ratings'
import {
  fetchAnswerTexts,
  fetchAnswers,
  fetchResponses,
  type AnswerLite,
  type AnswerTextLite,
  type ResponseLite,
} from './answers'
import { isLikert } from './types'
import type { Campus, Program, SurveyRun, SurveyWithAxes } from './types'

export interface QuestionStat {
  id: string
  text_ar: string
  text_en: string | null
  meanMale: number | null
  meanFemale: number | null
  meanAll: number | null
  percentAll: number | null
  band: RatingBand | null
  needsDev: boolean
}

export interface AxisStat {
  id: string
  title_ar: string
  title_en: string | null
  questions: QuestionStat[]
  meanAll: number | null
  percentAll: number | null
  band: RatingBand | null
}

/** نتائج سؤال مفتوح: كل الردود النصية مع مقر المجيب. */
export interface OpenQuestionResult {
  id: string
  text_ar: string
  axisTitle: string
  items: { text: string; campus: Campus | null; at: string | null }[]
}

export interface ReportData {
  run: SurveyRun
  survey: SurveyWithAxes
  program: Program
  axes: AxisStat[]
  overallMean: number | null
  overallPercent: number | null
  counts: { total: number; male: number; female: number }
  strengths: QuestionStat[]
  weaknesses: QuestionStat[]
  openAnswers: OpenQuestionResult[]
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/** البيانات الخام لنشر واحد (تُستخدم للتقرير وللتصدير إلى إكسل). */
export interface RunRawData {
  run: SurveyRun
  survey: SurveyWithAxes
  program: Program
  responses: ResponseLite[]
  answers: AnswerLite[]
  texts: AnswerTextLite[]
}

export async function loadRunData(runId: string): Promise<RunRawData | null> {
  const { data: run } = await supabase.from('survey_runs').select('*').eq('id', runId).single()
  if (!run) return null
  const r = run as SurveyRun

  const [survey, { data: program }] = await Promise.all([
    fetchSurveyWithAxes(r.survey_id),
    supabase.from('programs').select('*').eq('id', r.program_id).single(),
  ])
  if (!survey || !program) return null

  const responses = await fetchResponses([runId])
  const ids = responses.map((x) => x.id)
  const hasOpen = survey.axes.some((a) => a.questions.some((q) => !isLikert(q)))
  const [answers, texts] = await Promise.all([
    ids.length ? fetchAnswers(ids) : Promise.resolve([] as AnswerLite[]),
    ids.length && hasOpen ? fetchAnswerTexts(ids) : Promise.resolve([] as AnswerTextLite[]),
  ])
  return { run: r, survey, program: program as Program, responses, answers, texts }
}

export function computeReport(raw: RunRawData): ReportData {
  const { run, survey, program, responses, answers, texts } = raw
  const respCampus = new Map<string, Campus>(responses.map((x) => [x.id, x.campus]))

  // تجميع إجابات المقياس حسب الفقرة والمقر
  const byQuestion = new Map<string, { male: number[]; female: number[]; all: number[] }>()
  for (const a of answers) {
    const campus = respCampus.get(a.response_id)
    if (!byQuestion.has(a.question_id)) byQuestion.set(a.question_id, { male: [], female: [], all: [] })
    const g = byQuestion.get(a.question_id)!
    g.all.push(a.value)
    if (campus === 'male') g.male.push(a.value)
    else if (campus === 'female') g.female.push(a.value)
  }

  // المحاور تضم فقط فقرات المقياس؛ المحور المقتصر على أسئلة مفتوحة لا يدخل الإحصاء
  const axes: AxisStat[] = survey.axes
    .map((ax) => {
      const questions: QuestionStat[] = ax.questions.filter(isLikert).map((q) => {
        const g = byQuestion.get(q.id) ?? { male: [], female: [], all: [] }
        const meanAll = avg(g.all)
        return {
          id: q.id,
          text_ar: q.text_ar,
          text_en: q.text_en,
          meanMale: avg(g.male),
          meanFemale: avg(g.female),
          meanAll,
          percentAll: meanToPercent(meanAll),
          band: bandFor(meanAll),
          needsDev: needsDevelopment(meanAll),
        }
      })
      const axisMean = avg(questions.map((q) => q.meanAll).filter((x): x is number => x != null))
      return {
        id: ax.id,
        title_ar: ax.title_ar,
        title_en: ax.title_en,
        questions,
        meanAll: axisMean,
        percentAll: meanToPercent(axisMean),
        band: bandFor(axisMean),
      }
    })
    .filter((a) => a.questions.length > 0)

  const overallMean = avg(axes.map((a) => a.meanAll).filter((x): x is number => x != null))

  const allQ = axes.flatMap((a) => a.questions).filter((q) => q.meanAll != null)
  const sorted = [...allQ].sort((a, b) => (b.meanAll ?? 0) - (a.meanAll ?? 0))
  const strengths = sorted.slice(0, 5)
  const weaknesses = sorted.slice(-5).reverse()

  // الأسئلة المفتوحة
  const respById = new Map(responses.map((x) => [x.id, x]))
  const openAnswers: OpenQuestionResult[] = survey.axes.flatMap((ax) =>
    ax.questions
      .filter((q) => !isLikert(q))
      .map((q) => ({
        id: q.id,
        text_ar: q.text_ar,
        axisTitle: ax.title_ar,
        items: texts
          .filter((t) => t.question_id === q.id)
          .map((t) => ({
            text: t.text_value,
            campus: respById.get(t.response_id)?.campus ?? null,
            at: respById.get(t.response_id)?.submitted_at ?? null,
          })),
      })),
  )

  return {
    run,
    survey,
    program,
    axes,
    overallMean,
    overallPercent: meanToPercent(overallMean),
    counts: {
      total: responses.length,
      male: responses.filter((x) => x.campus === 'male').length,
      female: responses.filter((x) => x.campus === 'female').length,
    },
    strengths,
    weaknesses,
    openAnswers,
  }
}

export async function buildReport(runId: string): Promise<ReportData | null> {
  const raw = await loadRunData(runId)
  return raw ? computeReport(raw) : null
}
