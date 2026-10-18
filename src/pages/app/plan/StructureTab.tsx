import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Download, FileUp, Plus, Search, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { addRow, deleteRow, linkKpi, patchRow, swapPositions, unlinkKpi } from '@/lib/planOps'
import { nextKpiCode, type ActivityNode, type GoalNode, type InitiativeNode } from '@/lib/plans'
import {
  downloadPlanSheet,
  downloadPlanTemplate,
  importPlanRows,
  parsePlanWorkbook,
} from '@/lib/planExcel'
import type { Indicator, KpiDirection, MeasureType } from '@/lib/types'
import { Badge, Button, Field, Input, Select } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { InlineText, Section, type TabProps } from './shared'

interface Props extends TabProps {
  programKpis: Indicator[]
  refreshKpis: () => Promise<void>
}

function AddLine({ placeholder, onAdd }: { placeholder: string; onAdd: (t: string) => void }) {
  const [v, setV] = useState('')
  const go = () => {
    if (!v.trim()) return
    onAdd(v.trim())
    setV('')
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && go()}
        placeholder={placeholder}
        className="h-9 flex-1 text-sm"
      />
      <Button size="sm" variant="secondary" onClick={go}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}

export default function StructureTab({ full, reload, run, programKpis, refreshKpis }: Props) {
  const { session } = useAuth()
  const uid = session?.user.id
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [pickFor, setPickFor] = useState<ActivityNode | null>(null)

  const planId = full.plan.id
  const goals = full.goals

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setNote(null)
    try {
      const rows = await parsePlanWorkbook(file)
      if (!rows.length) throw new Error('empty')
      const s = await importPlanRows(full, programKpis, rows, uid)
      await Promise.all([reload(), refreshKpis()])
      setNote(
        `تم الاستيراد: ${s.goals} أهداف جديدة، ${s.initiatives} مبادرات، ${s.activities} أنشطة، ${s.kpisCreated} مؤشرات جديدة، ${s.links} ربطًا، و${s.values} قيمة.`,
      )
    } catch {
      setNote('تعذّر قراءة الملف. استخدم «قالب إكسل» أو الصق جدول الخطة بالأعمدة نفسها.')
    }
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const move = (
    table: 'op_goals' | 'op_initiatives' | 'op_activities',
    list: { id: string; position: number }[],
    i: number,
    d: -1 | 1,
  ) => {
    const a = list[i]
    const b = list[i + d]
    if (!a || !b) return
    run(() => swapPositions(table, a, b))
  }

  return (
    <div className="space-y-4">
      <Section
        title="هيكل الخطة"
        hint="هدف ← مبادرات ← أنشطة (جهة منفذة وميزانية) ← مؤشرات أداء تقيس تقدّم كل نشاط. عدّل أي نص مباشرة."
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={downloadPlanTemplate}>
              <Download className="h-4 w-4" />
              قالب إكسل
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
              <FileUp className="h-4 w-4" />
              {importing ? 'جارٍ الاستيراد…' : 'استيراد من إكسل'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => downloadPlanSheet(full)} disabled={!goals.length}>
              <Download className="h-4 w-4" />
              تصدير الجدول
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onImport} />
          </div>
        }
      >
        {note && <p className="mb-3 rounded-xl bg-brand-50 px-4 py-2.5 text-sm text-brand-800">{note}</p>}
        <AddLine
          placeholder="أضف هدفًا جديدًا للبرنامج ثم Enter"
          onAdd={(t) =>
            run(async () => (await addRow('op_goals', { plan_id: planId, position: goals.length, text_ar: t })).error)
          }
        />
      </Section>

      {goals.map((g, gi) => (
        <GoalCard
          key={g.id}
          g={g}
          gi={gi}
          full={full}
          run={run}
          move={move}
          goals={goals}
          onPick={setPickFor}
        />
      ))}

      {pickFor && (
        <KpiPicker
          key={pickFor.id}
          activity={full.goals.flatMap((x) => x.initiatives).flatMap((x) => x.activities).find((a) => a.id === pickFor.id) ?? pickFor}
          full={full}
          programKpis={programKpis}
          refreshKpis={refreshKpis}
          reload={reload}
          onClose={() => setPickFor(null)}
        />
      )}
    </div>
  )
}

