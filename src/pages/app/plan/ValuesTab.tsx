import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Database, Hand, Info } from 'lucide-react'
import { upsertValue } from '@/lib/planOps'
import {
  STATUS_META,
  fmtVal,
  kpiStatus,
  listRunsForKpi,
  measureFromRuns,
  type KpiRunOption,
  type KpiValue,
} from '@/lib/plans'
import type { Indicator } from '@/lib/types'
import { Badge, Select } from '@/components/ui'
import { Section, type TabProps } from './shared'

type Field = 'actual' | 'benchmark' | 'target' | 'new_target'

function ValueCell({
  value,
  onSave,
  disabled,
  highlight,
}: {
  value: string | null | undefined
  onSave: (v: string) => void
  disabled?: boolean
  highlight?: boolean
}) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => setV(value ?? ''), [value])
  return (
    <input
      value={v}
      disabled={disabled}
      dir="ltr"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() !== (value ?? '').trim() && onSave(v.trim())}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className={
        'tnum h-9 w-24 rounded-lg border border-[var(--border)] bg-white px-2 text-center text-sm transition-colors ' +
        'focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:bg-brand-50 disabled:font-semibold disabled:text-brand-800 ' +
        (highlight ? 'border-gold-400/70 bg-gold-400/5' : '')
      }
    />
  )
}

