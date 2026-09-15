import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, KeyRound, ShieldAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/i18n'
import { Logo } from '@/components/Logo'
import { Button, Card, Field, Input } from '@/components/ui'

export default function ResetPassword() {
  const { lang } = useLang()
  const nav = useNavigate()
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  // رابط الاستعادة ينشئ جلسة تلقائيًا (recovery). ننتظر توفّرها.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(Boolean(data.session)))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setHasSession(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (password.length < 8) {
      setErr(lang === 'ar' ? 'كلمة المرور ٨ أحرف فأكثر.' : 'Password must be 8+ chars.')
      return
    }
    if (password !== confirm) {
      setErr(lang === 'ar' ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.')
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      setErr(
        lang === 'ar'
          ? 'تعذّر التحديث. قد يكون الرابط منتهيًا — اطلب رابطًا جديدًا.'
          : 'Update failed. The link may have expired.',
      )
      return
    }
    setDone(true)
    setTimeout(() => nav('/app'), 1500)
  }

  return (
    <div className="grid min-h-full place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <Card className="p-6">
          {done ? (
            <div className="py-4 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-600" />
              <h1 className="text-lg font-bold text-brand-900">
                {lang === 'ar' ? 'تم تحديث كلمة المرور' : 'Password updated'}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {lang === 'ar' ? 'يجري تحويلك…' : 'Redirecting…'}
              </p>
            </div>
          ) : hasSession === false ? (
            <div className="py-4 text-center">
              <ShieldAlert className="mx-auto mb-3 h-12 w-12 text-amber-500" />
              <h1 className="text-lg font-bold text-brand-900">
                {lang === 'ar' ? 'رابط غير صالح أو منتهٍ' : 'Invalid or expired link'}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {lang === 'ar'
                  ? 'افتح هذه الصفحة من رابط الاستعادة المرسل إلى بريدك، أو اطلب رابطًا جديدًا من صفحة الدخول.'
                  : 'Open this page from the recovery link in your email.'}
              </p>
              <Link to="/login" className="mt-4 inline-block">
                <Button variant="outline">{lang === 'ar' ? 'صفحة الدخول' : 'Login'}</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-5 flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-brand-700" />
                <h1 className="text-lg font-bold text-brand-900">
                  {lang === 'ar' ? 'تعيين كلمة مرور جديدة' : 'Set a new password'}
                </h1>
              </div>
              <form onSubmit={submit} className="space-y-4">
                <Field label={lang === 'ar' ? 'كلمة المرور الجديدة' : 'New password'} required>
                  <Input
                    type="password"
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                </Field>
                <Field label={lang === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm password'} required>
                  <Input
                    type="password"
                    dir="ltr"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </Field>
                {err && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>
                )}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? '…' : lang === 'ar' ? 'حفظ كلمة المرور' : 'Save password'}
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
