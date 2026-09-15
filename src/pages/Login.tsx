import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, LogIn } from 'lucide-react'
import { supabase, supabaseReady } from '@/lib/supabase'
import { useLang } from '@/i18n'
import { Logo } from '@/components/Logo'
import { SetupNotice } from '@/components/SetupNotice'
import { Button, Card, Field, Input } from '@/components/ui'

export default function Login() {
  const { t, toggle, lang } = useLang()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      setErr(lang === 'ar' ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials')
      return
    }
    nav('/app')
  }

  async function onForgot() {
    setErr(null)
    if (!email.trim()) {
      setErr(lang === 'ar' ? 'أدخل بريدك الإلكتروني أولًا.' : 'Enter your email first.')
      return
    }
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}reset`
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    if (error) {
      setErr(lang === 'ar' ? 'تعذّر إرسال الرابط.' : 'Could not send the link.')
      return
    }
    setSent(true)
  }

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      {/* Brand side */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-800 to-brand-950 lg:block">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(600px_300px_at_20%_10%,#f0c14b,transparent),radial-gradient(600px_300px_at_80%_90%,#4b86dd,transparent)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="[&_*]:!text-white">
            <Logo />
          </div>
          <div>
            <h2 className="text-3xl font-bold leading-snug">{t('landing.heroTitle')}</h2>
            <p className="mt-4 max-w-md text-white/70">{t('landing.heroSub')}</p>
          </div>
          <span className="text-sm text-white/50">
            {t('app.university')} © {new Date().getFullYear()}
          </span>
        </div>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Logo />
          </div>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-brand-950">{t('nav.login')}</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {lang === 'ar'
                ? 'للمنسّقين ومديري النظام'
                : 'For coordinators and administrators'}
            </p>
          </div>

          {!supabaseReady ? (
            <SetupNotice />
          ) : (
            <Card className="p-6">
              <form onSubmit={onSubmit} className="space-y-4">
                <Field label={lang === 'ar' ? 'البريد الإلكتروني' : 'Email'} required>
                  <Input
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Field>
                <Field label={lang === 'ar' ? 'كلمة المرور' : 'Password'} required>
                  <Input
                    type="password"
                    dir="ltr"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </Field>
                {err && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>
                )}
                {sent && (
                  <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                    {lang === 'ar'
                      ? 'أُرسل رابط الاستعادة إلى بريدك. افتحه لتعيين كلمة مرور جديدة.'
                      : 'A recovery link was sent to your email.'}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={busy}>
                  <LogIn className="h-4 w-4" />
                  {busy ? t('common.loading') : t('nav.login')}
                </Button>
                <button
                  type="button"
                  onClick={onForgot}
                  className="w-full text-center text-sm text-brand-700 hover:text-brand-900"
                >
                  {lang === 'ar' ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                </button>
              </form>
            </Card>
          )}

          <div className="mt-6 flex items-center justify-between text-sm">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-brand-700 hover:text-brand-900"
            >
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              {t('nav.home')}
            </Link>
            <button onClick={toggle} className="text-brand-700 hover:text-brand-900">
              {lang === 'ar' ? 'English' : 'العربية'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
