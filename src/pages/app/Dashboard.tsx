import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FileBarChart, Filter, Send, Users2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/i18n'
import { bandFor, fmtMean, meanToPercent } from '@/lib/ratings'
import type { Campus } from '@/lib/types'
import { Badge, Button, Card, PageLoader, Select } from '@/components/ui'
import { PageHeader } from './AppLayout'

interface RunRow {
  id: string
  year: number
  status: string
  program_id: string
  survey_id: string
  survey: { id: string; title_ar: string } | null
  program: {
    id: string
    name_ar: string
    department_id: string
    department: {
      id: string
      name_ar: string
      college_id: string
      college: { id: string; name_ar: string } | null
    } | null
  } | null
}

interface RunAgg {
  run: RunRow
  total: number
  male: number
  female: number
  mean: number | null
}

export default function Dashboard() {
  const { t, lang } = useLang()
  const { profile, isAdmin, session } = useAuth()

  const [runs, setRuns] = useState<RunRow[]>([])
  const [aggs, setAggs] = useState<Record<string, RunAgg>>({})
  const [loading, setLoading] = useState(true)

  // filters
  const [college, setCollege] = useState('')
  const [department, setDepartment] = useState('')
  const [program, setProgram] = useState('')
  const [survey, setSurvey] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('survey_runs').select(
        `id, year, status, program_id, survey_id,
         survey:survey_templates(id,title_ar),
         program:programs(id,name_ar,department_id,
           department:departments(id,name_ar,college_id,
             college:colleges(id,name_ar)))`,
      )
      let list = (data as unknown as RunRow[]) ?? []

      // نطاق المنسّق: برامجه فقط
      if (!isAdmin && session?.user) {
        const { data: pc } = await supabase
          .from('program_coordinators')
          .select('program_id')
          .eq('user_id', session.user.id)
        const ids = new Set((pc ?? []).map((r: { program_id: string }) => r.program_id))
        list = list.filter((r) => ids.has(r.program_id))
      }
      setRuns(list)

      // احسب تجميع الاستجابات لكل نشر
      const runIds = list.map((r) => r.id)
      if (runIds.length) {
        const { data: resp } = await supabase
          .from('responses')
          .select('id, campus, run_id')
          .in('run_id', runIds)
        const respList = (resp as { id: string; campus: Campus; run_id: string }[]) ?? []
        const respRun = new Map(respList.map((x) => [x.id, x.run_id]))

        const answersByRun = new Map<string, number[]>()
        if (respList.length) {
          const { data: ans } = await supabase
            .from('answers')
            .select('value, response_id')
            .in(
              'response_id',
              respList.map((x) => x.id),
            )
          for (const a of (ans as { value: number; response_id: string }[]) ?? []) {
            const rid = respRun.get(a.response_id)
            if (!rid) continue
            if (!answersByRun.has(rid)) answersByRun.set(rid, [])
            answersByRun.get(rid)!.push(a.value)
          }
        }

        const map: Record<string, RunAgg> = {}
        for (const r of list) {
          const rResp = respList.filter((x) => x.run_id === r.id)
          const vals = answersByRun.get(r.id) ?? []
          map[r.id] = {
            run: r,
            total: rResp.length,
            male: rResp.filter((x) => x.campus === 'male').length,
            female: rResp.filter((x) => x.campus === 'female').length,
            mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
          }
        }
        setAggs(map)
      }
      setLoading(false)
    }
    load()
  }, [isAdmin, session])

  // خيارات الفلاتر مستمدة من النشرات المتاحة
  const colleges = useMemo(() => {
    const m = new Map<string, string>()
    runs.forEach((r) => r.program?.department?.college && m.set(r.program.department.college.id, r.program.department.college.name_ar))
    return [...m.entries()]
  }, [runs])
  const departments = useMemo(() => {
    const m = new Map<string, string>()
    runs
      .filter((r) => !college || r.program?.department?.college_id === college)
      .forEach((r) => r.program?.department && m.set(r.program.department.id, r.program.department.name_ar))
    return [...m.entries()]
  }, [runs, college])
  const programsOpt = useMemo(() => {
    const m = new Map<string, string>()
    runs
      .filter((r) => (!college || r.program?.department?.college_id === college) && (!department || r.program?.department_id === department))
      .forEach((r) => r.program && m.set(r.program.id, r.program.name_ar))
    return [...m.entries()]
  }, [runs, college, department])
  const surveysOpt = useMemo(() => {
    const m = new Map<string, string>()
    runs.forEach((r) => r.survey && m.set(r.survey.id, r.survey.title_ar))
    return [...m.entries()]
  }, [runs])

  const filtered = useMemo(
    () =>
      runs.filter(
        (r) =>
          (!college || r.program?.department?.college_id === college) &&
          (!department || r.program?.department_id === department) &&
          (!program || r.program_id === program) &&
          (!survey || r.survey_id === survey),
      ),
    [runs, college, department, program, survey],
  )

  const summary = useMemo(() => {
    let total = 0,
      male = 0,
      female = 0
    const means: number[] = []
    filtered.forEach((r) => {
      const a = aggs[r.id]
      if (!a) return
      total += a.total
      male += a.male
      female += a.female
      if (a.mean != null) means.push(a.mean)
    })
    const overall = means.length ? means.reduce((x, y) => x + y, 0) / means.length : null
    return { total, male, female, overall, runs: filtered.length }
  }, [filtered, aggs])

  if (loading) return <PageLoader label={t('common.loading')} />

  const chartData = filtered
    .map((r) => {
      const a = aggs[r.id]
      return {
        name: r.program?.name_ar?.slice(0, 14) ?? '—',
        full: `${r.survey?.title_ar ?? ''} — ${r.program?.name_ar ?? ''}`,
        value: a?.mean ?? 0,
        color: bandFor(a?.mean)?.color ?? '#cbd5e1',
      }
    })
    .filter((d) => d.value > 0)

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={`${t('nav.dashboard')} — ${profile?.full_name || ''}`}
        subtitle={isAdmin ? 'مدير النظام — كل البيانات' : 'منسّق برنامج — برامجك فقط'}
        icon={<FileBarChart className="h-5 w-5" />}
      />

      {/* Filters */}
      <Card className="mb-5 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-900">
          <Filter className="h-4 w-4" />
          {lang === 'ar' ? 'تصفية' : 'Filters'}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={college} onChange={(e) => { setCollege(e.target.value); setDepartment(''); setProgram('') }}>
            <option value="">{t('common.college')}: {t('common.all')}</option>
            {colleges.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </Select>
          <Select value={department} onChange={(e) => { setDepartment(e.target.value); setProgram('') }} disabled={!colleges.length}>
            <option value="">{t('common.department')}: {t('common.all')}</option>
            {departments.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </Select>
          <Select value={program} onChange={(e) => setProgram(e.target.value)}>
            <option value="">{t('common.program')}: {t('common.all')}</option>
            {programsOpt.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </Select>
          <Select value={survey} onChange={(e) => setSurvey(e.target.value)}>
            <option value="">{t('nav.surveys')}: {t('common.all')}</option>
            {surveysOpt.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </Select>
        </div>
      </Card>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Send className="h-5 w-5" />} label={t('nav.runs')} value={summary.runs} tone="var(--color-rate-5)" />
        <Stat icon={<FileBarChart className="h-5 w-5" />} label={t('common.responses')} value={summary.total} tone="var(--color-brand-600)" sub={`${t('common.male')}: ${summary.male} · ${t('common.female')}: ${summary.female}`} />
        <Stat icon={<Users2 className="h-5 w-5" />} label={t('common.male')} value={summary.male} tone="var(--color-rate-3)" />
        <Card className="p-5">
          <div className="text-sm text-[var(--text-muted)]">{lang === 'ar' ? 'المتوسط العام' : 'Overall avg'}</div>
          <div className="tnum mt-2 text-3xl font-bold" style={{ color: bandFor(summary.overall)?.color ?? '#0b3b6f' }}>
            {fmtMean(summary.overall)}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="tnum text-sm text-[var(--text-muted)]">{meanToPercent(summary.overall) ?? '—'}%</span>
            {bandFor(summary.overall) && <Badge color={bandFor(summary.overall)!.color}>{bandFor(summary.overall)!.labelAr}</Badge>}
          </div>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="mt-5 p-5">
          <div className="mb-3 text-sm font-semibold text-brand-900">
            {lang === 'ar' ? 'متوسط كل نشر' : 'Average per run'}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => fmtMean(Number(v))} labelFormatter={(l) => chartData.find((c) => c.name === l)?.full ?? ''} contentStyle={{ fontSize: 12, borderRadius: 12, direction: 'rtl' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((c, i) => <Cell key={i} fill={c.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Runs table */}
      <Card className="mt-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-slate-50/60 text-xs text-[var(--text-muted)]">
              <tr>
                <th className="p-3 text-start font-medium">{t('nav.surveys')}</th>
                <th className="p-3 text-start font-medium">{t('common.program')}</th>
                <th className="p-3 text-center font-medium">{t('common.responses')}</th>
                <th className="p-3 text-center font-medium">{t('common.average')}</th>
                <th className="p-3 text-center font-medium">{t('common.rating')}</th>
                <th className="p-3 text-center font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const a = aggs[r.id]
                const band = bandFor(a?.mean)
                return (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3 text-start font-medium text-brand-900">{r.survey?.title_ar}</td>
                    <td className="p-3 text-start text-[var(--text-muted)]">{r.program?.name_ar}</td>
                    <td className="tnum p-3 text-center">
                      {a?.total ?? 0}
                      <span className="text-xs text-[var(--text-muted)]"> ({a?.male ?? 0}/{a?.female ?? 0})</span>
                    </td>
                    <td className="tnum p-3 text-center font-semibold">{fmtMean(a?.mean)}</td>
                    <td className="p-3 text-center">
                      {band ? <Badge color={band.color}>{band.labelAr}</Badge> : '—'}
                    </td>
                    <td className="p-3 text-center">
                      <Link to={`/app/runs/${r.id}/report`}>
                        <Button size="sm" variant="outline">{t('nav.reports')}</Button>
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {!filtered.length && (
                <tr><td colSpan={6} className="p-10 text-center text-[var(--text-muted)]">
                  {lang === 'ar' ? 'لا توجد نشرات مطابقة.' : 'No matching runs.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Stat({ icon, label, value, tone, sub }: { icon: React.ReactNode; label: string; value: number; tone: string; sub?: string }) {
  return (
    <Card className="p-5">
      <div className="grid h-11 w-11 place-items-center rounded-xl" style={{ backgroundColor: `color-mix(in srgb, ${tone} 12%, white)`, color: tone }}>
        {icon}
      </div>
      <div className="tnum mt-4 text-3xl font-bold text-brand-950">{value}</div>
      <div className="mt-1 text-sm text-[var(--text-muted)]">{label}</div>
      {sub && <div className="tnum mt-1 text-xs text-[var(--text-muted)]">{sub}</div>}
    </Card>
  )
}
