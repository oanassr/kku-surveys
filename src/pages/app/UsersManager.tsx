import { useEffect, useState } from 'react'
import { Link2, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/i18n'
import type { AppRole, Profile, Program } from '@/lib/types'
import { Badge, Button, Card, PageLoader, Select } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { PageHeader } from './AppLayout'

export default function UsersManager() {
  const { t, lang } = useLang()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [assignFor, setAssignFor] = useState<Profile | null>(null)
  const [assigned, setAssigned] = useState<Set<string>>(new Set())

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

  const nm = (o: { name_ar: string; name_en: string | null }) =>
    lang === 'en' && o.name_en ? o.name_en : o.name_ar

  if (loading) return <PageLoader />

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={t('nav.users')}
        subtitle="إدارة المستخدمين والأدوار وربط المنسّقين بالبرامج"
        icon={<Users className="h-5 w-5" />}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-slate-50/60 text-xs text-[var(--text-muted)]">
              <tr>
                <th className="p-3 text-start font-medium">{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                <th className="p-3 text-start font-medium">{lang === 'ar' ? 'البريد' : 'Email'}</th>
                <th className="p-3 text-center font-medium">{lang === 'ar' ? 'الدور' : 'Role'}</th>
                <th className="p-3 text-center font-medium">{lang === 'ar' ? 'البرامج' : 'Programs'}</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="p-3 font-medium text-brand-900">{p.full_name || '—'}</td>
                  <td dir="ltr" className="p-3 text-start text-[var(--text-muted)]">{p.email}</td>
                  <td className="p-3 text-center">
                    <Select
                      value={p.role}
                      onChange={(e) => setRole(p.id, e.target.value as AppRole)}
                      className="mx-auto h-9 w-36"
                    >
                      <option value="admin">مدير النظام</option>
                      <option value="coordinator">منسّق برنامج</option>
                    </Select>
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
              ))}
              {!profiles.length && (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-[var(--text-muted)]">
                    {lang === 'ar' ? 'لا يوجد مستخدمون بعد.' : 'No users yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

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
