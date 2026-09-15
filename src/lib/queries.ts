import { supabase } from './supabase'
import type {
  AxisWithQuestions,
  Program,
  SurveyAxis,
  SurveyQuestion,
  SurveyRun,
  SurveyTemplate,
  SurveyWithAxes,
} from './types'

/** يجلب استطلاعًا كاملًا بمحاوره وفقراته مرتبة. */
export async function fetchSurveyWithAxes(surveyId: string): Promise<SurveyWithAxes | null> {
  const { data: survey } = await supabase
    .from('survey_templates')
    .select('*')
    .eq('id', surveyId)
    .single()
  if (!survey) return null

  const { data: axes } = await supabase
    .from('survey_axes')
    .select('*')
    .eq('survey_id', surveyId)
    .order('position')

  const axisIds = (axes ?? []).map((a: SurveyAxis) => a.id)
  let questions: SurveyQuestion[] = []
  if (axisIds.length) {
    const { data: qs } = await supabase
      .from('survey_questions')
      .select('*')
      .in('axis_id', axisIds)
      .eq('is_active', true)
      .order('position')
    questions = (qs as SurveyQuestion[]) ?? []
  }

  const axesWithQ: AxisWithQuestions[] = (axes ?? []).map((a: SurveyAxis) => ({
    ...a,
    questions: questions.filter((q) => q.axis_id === a.id),
  }))

  return { ...(survey as SurveyTemplate), axes: axesWithQ }
}

export interface RunFull {
  run: SurveyRun
  survey: SurveyWithAxes
  program: Program
}

/** يجلب نشرًا عبر رمز الوصول مع الاستطلاع والبرنامج. */
export async function fetchRunByToken(token: string): Promise<RunFull | null> {
  const { data: run } = await supabase
    .from('survey_runs')
    .select('*')
    .eq('access_token', token)
    .single()
  if (!run) return null

  const [survey, { data: program }] = await Promise.all([
    fetchSurveyWithAxes((run as SurveyRun).survey_id),
    supabase.from('programs').select('*').eq('id', (run as SurveyRun).program_id).single(),
  ])
  if (!survey || !program) return null

  return { run: run as SurveyRun, survey, program: program as Program }
}

export function runIsOpenNow(run: SurveyRun): boolean {
  const now = Date.now()
  return (
    run.status === 'open' &&
    now >= new Date(run.opens_at).getTime() &&
    now <= new Date(run.closes_at).getTime()
  )
}
