// جلب الاستجابات والإجابات بترقيم مجزّأ.
// السبب: Supabase يقطع أي استعلام عند 1000 صف افتراضيًا، فجلب الإجابات دفعة واحدة يعطي متوسطات
// خاطئة بصمت عند كثرة المجيبين. وكذلك قوائم .in() الطويلة تُنتج عناوين URL أطول من المسموح.
import { supabase } from './supabase'
import type { Campus } from './types'

const PAGE = 1000
const IN_CHUNK = 80

export interface ResponseLite {
  id: string
  run_id: string
  campus: Campus
  submitted_at: string
}
export interface AnswerLite {
  response_id: string
  question_id: string
  value: number
}
export interface AnswerTextLite {
  response_id: string
  question_id: string
  text_value: string
}

function chunks<T>(a: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n))
  return out
}

async function paged<T>(
  make: (from: number, to: number) => PromiseLike<{ data: unknown[] | null }>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data } = await make(from, from + PAGE - 1)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

export async function fetchResponses(runIds: string[]): Promise<ResponseLite[]> {
  const parts = await Promise.all(
    chunks(runIds, 40).map((ch) =>
      paged<ResponseLite>((a, b) =>
        supabase
          .from('responses')
          .select('id, run_id, campus, submitted_at')
          .in('run_id', ch)
          .order('submitted_at')
          .order('id')
          .range(a, b),
      ),
    ),
  )
  return parts.flat()
}

export async function fetchAnswers(responseIds: string[]): Promise<AnswerLite[]> {
  const parts = await Promise.all(
    chunks(responseIds, IN_CHUNK).map((ch) =>
      paged<AnswerLite>((a, b) =>
        supabase
          .from('answers')
          .select('id, response_id, question_id, value')
          .in('response_id', ch)
          .order('id')
          .range(a, b),
      ),
    ),
  )
  return parts.flat()
}

export async function fetchAnswerTexts(responseIds: string[]): Promise<AnswerTextLite[]> {
  const parts = await Promise.all(
    chunks(responseIds, IN_CHUNK).map((ch) =>
      paged<AnswerTextLite>((a, b) =>
        supabase
          .from('answer_texts')
          .select('id, response_id, question_id, text_value')
          .in('response_id', ch)
          .order('id')
          .range(a, b),
      ),
    ),
  )
  return parts.flat()
}
