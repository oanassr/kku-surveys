import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/i18n'
import { Card } from './ui'

/** يعرض المحتوى لمدير النظام فقط؛ غير ذلك يُظهر إشعارًا. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  const { lang } = useLang()
  if (isAdmin) return <>{children}</>
  return (
    <Card className="mx-auto max-w-md p-8 text-center">
      <Lock className="mx-auto mb-3 h-10 w-10 text-amber-500" />
      <h2 className="font-semibold text-brand-900">
        {lang === 'ar' ? 'هذه الصفحة لمدير النظام فقط' : 'Admins only'}
      </h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        {lang === 'ar'
          ? 'ليست ضمن صلاحيات منسّق البرنامج.'
          : 'Not available to program coordinators.'}
      </p>
    </Card>
  )
}
