import { supabase } from './supabase'
import { fetchSurveyWithAxes } from './queries'
import { bandFor, meanToPercent, needsDevelopment, type RatingBand } from './ratings'
import type { AnswerRow, Campus, Program, ResponseRow, SurveyRun, SurveyWithAxes } from './types'

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
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export async function buildReport(runId: string): Promise<ReportData | null> {
  const { data: run } = await supabase.from('survey_runs').select('*').eq('id', runId).single()
  if (!run) return null
  const r = run as SurveyRun

  const [survey, { data: program }] = await Promise.all([
    fetchSurveyWithAxes(r.survey_id),
    supabase.from('programs').select('*').eq('id', r.program_id).single(),
  ])
  if (!survey || !program) return null

  // responses + answers
  const { data: responses } = await supabase
    .from('responses')
    .select('id, campus')
    .eq('run_id', runId)
  const respList = (responses as Pick<ResponseRow, 'id' | 'campus'>[]) ?? []
  const respCampus = new Map<string, Campus>(respList.map((x) => [x.id, x.campus]))

  let answers: Pick<AnswerRow, 'response_id' | 'question_id' | 'value'>[] = []
  if (respList.length) {
    const { data: ans } = await supabase
      .from('answers')
      .select('response_id, question_id, value')
      .in(
        'response_id',
        respList.map((x) => x.id),
      )
    answers = (ans as typeof answers) ?? []
  }

  // group answers by question and campus
  const byQuestion = new Map<string, { male: number[]; female: number[]; all: number[] }>()
  for (const a of answers) {
    const campus = respCampus.get(a.response_id)
    if (!byQuestion.has(a.question_id))
      byQuestion.set(a.question_id, { male: [], female: [], all: [] })
    const g = byQuestion.get(a.question_id)!
    g.all.push(a.value)
    if (campus === 'male') g.male.push(a.value)
    else if (campus === 'female') g.female.push(a.value)
  }

  const axes: AxisStat[] = survey.axes.map((ax) => {
    const questions: QuestionStat[] = ax.questions.map((q) => {
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

  const overallMean = avg(axes.map((a) => a.meanAll).filter((x): x is number => x != null))

  const allQ = axes.flatMap((a) => a.questions).filter((q) => q.meanAll != null)
  const sorted = [...allQ].sort((a, b) => (b.meanAll ?? 0) - (a.meanAll ?? 0))
  const strengths = sorted.slice(0, 5)
  const weaknesses = sorted.slice(-5).reverse()

  return {
    run: r,
    survey,
    program: program as Program,
    axes,
    overallMean,
    overallPercent: meanToPercent(overallMean),
    counts: {
      total: respList.length,
      male: respList.filter((x) => x.campus === 'male').length,
      female: respList.filter((x) => x.campus === 'female').length,
    },
    strengths,
    weaknesses,
  }
}
