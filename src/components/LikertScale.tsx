import { cn } from '@/lib/cn'
import { useLang } from '@/i18n'

const VALUES = [5, 4, 3, 2, 1] as const

const COLORS: Record<number, string> = {
  5: 'var(--color-rate-5)',
  4: 'var(--color-rate-4)',
  3: 'var(--color-rate-3)',
  2: 'var(--color-rate-2)',
  1: 'var(--color-rate-1)',
}

export function LikertScale({
  value,
  onChange,
  name,
}: {
  value: number | null
  onChange: (v: number) => void
  name: string
}) {
  const { t } = useLang()
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={name}>
      {VALUES.map((v) => {
        const active = value === v
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            title={t(`scale.${v}`)}
            onClick={() => onChange(v)}
            className={cn(
              'group flex h-11 min-w-11 flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-medium transition-all',
              active
                ? 'border-transparent text-white shadow-sm'
                : 'border-[var(--border)] bg-white text-[var(--text-muted)] hover:border-brand-300 hover:bg-brand-50/50',
            )}
            style={active ? { backgroundColor: COLORS[v] } : undefined}
          >
            <span className="tnum text-base font-bold">{v}</span>
            <span className="hidden text-xs sm:inline">{t(`scale.${v}`)}</span>
          </button>
        )
      })}
    </div>
  )
}
