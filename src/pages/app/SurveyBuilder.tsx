import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Download,
  FileUp,
  GripVertical,
  Layers,
  Link2,
  MessageSquareText,
  Plus,
  Target,
  Trash2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchSurveyWithAxes } from '@/lib/queries'
import { downloadSurveyTemplate, parseSurveyWorkbook } from '@/lib/excel'
import { useLang } from '@/i18n'
import { isLikert, isRequired, type AxisWithQuestions, type Indicator, type QuestionKind, type SurveyWithAxes } from '@/lib/types'
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
    const pos = survey.axes.reduce((m, a) => Math.max(m, a.position), -1) + 1
    await supabase.from('survey_axes').insert({ survey_id: id, title_ar: newAxis, position: pos })
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
  const NEEDS_PATCH =
    'تعذّر الحفظ: أسئلة الرأي المفتوحة تتطلب تشغيل supabase/patch_survey_features.sql مرة واحدة في Supabase.'
  async function addQuestion(axisId: string, text: string, pos: number, kind: QuestionKind = 'likert') {
    if (!text.trim()) return
    // لا نُرسل kind للأسئلة العادية فتبقى متوافقة مع قاعدة لم تُرقَّع بعد
    // السؤال المفتوح اختياري افتراضيًا؛ نعيد المحاولة بلا required إن لم يُشغَّل patch_question_required.sql بعد
    const base: Record<string, unknown> = { axis_id: axisId, text_ar: text, position: pos, ...(kind === 'text' ? { kind } : {}) }
    let { error } = await supabase.from('survey_questions').insert(kind === 'text' ? { ...base, required: false } : base)
    if (error && kind === 'text' && /required|column|schema cache/i.test(error.message))
      ({ error } = await supabase.from('survey_questions').insert(base))
    if (error) alert(/column|schema cache/i.test(error.message) ? NEEDS_PATCH : error.message)
    reload()
  }
  async function updateQuestion(qId: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from('survey_questions').update(patch).eq('id', qId)
    if (error)
      alert(
        'required' in patch && /column|schema cache/i.test(error.message)
          ? 'تعذّر الحفظ: خاصية إلزامي/اختياري تتطلب تشغيل supabase/patch_question_required.sql مرة واحدة في Supabase.'
          : /column|schema cache/i.test(error.message)
            ? NEEDS_PATCH
            : error.message,
      )
    if ('kind' in patch || 'required' in patch) reload()
  }

  // ---- ترتيب المحاور والفقرات (يُحفظ في عمود position؛ يُعاد ترقيم القائمة 0..n-1) ----
  async function saveOrder(table: 'survey_axes' | 'survey_questions', ordered: { id: string; position: number }[]) {
    const changed = ordered.map((x, i) => ({ id: x.id, from: x.position, to: i })).filter((x) => x.from !== x.to)
    const res = await Promise.all(changed.map((c) => supabase.from(table).update({ position: c.to }).eq('id', c.id)))
    const err = res.find((r) => r.error)?.error
    if (err) alert(`تعذّر حفظ الترتيب: ${err.message}`)
    reload()
  }
  function reorder<T extends { id: string; position: number }>(list: T[], fromId: string, toId: string): T[] | null {
    const a = list.findIndex((x) => x.id === fromId)
    const b = list.findIndex((x) => x.id === toId)
    if (a < 0 || b < 0 || a === b) return null
    const next = [...list]
    const [m] = next.splice(a, 1)
    next.splice(b, 0, m)
    return next
  }
  function reorderAxes(fromId: string, toId: string) {
    if (!survey) return
    const next = reorder(survey.axes, fromId, toId)
    if (!next) return
    setSurvey({ ...survey, axes: next.map((x, i) => ({ ...x, position: i })) }) // تحديث فوري
    saveOrder('survey_axes', next.map((x) => ({ id: x.id, position: x.position })))
  }
  function reorderQuestions(axisId: string, fromId: string, toId: string) {
    if (!survey) return
    const axis = survey.axes.find((a) => a.id === axisId)
    if (!axis) return
    const next = reorder(axis.questions, fromId, toId)
    if (!next) return
    setSurvey({
      ...survey,
      axes: survey.axes.map((a) => (a.id === axisId ? { ...a, questions: next.map((x, i) => ({ ...x, position: i })) } : a)),
    })
    saveOrder('survey_questions', next.map((x) => ({ id: x.id, position: x.position })))
  }
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
            ...(q.kind === 'text' ? { kind: 'text' } : {}),
            ...(q.required === false ? { required: false } : {}),
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

  const totalQ = survey.axes.reduce((n, a) => n + a.questions.filter(isLikert).length, 0)
  const openQ = survey.axes.reduce((n, a) => n + a.questions.filter((q) => !isLikert(q)).length, 0)

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
        subtitle={`${survey.axes.length} ${t('common.axis')} · ${totalQ} ${t('common.question')}${openQ ? ` · ${openQ} ${lang === 'ar' ? 'سؤال مفتوح' : 'open'}` : ''}`}
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
            count={survey.axes.length}
            onMoveAxis={(d) => survey.axes[i + d] && reorderAxes(axis.id, survey.axes[i + d].id)}
            onDropAxis={(fromId) => reorderAxes(fromId, axis.id)}
            onMoveQuestion={(qi, d) => axis.questions[qi + d] && reorderQuestions(axis.id, axis.questions[qi].id, axis.questions[qi + d].id)}
            onDropQuestion={(fromId, toId) => reorderQuestions(axis.id, fromId, toId)}
            onAddQuestion={(text, kind) =>
              addQuestion(axis.id, text, axis.questions.reduce((m, q) => Math.max(m, q.position), -1) + 1, kind)
            }
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
  count,
  onUpdate,
  onDelete,
  onAddQuestion,
  onUpdateQuestion,
  onDeleteQuestion,
  onLinkAxis,
  onLinkQuestion,
  onMoveAxis,
  onDropAxis,
  onMoveQuestion,
  onDropQuestion,
}: {
  axis: AxisWithQuestions
  index: number
  count: number
  onUpdate: (id: string, patch: Record<string, unknown>) => void
  onDelete: () => void
  onAddQuestion: (text: string, kind: QuestionKind) => void
  onUpdateQuestion: (id: string, patch: Record<string, unknown>) => void
  onDeleteQuestion: (id: string) => void
  onLinkAxis: () => void
  onLinkQuestion: (qId: string, label: string) => void
  onMoveAxis: (dir: -1 | 1) => void
  onDropAxis: (fromAxisId: string) => void
  onMoveQuestion: (qIndex: number, dir: -1 | 1) => void
  onDropQuestion: (fromQId: string, toQId: string) => void
}) {
  const { t, lang } = useLang()
  const [title, setTitle] = useState(axis.title_ar)
  const [newQ, setNewQ] = useState('')
  const [newKind, setNewKind] = useState<QuestionKind>('likert')
  const [over, setOver] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={cardRef}
      data-axis-id={axis.id}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/x-axis')) {
          e.preventDefault()
          setOver(true)
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        const from = e.dataTransfer.getData('application/x-axis')
        setOver(false)
        if (from) {
          e.preventDefault()
          onDropAxis(from)
        }
      }}
    >
      <Card className={'overflow-hidden transition-shadow ' + (over ? 'ring-2 ring-gold-500' : '')}>
        <div className="flex items-center gap-2 border-b border-[var(--border)] bg-brand-50/50 px-4 py-3">
          <span
            draggable
            title={lang === 'ar' ? 'اسحب لترتيب المحور' : 'Drag to reorder'}
            data-handle="axis"
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-axis', axis.id)
              e.dataTransfer.effectAllowed = 'move'
              if (cardRef.current) e.dataTransfer.setDragImage(cardRef.current, 24, 24)
            }}
            className="shrink-0 cursor-grab text-slate-300 hover:text-brand-600 active:cursor-grabbing"
          >
            <GripVertical className="h-5 w-5" />
          </span>
          <span className="tnum grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-800 text-xs font-bold text-white">
            {index + 1}
          </span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== axis.title_ar && onUpdate(axis.id, { title_ar: title })}
            className="h-9 border-transparent bg-transparent font-semibold focus:border-brand-300 focus:bg-white"
          />
          <OrderBtns
            first={index === 0}
            last={index === count - 1}
            onUp={() => onMoveAxis(-1)}
            onDown={() => onMoveAxis(1)}
            label={lang === 'ar' ? 'المحور' : 'axis'}
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
          <Button size="sm" variant="ghost" className="shrink-0 text-red-500 hover:bg-red-50" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {axis.questions.map((q, qi) => (
            <QuestionRow
              key={q.id}
              id={q.id}
              axisId={axis.id}
              index={qi}
              count={axis.questions.length}
              text={q.text_ar}
              kind={isLikert(q) ? 'likert' : 'text'}
              required={isRequired(q)}
              onToggleKind={() => onUpdateQuestion(q.id, { kind: isLikert(q) ? 'text' : 'likert' })}
              onToggleRequired={() => onUpdateQuestion(q.id, { required: !isRequired(q) })}
              onSave={(text) => onUpdateQuestion(q.id, { text_ar: text })}
              onDelete={() => onDeleteQuestion(q.id)}
              onLink={() => onLinkQuestion(q.id, q.text_ar)}
              onMove={(d) => onMoveQuestion(qi, d)}
              onDropFrom={(fromId) => onDropQuestion(fromId, q.id)}
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
                onAddQuestion(newQ, newKind)
                setNewQ('')
              }
            }}
            placeholder={
              newKind === 'text'
                ? lang === 'ar' ? 'أضف سؤالًا مفتوحًا… (Enter)' : 'Add an open question… (Enter)'
                : lang === 'ar' ? 'أضف فقرة… (Enter)' : 'Add item… (Enter)'
            }
            className="h-9 border-transparent bg-white"
          />
          <div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-white text-xs">
            <button
              type="button"
              onClick={() => setNewKind('likert')}
              className={'px-2.5 py-1.5 ' + (newKind === 'likert' ? 'bg-brand-800 text-white' : 'text-[var(--text-muted)]')}
            >
              {lang === 'ar' ? 'مقياس' : 'Scale'}
            </button>
            <button
              type="button"
              onClick={() => setNewKind('text')}
              className={'flex items-center gap-1 px-2.5 py-1.5 ' + (newKind === 'text' ? 'bg-gold-500 font-semibold text-brand-950' : 'text-[var(--text-muted)]')}
            >
              <MessageSquareText className="h-3.5 w-3.5" />
              {lang === 'ar' ? 'مفتوح' : 'Open'}
            </button>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="shrink-0"
            onClick={() => {
              if (newQ.trim()) {
                onAddQuestion(newQ, newKind)
                setNewQ('')
              }
            }}
          >
            {t('common.save')}
          </Button>
        </div>
      </Card>
    </div>
  )
}

