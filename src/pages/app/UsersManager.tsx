import { useEffect, useState } from 'react'
import { Link2, Plus, Power, UserPlus, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/i18n'
import type { AppRole, Profile, Program } from '@/lib/types'
import { Badge, Button, Card, Field, Input, PageLoader, Select } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { PageHeader } from './AppLayout'

export default function UsersManager() {
  const { t, lang } = useLang()
  const { profile: me } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)

  const [assignFor, setAssignFor] = useState<Profile | null>(null)
  const [assigned, setAssigned] = useState<Set<string>>(new Set())

  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)
  const [form, setForm] = useState({
    email: '',
    full_name: '',
    password: '',
    role: 'coordinator' as AppRole,
    program_ids: new Set<string>(),
  })

  async function load() {
    const [{ data: prof }, { data: progs }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('programs').select('*').order('name_ar'),
    ])
    setProfiles((prof as Profile[]) ?? [])
    setPrograms((progs as Program[]) ?? [])
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  async function setRole(id: string, role: AppRole) {
    await supabase.from('profiles').update({ role }).eq('id', id)
    setProfiles((p) => p.map((x) => (x.id === id ? { ...x, role } : x)))
  }

  async function toggleActive(p: Profile) {
    const next = !p.is_active
    await supabase.from('profiles').update({ is_active: next }).eq('id', p.id)
    setProfiles((list) => list.map((x) => (x.id === p.id ? { ...x, is_active: next } : x)))
  }

  async function openAssign(p: Profile) {
    const { data } = await supabase
      .from('program_coordinators')
      .select('program_id')
      .eq('user_id', p.id)
    setAssigned(new Set((data ?? []).map((r: { program_id: string }) => r.program_id)))
    setAssignFor(p)
  }

  async function toggleAssign(programId: string) {
    if (!assignFor) return
    const next = new Set(assigned)
    if (next.has(programId)) {
      next.delete(programId)
      await supabase
        .from('program_coordinators')
        .delete()
        .eq('user_id', assignFor.id)
        .eq('program_id', programId)
    } else {
      next.add(programId)
      await supabase
        .from('program_coordinators')
        .insert({ user_id: assignFor.id, program_id: programId })
    }
    setAssigned(next)
  }

  async function createUser() {
    setCreateErr(null)
    if (!form.email.trim() || form.password.length < 8) {
      setCreateErr(lang === 'ar' ? 'أدخل بريدًا وكلمة مرور (٨ أحرف فأكثر).' : 'Enter email and password (8+ chars).')
      return
    }
    setCreating(true)
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: {
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim() || form.email.trim(),
        role: form.role,
        program_ids: [...form.program_ids],
      },
    })
    setCreating(false)
    if (error || (data && (data as { error?: string }).error)) {
      const msg = (data as { error?: string })?.error || error?.message || ''
      setCreateErr(
        msg.includes('Failed to fetch') || msg.includes('404')
          ? lang === 'ar'
            ? 'الدالة غير منشورة بعد. انشر admin-create-user (انظر README).'
            : 'Function not deployed yet (see README).'
          : `${lang === 'ar' ? 'تعذّر الإنشاء: ' : 'Failed: '}${msg}`,
      )
      return
    }
    setCreateOpen(false)
    setForm({ email: '', full_name: '', password: '', role: 'coordinator', program_ids: new Set() })
    load()
  }

  const nm = (o: { name_ar: string; name_en: string | null }) =>
    lang === 'en' && o.name_en ? o.name_en : o.name_ar

  if (loading) return <PageLoader />

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={t('nav.users')}
        subtitle="إنشاء المنسّقين وإدارة الأدوار والحالة وربطهم بالبرامج"
        icon={<Users className="h-5 w-5" />}
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4" />
            {lang === 'ar' ? 'مستخدم جديد' : 'New user'}
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-slate-50/60 text-xs text-[var(--text-muted)]">
              <tr>
                <th className="p-3 text-start font-medium">{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                <th className="p-3 text-start font-medium">{lang === 'ar' ? 'البريد' : 'Email'}</th>
                <th className="p-3 text-center font-medium">{lang === 'ar' ? 'الدور' : 'Role'}</th>
                <th className="p-3 text-center font-medium">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="p-3 text-center font-medium">{lang === 'ar' ? 'البرامج' : 'Programs'}</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const isMe = p.id === me?.id
                return (
                  <tr key={p.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3 font-medium text-brand-900">
                      {p.full_name || '—'}
                      {isMe && (
                        <Badge className="ms-2 bg-brand-50 text-brand-700">
                          {lang === 'ar' ? 'أنت' : 'You'}
                        </Badge>
                      )}
                    </td>
                    <td dir="ltr" className="p-3 text-start text-[var(--text-muted)]">{p.email}</td>
                    <td className="p-3 text-center">
                      <Select
                        value={p.role}
                        onChange={(e) => setRole(p.id, e.target.value as AppRole)}
                        disabled={isMe}
                        className="mx-auto h-9 w-36"
                      >
                        <option value="admin">مدير النظام</option>
                        <option value="coordinator">منسّق برنامج</option>
                      </Select>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => !isMe && toggleActive(p)}
                        disabled={isMe}
                        className="mx-auto inline-flex items-center gap-1.5 disabled:opacity-50"
                        title={p.is_active ? 'تعطيل' : 'تفعيل'}
                      >
                        <Power
                          className={`h-4 w-4 ${p.is_active ? 'text-green-600' : 'text-slate-400'}`}
                        />
                        <Badge
                          className={
                            p.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-500'
                          }
                        >
                          {p.is_active
                            ? lang === 'ar'
                              ? 'مفعّل'
                              : 'Active'
                            : lang === 'ar'
                              ? 'معطّل'
                              : 'Disabled'}
                        </Badge>
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      {p.role === 'coordinator' ? (
                        <Button size="sm" variant="outline" onClick={() => openAssign(p)}>
                          <Link2 className="h-4 w-4" />
                          {lang === 'ar' ? 'ربط' : 'Assign'}
                        </Button>
                      ) : (
                        <Badge className="bg-brand-50 text-brand-700">
                          {lang === 'ar' ? 'كل البرامج' : 'All'}
                        </Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!profiles.length && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-[var(--text-muted)]">
                    {lang === 'ar' ? 'لا يوجد مستخدمون بعد.' : 'No users yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create user modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={lang === 'ar' ? 'إنشاء مستخدم جديد' : 'New user'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={lang === 'ar' ? 'الاسم الكامل' : 'Full name'}>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </Field>
            <Field label={lang === 'ar' ? 'الدور' : 'Role'}>
              <Select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}
              >
                <option value="coordinator">منسّق برنامج</option>
                <option value="admin">مدير النظام</option>
              </Select>
            </Field>
            <Field label={lang === 'ar' ? 'البريد الإلكتروني' : 'Email'} required>
              <Input
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label={lang === 'ar' ? 'كلمة المرور' : 'Password'} required>
              <Input
                type="text"
                dir="ltr"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={lang === 'ar' ? '٨ أحرف فأكثر' : '8+ chars'}
              />
            </Field>
          </div>

          {form.role === 'coordinator' && (
            <div>
              <div className="mb-2 text-sm font-medium">{lang === 'ar' ? 'البرامج المشرف عليها' : 'Assigned programs'}</div>
              <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-xl border border-[var(--border)] p-2">
                {programs.map((pr) => (
                  <label
                    key={pr.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-brand-50/40"
                  >
                    <input
                      type="checkbox"
                      checked={form.program_ids.has(pr.id)}
                      onChange={() => {
                        const next = new Set(form.program_ids)
                        next.has(pr.id) ? next.delete(pr.id) : next.add(pr.id)
                        setForm({ ...form, program_ids: next })
                      }}
                      className="h-4 w-4 accent-brand-700"
                    />
                    <span className="flex-1 text-sm text-brand-900">{nm(pr)}</span>
                    <Badge className="bg-slate-100 text-slate-600">{t(`degree.${pr.degree}`)}</Badge>
                  </label>
                ))}
                {!programs.length && (
                  <p className="py-4 text-center text-sm text-[var(--text-muted)]">
                    {lang === 'ar' ? 'أضف برامج أولًا.' : 'Add programs first.'}
                  </p>
                )}
              </div>
            </div>
          )}

          {createErr && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{createErr}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={createUser} disabled={creating}>
              <Plus className="h-4 w-4" />
              {creating ? t('common.loading') : lang === 'ar' ? 'إنشاء' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign programs modal */}
      <Modal
        open={assignFor !== null}
        onClose={() => setAssignFor(null)}
        title={`${lang === 'ar' ? 'برامج المنسّق' : 'Coordinator programs'} — ${assignFor?.full_name || assignFor?.email || ''}`}
        size="lg"
      >
        <div className="max-h-96 space-y-1.5 overflow-y-auto">
          {programs.map((pr) => (
            <label
              key={pr.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2 hover:bg-brand-50/40"
            >
              <input
                type="checkbox"
                checked={assigned.has(pr.id)}
                onChange={() => toggleAssign(pr.id)}
                className="h-4 w-4 accent-brand-700"
              />
              <span className="flex-1 text-sm font-medium text-brand-900">{nm(pr)}</span>
              <Badge className="bg-slate-100 text-slate-600">{t(`degree.${pr.degree}`)}</Badge>
            </label>
          ))}
          {!programs.length && (
            <p className="py-6 text-center text-sm text-[var(--text-muted)]">
              {lang === 'ar' ? 'أضف برامج أولًا.' : 'Add programs first.'}
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}
