import { useLang } from '@/i18n'

export function Logo({ compact = false }: { compact?: boolean }) {
  const { t } = useLang()
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-900 shadow-sm">
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
          <rect x="4" y="12" width="3" height="7" rx="1" fill="#f0c14b" />
          <rect x="10.5" y="8" width="3" height="11" rx="1" fill="#fff" />
          <rect x="17" y="5" width="3" height="14" rx="1" fill="#f0c14b" />
        </svg>
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-sm font-bold text-brand-900">{t('app.name')}</div>
          <div className="text-[11px] text-[var(--text-muted)]">{t('app.university')}</div>
        </div>
      )}
    </div>
  )
}
