import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  FileText,
  ListChecks,
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
  n,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  n: string
}) {
  return (
    <Card className="group relative overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <span className="tnum absolute end-5 top-4 text-5xl font-black text-brand-50 transition-colors group-hover:text-gold-400/25">
        {n}
      </span>
      <div className="relative mb-4 grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-700 group-hover:text-white">
        {icon}
      </div>
      <h3 className="relative mb-1.5 text-lg font-semibold text-brand-900">{title}</h3>
      <p className="relative text-sm leading-relaxed text-[var(--text-muted)]">{desc}</p>
    </Card>
  )
}

const GOALS = [
  { label: 'الهدف 1 · جودة مخرجات التعلم', v: 92, c: 'var(--color-rate-5)' },
  { label: 'الهدف 2 · بيئة تعليمية محفزة', v: 78, c: 'var(--color-rate-4)' },
  { label: 'الهدف 3 · دعم الإنتاج العلمي', v: 64, c: 'var(--color-rate-3)' },
  { label: 'الهدف 4 · الدور المجتمعي', v: 48, c: 'var(--color-rate-2)' },
]

export default function Landing() {
  const { t } = useLang()

  return (
    <div className="min-h-full">
      <PublicHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700">
        <div className="dots pointer-events-none absolute inset-0 opacity-70 [mask-image:linear-gradient(to_bottom,#000,transparent_85%)]" />
        <div className="pointer-events-none absolute -top-24 end-[-6rem] h-96 w-96 rounded-full bg-gold-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 start-[-6rem] h-96 w-96 rounded-full bg-brand-400/30 blur-3xl" />
        <Container className="relative grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
          <div className="animate-fade-up text-white">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-brand-100">
              <Sparkles className="h-3.5 w-3.5 text-gold-400" />
              {t('app.tagline')}
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.2] md:text-5xl">{t('landing.heroTitle')}</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-brand-100/85">{t('landing.heroSub')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/take">
                <Button size="lg" variant="gold" className="group">
                  {t('landing.startSurvey')}
                  <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                  {t('landing.staffLogin')}
                </Button>
              </Link>
            </div>
          </div>

          {/* بطاقة توضيحية: تقدّم الأهداف في الخطة التشغيلية */}
          <div className="animate-fade-up [animation-delay:120ms]">
            <Card className="relative overflow-hidden p-6 shadow-2xl">
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-l from-gold-400 via-brand-400 to-brand-800" />
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-brand-900">الخطة التشغيلية · تقدّم الأهداف</span>
                <BarChart3 className="h-5 w-5 text-brand-400" />
              </div>
              <div className="space-y-3.5">
                {GOALS.map((r) => (
                  <div key={r.label}>
                    <div className="mb-1 flex justify-between text-xs text-[var(--text-muted)]">
                      <span>{r.label}</span>
                      <span className="tnum font-semibold" style={{ color: r.c }}>
                        {r.v}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${r.v}%`, backgroundColor: r.c }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800">
                <ClipboardList className="h-4 w-4 shrink-0" />
                مؤشرات تُغذّى تلقائيًا من نتائج الاستطلاعات
              </div>
            </Card>
          </div>
        </Container>
      </section>

      {/* Features */}
      <section className="py-10 md:py-16">
        <Container>
          <div className="grid gap-5 md:grid-cols-3">
            <Feature n="01" icon={<ClipboardList className="h-6 w-6" />} title={t('landing.f1Title')} desc={t('landing.f1Desc')} />
            <Feature n="02" icon={<ListChecks className="h-6 w-6" />} title={t('landing.f2Title')} desc={t('landing.f2Desc')} />
            <Feature n="03" icon={<FileText className="h-6 w-6" />} title={t('landing.f3Title')} desc={t('landing.f3Desc')} />
          </div>
        </Container>
      </section>

      <footer className="border-t border-[var(--border)] py-8">
        <Container className="flex flex-col items-center justify-between gap-3 text-sm text-[var(--text-muted)] sm:flex-row">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-400" />
            {t('app.name')} © {new Date().getFullYear()}
          </span>
          <span>{t('app.short')}</span>
        </Container>
      </footer>
    </div>
  )
}
