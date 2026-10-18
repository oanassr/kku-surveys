import { useLang } from '@/i18n'
import { cn } from '@/lib/cn'

export function Logo({ compact = false, tone = 'dark' }: { compact?: boolean; tone?: 'dark' | 'light' }) {
  const { t } = useLang()
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-xl shadow-sm',
          tone === 'light'
            ? 'bg-white/10 ring-1 ring-white/20'
            : 'bg-gradient-to-br from-brand-500 to-brand-900',
        )}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
          <rect x="4" y="12" width="3" height="7" rx="1" fill="#f0c14b" />
          <rect x="10.5" y="8" width="3" height="11" rx="1" fill="#fff" />
          <rect x="17" y="5" width="3" height="14" rx="1" fill="#f0c14b" />
        </svg>
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className={cn('text-sm font-bold', tone === 'light' ? 'text-white' : 'text-brand-900')}>{t('app.name')}</div>
          <div className={cn('text-[11px]', tone === 'light' ? 'text-brand-200' : 'text-[var(--text-muted)]')}>
            {t('app.short')}
          </div>
        </div>
      )}
    </div>
  )
}
