import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { KpiValue, PlanFull } from '@/lib/plans'

/** سياق مشترك بين تبويبات المحرّر. */
export interface TabProps {
  full: PlanFull
  reload: () => Promise<void>
  /** تشغيل عملية كتابة مع عرض الخطأ إن وُجد، ثم إعادة التحميل اختياريًا. */
  run: (op: () => Promise<string | null>, opts?: { reload?: boolean }) => Promise<boolean>
  /** تحديث قيمة مؤشر في الحالة المحلية بلا إعادة تحميل. */
  patchValue: (indicatorId: string, patch: Partial<KpiValue>) => void
}

/** نص قابل للتحرير في موضعه، يُحفظ عند فقدان التركيز. */
export function InlineText({
  value,
  onSave,
  placeholder,
  multiline = false,
  className,
  dir,
}: {
  value: string | null | undefined
  onSave: (v: string) => void
  placeholder?: string
  multiline?: boolean
  className?: string
  dir?: 'ltr' | 'rtl'
}) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => setV(value ?? ''), [value])
  const base =
    'w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm leading-relaxed text-[var(--text)] ' +
    'transition-colors placeholder:text-slate-400 hover:border-[var(--border)] hover:bg-white ' +
    'focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ring)]'
  const common = {
    value: v,
    placeholder,
    dir,
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setV(e.target.value),
    onBlur: () => {
      if (v.trim() !== (value ?? '').trim()) onSave(v.trim())
    },
  }
  return multiline ? (
    <textarea rows={1} className={cn(base, 'field-sizing-content min-h-9 resize-none', className)} {...common} />
  ) : (
    <input className={cn(base, 'h-9', className)} {...common} />
  )
}

export function Section({
  title,
  hint,
  action,
  children,
  className,
}: {
  title: string
  hint?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-brand-900">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function StatPill({
  label,
  value,
  color,
}: {
  label: string
  value: ReactNode
  color?: string
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3">
      <div className="tnum text-2xl font-bold" style={{ color: color ?? 'var(--color-brand-800)' }}>
        {value}
      </div>
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
    </div>
  )
}
