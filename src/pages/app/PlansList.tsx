import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ListChecks, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { deleteRow } from '@/lib/planOps'
import {
  STATUS_META,
  computeStats,
  createPlan,
  fetchPlanFull,
  isMissingTables,
  type OpPlan,
  type PlanFull,
} from '@/lib/plans'
import type { Program } from '@/lib/types'
import { Badge, Button, Card, Field, Input, PageLoader, Select } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { PageHeader } from './AppLayout'

export function PatchNotice() {
  return (
    <Card className="mx-auto max-w-2xl border-amber-200 bg-amber-50/60 p-6">
      <h3 className="mb-2 font-semibold text-amber-900">يلزم تفعيل جداول الخطط التشغيلية</h3>
      <p className="mb-3 text-sm leading-relaxed text-amber-900/80">
        لم تُنشأ جداول الخطط التشغيلية في قاعدة البيانات بعد. شغّل الملف التالي مرة واحدة من Supabase ← SQL Editor
        (إضافي بالكامل ولا يمس الاستطلاعات الحالية):
      </p>
      <code className="block rounded-lg bg-white px-3 py-2 text-xs text-amber-900" dir="ltr">
        supabase/patch_operational_plans.sql
      </code>
    </Card>
  )
}

interface Row {
  plan: OpPlan
  full: PlanFull | null
}

