import { cn } from '@/lib/cn'
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'

/* ----------------------------- Button ----------------------------- */
type Variant = 'primary' | 'secondary' | 'ghost' | 'gold' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

const btnVariants: Record<Variant, string> = {
  primary:
    'bg-brand-800 text-white shadow-sm hover:bg-brand-700 active:bg-brand-900 focus-visible:ring-brand-500',
  secondary:
    'bg-brand-50 text-brand-800 hover:bg-brand-100 focus-visible:ring-brand-400',
  gold: 'bg-gold-500 text-brand-950 shadow-sm hover:bg-gold-400 focus-visible:ring-gold-500 font-semibold',
  ghost: 'text-brand-800 hover:bg-brand-50 focus-visible:ring-brand-400',
  outline:
    'border border-brand-200 text-brand-800 bg-white hover:bg-brand-50 focus-visible:ring-brand-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
}
const btnSizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-5 text-sm gap-2 rounded-xl',
  lg: 'h-13 px-7 text-base gap-2.5 rounded-xl',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        btnVariants[variant],
        btnSizes[size],
        className,
      )}
      {...props}
    />
  ),
)
Button.displayName = 'Button'

/* ----------------------------- Card ------------------------------- */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--border)] bg-white shadow-[0_1px_3px_rgba(15,27,45,0.06),0_8px_24px_-12px_rgba(15,27,45,0.12)]',
        className,
      )}
      {...props}
    />
  )
}

/* ----------------------------- Badge ------------------------------ */
export function Badge({
  className,
  color,
  children,
}: {
  className?: string
  color?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        className,
      )}
      style={
        color
          ? { backgroundColor: `color-mix(in srgb, ${color} 14%, white)`, color }
          : undefined
      }
    >
      {children}
    </span>
  )
}

/* ----------------------------- Field / Input / Select ------------- */
export function Field({
  label,
  required,
  children,
  className,
}: {
  label: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-sm font-medium text-[var(--text)]">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  )
}

const controlCls =
  'w-full h-11 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm text-[var(--text)] ' +
  'transition-colors placeholder:text-slate-400 focus:border-brand-400 focus:outline-none ' +
  'focus:ring-2 focus:ring-[var(--ring)] disabled:bg-slate-50 disabled:text-slate-400'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(controlCls, className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(controlCls, 'cursor-pointer', className)} {...props}>
      {children}
    </select>
  ),
)
Select.displayName = 'Select'

/* ----------------------------- Spinner ---------------------------- */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-700',
        className,
      )}
    />
  )
}

export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
      <Spinner className="h-7 w-7" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}

/* ----------------------------- Container -------------------------- */
export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mx-auto w-full max-w-6xl px-4 sm:px-6', className)} {...props} />
}
