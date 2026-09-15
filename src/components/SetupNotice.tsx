import { AlertTriangle } from 'lucide-react'
import { useLang } from '@/i18n'
import { Card } from './ui'

export function SetupNotice() {
  const { t } = useLang()
  return (
    <Card className="mx-auto max-w-lg border-amber-200 bg-amber-50/60 p-6">
      <div className="flex gap-3">
        <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" />
        <div>
          <h3 className="font-semibold text-amber-900">{t('setup.title')}</h3>
          <p className="mt-1 text-sm leading-relaxed text-amber-800">{t('setup.body')}</p>
        </div>
      </div>
    </Card>
  )
}
