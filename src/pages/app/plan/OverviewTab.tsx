import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { AlertTriangle, CheckCircle2, Database } from 'lucide-react'
import {
  STATUS_META,
  computeStats,
  goalKpiIds,
  kpiStatus,
  parseNum,
  type KpiStatus,
} from '@/lib/plans'
import { Card } from '@/components/ui'
import { Section, StatPill, type TabProps } from './shared'

const ORDER: KpiStatus[] = ['achieved', 'below', 'nodata', 'na']

export default function OverviewTab({ full }: TabProps) {
  const st = computeStats(full)
  const pie = ORDER.map((k) => ({ key: k, name: STATUS_META[k].label, value: st[k], color: STATUS_META[k].color })).filter(
    (d) => d.value > 0,
  )
  const measurable = st.achieved + st.below
  const rate = measurable ? Math.round((st.achieved / measurable) * 100) : null

  const goalRows = full.goals.map((g, i) => {
    const ids = goalKpiIds(g)
    const c: Record<KpiStatus, number> = { achieved: 0, below: 0, nodata: 0, na: 0 }
    ids.forEach((id) => c[kpiStatus(full.kpis.get(id), full.values.get(id))]++)
    return { g, i, ids, c }
  })

  // مؤشرات دون المستهدف (فريدة) مع أرقام الأهداف التي تستخدمها
  const laggingMap = new Map<string, { id: string; goals: number[] }>()
  goalRows.forEach(({ i, ids }) =>
    ids.forEach((id) => {
      if (kpiStatus(full.kpis.get(id), full.values.get(id)) !== 'below') return
      const e = laggingMap.get(id) ?? { id, goals: [] }
      e.goals.push(i + 1)
      laggingMap.set(id, e)
    }),
  )
  const lagging = [...laggingMap.values()].map((e) => ({ ...e, k: full.kpis.get(e.id), v: full.values.get(e.id) }))

  if (!full.goals.length)
    return (
      <Section title="نظرة عامة">
        <p className="py-10 text-center text-sm text-[var(--text-muted)]">
          ابدأ ببناء الخطة من تبويب «الهيكل»: أضف أهداف البرنامج ثم المبادرات والأنشطة ومؤشرات القياس.
        </p>
      </Section>
    )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatPill label="الأهداف" value={st.goals} />
        <StatPill label="المبادرات" value={st.initiatives} />
        <StatPill label="الأنشطة" value={st.activities} />
        <StatPill label="مؤشرات الأداء" value={st.kpis} />
        <StatPill label="مغذّاة من الاستطلاعات" value={st.surveyFed} color="var(--color-brand-500)" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="mb-1 text-sm font-semibold text-brand-900">تحقق المستهدفات</div>
          <div className="relative h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="none">
                  {pie.map((d) => (
                    <Cell key={d.key} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, direction: 'rtl' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="tnum text-3xl font-bold text-brand-800">{rate == null ? '—' : `${rate}%`}</div>
                <div className="text-[11px] text-[var(--text-muted)]">من المؤشرات المقيسة</div>
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
            {ORDER.map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5 text-[var(--text-muted)]">
                <i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_META[k].color }} />
                {STATUS_META[k].label} <b className="tnum text-[var(--text)]">{st[k]}</b>
              </span>
            ))}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 text-sm font-semibold text-brand-900">الأداء بحسب الأهداف</div>
          <div className="space-y-3.5">
            {goalRows.map(({ g, i, ids, c }) => (
              <div key={g.id}>
                <div className="mb-1 flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 text-brand-900">
                    <b className="tnum text-gold-600">{i + 1}.</b> {g.text_ar}
                  </span>
                  <span className="tnum shrink-0 text-xs text-[var(--text-muted)]">{ids.length} مؤشر</span>
                </div>
                <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                  {ORDER.map((k) =>
                    c[k] ? (
                      <div
                        key={k}
                        title={`${STATUS_META[k].label}: ${c[k]}`}
                        style={{ width: `${(c[k] / Math.max(1, ids.length)) * 100}%`, backgroundColor: STATUS_META[k].color }}
                      />
                    ) : null,
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="مؤشرات دون المستهدف" hint="تحتاج إلى تدخل أو مراجعة المستهدف">
          {lagging.length ? (
            <ul className="space-y-2">
              {lagging.map(({ id, goals, k, v }) => {
                const gap = (parseNum(v?.actual) ?? 0) - (parseNum(v?.target) ?? 0)
                return (
                  <li key={id} className="flex items-start gap-2.5 rounded-xl bg-red-50/60 px-3 py-2 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <div className="min-w-0 flex-1">
                      <div className="text-brand-900">
                        <span className="tnum text-xs font-semibold text-brand-600">{k?.code}</span> · {k?.name_ar}
                      </div>
                      <div className="tnum text-xs text-[var(--text-muted)]">
                        الفعلي {v?.actual} مقابل المستهدف {v?.target}{' '}
                        <b className="text-red-600">({gap > 0 ? '+' : ''}{Math.round(gap * 100) / 100})</b>
                      </div>
                    </div>
                    <span className="tnum shrink-0 text-xs text-[var(--text-muted)]">
                      {goals.length > 1 ? 'الأهداف' : 'هدف'} {goals.join('، ')}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="flex items-center gap-2 py-6 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              لا توجد مؤشرات دون مستهدفها حاليًا.
            </p>
          )}
        </Section>

        <Section title="مصادر القيم" hint="المؤشرات المغذّاة مباشرة من نتائج الاستطلاعات مقابل المدخلة يدويًا">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <Database className="h-6 w-6" />
            </div>
            <div className="text-sm leading-relaxed text-[var(--text-muted)]">
              <b className="tnum text-xl text-brand-800">{st.surveyFed}</b> من أصل{' '}
              <b className="tnum text-brand-800">{st.kpis}</b> مؤشرًا تُحسب قيمتها الفعلية مباشرةً من استطلاعات الرأي،
              والباقي يُدخل يدويًا من تبويب «قيم المؤشرات».
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
