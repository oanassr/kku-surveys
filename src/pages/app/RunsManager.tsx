import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  CalendarClock,
  Check,
  Copy,
  FileBarChart,
  Link2,
  Lock,
  Plus,
  Send,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/i18n'
import type { Program, RunStatus, RunTerm, SurveyRun, SurveyTemplate } from '@/lib/types'
import { Badge, Button, Card, Field, Input, PageLoader, Select } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { PageHeader } from './AppLayout'

interface RunView extends SurveyRun {
  survey: Pick<SurveyTemplate, 'title_ar' | 'title_en'>
  program: Pick<Program, 'name_ar' | 'name_en'>
  responseCount?: number
}

const TERMS: RunTerm[] = ['annual', 's1', 's2', 'summer']

export default function RunsManager() {
  const { t, lang } = useLang()
  const [runs, setRuns] = useState<RunView[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [surveys, setSurveys] = useState<SurveyTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [qrRun, setQrRun] = useState<RunView | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
  const [form, setForm] = useState({
    survey_id: '',
    program_id: '',
    year: new Date().getFullYear(),
    term: 'annual' as RunTerm,
    opens_at: today,
    closes_at: in30,
  })

  async function load() {
    const { data: runData } = await supabase
      .from('survey_runs')
      .select('*, survey:survey_templates(title_ar,title_en), program:programs(name_ar,name_en)')
      .order('created_at', { ascending: false })
    const list = (runData as unknown as RunView[]) ?? []

    // response counts
    const withCounts = await Promise.all(
      list.map(async (r) => {
        const { count } = await supabase
          .from('responses')
          .select('id', { count: 'exact', head: true })
          .eq('run_id', r.id)
        return { ...r, responseCount: count ?? 0 }
      }),
    )
    setRuns(withCounts)

    const [{ data: progs }, { data: srv }] = await Promise.all([
      supabase.from('programs').select('*').order('name_ar'),
      supabase.from('survey_templates').select('*').eq('is_active', true).order('title_ar'),
    ])
    setPrograms((progs as Program[]) ?? [])
    setSurveys((srv as SurveyTemplate[]) ?? [])
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  async function create() {
    if (!form.survey_id || !form.program_id) return
    await supabase.from('survey_runs').insert({
      survey_id: form.survey_id,
      program_id: form.program_id,
      year: form.year,
      term: form.term,
      opens_at: new Date(form.opens_at).toISOString(),
      closes_at: new Date(form.closes_at + 'T23:59:59').toISOString(),
      status: 'open',
    })
    setModal(false)
    load()
  }

  async function setStatus(id: string, status: RunStatus) {
    await supabase.from('survey_runs').update({ status }).eq('id', id)
    setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  const nm = (o: { name_ar: string; name_en: string | null }) =>
    lang === 'en' && o.name_en ? o.name_en : o.name_ar
  const linkFor = (r: RunView) =>
    `${window.location.origin}${import.meta.env.BASE_URL}r/${r.access_token}`

  function copy(r: RunView) {
    navigator.clipboard.writeText(linkFor(r))
    setCopied(r.id)
    setTimeout(() => setCopied(null), 1500)
  }

  const statusBadge = useMemo(
    () => ({
      open: <Badge className="bg-green-100 text-green-700">مفتوح</Badge>,
      draft: <Badge className="bg-slate-100 text-slate-600">مسودة</Badge>,
      closed: <Badge className="bg-amber-100 text-amber-700">مغلق</Badge>,
    }),
    [],
  )

  if (loading) return <PageLoader />

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={t('nav.runs')}
        subtitle="نشر الاستطلاعات ومتابعة الاستجابات"
        icon={<Send className="h-5 w-5" />}
        action={
          <Button onClick={() => setModal(true)}>
            <Plus className="h-4 w-4" />
            {lang === 'ar' ? 'نشر استطلاع' : 'Publish survey'}
          </Button>
        }
      />

      <div className="space-y-3">
        {runs.map((r) => (
          <Card key={r.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-brand-900">
                    {lang === 'en' && r.survey.title_en ? r.survey.title_en : r.survey.title_ar}
                  </span>
                  {statusBadge[r.status]}
                </div>
                <div className="mt-1 text-sm text-brand-700">{nm(r.program)}</div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                  <span className="tnum flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {new Date(r.opens_at).toLocaleDateString('en-GB')} →{' '}
                    {new Date(r.closes_at).toLocaleDateString('en-GB')}
                  </span>
                  <span className="tnum flex items-center gap-1 font-medium text-brand-700">
                    <FileBarChart className="h-3.5 w-3.5" />
                    {r.responseCount} {t('common.responses')}
                  </span>
                  <span className="tnum">
                    {t('common.year')} {r.year}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="outline" onClick={() => copy(r)}>
                  {copied === r.id ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {lang === 'ar' ? 'الرابط' : 'Link'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setQrRun(r)}>
                  <Link2 className="h-4 w-4" />
                  QR
                </Button>
                {r.status === 'open' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-amber-600 hover:bg-amber-50"
                    onClick={() => setStatus(r.id, 'closed')}
                  >
                    <Lock className="h-4 w-4" />
                    {lang === 'ar' ? 'إغلاق' : 'Close'}
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, 'open')}>
                    <Send className="h-4 w-4" />
                    {lang === 'ar' ? 'فتح' : 'Open'}
                  </Button>
                )}
                <Link to={`/app/runs/${r.id}/report`}>
                  <Button size="sm" variant="primary">
                    <FileBarChart className="h-4 w-4" />
                    {t('nav.reports')}
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        ))}
        {!runs.length && (
          <Card className="p-10 text-center text-[var(--text-muted)]">
            {lang === 'ar' ? 'لا توجد عمليات نشر بعد.' : 'No published surveys yet.'}
          </Card>
        )}
      </div>

      {/* Create modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={lang === 'ar' ? 'نشر استطلاع' : 'Publish survey'} size="lg">
        <div className="space-y-4">
          <Field label={t('nav.surveys')} required>
            <Select
              value={form.survey_id}
              onChange={(e) => setForm({ ...form, survey_id: e.target.value })}
            >
              <option value="">—</option>
              {surveys.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title_ar}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('common.program')} required>
            <Select
              value={form.program_id}
              onChange={(e) => setForm({ ...form, program_id: e.target.value })}
            >
              <option value="">—</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name_ar} — {t(`degree.${p.degree}`)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('common.year')}>
              <Input
                type="number"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: +e.target.value })}
              />
            </Field>
            <Field label={t('common.term')}>
              <Select
                value={form.term}
                onChange={(e) => setForm({ ...form, term: e.target.value as RunTerm })}
              >
                {TERMS.map((tm) => (
                  <option key={tm} value={tm}>
                    {tm === 'annual' ? (lang === 'ar' ? 'سنوي' : 'Annual') : tm.toUpperCase()}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('common.from')}>
              <Input
                type="date"
                value={form.opens_at}
                onChange={(e) => setForm({ ...form, opens_at: e.target.value })}
              />
            </Field>
            <Field label={t('common.to')}>
              <Input
                type="date"
                value={form.closes_at}
                onChange={(e) => setForm({ ...form, closes_at: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={create}>{lang === 'ar' ? 'نشر' : 'Publish'}</Button>
          </div>
        </div>
      </Modal>

      {/* QR modal */}
      <Modal open={qrRun !== null} onClose={() => setQrRun(null)} title="رمز الاستطلاع (QR)">
        {qrRun && (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <QRCodeSVG value={linkFor(qrRun)} size={220} level="M" />
            </div>
            <code dir="ltr" className="tnum break-all rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {linkFor(qrRun)}
            </code>
            <Button variant="outline" size="sm" onClick={() => copy(qrRun)}>
              <Copy className="h-4 w-4" />
              {lang === 'ar' ? 'نسخ الرابط' : 'Copy link'}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
