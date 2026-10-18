import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowRight, Download, FileBarChart, FileSpreadsheet, MessageSquareText, Plus, Save, Sparkles, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { buildReport, type ReportData } from '@/lib/report'
import { exportReportDocx } from '@/lib/wordExport'
import { exportResponsesXlsx, runEnded } from '@/lib/responsesExport'
import { fmtMean } from '@/lib/ratings'
import {
  emptyPlanRow,
  generatePlan,
  parsePlanRows,
  serializePlanRows,
  type PlanRow,
} from '@/lib/improvementPlan'
import { useLang } from '@/i18n'
import type { ImprovementPlan } from '@/lib/types'
import { Badge, Button, Card, PageLoader } from '@/components/ui'
import { PageHeader } from './AppLayout'

export default function ReportPage() {
  const { runId = '' } = useParams()
  const { t, lang } = useLang()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<Partial<ImprovementPlan>>({})
  const [rows, setRows] = useState<PlanRow[]>([])
  const [legacyText, setLegacyText] = useState('')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportingX, setExportingX] = useState(false)

  useEffect(() => {
    async function load() {
      const [rep, { data: pl }] = await Promise.all([
        buildReport(runId),
        supabase.from('improvement_plans').select('*').eq('run_id', runId).maybeSingle(),
      ])
      setData(rep)
      if (pl) {
        setPlan(pl as ImprovementPlan)
        const parsed = parsePlanRows((pl as ImprovementPlan).actions)
        if (parsed) setRows(parsed)
        else setLegacyText((pl as ImprovementPlan).actions ?? '')
      }
      setLoading(false)
    }
    load()
  }, [runId])

  function autoGenerate() {
    if (!data) return
    if (rows.length && !window.confirm(lang === 'ar' ? 'سيُعاد توليد الخطة من النتائج واستبدال الصفوف الحالية. متابعة؟' : 'Regenerate and replace current rows?')) return
    setRows(generatePlan(data))
    setLegacyText('')
  }

  function updateRow(i: number, patch: Partial<PlanRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function addRow() {
    setRows((rs) => [...rs, emptyPlanRow()])
  }
  function removeRow(i: number) {
    setRows((rs) => rs.filter((_, idx) => idx !== i))
  }

  async function savePlan() {
    setSaving(true)
    const actions = rows.length ? serializePlanRows(rows) : legacyText || null
    await supabase.from('improvement_plans').upsert({
      run_id: runId,
      strengths: plan.strengths ?? null,
      weaknesses: plan.weaknesses ?? null,
      actions,
    })
    setSaving(false)
  }

  async function doExport() {
    if (!data) return
    setExporting(true)
    const actions = rows.length ? serializePlanRows(rows) : legacyText || null
    await exportReportDocx(data, { ...plan, actions }, lang)
    setExporting(false)
  }

  async function doExportXlsx() {
    setExportingX(true)
    await exportResponsesXlsx(runId)
    setExportingX(false)
  }

  if (loading) return <PageLoader label={t('common.loading')} />
  if (!data) return <div className="p-10 text-center text-[var(--text-muted)]">—</div>

  const chartData = data.axes.map((a, i) => ({
    name: `${i + 1}`,
    full: a.title_ar,
    value: a.meanAll ?? 0,
    color: a.band?.color ?? '#cbd5e1',
  }))

  return (
    <div className="animate-fade-up">
      <Link
        to="/app/runs"
        className="mb-4 inline-flex items-center gap-1 text-sm text-brand-700 hover:text-brand-900"
      >
        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        {t('nav.runs')}
      </Link>
      <PageHeader
        title={lang === 'en' && data.survey.title_en ? data.survey.title_en : data.survey.title_ar}
        subtitle={`${data.program.name_ar} · ${t('common.year')} ${data.run.year}`}
        icon={<FileBarChart className="h-5 w-5" />}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={doExportXlsx}
              disabled={exportingX || !runEnded(data.run) || !data.counts.total}
              title={
                !runEnded(data.run)
                  ? 'يتاح تصدير الاستجابات بعد انتهاء فترة النشر (أو إغلاقه)'
                  : !data.counts.total
                    ? 'لا توجد استجابات للتصدير'
                    : 'تصدير الاستجابات إلى Excel'
              }
            >
              <FileSpreadsheet className="h-4 w-4" />
              {exportingX ? t('common.loading') : lang === 'ar' ? 'تصدير الاستجابات (Excel)' : 'Export responses'}
            </Button>
            <Button variant="gold" onClick={doExport} disabled={exporting}>
              <Download className="h-4 w-4" />
              {exporting ? t('common.loading') : lang === 'ar' ? 'تصدير Word' : 'Export Word'}
            </Button>
          </div>
        }
      />

      {/* Overview */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center p-6 text-center">
          <div className="text-sm text-[var(--text-muted)]">{lang === 'ar' ? 'المتوسط العام' : 'Overall mean'}</div>
          <div className="tnum my-1 text-5xl font-bold" style={{ color: data.axes[0]?.band?.color ?? BRANDHEX }}>
            {fmtMean(data.overallMean)}
          </div>
          <Badge color={bandColor(data.overallPercent)}>{overallLabel(data)}</Badge>
          <div className="tnum mt-3 text-sm text-[var(--text-muted)]">
            {data.overallPercent ?? '—'}%
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="mb-2 text-sm font-semibold text-brand-900">
            {lang === 'ar' ? 'متوسط المحاور' : 'Axis averages'}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v) => fmtMean(Number(v))}
                labelFormatter={(l) => chartData.find((c) => c.name === l)?.full ?? ''}
                contentStyle={{ fontSize: 12, borderRadius: 12, direction: 'rtl' }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((c, i) => (
                  <Cell key={i} fill={c.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Response counts */}
      <div className="mt-4 flex flex-wrap gap-3">
        <CountPill label={t('common.responses')} value={data.counts.total} />
        <CountPill label={t('common.male')} value={data.counts.male} />
        <CountPill label={t('common.female')} value={data.counts.female} />
      </div>

      {/* Axes detail */}
      <div className="mt-6 space-y-4">
        {data.axes.map((ax, i) => (
          <Card key={ax.id} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-brand-50/50 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="tnum grid h-6 w-6 place-items-center rounded-lg bg-brand-800 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="font-semibold text-brand-900">{ax.title_ar}</span>
              </div>
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
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 font-semibold text-green-700">
            <ThumbsUp className="h-4 w-4" />
            {lang === 'ar' ? 'أبرز نقاط القوة' : 'Top strengths'}
          </div>
          <ul className="space-y-2">
            {data.strengths.map((q) => (
              <li key={q.id} className="flex justify-between gap-2 text-sm">
                <span className="text-[var(--text)]">{q.text_ar}</span>
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
            {data.weaknesses.map((q) => (
              <li key={q.id} className="flex justify-between gap-2 text-sm">
                <span className="text-[var(--text)]">{q.text_ar}</span>
                <span className="tnum shrink-0 font-semibold text-red-500">{fmtMean(q.meanAll)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Open answers */}
      {data.openAnswers.map((oq) => (
        <Card key={oq.id} className="mt-6 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-gold-400/10 px-5 py-3">
            <div className="flex items-center gap-2 font-semibold text-brand-900">
              <MessageSquareText className="h-4 w-4 text-gold-600" />
              {oq.text_ar}
            </div>
            <Badge className="bg-white text-[var(--text-muted)]">
              {oq.items.length} {lang === 'ar' ? 'إجابة' : 'answers'}
            </Badge>
          </div>
          {oq.items.length ? (
            <ul className="max-h-96 divide-y divide-[var(--border)] overflow-y-auto">
              {oq.items.map((it, i) => (
                <li key={i} className="flex items-start gap-3 px-5 py-3 text-sm leading-relaxed">
                  <span className="tnum mt-0.5 shrink-0 text-xs text-slate-400">{i + 1}</span>
                  <span className="flex-1 whitespace-pre-wrap text-[var(--text)]">{it.text}</span>
                  {it.campus && (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
                      {t(`common.${it.campus}`)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">لا توجد إجابات على هذا السؤال بعد.</p>
          )}
        </Card>
      ))}

      {/* Improvement plan */}
      <Card className="mt-6 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-brand-900">
            {lang === 'ar' ? 'الخطة التحسينية للفصل القادم' : 'Improvement plan'}
          </h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={autoGenerate}>
              <Sparkles className="h-4 w-4" />
              {lang === 'ar' ? 'توليد تلقائي من النتائج' : 'Auto-generate'}
            </Button>
            <Button size="sm" onClick={savePlan} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </div>

        <p className="mb-3 text-xs text-[var(--text-muted)]">
          {lang === 'ar'
            ? 'تُبنى الخطة آليًا من المحاور والفقرات الأدنى تقييمًا وفق مقياس التقدير، ويمكنك تعديل أي خلية أو إضافة/حذف صفوف.'
            : 'Generated deterministically from the lowest-rated axes and items; every cell is editable.'}
        </p>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
            {lang === 'ar'
              ? 'لا توجد خطة بعد — اضغط «توليد تلقائي من النتائج» لبنائها، أو «إضافة صف» لكتابتها يدويًا.'
              : 'No plan yet — click Auto-generate or add a row.'}
            <div className="mt-3">
              <Button size="sm" variant="ghost" onClick={addRow}>
                <Plus className="h-4 w-4" />
                {lang === 'ar' ? 'إضافة صف' : 'Add row'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)]">
                  <th className="p-2 text-start font-medium">{lang === 'ar' ? 'مجال التحسين' : 'Area'}</th>
                  <th className="p-2 text-start font-medium">{lang === 'ar' ? 'الإجراء التحسيني المقترح' : 'Action'}</th>
                  <th className="p-2 text-start font-medium">{lang === 'ar' ? 'المسؤول' : 'Owner'}</th>
                  <th className="p-2 text-start font-medium">{lang === 'ar' ? 'الإطار الزمني' : 'Timeframe'}</th>
                  <th className="p-2 text-start font-medium">{lang === 'ar' ? 'مؤشر قياس النجاح' : 'Success indicator'}</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--border)] align-top">
                    <PlanCell value={r.area} onChange={(v) => updateRow(i, { area: v })} />
                    <PlanCell value={r.action} onChange={(v) => updateRow(i, { action: v })} wide />
                    <PlanCell value={r.responsible} onChange={(v) => updateRow(i, { responsible: v })} />
                    <PlanCell value={r.timeframe} onChange={(v) => updateRow(i, { timeframe: v })} />
                    <PlanCell value={r.indicator} onChange={(v) => updateRow(i, { indicator: v })} />
                    <td className="p-1">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="grid h-7 w-7 place-items-center rounded-lg text-red-500 hover:bg-red-50"
                        title={lang === 'ar' ? 'حذف الصف' : 'Delete row'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3">
              <Button size="sm" variant="ghost" onClick={addRow}>
                <Plus className="h-4 w-4" />
                {lang === 'ar' ? 'إضافة صف' : 'Add row'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

function PlanCell({
  value,
  onChange,
  wide,
}: {
  value: string
  onChange: (v: string) => void
  wide?: boolean
}) {
  return (
    <td className={`p-1 ${wide ? 'min-w-[16rem]' : 'min-w-[9rem]'}`}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={wide ? 3 : 2}
        className="w-full resize-y rounded-lg border border-[var(--border)] bg-white p-2 text-xs leading-relaxed focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
      />
    </td>
  )
}

const BRANDHEX = '#0d4259'

function bandColor(pct: number | null) {
  if (pct == null) return '#94a3b8'
  if (pct >= 90) return 'var(--color-rate-5)'
  if (pct >= 70) return 'var(--color-rate-4)'
  if (pct >= 50) return 'var(--color-rate-3)'
  if (pct >= 30) return 'var(--color-rate-2)'
  return 'var(--color-rate-1)'
}

function overallLabel(data: ReportData) {
  return data.axes[0]?.band?.labelAr && data.overallMean != null
    ? bandLabel(data.overallMean)
    : '—'
}

function bandLabel(mean: number) {
  if (mean >= 4.5) return 'مستوفٍ بتميز'
  if (mean >= 3.5) return 'مستوفٍ بإتقان'
  if (mean >= 2.5) return 'مستوفٍ'
  if (mean >= 1.5) return 'مستوفٍ جزئيًا'
  return 'غير مستوفٍ'
}

function CountPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2">
      <span className="tnum text-lg font-bold text-brand-800">{value}</span>
      <span className="text-sm text-[var(--text-muted)]">{label}</span>
    </div>
  )
}
