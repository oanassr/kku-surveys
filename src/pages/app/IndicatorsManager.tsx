import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileBarChart, Link2, Plus, Target, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/i18n'
import type { College, Department, Indicator, IndicatorKind, Program } from '@/lib/types'
import { Badge, Button, Card, Field, Input, PageLoader, Select } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { PageHeader } from './AppLayout'
import { IndicatorLinker } from './IndicatorLinker'

const KINDS: IndicatorKind[] = ['kpi', 'objective', 'initiative']

export const KIND_LABEL: Record<IndicatorKind, { ar: string; en: string; color: string }> = {
  kpi: { ar: 'مؤشر أداء KPI', en: 'KPI', color: 'var(--color-brand-600)' },
  objective: { ar: 'هدف برنامج', en: 'Objective', color: 'var(--color-rate-4)' },
  initiative: { ar: 'مبادرة', en: 'Initiative', color: 'var(--color-gold-600)' },
}

export default function IndicatorsManager() {
  const { t, lang } = useLang()
  const [items, setItems] = useState<Indicator[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [linkFor, setLinkFor] = useState<Indicator | null>(null)
  const [colleges, setColleges] = useState<College[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const emptyForm = {
    kind: 'kpi' as IndicatorKind,
    code: '',
    name_ar: '',
    name_en: '',
    college: '',
    department: '',
    program_id: '',
  }
  const [form, setForm] = useState(emptyForm)

  async function load() {
    const [{ data }, { data: cols }, { data: deps }, { data: progs }] = await Promise.all([
      supabase.from('indicators').select('*').order('created_at'),
      supabase.from('colleges').select('*').order('name_ar'),
      supabase.from('departments').select('*').order('name_ar'),
      supabase.from('programs').select('*').order('name_ar'),
    ])
    setItems((data as Indicator[]) ?? [])
    setColleges((cols as College[]) ?? [])
    setDepartments((deps as Department[]) ?? [])
    setPrograms((progs as Program[]) ?? [])
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  const programName = (id: string | null) =>
    id ? (programs.find((p) => p.id === id)?.name_ar ?? '') : ''

  async function create() {
    if (!form.name_ar.trim()) return
    await supabase.from('indicators').insert({
      kind: form.kind,
      code: form.code || null,
      name_ar: form.name_ar,
      name_en: form.name_en || null,
      program_id: form.program_id || null,
    })
    setForm(emptyForm)
    setModal(false)
    load()
  }

  async function del(id: string) {
    if (!confirm(lang === 'ar' ? 'حذف المؤشر؟' : 'Delete indicator?')) return
    await supabase.from('indicators').delete().eq('id', id)
    setItems((x) => x.filter((y) => y.id !== id))
  }

  if (loading) return <PageLoader />

  const groups = KINDS.map((k) => ({ kind: k, list: items.filter((i) => i.kind === k) }))

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={t('nav.indicators')}
        subtitle="مؤشرات الأداء والأهداف والمبادرات المرتبطة بالمحاور والأسئلة"
        icon={<Target className="h-5 w-5" />}
        action={
          <Button
            onClick={() => {
              setForm(emptyForm)
              setModal(true)
            }}
          >
            <Plus className="h-4 w-4" />
            {lang === 'ar' ? 'مؤشر جديد' : 'New indicator'}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {groups.map((g) => (
          <Card key={g.kind} className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: KIND_LABEL[g.kind].color }}
              />
              <h3 className="font-semibold text-brand-900">
                {lang === 'ar' ? KIND_LABEL[g.kind].ar : KIND_LABEL[g.kind].en}
              </h3>
              <Badge className="ms-auto bg-slate-100 text-slate-600">{g.list.length}</Badge>
            </div>
            <div className="space-y-1.5">
              {g.list.map((i) => (
                <div
                  key={i.id}
                  className="group rounded-lg border border-[var(--border)] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      {i.code && <span className="tnum text-xs text-brand-500">{i.code} · </span>}
                      <span className="text-sm text-brand-900">
                        {lang === 'en' && i.name_en ? i.name_en : i.name_ar}
                      </span>
                      {i.program_id && (
                        <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                          {programName(i.program_id)}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => del(i.id)}
                      className="shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-8" onClick={() => setLinkFor(i)}>
                      <Link2 className="h-3.5 w-3.5" />
                      {lang === 'ar' ? 'ربط' : 'Link'}
                    </Button>
                    <Link to={`/app/indicators/${i.id}/report`}>
                      <Button size="sm" variant="secondary" className="h-8">
                        <FileBarChart className="h-3.5 w-3.5" />
                        {lang === 'ar' ? 'تقرير القياس' : 'Report'}
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
              {!g.list.length && (
                <p className="py-4 text-center text-xs text-[var(--text-muted)]">—</p>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={lang === 'ar' ? 'مؤشر جديد' : 'New indicator'}>
        <div className="space-y-4">
          <Field label={lang === 'ar' ? 'النوع' : 'Kind'} required>
            <Select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as IndicatorKind })}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {lang === 'ar' ? KIND_LABEL[k].ar : KIND_LABEL[k].en}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={lang === 'ar' ? 'الرمز (اختياري)' : 'Code (optional)'}>
            <Input
              dir="ltr"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="KPI-1"
            />
          </Field>
          <Field label={lang === 'ar' ? 'الاسم (عربي)' : 'Name (Arabic)'} required>
            <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
          </Field>
          <Field label={lang === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)'}>
            <Input dir="ltr" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
          </Field>

          {/* البرنامج المرتبط: كلية ← قسم ← برنامج */}
          <div className="rounded-xl border border-[var(--border)] bg-slate-50/50 p-3">
            <div className="mb-2 text-sm font-medium text-brand-900">
              {lang === 'ar' ? 'البرنامج المرتبط' : 'Linked program'}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t('common.college')}>
                <Select
                  value={form.college}
                  onChange={(e) =>
                    setForm({ ...form, college: e.target.value, department: '', program_id: '' })
                  }
                >
                  <option value="">—</option>
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name_ar}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('common.department')}>
                <Select
                  value={form.department}
                  onChange={(e) =>
                    setForm({ ...form, department: e.target.value, program_id: '' })
                  }
                  disabled={!form.college}
                >
                  <option value="">—</option>
                  {departments
                    .filter((d) => d.college_id === form.college)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name_ar}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label={t('common.program')}>
                <Select
                  value={form.program_id}
                  onChange={(e) => setForm({ ...form, program_id: e.target.value })}
                  disabled={!form.department}
                >
                  <option value="">—</option>
                  {programs
                    .filter((p) => p.department_id === form.department)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name_ar}
                      </option>
                    ))}
                </Select>
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={create}>{t('common.save')}</Button>
          </div>
        </div>
      </Modal>

      {linkFor && (
        <IndicatorLinker
          indicatorId={linkFor.id}
          title={linkFor.name_ar}
          onClose={() => setLinkFor(null)}
        />
      )}
    </div>
  )
}
