import { useEffect, useState } from 'react'
import { Plus, Target, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/i18n'
import type { Indicator, IndicatorKind } from '@/lib/types'
import { Badge, Button, Card, Field, Input, PageLoader, Select } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { PageHeader } from './AppLayout'

const KINDS: IndicatorKind[] = ['kpi', 'objective', 'initiative']

export const KIND_LABEL: Record<IndicatorKind, { ar: string; en: string; color: string }> = {
  kpi: { ar: 'مؤشر أداء KPI', en: 'KPI', color: 'var(--color-brand-600)' },
  objective: { ar: 'هدف برنامج', en: 'Objective', color: 'var(--color-rate-4)' },
  initiative: { ar: 'مبادرة', en: 'Initiative', color: 'var(--color-gold-600)' },
}

export default function IndicatorsManager() {
  const { t, lang } = useLang()
  const [items, setItems] = useState<Indicator[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ kind: 'kpi' as IndicatorKind, code: '', name_ar: '', name_en: '' })

  async function load() {
    const { data } = await supabase.from('indicators').select('*').order('created_at')
    setItems((data as Indicator[]) ?? [])
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  async function create() {
    if (!form.name_ar.trim()) return
    await supabase.from('indicators').insert({
      kind: form.kind,
      code: form.code || null,
      name_ar: form.name_ar,
      name_en: form.name_en || null,
    })
    setForm({ kind: 'kpi', code: '', name_ar: '', name_en: '' })
    setModal(false)
    load()
  }

  async function del(id: string) {
    if (!confirm(lang === 'ar' ? 'حذف المؤشر؟' : 'Delete indicator?')) return
    await supabase.from('indicators').delete().eq('id', id)
    setItems((x) => x.filter((y) => y.id !== id))
  }

  if (loading) return <PageLoader />

  const groups = KINDS.map((k) => ({ kind: k, list: items.filter((i) => i.kind === k) }))

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={t('nav.indicators')}
        subtitle="مؤشرات الأداء والأهداف والمبادرات المرتبطة بالمحاور والأسئلة"
        icon={<Target className="h-5 w-5" />}
        action={
          <Button onClick={() => setModal(true)}>
            <Plus className="h-4 w-4" />
            {lang === 'ar' ? 'مؤشر جديد' : 'New indicator'}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {groups.map((g) => (
          <Card key={g.kind} className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: KIND_LABEL[g.kind].color }}
              />
              <h3 className="font-semibold text-brand-900">
                {lang === 'ar' ? KIND_LABEL[g.kind].ar : KIND_LABEL[g.kind].en}
              </h3>
              <Badge className="ms-auto bg-slate-100 text-slate-600">{g.list.length}</Badge>
            </div>
            <div className="space-y-1.5">
              {g.list.map((i) => (
                <div
                  key={i.id}
                  className="group flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2"
                >
                  <div className="min-w-0">
                    {i.code && <span className="tnum text-xs text-brand-500">{i.code} · </span>}
                    <span className="text-sm text-brand-900">
                      {lang === 'en' && i.name_en ? i.name_en : i.name_ar}
                    </span>
                  </div>
                  <button
                    onClick={() => del(i.id)}
                    className="shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {!g.list.length && (
                <p className="py-4 text-center text-xs text-[var(--text-muted)]">—</p>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={lang === 'ar' ? 'مؤشر جديد' : 'New indicator'}>
        <div className="space-y-4">
          <Field label={lang === 'ar' ? 'النوع' : 'Kind'} required>
            <Select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as IndicatorKind })}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {lang === 'ar' ? KIND_LABEL[k].ar : KIND_LABEL[k].en}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={lang === 'ar' ? 'الرمز (اختياري)' : 'Code (optional)'}>
            <Input
              dir="ltr"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="KPI-1"
            />
          </Field>
          <Field label={lang === 'ar' ? 'الاسم (عربي)' : 'Name (Arabic)'} required>
            <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
          </Field>
          <Field label={lang === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)'}>
            <Input dir="ltr" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={create}>{t('common.save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
