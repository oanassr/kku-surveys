import { useEffect, useState } from 'react'
import { ChevronDown, ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/i18n'
import type { SurveyAxis, SurveyQuestion, SurveyTemplate } from '@/lib/types'
import { Modal } from '@/components/Modal'
import { PageLoader } from '@/components/ui'
import { cn } from '@/lib/cn'

export function IndicatorLinker({
  indicatorId,
  title,
  onClose,
}: {
  indicatorId: string
  title: string
  onClose: () => void
}) {
  const { lang } = useLang()
  const [surveys, setSurveys] = useState<SurveyTemplate[]>([])
  const [axes, setAxes] = useState<SurveyAxis[]>([])
  const [questions, setQuestions] = useState<SurveyQuestion[]>([])
  const [linkedAxes, setLinkedAxes] = useState<Set<string>>(new Set())
  const [linkedQs, setLinkedQs] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [s, a, q, la, lq] = await Promise.all([
        supabase.from('survey_templates').select('*').order('created_at'),
        supabase.from('survey_axes').select('*').order('position'),
        supabase.from('survey_questions').select('*').eq('is_active', true).order('position'),
        supabase.from('axis_indicators').select('axis_id').eq('indicator_id', indicatorId),
        supabase.from('question_indicators').select('question_id').eq('indicator_id', indicatorId),
      ])
      setSurveys((s.data as SurveyTemplate[]) ?? [])
      setAxes((a.data as SurveyAxis[]) ?? [])
      setQuestions((q.data as SurveyQuestion[]) ?? [])
      setLinkedAxes(new Set((la.data ?? []).map((r: { axis_id: string }) => r.axis_id)))
      setLinkedQs(new Set((lq.data ?? []).map((r: { question_id: string }) => r.question_id)))
      setLoading(false)
    }
    load()
  }, [indicatorId])

  async function toggleAxis(axisId: string) {
    const next = new Set(linkedAxes)
    if (next.has(axisId)) {
      next.delete(axisId)
      await supabase
        .from('axis_indicators')
        .delete()
        .eq('indicator_id', indicatorId)
        .eq('axis_id', axisId)
    } else {
      next.add(axisId)
      await supabase.from('axis_indicators').insert({ indicator_id: indicatorId, axis_id: axisId })
    }
    setLinkedAxes(next)
  }

  async function toggleQ(qId: string) {
    const next = new Set(linkedQs)
    if (next.has(qId)) {
      next.delete(qId)
      await supabase
        .from('question_indicators')
        .delete()
        .eq('indicator_id', indicatorId)
        .eq('question_id', qId)
    } else {
      next.add(qId)
      await supabase.from('question_indicators').insert({ indicator_id: indicatorId, question_id: qId })
    }
    setLinkedQs(next)
  }

  const nm = (o: { title_ar?: string; name_ar?: string; title_en?: string | null }) =>
    o.title_ar ?? o.name_ar ?? ''

  return (
    <Modal open onClose={onClose} title={`${lang === 'ar' ? 'ربط بالمؤشر' : 'Link'} — ${title}`} size="xl">
      {loading ? (
        <PageLoader />
      ) : (
        <div className="max-h-[65vh] space-y-2 overflow-y-auto pe-1">
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
            {lang === 'ar'
              ? 'اختر محاور كاملة أو فقرات محددة تقيس هذا المؤشر/الهدف/المبادرة. ربط محور يشمل كل فقراته.'
              : 'Select whole axes or specific items that measure this indicator.'}
          </p>
          {surveys.map((s) => {
            const sAxes = axes.filter((a) => a.survey_id === s.id)
            if (!sAxes.length) return null
            const isOpen = open.has(s.id)
            const linkedCount =
              sAxes.filter((a) => linkedAxes.has(a.id)).length +
              questions.filter((q) => sAxes.some((a) => a.id === q.axis_id) && linkedQs.has(q.id))
                .length
            return (
              <div key={s.id} className="rounded-xl border border-[var(--border)]">
                <button
                  onClick={() =>
                    setOpen((o) => {
                      const n = new Set(o)
                      n.has(s.id) ? n.delete(s.id) : n.add(s.id)
                      return n
                    })
                  }
                  className="flex w-full items-center justify-between px-3 py-2.5 text-start"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-brand-900">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                    )}
                    {s.title_ar}
                  </span>
                  {linkedCount > 0 && (
                    <span className="tnum rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                      {linkedCount}
                    </span>
                  )}
                </button>

                {isOpen && (
                  <div className="space-y-2 border-t border-[var(--border)] p-3">
                    {sAxes.map((ax) => {
                      const axisLinked = linkedAxes.has(ax.id)
                      const axQs = questions.filter((q) => q.axis_id === ax.id)
                      return (
                        <div key={ax.id} className="rounded-lg bg-slate-50/60 p-2">
                          <label className="flex cursor-pointer items-center gap-2.5 px-1 py-1">
                            <input
                              type="checkbox"
                              checked={axisLinked}
                              onChange={() => toggleAxis(ax.id)}
                              className="h-4 w-4 accent-brand-700"
                            />
                            <span className="text-sm font-medium text-brand-900">
                              {nm(ax)}
                              <span className="ms-1 text-xs text-[var(--text-muted)]">
                                ({lang === 'ar' ? 'المحور كامل' : 'whole axis'})
                              </span>
                            </span>
                          </label>
                          {!axisLinked && (
                            <div className="mt-1 space-y-0.5 ps-6">
                              {axQs.map((q) => (
                                <label
                                  key={q.id}
                                  className="flex cursor-pointer items-start gap-2.5 rounded px-1 py-1 hover:bg-white"
                                >
                                  <input
                                    type="checkbox"
                                    checked={linkedQs.has(q.id)}
                                    onChange={() => toggleQ(q.id)}
                                    className={cn('mt-0.5 h-3.5 w-3.5 accent-brand-600')}
                                  />
                                  <span className="text-xs leading-relaxed text-[var(--text)]">
                                    {q.text_ar}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
