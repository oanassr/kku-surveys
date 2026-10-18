import { useEffect, useState } from 'react'
import { Plus, Save, Sparkles, Trash2 } from 'lucide-react'
import { patchRow } from '@/lib/planOps'
import { LEVELS, type LevelKey, type PlanContext } from '@/lib/plans'
import { defaultPlanIntro } from '@/lib/planExport'
import { Button } from '@/components/ui'
import { Section, type TabProps } from './shared'

const MISSIONS: { key: LevelKey | 'program'; label: string }[] = [
  { key: 'university', label: 'رسالة الجامعة' },
  { key: 'college', label: 'رسالة الكلية' },
  { key: 'department', label: 'رسالة القسم' },
  { key: 'program', label: 'رسالة البرنامج' },
]

const area =
  'w-full rounded-xl border border-[var(--border)] bg-white p-3 text-sm leading-relaxed transition-colors ' +
  'focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]'

export default function ContextTab({ full, run }: TabProps) {
  const { plan, program } = full
  const [intro, setIntro] = useState(plan.intro ?? '')
  const [ctx, setCtx] = useState<PlanContext>(plan.context ?? {})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setIntro(plan.intro ?? '')
    setCtx(plan.context ?? {})
    setDirty(false)
  }, [plan.id])

  const touch = <T,>(fn: (c: PlanContext) => T) => {
    setCtx((c) => {
      const n: PlanContext = JSON.parse(JSON.stringify(c))
      fn(n)
      return n
    })
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    // نحذف الأهداف الفارغة قبل الحفظ حتى تبقى فهارس المواءمة متسقة
    const cleaned: PlanContext = JSON.parse(JSON.stringify(ctx))
    if (cleaned.lists)
      for (const k of Object.keys(cleaned.lists) as LevelKey[])
        cleaned.lists[k] = (cleaned.lists[k] ?? []).filter((x) => x.trim())
    await run(() => patchRow('op_plans', plan.id, { intro: intro.trim() || null, context: cleaned }))
    setCtx(cleaned)
    setSaving(false)
    setDirty(false)
  }

  async function toggleAlign(goalId: string, level: LevelKey, idx: number, cur: number[]) {
    const next = cur.includes(idx) ? cur.filter((x) => x !== idx) : [...cur, idx].sort((a, b) => a - b)
    const g = full.goals.find((x) => x.id === goalId)
    await run(() => patchRow('op_goals', goalId, { aligns: { ...(g?.aligns ?? {}), [level]: next } }))
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-2 z-20 flex items-center justify-between rounded-xl border border-[var(--border)] bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur">
        <span className={'text-sm ' + (dirty ? 'font-medium text-amber-700' : 'text-[var(--text-muted)]')}>
          {dirty ? 'لديك تعديلات غير محفوظة' : 'هذه البيانات تظهر في مقدمة تقرير Word'}
        </span>
        <Button size="sm" onClick={save} disabled={!dirty || saving}>
          <Save className="h-4 w-4" />
          {saving ? 'جارٍ الحفظ…' : 'حفظ'}
        </Button>
      </div>

      <Section
        title="مقدمة الخطة"
        action={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setIntro(defaultPlanIntro(program.name_ar))
              setDirty(true)
            }}
          >
            <Sparkles className="h-4 w-4" />
            استخدام نص مقترح
          </Button>
        }
      >
        <textarea
          value={intro}
          onChange={(e) => {
            setIntro(e.target.value)
            setDirty(true)
          }}
          rows={6}
          placeholder="اتركها فارغة لاستخدام النص المقترح تلقائيًا عند التصدير."
          className={area}
        />
      </Section>

      <Section title="الرسائل" hint="رسالة كل مستوى كما تُدرج في التقرير (اختيارية).">
        <div className="grid gap-3 md:grid-cols-2">
          {MISSIONS.map((m) => (
            <label key={m.key} className="block space-y-1.5">
              <span className="text-sm font-medium text-brand-900">{m.label}</span>
              <textarea
                rows={4}
                value={ctx.missions?.[m.key] ?? ''}
                onChange={(e) => touch((c) => ((c.missions ??= {})[m.key] = e.target.value))}
                className={area}
              />
            </label>
          ))}
        </div>
      </Section>

      <Section title="أهداف المستويات الأعلى" hint="أدخل أهداف الجامعة والكلية والقسم لتظهر في مصفوفات المواءمة مع أهداف البرنامج.">
        <div className="grid gap-4 lg:grid-cols-3">
          {LEVELS.map((l) => {
            const items = ctx.lists?.[l.key] ?? []
            return (
              <div key={l.key} className="rounded-xl border border-[var(--border)] p-3">
                <div className="mb-2 text-sm font-semibold text-brand-900">أهداف {l.label}</div>
                <div className="space-y-1.5">
                  {items.map((t, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="tnum mt-2 text-xs font-bold text-gold-600">{i + 1}</span>
                      <textarea
                        rows={2}
                        value={t}
                        onChange={(e) => touch((c) => ((c.lists ??= {})[l.key] = items.map((x, j) => (j === i ? e.target.value : x))))}
                        className={area + ' !p-2 text-xs'}
                      />
                      <button
                        className="mt-1.5 text-slate-300 hover:text-red-500"
                        onClick={() => touch((c) => ((c.lists ??= {})[l.key] = items.filter((_, j) => j !== i)))}
                        aria-label="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    onClick={() => touch((c) => ((c.lists ??= {})[l.key] = [...items, '']))}
                  >
                    <Plus className="h-4 w-4" />
                    هدف
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {LEVELS.map((l) => {
        const lvGoals = plan.context?.lists?.[l.key] ?? []
        if (!lvGoals.length || !full.goals.length) return null
        return (
          <Section
            key={l.key}
            title={`مواءمة أهداف البرنامج مع أهداف ${l.label}`}
            hint="ضع علامة حيث يُسهم هدف البرنامج في تحقيق هدف المستوى الأعلى (احفظ الأهداف أعلاه أولًا لتظهر الأعمدة)."
          >
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="bg-brand-50/70 text-xs">
                    <th className="p-2.5 text-start font-medium text-[var(--text-muted)]">هدف البرنامج</th>
                    {lvGoals.map((t, i) => (
                      <th key={i} title={t} className="tnum w-12 p-2.5 text-center font-semibold text-brand-800">
                        {i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {full.goals.map((g) => {
                    const cur = g.aligns?.[l.key] ?? []
                    return (
                      <tr key={g.id} className="border-t border-[var(--border)]">
                        <td className="p-2.5 text-xs leading-relaxed">{g.text_ar}</td>
                        {lvGoals.map((_, i) => (
                          <td key={i} className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={cur.includes(i)}
                              onChange={() => toggleAlign(g.id, l.key, i, cur)}
                              className="h-4 w-4 accent-[var(--color-brand-700)]"
                            />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <ol className="mt-2 list-inside space-y-0.5 text-xs text-[var(--text-muted)]">
              {lvGoals.map((t, i) => (
                <li key={i}>
                  <b className="tnum text-brand-700">{i + 1}.</b> {t}
                </li>
              ))}
            </ol>
          </Section>
        )
      })}
    </div>
  )
}