/** أسهم الترتيب (أعلى/أسفل). */
function OrderBtns({
  first,
  last,
  onUp,
  onDown,
  label,
}: {
  first: boolean
  last: boolean
  onUp: () => void
  onDown: () => void
  label: string
}) {
  const cls =
    'grid h-7 w-7 place-items-center rounded-md text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:pointer-events-none disabled:opacity-25'
  return (
    <span className="flex shrink-0 items-center">
      <button type="button" data-order="up" title={`تحريك ${label} للأعلى`} disabled={first} onClick={onUp} className={cls}>
        <ArrowUp className="h-4 w-4" />
      </button>
      <button type="button" data-order="down" title={`تحريك ${label} للأسفل`} disabled={last} onClick={onDown} className={cls}>
        <ArrowDown className="h-4 w-4" />
      </button>
    </span>
  )
}

function QuestionRow({
  id,
  axisId,
  index,
  count,
  text,
  kind,
  required,
  onToggleKind,
  onToggleRequired,
  onSave,
  onDelete,
  onLink,
  onMove,
  onDropFrom,
}: {
  id: string
  axisId: string
  index: number
  count: number
  text: string
  kind: QuestionKind
  required: boolean
  onToggleKind: () => void
  onToggleRequired: () => void
  onSave: (text: string) => void
  onDelete: () => void
  onLink: () => void
  onMove: (dir: -1 | 1) => void
  onDropFrom: (fromQId: string) => void
}) {
  const [val, setVal] = useState(text)
  const [over, setOver] = useState(false)
  useEffect(() => setVal(text), [text])
  const payload = `${axisId}|${id}`
  return (
    <div
      data-question-id={id}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/x-question')) {
          e.preventDefault()
          setOver(true)
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData('application/x-question')
        setOver(false)
        if (!raw) return
        const [fromAxis, fromQ] = raw.split('|')
        if (fromAxis !== axisId) return // الترتيب داخل المحور نفسه
        e.preventDefault()
        e.stopPropagation()
        onDropFrom(fromQ)
      }}
      className={'group flex items-center gap-2 px-4 py-2 transition-colors ' + (over ? 'bg-gold-400/15' : '')}
    >
      <span
        draggable
        data-handle="question"
        title="اسحب لترتيب الفقرة"
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-question', payload)
          e.dataTransfer.effectAllowed = 'move'
        }}
        className="shrink-0 cursor-grab text-slate-300 hover:text-brand-600 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <span className="tnum w-6 shrink-0 text-center text-xs text-slate-400">{index + 1}</span>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => val !== text && onSave(val)}
        className="flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-[var(--text)] hover:bg-slate-50 focus:border-brand-300 focus:bg-white focus:outline-none"
      />
      <button
        type="button"
        data-required-toggle
        onClick={onToggleRequired}
        title={required ? 'إلزامي — اضغط لجعله اختياريًا' : 'اختياري — اضغط لجعله إلزاميًا'}
        className={
          'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ' +
          (required
            ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            : 'bg-gold-400/25 text-gold-600 hover:bg-gold-400/40')
        }
      >
        {required ? 'إلزامي' : 'اختياري'}
      </button>
      <button
        onClick={onToggleKind}
        title={kind === 'text' ? 'سؤال مفتوح (اضغط للتحويل إلى مقياس)' : 'تحويل إلى سؤال مفتوح'}
        className={
          'shrink-0 rounded-md px-1.5 py-1 text-[11px] transition ' +
          (kind === 'text'
            ? 'flex items-center gap-1 bg-gold-400/20 font-semibold text-gold-600'
            : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-gold-600')
        }
      >
        <MessageSquareText className="h-3.5 w-3.5" />
        {kind === 'text' && 'مفتوح'}
      </button>
      {kind === 'likert' && (
        <button
          onClick={onLink}
          title="ربط بمؤشر"
          className="shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-brand-600"
        >
          <Link2 className="h-4 w-4" />
        </button>
      )}
      <OrderBtns first={index === 0} last={index === count - 1} onUp={() => onMove(-1)} onDown={() => onMove(1)} label="الفقرة" />
      <button
        onClick={onDelete}
        className="shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
