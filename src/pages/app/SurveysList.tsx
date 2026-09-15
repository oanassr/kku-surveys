import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/i18n'
import type { AudienceType, DegreeLevel, SurveyTemplate } from '@/lib/types'
import { Badge, Button, Card, Field, Input, PageLoader, Select } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { PageHeader } from './AppLayout'

const AUDIENCES: AudienceType[] = [
  'student', 'graduate', 'faculty', 'employee', 'employer', 'trainee', 'supervision', 'other',
]
const DEGREES: DegreeLevel[] = ['bachelor', 'master', 'phd']

export default function SurveysList() {
  const { t, lang } = useLang()
  const { isAdmin } = useAuth()
  const [surveys, setSurveys] = useState<SurveyTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({
    title_ar: '',
    title_en: '',
    audience: 'student' as AudienceType,
    degree_level: 'master' as DegreeLevel,
  })

  async function load() {
    const { data } = await supabase
      .from('survey_templates')
      .select('*')
      .order('created_at', { ascending: false })
    setSurveys((data as SurveyTemplate[]) ?? [])
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  async function create() {
    if (!form.title_ar.trim()) return
    const { data } = await supabase
      .from('survey_templates')
      .insert({
        title_ar: form.title_ar,
        title_en: form.title_en || null,
        audience: form.audience,
        degree_level: form.degree_level,
      })
      .select()
      .single()
    setModal(false)
    if (data) load()
  }

  async function del(id: string) {
    if (!confirm(lang === 'ar' ? 'حذف الاستطلاع وكل محاوره؟' : 'Delete survey and its axes?')) return
    await supabase.from('survey_templates').delete().eq('id', id)
    setSurveys((s) => s.filter((x) => x.id !== id))
  }

  if (loading) return <PageLoader />

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={t('nav.surveys')}
        subtitle="قوالب الاستطلاعات القابلة لإعادة الاستخدام"
        icon={<ClipboardList className="h-5 w-5" />}
        action={
          isAdmin && (
            <Button onClick={() => setModal(true)}>
              <Plus className="h-4 w-4" />
              {lang === 'ar' ? 'استطلاع جديد' : 'New survey'}
            </Button>
          )
        }
      />

      <div className="grid gap-3 md:grid-cols-2">
        {surveys.map((s) => (
          <Card key={s.id} className="flex items-start justify-between p-5">
            <div className="min-w-0">
              <div className="font-semibold text-brand-900">
                {lang === 'en' && s.title_en ? s.title_en : s.title_ar}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge className="bg-brand-50 text-brand-700">{t(`audience.${s.audience}`)}</Badge>
                {s.degree_level && (
                  <Badge className="bg-gold-500/10 text-gold-600">
                    {t(`degree.${s.degree_level}`)}
                  </Badge>
                )}
                <Badge className="bg-slate-100 text-slate-600">
                  {s.language === 'ar' ? 'عربي' : 'EN'}
                </Badge>
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Link to={`/app/surveys/${s.id}`}>
                <Button size="sm" variant="outline">
                  <Pencil className="h-4 w-4" />
                </Button>
              </Link>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:bg-red-50"
                  onClick={() => del(s.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </Card>
        ))}
        {!surveys.length && (
          <Card className="col-span-full p-10 text-center text-[var(--text-muted)]">
            {lang === 'ar' ? 'لا توجد استطلاعات بعد.' : 'No surveys yet.'}
          </Card>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={lang === 'ar' ? 'استطلاع جديد' : 'New survey'}>
        <div className="space-y-4">
          <Field label={lang === 'ar' ? 'العنوان (عربي)' : 'Title (Arabic)'} required>
            <Input
              value={form.title_ar}
              onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
              autoFocus
            />
          </Field>
          <Field label={lang === 'ar' ? 'العنوان (إنجليزي)' : 'Title (English)'}>
            <Input
              dir="ltr"
              value={form.title_en}
              onChange={(e) => setForm({ ...form, title_en: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={lang === 'ar' ? 'الجمهور المستهدف' : 'Audience'}>
              <Select
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value as AudienceType })}
              >
                {AUDIENCES.map((a) => (
                  <option key={a} value={a}>
                    {t(`audience.${a}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('common.degree')}>
              <Select
                value={form.degree_level}
                onChange={(e) => setForm({ ...form, degree_level: e.target.value as DegreeLevel })}
              >
                {DEGREES.map((d) => (
                  <option key={d} value={d}>
                    {t(`degree.${d}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={create}>{t('common.save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