export default function PlansList() {
  const { isAdmin, session } = useAuth()
  const uid = session?.user.id
  const nav = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [modal, setModal] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('')
  const [form, setForm] = useState({ program_id: '', year: '', target: '', copyFrom: '' })

  async function load() {
    const { data, error } = await supabase.from('op_plans').select('*').order('created_at', { ascending: false })
    if (error && isMissingTables(error)) {
      setMissing(true)
      setLoading(false)
      return
    }
    const plans = (data as OpPlan[]) ?? []
    const [{ data: progs }, pc, fulls] = await Promise.all([
      supabase.from('programs').select('*').order('name_ar'),
      uid ? supabase.from('program_coordinators').select('program_id').eq('user_id', uid) : Promise.resolve({ data: [] as { program_id: string }[] }),
      Promise.all(plans.map((p) => fetchPlanFull(p.id))),
    ])
    const mine = new Set((pc.data ?? []).map((r: { program_id: string }) => r.program_id))
    const all = (progs as Program[]) ?? []
    setPrograms(isAdmin ? all : all.filter((p) => mine.has(p.id)))
    setRows(plans.map((p, i) => ({ plan: p, full: fulls[i].data })))
    setLoading(false)
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, uid])

  const programName = (id: string) => programs.find((p) => p.id === id)?.name_ar ?? rowsProgram(id)
  const rowsProgram = (id: string) => rows.find((r) => r.plan.program_id === id)?.full?.program.name_ar ?? '—'

  const visible = rows.filter((r) => !filter || r.plan.program_id === filter)
  const previous = useMemo(
    () => rows.filter((r) => r.plan.program_id === form.program_id),
    [rows, form.program_id],
  )

  async function create() {
    if (!form.program_id || !form.year.trim()) return setErr('اختر البرنامج واكتب عام الخطة.')
    setSaving(true)
    setErr(null)
    const r = await createPlan({
      program_id: form.program_id,
      year_label: form.year,
      target_year_label: form.target,
      title: null,
      created_by: uid ?? null,
      copyFrom: form.copyFrom || null,
    })
    setSaving(false)
    if (r.error || !r.id) return setErr(r.error)
    setModal(false)
    nav(`/app/plans/${r.id}`)
  }

  async function del(id: string) {
    if (!confirm('حذف الخطة بكل أهدافها ومبادراتها وأنشطتها وقيمها؟ لا يمكن التراجع.')) return
    const e = await deleteRow('op_plans', id)
    if (e) return alert(e)
    setRows((x) => x.filter((r) => r.plan.id !== id))
  }

  if (loading) return <PageLoader />

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="الخطط التشغيلية"
        subtitle="أهداف البرنامج ومبادراته وأنشطته ومؤشرات أدائه، مغذّاة بنتائج الاستطلاعات"
        icon={<ListChecks className="h-5 w-5" />}
        action={
          !missing && (
            <Button
              onClick={() => {
                setErr(null)
                setForm({ program_id: programs[0]?.id ?? '', year: '', target: '', copyFrom: '' })
                setModal(true)
              }}
              disabled={!programs.length}
            >
              <Plus className="h-4 w-4" />
              خطة جديدة
            </Button>
          )
        }
      />

      {missing ? (
        <PatchNotice />
      ) : (
        <>
          {rows.length > 1 && (
            <div className="mb-4 max-w-xs">
              <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="">كل البرامج</option>
                {[...new Set(rows.map((r) => r.plan.program_id))].map((id) => (
                  <option key={id} value={id}>
                    {programName(id)}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map(({ plan, full }) => {
              const st = full ? computeStats(full) : null
              const measurable = st ? st.achieved + st.below : 0
              const pct = st && measurable ? Math.round((st.achieved / measurable) * 100) : null
              return (
                <Card key={plan.id} className="group relative overflow-hidden p-5 transition-shadow hover:shadow-lg">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-gold-400 via-brand-500 to-brand-800" />
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs text-[var(--text-muted)]">الخطة التشغيلية</div>
                      <h3 className="font-bold leading-snug text-brand-900">{programName(plan.program_id)}</h3>
                    </div>
                    <Badge className={plan.status === 'final' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}>
                      {plan.status === 'final' ? 'معتمدة' : 'مسودة'}
                    </Badge>
                  </div>
                  <div className="mb-4 text-sm text-brand-700">
                    العام <b className="tnum">{plan.year_label}</b>
                    {plan.target_year_label && (
                      <span className="text-[var(--text-muted)]"> · مستهدفات {plan.target_year_label}</span>
                    )}
                  </div>

                  {st && (
                    <>
                      <div className="mb-3 grid grid-cols-4 gap-2 text-center">
                        {[
                          ['الأهداف', st.goals],
                          ['المبادرات', st.initiatives],
                          ['الأنشطة', st.activities],
                          ['المؤشرات', st.kpis],
                        ].map(([l, n]) => (
                          <div key={l as string} className="rounded-lg bg-slate-50 py-1.5">
                            <div className="tnum text-lg font-bold text-brand-800">{n}</div>
                            <div className="text-[10px] text-[var(--text-muted)]">{l}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mb-1 flex justify-between text-xs text-[var(--text-muted)]">
                        <span>مؤشرات محققة لمستهدفها</span>
                        <span className="tnum font-semibold" style={{ color: STATUS_META.achieved.color }}>
                          {pct == null ? '—' : `${pct}%`}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct ?? 0}%`, backgroundColor: STATUS_META.achieved.color }}
                        />
                      </div>
                    </>
                  )}

                  <div className="mt-4 flex items-center gap-2">
                    <Link to={`/app/plans/${plan.id}`} className="flex-1">
                      <Button className="w-full" variant="primary">
                        فتح الخطة
                      </Button>
                    </Link>
                    <button
                      onClick={() => del(plan.id)}
                      className="grid h-11 w-11 place-items-center rounded-xl text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label="حذف"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>

          {!rows.length && (
            <Card className="mx-auto max-w-xl p-10 text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                <ListChecks className="h-7 w-7" />
              </div>
              <h3 className="mb-1 font-semibold text-brand-900">لا توجد خطط تشغيلية بعد</h3>
              <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                أنشئ خطة لبرنامجك ثم ابنِ أهدافها ومبادراتها وأنشطتها، واربط مؤشرات الأداء بنتائج الاستطلاعات أو أدخل قيمها
                يدويًا، وصدّر التقرير الكامل بصيغة Word.
              </p>
            </Card>
          )}
        </>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="خطة تشغيلية جديدة">
        <div className="space-y-4">
          {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <Field label="البرنامج" required>
            <Select value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value, copyFrom: '' })}>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name_ar}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="عام الخطة" required>
              <Input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="مثال: 1446 هـ" />
            </Field>
            <Field label="عام المستهدفات الجديدة">
              <Input value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="مثال: 1447 هـ" />
            </Field>
          </div>
          {previous.length > 0 && (
            <Field label="نسخ البناء من خطة سابقة">
              <Select value={form.copyFrom} onChange={(e) => setForm({ ...form, copyFrom: e.target.value })}>
                <option value="">بدء خطة فارغة</option>
                {previous.map((r) => (
                  <option key={r.plan.id} value={r.plan.id}>
                    خطة {r.plan.year_label}
                  </option>
                ))}
              </Select>
              {form.copyFrom && (
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">
                  تُنسخ الأهداف والمبادرات والأنشطة والمؤشرات، ويصبح «المستهدف الجديد» السابق هو «المستهدف» في الخطة الجديدة،
                  و«الأداء الفعلي» السابق هو «المرجعية الداخلية»، وتُفرَّغ الحقول الفعلية لتُدخل من جديد.
                </p>
              )}
            </Field>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setModal(false)}>
              إلغاء
            </Button>
            <Button onClick={create} disabled={saving}>
              {saving ? 'جارٍ الإنشاء…' : 'إنشاء الخطة'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
