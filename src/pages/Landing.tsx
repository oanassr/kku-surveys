import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  FileSpreadsheet,
  QrCode,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useLang } from '@/i18n'
import { PublicHeader } from '@/components/PublicHeader'
import { Button, Card, Container } from '@/components/ui'

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <Card className="group p-6 transition-transform duration-300 hover:-translate-y-1">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-700 group-hover:text-white">
        {icon}
      </div>
      <h3 className="mb-1.5 text-lg font-semibold text-brand-900">{title}</h3>
      <p className="text-sm leading-relaxed text-[var(--text-muted)]">{desc}</p>
    </Card>
  )
}

export default function Landing() {
  const { t, dir } = useLang()
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowLeft

  return (
    <div className="min-h-full">
      <PublicHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 start-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl" />
        </div>
        <Container className="grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-xs font-medium text-brand-700">
              <Sparkles className="h-3.5 w-3.5 text-gold-500" />
              {t('app.tagline')}
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.15] text-brand-950 md:text-5xl">
              {t('landing.heroTitle')}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--text-muted)]">
              {t('landing.heroSub')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/take">
                <Button size="lg" variant="gold" className="group">
                  {t('landing.startSurvey')}
                  <Arrow className="h-4 w-4 transition-transform group-hover:-translate-x-1 rtl:group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline">
                  {t('landing.staffLogin')}
                </Button>
              </Link>
            </div>
          </div>

          {/* Decorative preview card */}
          <div className="animate-fade-up [animation-delay:120ms]">
            <Card className="relative overflow-hidden p-6">
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-l from-gold-400 via-brand-500 to-brand-800" />
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-brand-900">
                  {t('nav.reports')}
                </span>
                <BarChart3 className="h-5 w-5 text-brand-400" />
              </div>
              <div className="space-y-3">
                {[
                  { label: 'محور جودة إدارة البرنامج', v: 92, c: 'var(--color-rate-5)' },
                  { label: 'محور المنهج وطرق التقييم', v: 78, c: 'var(--color-rate-4)' },
                  { label: 'محور الإرشاد الأكاديمي', v: 64, c: 'var(--color-rate-3)' },
                  { label: 'محور تقنية المعلومات', v: 48, c: 'var(--color-rate-2)' },
                ].map((r) => (
                  <div key={r.label}>
                    <div className="mb-1 flex justify-between text-xs text-[var(--text-muted)]">
                      <span>{r.label}</span>
                      <span className="tnum font-semibold" style={{ color: r.c }}>
                        {r.v}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${r.v}%`, backgroundColor: r.c }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Container>
      </section>

      {/* Features */}
      <section className="py-8 md:py-16">
        <Container>
          <div className="grid gap-5 md:grid-cols-3">
            <Feature
              icon={<ClipboardList className="h-6 w-6" />}
              title={t('landing.f1Title')}
              desc={t('landing.f1Desc')}
            />
            <Feature
              icon={<QrCode className="h-6 w-6" />}
              title={t('landing.f2Title')}
              desc={t('landing.f2Desc')}
            />
            <Feature
              icon={<FileSpreadsheet className="h-6 w-6" />}
              title={t('landing.f3Title')}
              desc={t('landing.f3Desc')}
            />
          </div>
        </Container>
      </section>

      <footer className="border-t border-[var(--border)] py-8">
        <Container className="flex flex-col items-center justify-between gap-3 text-sm text-[var(--text-muted)] sm:flex-row">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-400" />
            {t('app.university')} © {new Date().getFullYear()}
          </span>
          <span>{t('app.name')}</span>
        </Container>
      </footer>
    </div>
  )
}
