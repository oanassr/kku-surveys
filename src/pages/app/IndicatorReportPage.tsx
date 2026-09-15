import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Download, Target, ThumbsDown, ThumbsUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  buildIndicatorReport,
  fetchIndicatorLinks,
  fetchRunsForIndicator,
  type IndicatorReport,
} from '@/lib/indicatorReport'
import { exportReportDocx } from '@/lib/wordExport'
import { fmtMean } from '@/lib/ratings'
import { useLang } from '@/i18n'
import type { SurveyRun } from '@/lib/types'
import { Badge, Button, Card, PageLoader, Select } from '@/components/ui'
import { PageHeader } from './AppLayout'
import { KIND_LABEL } from './IndicatorsManager'

type RunOpt = SurveyRun & { survey: { title_ar: string }; program: { name_ar: string } }

export default function IndicatorReportPage() {
  const { indicatorId = '' } = useParams()
  const { t, lang } = useLang()
  const [runs, setRuns] = useState<RunOpt[]>([])
  const [runId, setRunId] = useState('')
  const [data, setData] = useState<IndicatorReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [computing, setComputing] = useState(false)
  const [noLinks, setNoLinks] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    async function load() {
      const links = await fetchIndicatorLinks(indicatorId)
      if (!links.axisIds.size && !links.questionIds.size) {
        setNoLinks(true)
        setLoading(false)
        return
      }
      let rs = await fetchRunsForIndicator(links)
      // إن كان المؤشر مرتبطًا ببرنامج، نُبقي نشرات ذلك البرنامج فقط
      const { data: ind } = await supabase
        .from('indicators')
        .select('program_id')
        .eq('id', indicatorId)
        .single()
      const pid = (ind as { program_id: string | null } | null)?.program_id
      if (pid) {
        const filtered = rs.filter((r) => r.program_id === pid)
        if (filtered.length) rs = filtered
      }
      setRuns(rs)
      if (rs.length) setRunId(rs[0].id)
      setLoading(false)
    }
    load()
  }, [indicatorId])

  useEffect(() => {
    if (!runId) return
    setComputing(true)
    buildIndicatorReport(indicatorId, runId).then((r) => {
      setData(r)
      setComputing(false)
    })
  }, [indicatorId, runId])

  async function doExport() {
    if (!data) return
    setExporting(true)
    await exportReportDocx(data.report, null, lang)
    setExporting(false)
  }

  const kind = data?.indicator.kind
  const kindMeta = useMemo(() => (kind ? KIND_LABEL[kind] : null), [kind])

  if (loading) return <PageLoader label={t('common.loading')} />

  if (noLinks)
    return (
      <div className="animate-fade-up">
        <BackLink />
        <Card className="mx-auto max-w-md p-8 text-center">
          <Target className="mx-auto mb-3 h-10 w-10 text-brand-300" />
          <h2 className="font-semibold text-brand-900">
            {lang === 'ar' ? 'لا توجد عناصر مرتبطة بعد' : 'No linked items yet'}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {lang === 'ar'
              ? 'اربط محاور أو فقرات بهذا المؤشر أولًا من صفحة المؤشرات (زر «ربط»).'
              : 'Link axes or items to this indicator first.'}
          </p>
        </Card>
      </div>
    )

  return (
    <div className="animate-fade-up">
      <BackLink />
      <PageHeader
        title={data ? data.report.survey.title_ar : t('nav.indicators')}
        subtitle={
          data ? `${data.report.program.name_ar} · ${data.itemCount} ${t('common.question')}` : ''
        }
        icon={<Target className="h-5 w-5" />}
        action={
          data && (
            <Button variant="gold" onClick={doExport} disabled={exporting}>
              <Download className="h-4 w-4" />
              {exporting ? t('common.loading') : lang === 'ar' ? 'تصدير Word' : 'Export Word'}
            </Button>
          )
        }
      />

      {/* Run picker */}
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        {kindMeta && <Badge color={kindMeta.color}>{lang === 'ar' ? kindMeta.ar : kindMeta.en}</Badge>}
        <span className="text-sm text-[var(--text-muted)]">
          {lang === 'ar' ? 'اختر النشر للقياس:' : 'Measure from run:'}
        </span>
        <Select value={runId} onChange={(e) => setRunId(e.target.value)} className="h-10 max-w-md">
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.survey.title_ar} — {r.program.name_ar} ({r.year})
            </option>
          ))}
        </Select>
      </Card>

      {computing ? (
        <PageLoader />
      ) : !data || !data.report.axes.length ? (
        <Card className="p-8 text-center text-[var(--text-muted)]">
          {lang === 'ar'
            ? 'لا توجد فقرات مرتبطة ضمن هذا النشر.'
            : 'No linked items within this run.'}
        </Card>
      ) : (
        <>
          {/* Overall */}
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <Card className="flex flex-col items-center justify-center p-5 text-center">
              <div className="text-sm text-[var(--text-muted)]">
                {lang === 'ar' ? 'قيمة القياس' : 'Score'}
              </div>
              <div
                className="tnum my-1 text-4xl font-bold"
                style={{ color: data.report.axes[0]?.band?.color ?? '#0b3b6f' }}
              >
                {fmtMean(data.report.overallMean)}
              </div>
              <div className="tnum text-sm text-[var(--text-muted)]">
                {data.report.overallPercent ?? '—'}%
              </div>
            </Card>
            <Card className="flex flex-col items-center justify-center p-5 text-center">
              <div className="text-sm text-[var(--text-muted)]">{t('common.male')}</div>
              <div className="tnum my-1 text-2xl font-bold text-brand-800">{data.report.counts.male}</div>
            </Card>
            <Card className="flex flex-col items-center justify-center p-5 text-center">
              <div className="text-sm text-[var(--text-muted)]">{t('common.female')}</div>
              <div className="tnum my-1 text-2xl font-bold text-brand-800">{data.report.counts.female}</div>
            </Card>
          </div>

          {/* Items grouped by axis */}
          <div className="space-y-4">
            {data.report.axes.map((ax) => (
              <Card key={ax.id} className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-[var(--border)] bg-brand-50/50 px-5 py-3">
                  <span className="font-semibold text-brand-900">{ax.title_ar}</span>
                  <div className="flex items-center gap-2">
                    {ax.band && <Badge color={ax.band.color}>{ax.band.labelAr}</Badge>}
                    <span className="tnum text-sm font-bold text-brand-800">{fmtMean(ax.meanAll)}</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)]">
                        <th className="p-3 text-start font-medium">{t('common.question')}</th>
                        <th className="p-3 text-center font-medium">{t('common.male')}</th>
                        <th className="p-3 text-center font-medium">{t('common.female')}</th>
                        <th className="p-3 text-center font-medium">{t('common.average')}</th>
                        <th className="p-3 text-center font-medium">{t('common.rating')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ax.questions.map((q) => (
                        <tr key={q.id} className="border-b border-[var(--border)] last:border-0">
                          <td className="p-3 text-start">{q.text_ar}</td>
                          <td className="tnum p-3 text-center text-[var(--text-muted)]">{fmtMean(q.meanMale)}</td>
                          <td className="tnum p-3 text-center text-[var(--text-muted)]">{fmtMean(q.meanFemale)}</td>
                          <td className="tnum p-3 text-center font-semibold">{fmtMean(q.meanAll)}</td>
                          <td className="p-3 text-center">
                            {q.band ? (
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: q.band.color }}
                                title={q.band.labelAr}
                              />
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </div>

          {/* Strengths / weaknesses */}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2 font-semibold text-green-700">
                <ThumbsUp className="h-4 w-4" />
                {lang === 'ar' ? 'أبرز نقاط القوة' : 'Top strengths'}
              </div>
              <ul className="space-y-2">
                {data.report.strengths.map((q) => (
                  <li key={q.id} className="flex justify-between gap-2 text-sm">
                    <span>{q.text_ar}</span>
                    <span className="tnum shrink-0 font-semibold text-green-600">{fmtMean(q.meanAll)}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2 font-semibold text-red-600">
                <ThumbsDown className="h-4 w-4" />
                {lang === 'ar' ? 'أبرز نقاط الضعف' : 'Top weaknesses'}
              </div>
              <ul className="space-y-2">
                {data.report.weaknesses.map((q) => (
                  <li key={q.id} className="flex justify-between gap-2 text-sm">
                    <span>{q.text_ar}</span>
                    <span className="tnum shrink-0 font-semibold text-red-500">{fmtMean(q.meanAll)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function BackLink() {
  const { t } = useLang()
  return (
    <Link
      to="/app/indicators"
      className="mb-4 inline-flex items-center gap-1 text-sm text-brand-700 hover:text-brand-900"
    >
      <ArrowRight className="h-4 w-4 rtl:rotate-180" />
      {t('nav.indicators')}
    </Link>
  )
}
