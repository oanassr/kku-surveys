import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, FileDown, Gauge, LayoutDashboard, ListTree, Scale, X } from 'lucide-react'
import { patchRow } from '@/lib/planOps'
import {
  fetchPlanFull,
  fetchProgramKpis,
  isMissingTables,
  type KpiValue,
  type PlanFull,
} from '@/lib/plans'
import type { Indicator } from '@/lib/types'
import { Badge, PageLoader, Select } from '@/components/ui'
import { PageHeader } from './AppLayout'
import { InlineText, type TabProps } from './plan/shared'
import { PatchNotice } from './PlansList'
import OverviewTab from './plan/OverviewTab'
import StructureTab from './plan/StructureTab'
import ValuesTab from './plan/ValuesTab'
import ContextTab from './plan/ContextTab'
import ReportTab from './plan/ReportTab'

const TABS = [
  { key: 'overview', label: 'نظرة عامة', icon: LayoutDashboard },
  { key: 'structure', label: 'الهيكل', icon: ListTree },
  { key: 'values', label: 'قيم المؤشرات', icon: Gauge },
  { key: 'context', label: 'الإطار والمواءمة', icon: Scale },
  { key: 'report', label: 'التقرير والتصدير', icon: FileDown },
] as const
type TabKey = (typeof TABS)[number]['key']

function friendly(msg: string) {
  if (/row-level security|42501/i.test(msg)) return 'لا تملك صلاحية التعديل على هذه الخطة.'
  return `تعذّر الحفظ: ${msg}`
}

export default function PlanEditor() {
  const { planId = '' } = useParams()
  const [sp, setSp] = useSearchParams()
  const tab = (TABS.find((t) => t.key === sp.get('tab'))?.key ?? 'overview') as TabKey

  const [full, setFull] = useState<PlanFull | null>(null)
  const [programKpis, setProgramKpis] = useState<Indicator[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const { data, error } = await fetchPlanFull(planId)
    if (error && isMissingTables(error)) setMissing(true)
    setFull(data)
    if (data) setProgramKpis(await fetchProgramKpis(data.plan.program_id))
    setLoading(false)
  }, [planId])
  useEffect(() => {
    setLoading(true)
    reload()
  }, [reload])

  const refreshKpis = useCallback(async () => {
    if (full) setProgramKpis(await fetchProgramKpis(full.plan.program_id))
  }, [full])

  const run: TabProps['run'] = async (op, opts) => {
    setErr(null)
    const e = await op()
    if (e) {
      setErr(friendly(e))
      return false
    }
    if (opts?.reload !== false) await reload()
    return true
  }

  const patchValue: TabProps['patchValue'] = (id, patch) =>
    setFull((prev) => {
      if (!prev) return prev
      const cur: KpiValue = prev.values.get(id) ?? {
        plan_id: prev.plan.id,
        indicator_id: id,
        actual: null,
        benchmark: null,
        target: null,
        new_target: null,
        source: 'manual',
        run_id: null,
        narrative: null,
      }
      const values = new Map(prev.values)
      values.set(id, { ...cur, ...patch })
      return { ...prev, values }
    })

  if (loading) return <PageLoader />
  if (missing) return <PatchNotice />
  if (!full)
    return (
      <div className="p-10 text-center text-[var(--text-muted)]">
        الخطة غير موجودة أو لا تملك صلاحية عرضها.
        <div className="mt-3">
          <Link to="/app/plans" className="text-brand-700 underline">
            العودة إلى الخطط
          </Link>
        </div>
      </div>
    )

  const props: TabProps = { full, reload, run, patchValue }

  return (
    <div className="animate-fade-up">
      <Link to="/app/plans" className="mb-4 inline-flex items-center gap-1 text-sm text-brand-700 hover:text-brand-900">
        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        الخطط التشغيلية
      </Link>

      <PageHeader
        title={full.program.name_ar}
        subtitle={[full.program.department?.college?.name_ar, full.program.department?.name_ar].filter(Boolean).join(' · ')}
        icon={<ListTree className="h-5 w-5" />}
        action={
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">حالة الخطة</span>
            <Select
              value={full.plan.status}
              onChange={(e) => run(() => patchRow('op_plans', full.plan.id, { status: e.target.value }))}
              className="h-9 w-32 text-sm"
            >
              <option value="draft">مسودة</option>
              <option value="final">معتمدة</option>
            </Select>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)]">عام الخطة</span>
          <InlineText
            dir="ltr"
            value={full.plan.year_label}
            onSave={(v) => v && run(() => patchRow('op_plans', full.plan.id, { year_label: v }))}
            className="tnum w-28 text-center font-semibold"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)]">عام المستهدفات الجديدة</span>
          <InlineText
            dir="ltr"
            value={full.plan.target_year_label}
            onSave={(v) => run(() => patchRow('op_plans', full.plan.id, { target_year_label: v || null }))}
            className="tnum w-28 text-center font-semibold"
          />
        </div>
        <Badge className="ms-auto bg-brand-50 text-brand-700">{full.plan.status === 'final' ? 'معتمدة' : 'مسودة'}</Badge>
      </div>

      {err && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{err}</span>
          <button onClick={() => setErr(null)} aria-label="إغلاق">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mb-5 flex gap-1.5 overflow-x-auto rounded-2xl border border-[var(--border)] bg-white p-1.5 shadow-sm">
        {TABS.map((t) => {
          const Ic = t.icon
          const on = t.key === tab
          return (
            <button
              key={t.key}
              onClick={() => setSp({ tab: t.key }, { replace: true })}
              className={
                'flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ' +
                (on ? 'bg-brand-800 text-white shadow-sm' : 'text-[var(--text-muted)] hover:bg-brand-50 hover:text-brand-800')
              }
            >
              <Ic className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'overview' && <OverviewTab {...props} />}
      {tab === 'structure' && <StructureTab {...props} programKpis={programKpis} refreshKpis={refreshKpis} />}
      {tab === 'values' && <ValuesTab {...props} />}
      {tab === 'context' && <ContextTab {...props} />}
      {tab === 'report' && <ReportTab {...props} />}
    </div>
  )
}
