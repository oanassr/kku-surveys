import { useEffect, useState } from 'react'
import { Building2, ChevronLeft, GraduationCap, Lock, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/i18n'
import type { College, Department, DegreeLevel, Program } from '@/lib/types'
import { Button, Card, Field, Input, PageLoader, Select } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { PageHeader } from './AppLayout'
import { cn } from '@/lib/cn'

const DEGREES: DegreeLevel[] = ['bachelor', 'master', 'phd']

export default function OrgManager() {
  const { t, lang } = useLang()
  const { isAdmin } = useAuth()
  const [err, setErr] = useState<string | null>(null)
  const nm = (o: { name_ar: string; name_en: string | null }) =>
    lang === 'en' && o.name_en ? o.name_en : o.name_ar

  const [colleges, setColleges] = useState<College[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [selCollege, setSelCollege] = useState<College | null>(null)
  const [selDept, setSelDept] = useState<Department | null>(null)
  const [loading, setLoading] = useState(true)

  const [modal, setModal] = useState<null | 'college' | 'dept' | 'program'>(null)
  const [form, setForm] = useState({ name_ar: '', name_en: '', degree: 'bachelor' as DegreeLevel })

  async function loadColleges() {
    const { data } = await supabase.from('colleges').select('*').order('name_ar')
    setColleges((data as College[]) ?? [])
    setLoading(false)
  }
  useEffect(() => {
    loadColleges()
  }, [])

  useEffect(() => {
    setSelDept(null)
    setPrograms([])
    if (!selCollege) return setDepartments([])
    supabase
      .from('departments')
      .select('*')
      .eq('college_id', selCollege.id)
      .order('name_ar')
      .then(({ data }) => setDepartments((data as Department[]) ?? []))
  }, [selCollege])

  useEffect(() => {
    if (!selDept) return setPrograms([])
    supabase
      .from('programs')
      .select('*')
      .eq('department_id', selDept.id)
      .order('name_ar')
      .then(({ data }) => setPrograms((data as Program[]) ?? []))
  }, [selDept])

  function openModal(kind: 'college' | 'dept' | 'program') {
    setErr(null)
    setForm({ name_ar: '', name_en: '', degree: 'bachelor' })
    setModal(kind)
  }

  function rlsHint(msg: string) {
    return /row-level security|permission|42501/i.test(msg)
      ? lang === 'ar'
        ? 'لا تملك صلاحية الإضافة. تأكد أن حسابك «مدير نظام».'
        : 'Not permitted. Ensure your account is admin.'
      : `${lang === 'ar' ? 'تعذّر الحفظ: ' : 'Failed: '}${msg}`
  }

  async function save() {
    setErr(null)
    if (!form.name_ar.trim()) return
    if (modal === 'college') {
      const { data, error } = await supabase
        .from('colleges')
        .insert({ name_ar: form.name_ar, name_en: form.name_en || null })
        .select()
        .single()
      if (error) return setErr(rlsHint(error.message))
      if (data) setColleges((c) => [...c, data as College])
    } else if (modal === 'dept' && selCollege) {
      const { data, error } = await supabase
        .from('departments')
        .insert({ college_id: selCollege.id, name_ar: form.name_ar, name_en: form.name_en || null })
        .select()
        .single()
      if (error) return setErr(rlsHint(error.message))
      if (data) setDepartments((d) => [...d, data as Department])
    } else if (modal === 'program' && selDept) {
      const { data, error } = await supabase
        .from('programs')
        .insert({
          department_id: selDept.id,
          name_ar: form.name_ar,
          name_en: form.name_en || null,
          degree: form.degree,
        })
        .select()
        .single()
      if (error) return setErr(rlsHint(error.message))
      if (data) setPrograms((p) => [...p, data as Program])
    }
    setModal(null)
  }

  async function del(table: string, id: string, refresh: () => void) {
    if (!confirm(lang === 'ar' ? 'تأكيد الحذف؟' : 'Confirm delete?')) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) {
      alert(rlsHint(error.message))
      return
    }
    refresh()
  }

  if (loading) return <PageLoader />

  if (!isAdmin)
    return (
      <Card className="mx-auto max-w-md p-8 text-center">
        <Lock className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <h2 className="font-semibold text-brand-900">
          {lang === 'ar' ? 'هذه الصفحة لمدير النظام فقط' : 'Admins only'}
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {lang === 'ar'
            ? 'حسابك ليس «مدير نظام». نفّذ: update profiles set role=\'admin\' where email=\'بريدك\';'
            : 'Your account is not an admin.'}
        </p>
      </Card>
    )

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={t('nav.org')}
        subtitle="إدارة الكليات والأقسام والبرامج"
        icon={<Building2 className="h-5 w-5" />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Colleges */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-brand-900">{t('common.college')}</h3>
            <Button size="sm" variant="secondary" onClick={() => openModal('college')}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1.5">
            {colleges.map((c) => (
              <Row
                key={c.id}
                active={selCollege?.id === c.id}
                label={nm(c)}
                onClick={() => setSelCollege(c)}
                onDelete={() => del('colleges', c.id, loadColleges)}
              />
            ))}
            {!colleges.length && <Empty />}
          </div>
        </Card>

        {/* Departments */}
        <Card className={cn('p-4', !selCollege && 'opacity-50')}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-brand-900">{t('common.department')}</h3>
            <Button
              size="sm"
              variant="secondary"
              disabled={!selCollege}
              onClick={() => openModal('dept')}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1.5">
            {departments.map((d) => (
              <Row
                key={d.id}
                active={selDept?.id === d.id}
                label={nm(d)}
                onClick={() => setSelDept(d)}
                onDelete={() =>
                  del('departments', d.id, () =>
                    setDepartments((x) => x.filter((y) => y.id !== d.id)),
                  )
                }
              />
            ))}
            {selCollege && !departments.length && <Empty />}
          </div>
        </Card>

        {/* Programs */}
        <Card className={cn('p-4', !selDept && 'opacity-50')}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-brand-900">{t('common.program')}</h3>
            <Button
              size="sm"
              variant="secondary"
              disabled={!selDept}
              onClick={() => openModal('program')}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1.5">
            {programs.map((p) => (
              <div
                key={p.id}
                className="group flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-brand-900">{nm(p)}</div>
                  <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <GraduationCap className="h-3 w-3" />
                    {t(`degree.${p.degree}`)}
                  </div>
                </div>
                <button
                  onClick={() =>
                    del('programs', p.id, () => setPrograms((x) => x.filter((y) => y.id !== p.id)))
                  }
                  className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {selDept && !programs.length && <Empty />}
          </div>
        </Card>
      </div>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={
          modal === 'college'
            ? t('common.college')
            : modal === 'dept'
              ? t('common.department')
              : t('common.program')
        }
      >
        <div className="space-y-4">
          <Field label={lang === 'ar' ? 'الاسم (عربي)' : 'Name (Arabic)'} required>
            <Input
              value={form.name_ar}
              onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
              autoFocus
            />
          </Field>
          <Field label={lang === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)'}>
            <Input
              dir="ltr"
              value={form.name_en}
              onChange={(e) => setForm({ ...form, name_en: e.target.value })}
            />
          </Field>
          {modal === 'program' && (
            <Field label={t('common.degree')} required>
              <Select
                value={form.degree}
                onChange={(e) => setForm({ ...form, degree: e.target.value as DegreeLevel })}
              >
                {DEGREES.map((d) => (
                  <option key={d} value={d}>
                    {t(`degree.${d}`)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModal(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={save}>{t('common.save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Row({
  active,
  label,
  onClick,
  onDelete,
}: {
  active: boolean
  label: string
  onClick: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        'group flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 transition',
        active
          ? 'border-brand-300 bg-brand-50'
          : 'border-[var(--border)] hover:border-brand-200 hover:bg-brand-50/40',
      )}
      onClick={onClick}
    >
      <span className="truncate text-sm font-medium text-brand-900">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <ChevronLeft className="h-4 w-4 text-brand-400 ltr:rotate-180" />
      </div>
    </div>
  )
}

function Empty() {
  const { lang } = useLang()
  return (
    <div className="py-6 text-center text-xs text-[var(--text-muted)]">
      {lang === 'ar' ? 'لا توجد عناصر' : 'No items'}
    </div>
  )
}
