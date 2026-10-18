import { useEffect, useState } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import { upsertValue } from '@/lib/planOps'
import { exportPlanDocx } from '@/lib/planExport'
import { generateNarrative, type GoalNode, type PlanFull } from '@/lib/plans'
import { Button } from '@/components/ui'
import { Section, type TabProps } from './shared'

function NarrativeBox({
  text,
  custom,
  onSave,
  onReset,
}: {
  text: string
  custom: boolean
  onSave: (v: string) => void
  onReset: () => void
}) {
  const [v, setV] = useState(text)
  useEffect(() => setV(text), [text])
  return (
    <div>
      <textarea
        rows={2}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v.trim() && v.trim() !== text.trim() && onSave(v.trim())}
        className="field-sizing-content min-h-16 w-full rounded-xl border border-[var(--border)] bg-white p-3 text-sm leading-relaxed focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
      {custom && (
        <button onClick={onReset} className="mt-1 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
          <RotateCcw className="h-3 w-3" />
          إعادة التوليد الآلي من القيم
        </button>
      )}
    </div>
  )
}

/** معاينة جدول الخطة كما سيظهر في Word (مع دمج الخلايا). */
function PlanTablePreview({ full, g }: { full: PlanFull; g: GoalNode }) {
  const val = (id: string, f: 'actual' | 'benchmark' | 'target' | 'new_target') => full.values.get(id)?.[f] ?? ''
  const rows: React.ReactNode[] = []
  g.initiatives.forEach((ini) => {
    const total = ini.activities.reduce((n, a) => n + Math.max(1, a.kpiIds.length), 0) || 1
    let first = true
    const acts = ini.activities.length ? ini.activities : [null]
    acts.forEach((a) => {
      const ks = a && a.kpiIds.length ? a.kpiIds : [null]
      ks.forEach((kid, ki) => {
        const k = kid ? full.kpis.get(kid) : undefined
        rows.push(
          <tr key={`${ini.id}-${a?.id}-${kid ?? ki}`} className="border-t border-[var(--border)] align-middle">
            {first && (
              <td rowSpan={total} className="bg-brand-50/60 p-2 text-xs font-semibold text-brand-800">
                {ini.text_ar}
              </td>
            )}
            {ki === 0 && (
              <>
                <td rowSpan={ks.length} className="p-2 text-xs">{a?.text_ar}</td>
                <td rowSpan={ks.length} className="p-2 text-center text-xs">{a?.executor}</td>
              </>
            )}
            <td className="p-2 text-xs">{k?.name_ar}</td>
            <td className="tnum p-2 text-center text-[11px] font-semibold text-brand-700">{k?.code}</td>
            <td className="tnum p-2 text-center text-xs font-semibold">{kid ? val(kid, 'actual') : ''}</td>
            <td className="tnum p-2 text-center text-xs">{kid ? val(kid, 'benchmark') : ''}</td>
            <td className="tnum p-2 text-center text-xs">{kid ? val(kid, 'target') : ''}</td>
            <td className="tnum p-2 text-center text-xs font-semibold text-gold-600">{kid ? val(kid, 'new_target') : ''}</td>
            {ki === 0 && <td rowSpan={ks.length} className="p-2 text-center text-[11px] text-[var(--text-muted)]">{a?.budget}</td>}
          </tr>,
        )
        first = false
      })
    })
  })
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead>
          <tr className="bg-brand-800 text-xs text-white">
            {['المبادرات', 'الأنشطة والإجراءات', 'الجهة المنفذة', 'مؤشرات الأداء', 'الرمز', 'الفعلي', 'المرجعية', 'المستهدف', 'المستهدف الجديد', 'الميزانية'].map((h) => (
              <th key={h} className="p-2 text-center font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  )
}

export default function ReportTab({ full, run, patchValue }: TabProps) {
  const [exporting, setExporting] = useState(false)
  const target = full.plan.target_year_label

  async function save(id: string, narrative: string | null) {
    const ok = await run(() => upsertValue(full.plan.id, id, { narrative }), { reload: false })
    if (ok) patchValue(id, { narrative })
  }

  async function doExport() {
    setExporting(true)
    try {
      await exportPlanDocx(full)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-400/50 bg-gradient-to-l from-gold-400/10 to-white p-5">
        <div>
          <h3 className="font-semibold text-brand-900">تقرير الخطة التشغيلية (Word)</h3>
          <p className="mt-0.5 max-w-2xl text-sm text-[var(--text-muted)]">
            يضم الغلاف والمقدمة والرسائل والأهداف ومصفوفات المواءمة، ثم لكل هدف: جدول الخطة، والتقرير التفصيلي لكل مؤشر،
            وجدول طرق الحساب. الملف الناتج قابل للتعديل بالكامل.
          </p>
        </div>
        <Button variant="gold" size="lg" onClick={doExport} disabled={exporting || !full.goals.length}>
          <Download className="h-5 w-5" />
          {exporting ? 'جارٍ التصدير…' : 'تصدير Word'}
        </Button>
      </div>

      {full.goals.map((g, gi) => (
        <Section
          key={g.id}
          title={`الهدف ${gi + 1}`}
          hint={g.text_ar}
        >
          <div className="mb-2 text-xs font-semibold text-brand-700">جدول الخطة التشغيلية</div>
          <PlanTablePreview full={full} g={g} />

          <div className="mb-2 mt-5 text-xs font-semibold text-brand-700">
            التقرير التفصيلي للمؤشرات (يُولَّد آليًا من القيم ويمكنك تعديل أي فقرة)
          </div>
          <div className="space-y-4">
            {g.initiatives.map((ini, ii) => {
              const ids: string[] = []
              ini.activities.forEach((a) => a.kpiIds.forEach((k) => !ids.includes(k) && ids.push(k)))
              if (!ids.length) return null
              return (
                <div key={ini.id}>
                  <div className="mb-2 text-sm font-semibold text-brand-800">
                    مبادرة {ii + 1}: {ini.text_ar}
                  </div>
                  <div className="space-y-3">
                    {ids.map((id) => {
                      const k = full.kpis.get(id)
                      if (!k) return null
                      const v = full.values.get(id)
                      const auto = generateNarrative(k, v, target)
                      const custom = !!v?.narrative?.trim()
                      return (
                        <div key={id}>
                          <div className="mb-1 text-sm text-brand-900">
                            <span className="tnum text-xs font-semibold text-brand-600">{k.code}</span> · {k.name_ar}
                          </div>
                          <NarrativeBox
                            text={custom ? (v?.narrative as string) : auto}
                            custom={custom}
                            onSave={(t) => save(id, t === auto ? null : t)}
                            onReset={() => save(id, null)}
                          />
                        </div>
                      )
                    })}
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
