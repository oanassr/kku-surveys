import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, FileBarChart, Send, Users2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/i18n'
import { Card, PageLoader } from '@/components/ui'
import { PageHeader } from './AppLayout'

interface Stats {
  programs: number
  surveys: number
  openRuns: number
  responses: number
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone: string
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div
          className="grid h-11 w-11 place-items-center rounded-xl"
          style={{ backgroundColor: `color-mix(in srgb, ${tone} 12%, white)`, color: tone }}
        >
          {icon}
        </div>
      </div>
      <div className="tnum mt-4 text-3xl font-bold text-brand-950">{value}</div>
      <div className="mt-1 text-sm text-[var(--text-muted)]">{label}</div>
    </Card>
  )
}

export default function Dashboard() {
  const { t } = useLang()
  const { profile, isAdmin } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    async function load() {
      const [p, s, r, resp] = await Promise.all([
        supabase.from('programs').select('id', { count: 'exact', head: true }),
        supabase.from('survey_templates').select('id', { count: 'exact', head: true }),
        supabase
          .from('survey_runs')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'open'),
        supabase.from('responses').select('id', { count: 'exact', head: true }),
      ])
      setStats({
        programs: p.count ?? 0,
        surveys: s.count ?? 0,
        openRuns: r.count ?? 0,
        responses: resp.count ?? 0,
      })
    }
    load()
  }, [])

  if (!stats) return <PageLoader label={t('common.loading')} />

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={`${t('nav.dashboard')} — ${profile?.full_name || ''}`}
        subtitle={isAdmin ? 'مدير النظام — صلاحيات كاملة' : 'منسّق برنامج'}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Send className="h-5 w-5" />}
          label={t('nav.runs')}
          value={stats.openRuns}
          tone="var(--color-rate-5)"
        />
        <StatCard
          icon={<FileBarChart className="h-5 w-5" />}
          label={t('common.responses')}
          value={stats.responses}
          tone="var(--color-brand-600)"
        />
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          label={t('nav.surveys')}
          value={stats.surveys}
          tone="var(--color-rate-3)"
        />
        <StatCard
          icon={<Users2 className="h-5 w-5" />}
          label={t('common.program')}
          value={stats.programs}
          tone="var(--color-gold-600)"
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Link to="/app/runs">
          <Card className="flex h-full items-center gap-4 p-6 transition-all hover:border-brand-300 hover:shadow-md">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Send className="h-6 w-6" />
            </div>
            <div>
              <div className="font-semibold text-brand-900">{t('nav.runs')}</div>
              <div className="text-sm text-[var(--text-muted)]">
                نشر استطلاع جديد ومتابعة الاستجابات
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/app/surveys">
          <Card className="flex h-full items-center gap-4 p-6 transition-all hover:border-brand-300 hover:shadow-md">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <div className="font-semibold text-brand-900">{t('nav.surveys')}</div>
              <div className="text-sm text-[var(--text-muted)]">
                بناء وتعديل المحاور والفقرات
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  )
}
