import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom'
import {
  BarChart3,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Languages,
  LogOut,
  Send,
  Target,
  Users,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/i18n'
import { supabaseReady } from '@/lib/supabase'
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
    { to: '/app/indicators', icon: <Target className="h-4.5 w-4.5" />, label: t('nav.indicators'), adminOnly: true },
    { to: '/app/org', icon: <Building2 className="h-4.5 w-4.5" />, label: t('nav.org'), adminOnly: true },
    { to: '/app/users', icon: <Users className="h-4.5 w-4.5" />, label: t('nav.users'), adminOnly: true },
  ]

  return (
    <div className="flex min-h-full">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-[var(--border)] bg-white/70 backdrop-blur md:flex">
        <div className="border-b border-[var(--border)] p-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items
            .filter((i) => !i.adminOnly || isAdmin)
            .map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-800 text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:bg-brand-50 hover:text-brand-800',
                  )
                }
              >
                {i.icon}
                {i.label}
              </NavLink>
            ))}
        </nav>
        <div className="border-t border-[var(--border)] p-3">
          <div className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
              {(profile?.full_name || profile?.email || '؟').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-brand-900">
                {profile?.full_name || profile?.email}
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                {isAdmin ? 'مدير النظام' : 'منسّق برنامج'}
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="flex-1" onClick={toggle}>
              <Languages className="h-4 w-4" />
              {lang === 'ar' ? 'EN' : 'ع'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-red-600 hover:bg-red-50"
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
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
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
