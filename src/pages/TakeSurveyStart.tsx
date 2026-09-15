import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, ChevronLeft } from 'lucide-react'
import { supabase, supabaseReady } from '@/lib/supabase'
import { useLang } from '@/i18n'
import type { College, Department, DegreeLevel, Program, SurveyRun, SurveyTemplate } from '@/lib/types'
import { PublicHeader } from '@/components/PublicHeader'
import { SetupNotice } from '@/components/SetupNotice'
import { Button, Card, Container, Field, PageLoader, Select } from '@/components/ui'

interface OpenRun extends SurveyRun {
  survey: Pick<SurveyTemplate, 'title_ar' | 'title_en' | 'audience'>
}

const DEGREES: DegreeLevel[] = ['bachelor', 'master', 'phd']

export default function TakeSurveyStart() {
  const { t, lang } = useLang()
  const nm = (o: { name_ar: string; name_en: string | null }) =>
    lang === 'en' && o.name_en ? o.name_en : o.name_ar

  const [colleges, setColleges] = useState<College[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)

  const [college, setCollege] = useState('')
  const [department, setDepartment] = useState('')
  const [degree, setDegree] = useState<DegreeLevel | ''>('')
  const [program, setProgram] = useState('')

  const [runs, setRuns] = useState<OpenRun[] | null>(null)
  const [runsLoading, setRunsLoading] = useState(false)

  useEffect(() => {
    if (!supabaseReady) {
      setLoading(false)
      return
    }
    supabase
      .from('colleges')
      .select('*')
      .order('name_ar')
      .then(({ data }) => {
        setColleges((data as College[]) ?? [])
        setLoading(false)
      })
  }, [])

  // load departments when college changes
  useEffect(() => {
    setDepartment('')
    setDepartments([])
    if (!college) return
    supabase
      .from('departments')
      .select('*')
      .eq('college_id', college)
      .order('name_ar')
      .then(({ data }) => setDepartments((data as Department[]) ?? []))
  }, [college])

  // load programs when department/degree changes
  useEffect(() => {
    setProgram('')
    setPrograms([])
    setRuns(null)
    if (!department || !degree) return
    supabase
      .from('programs')
      .select('*')
      .eq('department_id', department)
      .eq('degree', degree)
      .order('name_ar')
      .then(({ data }) => setPrograms((data as Program[]) ?? []))
  }, [department, degree])

  // load open runs when program chosen
  useEffect(() => {
    setRuns(null)
    if (!program) return
    setRunsLoading(true)
    const nowIso = new Date().toISOString()
    supabase
      .from('survey_runs')
      .select('*, survey:survey_templates(title_ar,title_en,audience)')
      .eq('program_id', program)
      .eq('status', 'open')
      .lte('opens_at', nowIso)
      .gte('closes_at', nowIso)
      .then(({ data }) => {
        setRuns((data as unknown as OpenRun[]) ?? [])
        setRunsLoading(false)
      })
  }, [program])

  if (!supabaseReady) {
    return (
      <div className="min-h-full">
        <PublicHeader />
        <Container className="py-16">
          <SetupNotice />
        </Container>
      </div>
    )
  }

  return (
    <div className="min-h-full">
      <PublicHeader />
      <Container className="py-10 md:py-14">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-brand-950">{t('take.pickTitle')}</h1>
            <p className="mt-2 text-[var(--text-muted)]">{t('take.pickSub')}</p>
          </div>

          {loading ? (
            <PageLoader label={t('common.loading')} />
          ) : (
            <Card className="p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('common.college')} required>
                  <Select value={college} onChange={(e) => setCollege(e.target.value)}>
                    <option value="">—</option>
                    {colleges.map((c) => (
                      <option key={c.id} value={c.id}>
                        {nm(c)}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label={t('common.department')} required>
                  <Select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    disabled={!college}
                  >
                    <option value="">—</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {nm(d)}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label={t('common.degree')} required>
                  <Select
                    value={degree}
                    onChange={(e) => setDegree(e.target.value as DegreeLevel)}
                    disabled={!department}
                  >
                    <option value="">—</option>
                    {DEGREES.map((d) => (
                      <option key={d} value={d}>
                        {t(`degree.${d}`)}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label={t('common.program')} required>
                  <Select
                    value={program}
                    onChange={(e) => setProgram(e.target.value)}
                    disabled={!degree}
                  >
                    <option value="">—</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {nm(p)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Card>
          )}

          {/* Available surveys */}
          {program && (
            <div className="mt-8">
              <h2 className="mb-3 text-lg font-semibold text-brand-900">
                {t('take.available')}
              </h2>
              {runsLoading ? (
                <PageLoader />
              ) : runs && runs.length > 0 ? (
                <div className="space-y-3">
                  {runs.map((r) => (
                    <Link key={r.id} to={`/r/${r.access_token}`}>
                      <Card className="flex items-center justify-between p-5 transition-all hover:border-brand-300 hover:shadow-md">
                        <div>
                          <div className="font-semibold text-brand-900">
                            {lang === 'en' && r.survey.title_en
                              ? r.survey.title_en
                              : r.survey.title_ar}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                            <CalendarClock className="h-3.5 w-3.5" />
                            {t('common.to')}{' '}
                            {new Date(r.closes_at).toLocaleDateString(
                              lang === 'ar' ? 'ar-SA' : 'en-GB',
                            )}
                          </div>
                        </div>
                        <ChevronLeft className="h-5 w-5 text-brand-400 ltr:rotate-180" />
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center text-[var(--text-muted)]">
                  {t('take.none')}
                </Card>
              )}
            </div>
          )}

          <div className="mt-8 text-center">
            <Link to="/">
              <Button variant="ghost" size="sm">
                {t('nav.home')}
              </Button>
            </Link>
          </div>
        </div>
      </Container>
    </div>
  )
}
