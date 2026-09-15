import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowRight,
  Download,
  FileUp,
  GripVertical,
  Layers,
  Link2,
  Plus,
  Target,
  Trash2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchSurveyWithAxes } from '@/lib/queries'
import { downloadSurveyTemplate, parseSurveyWorkbook } from '@/lib/excel'
import { useLang } from '@/i18n'
import type { AxisWithQuestions, Indicator, SurveyWithAxes } from '@/lib/types'
import { Badge, Button, Card, Input, PageLoader } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { PageHeader } from './AppLayout'
import { KIND_LABEL } from './IndicatorsManager'

type LinkTarget =
  | { kind: 'axis'; id: string; label: string }
  | { kind: 'question'; id: string; label: string }
  | null

export default function SurveyBuilder() {
  const { id = '' } = useParams()
  const { t, lang } = useLang()
  const [survey, setSurvey] = useState<SurveyWithAxes | null>(null)
  const [loading, setLoading] = useState(true)
  const [newAxis, setNewAxis] = useState('')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // indicator linking
  const [indicators, setIndicators] = useState<Indicator[]>([])
  const [linkTarget, setLinkTarget] = useState<LinkTarget>(null)
  const [linked, setLinked] = useState<Set<string>>(new Set())

  async function reload() {
    const s = await fetchSurveyWithAxes(id)
    setSurvey(s)
    setLoading(false)
  }
  useEffect(() => {
    reload()
    supabase
      .from('indicators')
      .select('*')
      .order('created_at')
      .then(({ data }) => setIndicators((data as Indicator[]) ?? []))
  }, [id])

  async function addAxis() {
    if (!newAxis.trim() || !survey) return
    await supabase.from('survey_axes').insert({ survey_id: id, title_ar: newAxis, position: survey.axes.length })
    setNewAxis('')
    reload()
  }
  const updateAxis = (axisId: string, patch: Record<string, unknown>) =>
    supabase.from('survey_axes').update(patch).eq('id', axisId)
  async function delAxis(axisId: string) {
    if (!confirm(lang === 'ar' ? 'حذف المحور وكل فقراته؟' : 'Delete axis and its items?')) return
    await supabase.from('survey_axes').delete().eq('id', axisId)
    reload()
  }
  async function addQuestion(axisId: string, text: string, pos: number) {
    if (!text.trim()) return
    await supabase.from('survey_questions').insert({ axis_id: axisId, text_ar: text, position: pos })
    reload()
  }
  const updateQuestion = (qId: string, patch: Record<string, unknown>) =>
    supabase.from('survey_questions').update(patch).eq('id', qId)
  async function delQuestion(qId: string) {
    await supabase.from('survey_questions').delete().eq('id', qId)
    reload()
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !survey) return
    setImporting(true)
    try {
      const parsed = await parseSurveyWorkbook(file)
      let pos = survey.axes.length
      for (const ax of parsed) {
        const { data: axisRow } = await supabase
          .from('survey_axes')
          .insert({ survey_id: id, title_ar: ax.title_ar, title_en: ax.title_en, position: pos++ })
          .select('id')
          .single()
        if (axisRow) {
          const qRows = ax.questions.map((q, i) => ({
            axis_id: axisRow.id,
            text_ar: q.text_ar,
            text_en: q.text_en,
            position: i,
          }))
          if (qRows.length) await supabase.from('survey_questions').insert(qRows)
        }
      }
      await reload()
      alert(
        lang === 'ar'
          ? `تم استيراد ${parsed.length} محاور بنجاح.`
          : `Imported ${parsed.length} axes.`,
      )
    } catch {
      alert(lang === 'ar' ? 'تعذّر قراءة الملف. تأكد من مطابقته للقالب.' : 'Could not read file.')
    }
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function openLink(target: NonNullable<LinkTarget>) {
    const table = target.kind === 'axis' ? 'axis_indicators' : 'question_indicators'
    const col = target.kind === 'axis' ? 'axis_id' : 'question_id'
    const { data } = await supabase.from(table).select('indicator_id').eq(col, target.id)
    setLinked(new Set((data ?? []).map((r: { indicator_id: string }) => r.indicator_id)))
    setLinkTarget(target)
  }
  async function toggleLink(indicatorId: string) {
    if (!linkTarget) return
    const table = linkTarget.kind === 'axis' ? 'axis_indicators' : 'question_indicators'
    const col = linkTarget.kind === 'axis' ? 'axis_id' : 'question_id'
    const next = new Set(linked)
    if (next.has(indicatorId)) {
      next.delete(indicatorId)
      await supabase.from(table).delete().eq(col, linkTarget.id).eq('indicator_id', indicatorId)
    } else {
      next.add(indicatorId)
      await supabase.from(table).insert({ [col]: linkTarget.id, indicator_id: indicatorId })
    }
    setLinked(next)
  }

  if (loading) return <PageLoader />
  if (!survey) return <div className="p-10 text-center text-[var(--text-muted)]">—</div>

  const totalQ = survey.axes.reduce((n, a) => n + a.questions.length, 0)

  return (
    <div className="animate-fade-up">
      <Link
        to="/app/surveys"
        className="mb-4 inline-flex items-center gap-1 text-sm text-brand-700 hover:text-brand-900"
      >
        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        {t('nav.surveys')}
      </Link>
      <PageHeader
        title={lang === 'en' && survey.title_en ? survey.title_en : survey.title_ar}
        subtitle={`${survey.axes.length} ${t('common.axis')} · ${totalQ} ${t('common.question')}`}
        icon={<Layers className="h-5 w-5" />}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={downloadSurveyTemplate}>
              <Download className="h-4 w-4" />
              {lang === 'ar' ? 'تنزيل القالب' : 'Template'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              <FileUp className="h-4 w-4" />
              {importing ? t('common.loading') : lang === 'ar' ? 'استيراد إكسل' : 'Import Excel'}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={onImport}
            />
          </div>
        }
      />

      <div className="space-y-4">
        {survey.axes.map((axis, i) => (
          <AxisEditor
            key={axis.id}
            axis={axis}
            index={i}
            onUpdate={updateAxis}
            onDelete={() => delAxis(axis.id)}
            onAddQuestion={(text) => addQuestion(axis.id, text, axis.questions.length)}
            onUpdateQuestion={updateQuestion}
            onDeleteQuestion={delQuestion}
            onLinkAxis={() => openLink({ kind: 'axis', id: axis.id, label: axis.title_ar })}
            onLinkQuestion={(qId, label) => openLink({ kind: 'question', id: qId, label })}
          />
        ))}
      </div>

      <Card className="mt-4 flex items-center gap-2 p-3">
        <Input
          value={newAxis}
          onChange={(e) => setNewAxis(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addAxis()}
          placeholder={lang === 'ar' ? 'اسم محور جديد…' : 'New axis title…'}
        />
        <Button onClick={addAxis} className="shrink-0">
          <Plus className="h-4 w-4" />
          {t('common.axis')}
        </Button>
      </Card>

      {/* Indicator linking modal */}
      <Modal
        open={linkTarget !== null}
        onClose={() => setLinkTarget(null)}
        title={lang === 'ar' ? 'ربط بالمؤشرات' : 'Link indicators'}
      >
        <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
          {linkTarget?.label}
        </p>
        {indicators.length ? (
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {indicators.map((ind) => (
              <label
                key={ind.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2 hover:bg-brand-50/40"
              >
                <input
                  type="checkbox"
                  checked={linked.has(ind.id)}
                  onChange={() => toggleLink(ind.id)}
                  className="h-4 w-4 accent-brand-700"
                />
                <span className="flex-1 text-sm text-brand-900">
                  {lang === 'en' && ind.name_en ? ind.name_en : ind.name_ar}
                </span>
                <Badge color={KIND_LABEL[ind.kind].color}>
                  {lang === 'ar' ? KIND_LABEL[ind.kind].ar : KIND_LABEL[ind.kind].en}
                </Badge>
              </label>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-[var(--text-muted)]">
            {lang === 'ar' ? 'أضف مؤشرات أولًا من صفحة المؤشرات.' : 'Add indicators first.'}
          </p>
        )}
      </Modal>
    </div>
  )
}

function AxisEditor({
  axis,
  index,
  onUpdate,
  onDelete,
  onAddQuestion,
  onUpdateQuestion,
  onDeleteQuestion,
  onLinkAxis,
  onLinkQuestion,
}: {
  axis: AxisWithQuestions
  index: number
  onUpdate: (id: string, patch: Record<string, unknown>) => void
  onDelete: () => void
  onAddQuestion: (text: string) => void
  onUpdateQuestion: (id: string, patch: Record<string, unknown>) => void
  onDeleteQuestion: (id: string) => void
  onLinkAxis: () => void
  onLinkQuestion: (qId: string, label: string) => void
}) {
  const { t, lang } = useLang()
  const [title, setTitle] = useState(axis.title_ar)
  const [newQ, setNewQ] = useState('')

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-brand-50/50 px-4 py-3">
        <span className="tnum grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-800 text-xs font-bold text-white">
          {index + 1}
        </span>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== axis.title_ar && onUpdate(axis.id, { title_ar: title })}
          className="h-9 border-transparent bg-transparent font-semibold focus:border-brand-300 focus:bg-white"
        />
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 text-brand-500 hover:bg-brand-50"
          title={lang === 'ar' ? 'ربط المحور بمؤشر' : 'Link axis'}
          onClick={onLinkAxis}
        >
          <Target className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 text-red-500 hover:bg-red-50"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {axis.questions.map((q, qi) => (
          <QuestionRow
            key={q.id}
            index={qi}
            text={q.text_ar}
            onSave={(text) => onUpdateQuestion(q.id, { text_ar: text })}
            onDelete={() => onDeleteQuestion(q.id)}
            onLink={() => onLinkQuestion(q.id, q.text_ar)}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--border)] bg-slate-50/50 p-3">
        <Plus className="h-4 w-4 shrink-0 text-brand-400" />
        <Input
          value={newQ}
          onChange={(e) => setNewQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newQ.trim()) {
              onAddQuestion(newQ)
              setNewQ('')
            }
          }}
          placeholder={lang === 'ar' ? 'أضف فقرة… (Enter)' : 'Add item… (Enter)'}
          className="h-9 border-transparent bg-white"
        />
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0"
          onClick={() => {
            if (newQ.trim()) {
              onAddQuestion(newQ)
              setNewQ('')
            }
          }}
        >
          {t('common.save')}
        </Button>
      </div>
    </Card>
  )
}

function QuestionRow({
  index,
  text,
  onSave,
  onDelete,
  onLink,
}: {
  index: number
  text: string
  onSave: (text: string) => void
  onDelete: () => void
  onLink: () => void
}) {
  const [val, setVal] = useState(text)
  return (
    <div className="group flex items-center gap-2 px-4 py-2">
      <GripVertical className="h-4 w-4 shrink-0 text-slate-300" />
      <span className="tnum w-6 shrink-0 text-center text-xs text-slate-400">{index + 1}</span>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => val !== text && onSave(val)}
        className="flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-[var(--text)] hover:bg-slate-50 focus:border-brand-300 focus:bg-white focus:outline-none"
      />
      <button
        onClick={onLink}
        title="ربط بمؤشر"
        className="shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-brand-600"
      >
        <Link2 className="h-4 w-4" />
      </button>
      <button
        onClick={onDelete}
        className="shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