function GoalCard({
  g,
  gi,
  full,
  run,
  move,
  goals,
  onPick,
}: {
  g: GoalNode
  gi: number
  full: Props['full']
  run: Props['run']
  move: (t: 'op_goals' | 'op_initiatives' | 'op_activities', l: { id: string; position: number }[], i: number, d: -1 | 1) => void
  goals: GoalNode[]
  onPick: (a: ActivityNode) => void
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-[var(--border)] bg-brand-50/60 px-4 py-3">
        <span className="tnum mt-1 grid h-7 min-w-7 place-items-center rounded-lg bg-brand-800 px-1 text-sm font-bold text-white">
          {gi + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="px-2 text-[11px] font-semibold text-gold-600">هدف البرنامج</div>
          <InlineText
            multiline
            value={g.text_ar}
            onSave={(v) => run(() => patchRow('op_goals', g.id, { text_ar: v }))}
            className="font-semibold text-brand-900"
          />
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconBtn title="أعلى" disabled={gi === 0} onClick={() => move('op_goals', goals, gi, -1)}>
            <ArrowUp className="h-4 w-4" />
          </IconBtn>
          <IconBtn title="أسفل" disabled={gi === goals.length - 1} onClick={() => move('op_goals', goals, gi, 1)}>
            <ArrowDown className="h-4 w-4" />
          </IconBtn>
          <IconBtn
            title="حذف الهدف"
            danger
            onClick={() => confirm('حذف الهدف بكل مبادراته وأنشطته؟') && run(() => deleteRow('op_goals', g.id))}
          >
            <Trash2 className="h-4 w-4" />
          </IconBtn>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {g.initiatives.map((ini, ii) => (
          <InitiativeBlock
            key={ini.id}
            ini={ini}
            ii={ii}
            list={g.initiatives}
            full={full}
            run={run}
            move={move}
            onPick={onPick}
          />
        ))}
        <AddLine
          placeholder="أضف مبادرة لهذا الهدف ثم Enter"
          onAdd={(t) =>
            run(async () => (await addRow('op_initiatives', { goal_id: g.id, position: g.initiatives.length, text_ar: t })).error)
          }
        />
      </div>
    </section>
  )
}

function InitiativeBlock({
  ini,
  ii,
  list,
  full,
  run,
  move,
  onPick,
}: {
  ini: InitiativeNode
  ii: number
  list: InitiativeNode[]
  full: Props['full']
  run: Props['run']
  move: Parameters<typeof GoalCard>[0]['move']
  onPick: (a: ActivityNode) => void
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-slate-50/50">
      <div className="flex items-start gap-2 px-3 py-2">
        <Badge className="mt-1.5 bg-gold-400/20 text-gold-600">مبادرة {ii + 1}</Badge>
        <InlineText
          multiline
          value={ini.text_ar}
          onSave={(v) => run(() => patchRow('op_initiatives', ini.id, { text_ar: v }))}
          className="font-medium text-brand-800"
        />
        <div className="flex shrink-0 items-center">
          <IconBtn title="أعلى" disabled={ii === 0} onClick={() => move('op_initiatives', list, ii, -1)}>
            <ArrowUp className="h-4 w-4" />
          </IconBtn>
          <IconBtn title="أسفل" disabled={ii === list.length - 1} onClick={() => move('op_initiatives', list, ii, 1)}>
            <ArrowDown className="h-4 w-4" />
          </IconBtn>
          <IconBtn
            title="حذف المبادرة"
            danger
            onClick={() => confirm('حذف المبادرة بكل أنشطتها؟') && run(() => deleteRow('op_initiatives', ini.id))}
          >
            <Trash2 className="h-4 w-4" />
          </IconBtn>
        </div>
      </div>

      <div className="space-y-2 border-t border-[var(--border)] p-3">
        {ini.activities.map((a, ai) => (
          <div key={a.id} className="rounded-lg border border-[var(--border)] bg-white p-3">
            <div className="flex items-start gap-2">
              <span className="tnum mt-1.5 text-xs font-bold text-[var(--text-muted)]">{ai + 1}</span>
              <div className="min-w-0 flex-1 space-y-1">
                <InlineText
                  multiline
                  value={a.text_ar}
                  placeholder="النشاط أو الإجراء التنفيذي"
                  onSave={(v) => run(() => patchRow('op_activities', a.id, { text_ar: v }))}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <InlineText
                    value={a.executor}
                    placeholder="الجهة المنفذة"
                    onSave={(v) => run(() => patchRow('op_activities', a.id, { executor: v || null }))}
                    className="text-xs"
                  />
                  <InlineText
                    value={a.budget}
                    placeholder="الميزانية التقديرية"
                    onSave={(v) => run(() => patchRow('op_activities', a.id, { budget: v || null }))}
                    className="text-xs"
                  />
                </div>
              </div>
              <div className="flex shrink-0 items-center">
                <IconBtn title="أعلى" disabled={ai === 0} onClick={() => move('op_activities', ini.activities, ai, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </IconBtn>
                <IconBtn
                  title="أسفل"
                  disabled={ai === ini.activities.length - 1}
                  onClick={() => move('op_activities', ini.activities, ai, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </IconBtn>
                <IconBtn
                  title="حذف النشاط"
                  danger
                  onClick={() => confirm('حذف النشاط؟') && run(() => deleteRow('op_activities', a.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </IconBtn>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 ps-5">
              <span className="text-xs text-[var(--text-muted)]">مؤشرات القياس:</span>
              {a.kpiIds.map((kid) => {
                const k = full.kpis.get(kid)
                if (!k) return null
                const survey = (k.measure_type ?? 'survey') === 'survey'
                return (
                  <span
                    key={kid}
                    title={`${k.name_ar} — ${survey ? 'من استطلاع' : 'إدخال يدوي'}`}
                    className={
                      'inline-flex max-w-[18rem] items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ' +
                      (survey
                        ? 'border-brand-200 bg-brand-50 text-brand-800'
                        : 'border-gold-400/50 bg-gold-400/10 text-gold-600')
                    }
                  >
                    <span className="tnum shrink-0 font-semibold">{k.code ?? '—'}</span>
                    <span className="truncate">{k.name_ar}</span>
                    <button
                      className="shrink-0 opacity-60 hover:opacity-100"
                      onClick={() => run(() => unlinkKpi(a.id, kid))}
                      aria-label="إزالة"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })}
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onPick(a)}>
                <Plus className="h-3.5 w-3.5" />
                مؤشر
              </Button>
            </div>
          </div>
        ))}
        <AddLine
          placeholder="أضف نشاطًا لهذه المبادرة ثم Enter"
          onAdd={(t) =>
            run(
              async () =>
                (await addRow('op_activities', { initiative_id: ini.id, position: ini.activities.length, text_ar: t })).error,
            )
          }
        />
      </div>
    </div>
  )
}

function IconBtn({
  children,
  onClick,
  title,
  disabled,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={
        'grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors disabled:opacity-30 ' +
        (danger ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-brand-50 hover:text-brand-700')
      }
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// اختيار/إنشاء مؤشرات الأداء لنشاط
// ---------------------------------------------------------------------------
function KpiPicker({
  activity,
  full,
  programKpis,
  refreshKpis,
  reload,
  onClose,
}: {
  activity: ActivityNode
  full: Props['full']
  programKpis: Indicator[]
  refreshKpis: () => Promise<void>
  reload: () => Promise<void>
  onClose: () => void
}) {
  const { session } = useAuth()
  const uid = session?.user.id
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [linked, setLinked] = useState<Set<string>>(new Set(activity.kpiIds))
  const [form, setForm] = useState({
    code: nextKpiCode(full.program.degree, programKpis),
    name: '',
    measure: 'survey' as MeasureType,
    calc: '',
    direction: 'up' as KpiDirection,
  })

  const list = programKpis.filter((k) => !q.trim() || `${k.code ?? ''} ${k.name_ar}`.includes(q.trim()))

  async function toggle(id: string) {
    setErr(null)
    const next = new Set(linked)
    const e = next.has(id)
      ? await unlinkKpi(activity.id, id)
      : await linkKpi(activity.id, id, next.size)
    if (e) return setErr(e)
    next.has(id) ? next.delete(id) : next.add(id)
    setLinked(next)
    await reload()
  }

  async function create() {
    if (!form.name.trim()) return setErr('اكتب اسم المؤشر.')
    setErr(null)
    const { data, error } = await supabase
      .from('indicators')
      .insert({
        kind: 'kpi',
        code: form.code.trim() || null,
        name_ar: form.name.trim(),
        program_id: full.program.id,
        created_by: uid,
        degree_level: full.program.degree,
        measure_type: form.measure,
        calc_method: form.calc.trim() || null,
        direction: form.direction,
      })
      .select('id')
      .single()
    if (error || !data) return setErr(error?.message ?? 'تعذّر إنشاء المؤشر')
    const id = (data as { id: string }).id
    const e = await linkKpi(activity.id, id, linked.size)
    if (e) return setErr(e)
    setLinked(new Set([...linked, id]))
    setCreating(false)
    setForm({ ...form, name: '', calc: '', code: '' })
    await refreshKpis()
    await reload()
  }

  return (
    <Modal open onClose={onClose} title="مؤشرات قياس النشاط" size="lg">
      <p className="mb-3 line-clamp-2 text-sm text-[var(--text-muted)]">{activity.text_ar}</p>
      {err && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      {!creating ? (
        <>
          <div className="mb-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالرمز أو الاسم" className="ps-9" />
            </div>
            <Button
              variant="gold"
              onClick={() => {
                setForm((f) => ({ ...f, code: nextKpiCode(full.program.degree, programKpis) }))
                setCreating(true)
              }}
            >
              <Plus className="h-4 w-4" />
              مؤشر جديد
            </Button>
          </div>
          <div className="max-h-[48vh] space-y-1.5 overflow-y-auto pe-1">
            {list.map((k) => (
              <label
                key={k.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5 hover:bg-brand-50/50"
              >
                <input
                  type="checkbox"
                  checked={linked.has(k.id)}
                  onChange={() => toggle(k.id)}
                  className="mt-1 h-4 w-4 accent-[var(--color-brand-700)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-brand-900">
                    <span className="tnum font-semibold text-brand-600">{k.code ?? '—'}</span> · {k.name_ar}
                  </div>
                  <div className="mt-0.5 flex gap-1.5">
                    <Badge className={(k.measure_type ?? 'survey') === 'survey' ? 'bg-brand-50 text-brand-700' : 'bg-gold-400/15 text-gold-600'}>
                      {(k.measure_type ?? 'survey') === 'survey' ? 'من استطلاع' : 'إدخال يدوي'}
                    </Badge>
                  </div>
                </div>
              </label>
            ))}
            {!list.length && (
              <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                لا توجد مؤشرات لهذا البرنامج بعد — أنشئ مؤشرًا جديدًا.
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <Field label="رمز المؤشر">
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} dir="ltr" className="tnum" />
            </Field>
            <Field label="اسم المؤشر" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="مصدر القياس">
              <Select value={form.measure} onChange={(e) => setForm({ ...form, measure: e.target.value as MeasureType })}>
                <option value="survey">من استطلاع رأي (مرتبط بفقرات)</option>
                <option value="manual">إدخال يدوي</option>
              </Select>
            </Field>
            <Field label="اتجاه التحسّن">
              <Select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as KpiDirection })}>
                <option value="up">الأعلى أفضل</option>
                <option value="down">الأقل أفضل</option>
                <option value="none">لا يُقارَن بالمستهدف (نسبة نصية)</option>
              </Select>
            </Field>
          </div>
          <Field label="كيفية حساب المؤشر">
            <textarea
              value={form.calc}
              onChange={(e) => setForm({ ...form, calc: e.target.value })}
              rows={3}
              className="w-full rounded-xl border border-[var(--border)] bg-white p-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder="مثال: متوسط تقدير الطلاب على مقياس من خمس مستويات في مسح سنوي"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>
              رجوع
            </Button>
            <Button onClick={create}>إنشاء وربط بالنشاط</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
