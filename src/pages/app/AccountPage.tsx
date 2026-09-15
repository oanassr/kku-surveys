import { useState } from 'react'
import { KeyRound, Save, UserCog } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/i18n'
import { Button, Card, Field, Input } from '@/components/ui'
import { PageHeader } from './AppLayout'

export default function AccountPage() {
  const { t, lang } = useLang()
  const { profile, isAdmin, refreshProfile } = useAuth()

  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [savingName, setSavingName] = useState(false)
  const [nameMsg, setNameMsg] = useState<string | null>(null)

  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function saveName() {
    if (!profile) return
    setSavingName(true)
    setNameMsg(null)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', profile.id)
    setSavingName(false)
    if (!error) {
      await refreshProfile()
      setNameMsg(lang === 'ar' ? 'تم الحفظ.' : 'Saved.')
    }
  }

  async function changePw(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg(null)
    if (pw.length < 8) {
      setPwMsg({ ok: false, text: lang === 'ar' ? 'كلمة المرور ٨ أحرف فأكثر.' : 'Min 8 characters.' })
      return
    }
    if (pw !== pw2) {
      setPwMsg({ ok: false, text: lang === 'ar' ? 'كلمتا المرور غير متطابقتين.' : 'Passwords differ.' })
      return
    }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setSavingPw(false)
    if (error) {
      setPwMsg({ ok: false, text: `${lang === 'ar' ? 'تعذّر التغيير: ' : 'Failed: '}${error.message}` })
      return
    }
    setPw('')
    setPw2('')
    setPwMsg({ ok: true, text: lang === 'ar' ? 'تم تغيير كلمة المرور بنجاح.' : 'Password changed.' })
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade-up">
      <PageHeader
        title={lang === 'ar' ? 'حسابي' : 'My account'}
        subtitle={isAdmin ? 'مدير النظام' : 'منسّق برنامج'}
        icon={<UserCog className="h-5 w-5" />}
      />

      {/* Profile */}
      <Card className="mb-5 p-6">
        <h3 className="mb-4 font-semibold text-brand-900">
          {lang === 'ar' ? 'البيانات الشخصية' : 'Profile'}
        </h3>
        <div className="space-y-4">
          <Field label={lang === 'ar' ? 'الاسم الكامل' : 'Full name'}>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label={lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}>
            <Input dir="ltr" value={profile?.email ?? ''} disabled />
          </Field>
          <div className="flex items-center gap-3">
            <Button onClick={saveName} disabled={savingName}>
              <Save className="h-4 w-4" />
              {savingName ? t('common.loading') : t('common.save')}
            </Button>
            {nameMsg && <span className="text-sm text-green-700">{nameMsg}</span>}
          </div>
        </div>
      </Card>

      {/* Password */}
      <Card className="p-6">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-brand-900">
          <KeyRound className="h-4 w-4" />
          {lang === 'ar' ? 'تغيير كلمة المرور' : 'Change password'}
        </h3>
        <form onSubmit={changePw} className="space-y-4">
          <Field label={lang === 'ar' ? 'كلمة المرور الجديدة' : 'New password'} required>
            <Input type="password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Field label={lang === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm password'} required>
            <Input type="password" dir="ltr" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </Field>
          {pwMsg && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                pwMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {pwMsg.text}
            </p>
          )}
          <Button type="submit" disabled={savingPw}>
            <KeyRound className="h-4 w-4" />
            {savingPw ? t('common.loading') : lang === 'ar' ? 'تغيير كلمة المرور' : 'Change password'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