export default function ValuesTab({ full, run, patchValue }: TabProps) {
  const planId = full.plan.id
  const synced = useRef(false)

  async function save(id: string, patch: Partial<KpiValue>) {
    const ok = await run(() => upsertValue(planId, id, patch), { reload: false })
    if (ok) patchValue(id, patch)
  }

  // مزامنة القيم المرتبطة بالاستطلاعات عند فتح التبويب (تغذية مباشرة)
  useEffect(() => {
    if (synced.current) return
    synced.current = true
    const reqs = [...full.values.values()]
      .filter((v) => v.source === 'survey' && v.run_id)
      .map((v) => ({ indicatorId: v.indicator_id, runId: v.run_id as string }))
    if (!reqs.length) return
    measureFromRuns(reqs).then((res) => {
      for (const r of reqs) {
        const m = res.get(`${r.indicatorId}|${r.runId}`)
        const next = m?.mean != null ? fmtVal(m.mean) : null
        const cur = full.values.get(r.indicatorId)?.actual ?? null
        if (next != null && next !== cur) save(r.indicatorId, { actual: next })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasKpis = full.goals.some((g) => g.initiatives.some((i) => i.activities.some((a) => a.kpiIds.length)))
  if (!hasKpis)
    return (
      <Section title="قيم المؤشرات">
        <p className="py-8 text-center text-sm text-[var(--text-muted)]">
          اربط مؤشرات الأداء بأنشطة الخطة من تبويب «الهيكل» أولًا، ثم أدخل قيمها هنا.
        </p>
      </Section>
    )

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-brand-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          أدخل <b>الأداء الفعلي</b> والمرجعية الداخلية والمستهدف والمستهدف الجديد. المؤشرات «من استطلاع» يمكن تغذيتها
          مباشرةً من نتائج نشر استطلاع (تُحدَّث القيمة تلقائيًا عند فتح الصفحة)، وتبقى القيم النصية مثل 1:6.7 مسموحة.
        </p>
      </div>

      {full.goals.map((g, gi) => (
        <Section key={g.id} title={`الهدف ${gi + 1}`} hint={g.text_ar}>
          <div className="space-y-4">
            {g.initiatives.map((ini, ii) => {
              const ids: string[] = []
              ini.activities.forEach((a) => a.kpiIds.forEach((k) => !ids.includes(k) && ids.push(k)))
              if (!ids.length) return null
              return (
                <div key={ini.id}>
                  <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-brand-800">
                    <Badge className="bg-gold-400/20 text-gold-600">مبادرة {ii + 1}</Badge>
                    {ini.text_ar}
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                    <table className="w-full min-w-[820px] text-sm">
                      <thead>
                        <tr className="bg-brand-50/70 text-xs text-[var(--text-muted)]">
                          <th className="p-2.5 text-start font-medium">المؤشر</th>
                          <th className="p-2.5 text-center font-medium">الأداء الفعلي</th>
                          <th className="p-2.5 text-center font-medium">المرجعية الداخلية</th>
                          <th className="p-2.5 text-center font-medium">المستهدف</th>
                          <th className="p-2.5 text-center font-medium">المستهدف الجديد</th>
                          <th className="p-2.5 text-center font-medium">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ids.map((id) => {
                          const k = full.kpis.get(id)
                          if (!k) return null
                          return (
                            <KpiRow
                              key={id}
                              k={k}
                              v={full.values.get(id)}
                              programId={full.program.id}
                              save={(p) => save(id, p)}
                            />
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      ))}
    </div>
  )
}

function KpiRow({
  k,
  v,
  programId,
  save,
}: {
  k: Indicator
  v: KpiValue | undefined
  programId: string
  save: (p: Partial<KpiValue>) => void
}) {
  const surveyType = (k.measure_type ?? 'survey') === 'survey'
  const source = v?.source ?? 'manual'
  const [runs, setRuns] = useState<KpiRunOption[] | null>(null)
  const [loadingRuns, setLoadingRuns] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    if (source === 'survey' && runs == null && !loadingRuns) loadRuns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  async function loadRuns() {
    setLoadingRuns(true)
    setRuns(await listRunsForKpi(k.id, programId))
    setLoadingRuns(false)
  }

  async function chooseRun(runId: string) {
    if (!runId) return save({ run_id: null })
    setInfo('جارٍ الحساب…')
    const res = await measureFromRuns([{ indicatorId: k.id, runId }])
    const m = res.get(`${k.id}|${runId}`)
    if (!m || m.mean == null) {
      setInfo('لا توجد بيانات: اربط محاور/فقرات بهذا المؤشر من صفحة «المؤشرات» ثم أعد المحاولة.')
      return save({ run_id: runId })
    }
    setInfo(`من ${m.items} فقرات و${m.responses} استجابة`)
    save({ run_id: runId, source: 'survey', actual: fmtVal(m.mean) })
  }

  const st = kpiStatus(k, v)
  const meta = STATUS_META[st]
  const live = source === 'survey' && !!v?.run_id

  return (
    <tr className="border-t border-[var(--border)] align-top">
      <td className="max-w-md p-2.5">
        <div className="text-brand-900">
          <span className="tnum font-semibold text-brand-600">{k.code ?? '—'}</span> · {k.name_ar}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {surveyType ? (
            <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border)] text-xs">
              <button
                className={'flex items-center gap-1 px-2 py-1 ' + (source === 'manual' ? 'bg-brand-800 text-white' : 'bg-white text-[var(--text-muted)]')}
                onClick={() => save({ source: 'manual' })}
              >
                <Hand className="h-3 w-3" />
                يدوي
              </button>
              <button
                className={'flex items-center gap-1 px-2 py-1 ' + (source === 'survey' ? 'bg-brand-800 text-white' : 'bg-white text-[var(--text-muted)]')}
                onClick={() => {
                  save({ source: 'survey' })
                  if (runs == null) loadRuns()
                }}
              >
                <Database className="h-3 w-3" />
                من استطلاع
              </button>
            </div>
          ) : (
            <Badge className="bg-gold-400/15 text-gold-600">إدخال يدوي</Badge>
          )}
          {source === 'survey' && (
            <Select
              value={v?.run_id ?? ''}
              onChange={(e) => chooseRun(e.target.value)}
              className="h-8 max-w-[17rem] rounded-lg text-xs"
            >
              <option value="">{loadingRuns ? 'جارٍ التحميل…' : 'اختر نشر الاستطلاع…'}</option>
              {(runs ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          )}
        </div>
        {source === 'survey' && runs && !runs.length && (
          <p className="mt-1 text-xs text-amber-700">
            لا توجد نشرات لهذا البرنامج مرتبطة بالمؤشر.{' '}
            <Link to="/app/indicators" className="underline">
              اربط فقرات بالمؤشر
            </Link>
          </p>
        )}
        {info && source === 'survey' && <p className="mt-1 text-xs text-[var(--text-muted)]">{info}</p>}
      </td>
      <td className="p-2.5 text-center">
        <ValueCell value={v?.actual} onSave={(x) => save({ actual: x || null })} disabled={live} highlight />
        {live && <div className="mt-1 text-[10px] font-medium text-brand-600">مباشر من الاستطلاع</div>}
      </td>
      <td className="p-2.5 text-center">
        <ValueCell value={v?.benchmark} onSave={(x) => save({ benchmark: x || null })} />
      </td>
      <td className="p-2.5 text-center">
        <ValueCell value={v?.target} onSave={(x) => save({ target: x || null })} />
      </td>
      <td className="p-2.5 text-center">
        <ValueCell value={v?.new_target} onSave={(x) => save({ new_target: x || null })} />
      </td>
      <td className="p-2.5 text-center">
        <Badge color={meta.color}>{meta.label}</Badge>
      </td>
    </tr>
  )
}

export type { Field }
