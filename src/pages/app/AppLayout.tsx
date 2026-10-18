import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom'
import {
  BarChart3,
  Building2,
  ClipboardList,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Languages,
  ListChecks,
  LogOut,
  Send,
  Target,
  UserCog,
  Users,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/i18n'
import { supabaseReady } from '@/lib/supabase'
import { COURSE_REPORT_URL } from '@/lib/links'
import { Logo } from '@/components/Logo'
import { SetupNotice } from '@/components/SetupNotice'
import { Button, PageLoader } from '@/components/ui'
import { cn } from '@/lib/cn'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  adminOnly?: boolean
  end?: boolean
}

export default function AppLayout() {
  const { session, profile, loading, isAdmin, signOut } = useAuth()
  const { t, toggle, lang } = useLang()
  const nav = useNavigate()

  if (!supabaseReady)
    return (
      <div className="grid min-h-full place-items-center p-6">
        <SetupNotice />
      </div>
    )
  if (loading) return <PageLoader label={t('common.loading')} />
  if (!session) return <Navigate to="/login" replace />

  const items: NavItem[] = [
    { to: '/app', icon: <LayoutDashboard className="h-4.5 w-4.5" />, label: t('nav.dashboard'), end: true },
    { to: '/app/runs', icon: <Send className="h-4.5 w-4.5" />, label: t('nav.runs') },
    { to: '/app/surveys', icon: <ClipboardList className="h-4.5 w-4.5" />, label: t('nav.surveys') },
    { to: '/app/plans', icon: <ListChecks className="h-4.5 w-4.5" />, label: t('nav.plans') },
    { to: '/app/indicators', icon: <Target className="h-4.5 w-4.5" />, label: t('nav.indicators') },
    { to: '/app/org', icon: <Building2 className="h-4.5 w-4.5" />, label: t('nav.org'), adminOnly: true },
    { to: '/app/users', icon: <Users className="h-4.5 w-4.5" />, label: t('nav.users'), adminOnly: true },
  ]

  return (
    <div className="flex min-h-full">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-hidden bg-gradient-to-b from-brand-950 via-brand-900 to-brand-800 text-white md:flex">
        <div className="dots pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,#000,transparent_60%)]" />
        <div className="relative border-b border-white/10 p-5">
          <Logo tone="light" />
        </div>
        <nav className="relative flex-1 space-y-1 overflow-y-auto p-3">
          {items
            .filter((i) => !i.adminOnly || isAdmin)
            .map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.end}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-white/15 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]'
                      : 'text-brand-100/80 hover:bg-white/10 hover:text-white',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute inset-y-2 end-0 w-1 rounded-s-full bg-gold-400" />}
                    <span className={isActive ? 'text-gold-400' : ''}>{i.icon}</span>
                    {i.label}
                  </>
                )}
              </NavLink>
            ))}
        </nav>

        <div className="relative px-3 pb-3">
          <div className="mb-1.5 px-1 text-[11px] font-semibold tracking-wide text-brand-200/70">{t('nav.tools')}</div>
          <a
            href={COURSE_REPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            title={t('nav.courseReportsHint')}
            className="flex items-center gap-3 rounded-xl border border-dashed border-white/25 bg-white/5 px-3.5 py-2.5 text-sm font-medium text-brand-50 transition-colors hover:bg-white/10"
          >
            <FileText className="h-4.5 w-4.5 shrink-0 text-gold-400" />
            <span className="flex-1 leading-snug">{t('nav.courseReports')}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </a>
        </div>

        <div className="relative border-t border-white/10 p-3">
          <NavLink
            to="/app/account"
            className={({ isActive }) =>
              cn(
                'mb-2 flex items-center gap-3 rounded-xl px-3 py-2 transition-colors',
                isActive ? 'bg-white/15' : 'hover:bg-white/10',
              )
            }
          >
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gold-400 text-sm font-bold text-brand-950">
              {(profile?.full_name || profile?.email || '؟').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">{profile?.full_name || profile?.email}</div>
              <div className="text-xs text-brand-200/80">
                {isAdmin ? 'مدير النظام' : 'منسّق برنامج'} · {lang === 'ar' ? 'حسابي' : 'Account'}
              </div>
            </div>
          </NavLink>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="flex-1 text-brand-100 hover:bg-white/10" onClick={toggle}>
              <Languages className="h-4 w-4" />
              {lang === 'ar' ? 'EN' : 'ع'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-red-300 hover:bg-red-500/15"
              onClick={async () => {
                await signOut()
                nav('/login')
              }}
            >
              <LogOut className="h-4 w-4" />
              {t('nav.logout')}
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--border)] glass px-4 py-3 md:hidden">
          <Logo compact />
          <div className="flex gap-1">
            <NavLink to="/app/account">
              <Button variant="ghost" size="sm">
                <UserCog className="h-4 w-4" />
              </Button>
            </NavLink>
            <Button variant="ghost" size="sm" onClick={toggle}>
              <Languages className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut()
                nav('/login')
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-b border-[var(--border)] bg-white px-3 py-2 md:hidden">
          {items
            .filter((i) => !i.adminOnly || isAdmin)
            .map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.end}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
                    isActive ? 'bg-brand-800 text-white' : 'text-[var(--text-muted)]',
                  )
                }
              >
                {i.icon}
                {i.label}
              </NavLink>
            ))}
          <a
            href={COURSE_REPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            title={t('nav.courseReportsHint')}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-brand-700"
          >
            <FileText className="h-4 w-4" />
            {t('nav.courseReports')}
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        </nav>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 shadow-sm ring-1 ring-brand-200/60">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-brand-950">{title}</h1>
          {subtitle && <p className="text-sm text-[var(--text-muted)]">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export { BarChart3 }
