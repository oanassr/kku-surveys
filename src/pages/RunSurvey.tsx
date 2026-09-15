import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarX2, CheckCircle2, PartyPopper, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchRunByToken, runIsOpenNow, type RunFull } from '@/lib/queries'
import type { Campus } from '@/lib/types'
import { useLang } from '@/i18n'
import { PublicHeader } from '@/components/PublicHeader'
import { LikertScale } from '@/components/LikertScale'
import { Button, Card, Container, PageLoader } from '@/components/ui'
import { cn } from '@/lib/cn'

export default function RunSurvey() {
  const { token = '' } = useParams()
  const { t, lang } = useLang()
  const nm = (o: { name_ar: string; name_en: string | null }) =>
    lang === 'en' && o.name_en ? o.name_en : o.name_ar

  const [data, setData] = useState<RunFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [campus, setCampus] = useState<Campus | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRunByToken(token).then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [token])

  const allQuestions = useMemo(
    () => (data ? data.survey.axes.flatMap((a) => a.questions) : []),
    [data],
  )
  const answeredCount = Object.keys(answers).length
  const total = allQuestions.length
  const progress = total ? Math.round((answeredCount / total) * 100) : 0

  async function submit() {
    if (!data) return
    if (!campus) {
      setError(t('take.selectCampus'))
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (answeredCount < total) {
      setError(t('take.answerAll'))
      return
    }
    setSubmitting(true)
    setError(null)
    const { data: resp, error: e1 } = await supabase
      .from('responses')
      .insert({ run_id: data.run.id, campus })
      .select('id')
      .single()
    if (e1 || !resp) {
      setSubmitting(false)
      setError(t('take.closed'))
      return
    }
    const rows = Object.entries(answers).map(([question_id, value]) => ({
      response_id: resp.id,
      question_id,
      value,
    }))
    const { error: e2 } = await supabase.from('answers').insert(rows)
    setSubmitting(false)
    if (e2) {
      setError('—')
      return
    }
    setDone(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading)
    return (
      <div className="min-h-full">
        <PublicHeader />
        <PageLoader label={t('common.loading')} />
      </div>
    )

  if (!data)
    return (
      <div className="min-h-full">
        <PublicHeader />
        <Container className="py-20 text-center text-[var(--text-muted)]">
          {t('take.closed')}
        </Container>
      </div>
    )

  if (!runIsOpenNow(data.run) && !done)
    return (
      <div className="min-h-full">
        <PublicHeader />
        <Container className="py-16">
          <Card className="mx-auto max-w-md p-8 text-center">
            <CalendarX2 className="mx-auto mb-4 h-12 w-12 text-amber-500" />
            <h2 className="text-lg font-semibold text-brand-900">{t('take.closed')}</h2>
          </Card>
        </Container>
      </div>
    )

  if (done)
    return (
      <div className="min-h-full">
        <PublicHeader />
        <Container className="py-16">
          <Card className="mx-auto max-w-md p-10 text-center animate-fade-up">
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-green-50">
              <PartyPopper className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-brand-900">{t('take.thanks')}</h2>
            <p className="mt-2 text-[var(--text-muted)]">{t('take.thanksSub')}</p>
            <Link to="/" className="mt-6 inline-block">
              <Button variant="outline">{t('nav.home')}</Button>
            </Link>
          </Card>
        </Container>
      </div>
    )

  const title = lang === 'en' && data.survey.title_en ? data.survey.title_en : data.survey.title_ar
  let qNo = 0

  return (
    <div className="min-h-full pb-28">
      <PublicHeader />

      {/* Sticky progress */}
      <div className="sticky top-16 z-30 border-b border-[var(--border)] glass">
        <Container className="flex items-center gap-4 py-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-l from-brand-500 to-brand-800 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="tnum shrink-0 text-sm font-semibold text-brand-800">
            {answeredCount}/{total}
          </span>
        </Container>
      </div>

      <Container className="max-w-3xl py-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-brand-950">{title}</h1>
          <p className="mt-1 text-brand-700">{nm(data.program)}</p>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--text-muted)]">
            {t('take.intro')}
          </p>
        </div>

        {/* Campus */}
        <Card className="mb-6 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-900">
            <Users className="h-4 w-4" />
            {t('take.selectCampus')} <span className="text-red-500">*</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(['male', 'female'] as Campus[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCampus(c)}
                className={cn(
                  'h-12 rounded-xl border text-sm font-medium transition-all',
                  campus === c
                    ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                    : 'border-[var(--border)] bg-white text-[var(--text)] hover:border-brand-300',
                )}
              >
                {t(`common.${c}`)}
              </button>
            ))}
          </div>
        </Card>

        {/* Axes */}
        <div className="space-y-6">
          {data.survey.axes.map((axis) => (
            <Card key={axis.id} className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-[var(--border)] bg-brand-50/60 px-5 py-3">
                <span className="text-sm font-bold text-brand-900">
                  {lang === 'en' && axis.title_en ? axis.title_en : axis.title_ar}
                </span>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {axis.questions.map((q) => {
                  qNo += 1
                  const answered = answers[q.id] != null
                  return (
                    <div key={q.id} className="p-5">
                      <div className="mb-3 flex items-start gap-2">
                        <span
                          className={cn(
                            'tnum mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold',
                            answered
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {answered ? <CheckCircle2 className="h-4 w-4" /> : qNo}
                        </span>
                        <p className="text-sm leading-relaxed text-[var(--text)]">
                          {lang === 'en' && q.text_en ? q.text_en : q.text_ar}
                        </p>
                      </div>
                      <div className="ps-8">
                        <LikertScale
                          name={q.text_ar}
                          value={answers[q.id] ?? null}
                          onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          ))}
        </div>

        {error && (
          <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            {error}
          </p>
        )}
      </Container>

      {/* Sticky submit bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] glass">
        <Container className="flex items-center justify-between py-3">
          <span className="text-sm text-[var(--text-muted)]">
            {answeredCount === total ? (
              <span className="font-medium text-green-700">✓ {t('common.responses')}</span>
            ) : (
              `${total - answeredCount} ${t('common.required')}`
            )}
          </span>
          <Button variant="gold" onClick={submit} disabled={submitting}>
            {submitting ? t('common.loading') : t('common.submit')}
          </Button>
        </Container>
      </div>
    </div>
  )
}
