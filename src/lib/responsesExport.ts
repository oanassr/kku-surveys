// تصدير استجابات نشر استطلاع إلى Excel (متاح بعد انتهاء فترة النشر)
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { computeReport, loadRunData } from './report'
import { isLikert, type SurveyRun } from './types'

/** هل انتهت فترة النشر؟ (أُغلق يدويًا أو تجاوز تاريخ الإغلاق) */
export function runEnded(run: Pick<SurveyRun, 'status' | 'closes_at'>): boolean {
  return run.status === 'closed' || new Date(run.closes_at).getTime() < Date.now()
}

const campusAr = (c: string) => (c === 'male' ? 'مقر الطلاب' : c === 'female' ? 'مقر الطالبات' : '')
const stamp = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short', hour12: false })
const fileSafe = (s: string) => s.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim()

export async function exportResponsesXlsx(runId: string): Promise<{ ok: boolean; message?: string }> {
  const raw = await loadRunData(runId)
  if (!raw) return { ok: false, message: 'تعذّر تحميل بيانات النشر.' }
  const { run, survey, program, responses, answers, texts } = raw
  const rep = computeReport(raw)

  // ---------- 1) الاستجابات: صف لكل مجيب ----------
  const cols = survey.axes.flatMap((ax) =>
    ax.questions.map((q) => ({ q, header: `${ax.title_ar} — ${q.text_ar}` })),
  )
  const ansMap = new Map<string, number>()
  for (const a of answers) ansMap.set(`${a.response_id}|${a.question_id}`, a.value)
  const txtMap = new Map<string, string>()
  for (const t of texts) txtMap.set(`${t.response_id}|${t.question_id}`, t.text_value)

  const head = ['م', 'تاريخ الإرسال', 'المقر', ...cols.map((c) => c.header)]
  const body = responses.map((r, i) => [
    i + 1,
    stamp(r.submitted_at),
    campusAr(r.campus),
    ...cols.map(({ q }) => {
      const k = `${r.id}|${q.id}`
      return isLikert(q) ? (ansMap.get(k) ?? '') : (txtMap.get(k) ?? '')
    }),
  ])
  const ws1 = XLSX.utils.aoa_to_sheet([head, ...body])
  ws1['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 14 }, ...cols.map((c) => ({ wch: isLikert(c.q) ? 22 : 40 }))]
  ws1['!freeze'] = { xSplit: 3, ySplit: 1 } as never

  // ---------- 2) الملخص الإحصائي ----------
  const counts = new Map<string, number>()
  for (const a of answers) counts.set(a.question_id, (counts.get(a.question_id) ?? 0) + 1)
  const sum: (string | number)[][] = [
    ['المحور', 'الفقرة', 'متوسط الذكور', 'متوسط الإناث', 'المتوسط العام', 'النسبة المئوية %', 'مستوى التقدير', 'عدد الإجابات'],
  ]
  const num = (n: number | null) => (n == null ? '' : Math.round(n * 100) / 100)
  rep.axes.forEach((ax) => {
    ax.questions.forEach((q) =>
      sum.push([ax.title_ar, q.text_ar, num(q.meanMale), num(q.meanFemale), num(q.meanAll), q.percentAll ?? '', q.band?.labelAr ?? '', counts.get(q.id) ?? 0]),
    )
    sum.push([ax.title_ar, '◄ متوسط المحور', '', '', num(ax.meanAll), ax.percentAll ?? '', ax.band?.labelAr ?? '', ''])
  })
  sum.push(['', 'المتوسط العام للاستطلاع', '', '', num(rep.overallMean), rep.overallPercent ?? '', '', ''])
  const ws2 = XLSX.utils.aoa_to_sheet(sum)
  ws2['!cols'] = [{ wch: 28 }, { wch: 60 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 14 }, { wch: 16 }, { wch: 13 }]

  // ---------- 3) الإجابات المفتوحة ----------
  const openRows: (string | number)[][] = [['السؤال', 'المقر', 'تاريخ الإرسال', 'الإجابة']]
  rep.openAnswers.forEach((oq) =>
    oq.items.forEach((it) => openRows.push([oq.text_ar, campusAr(it.campus ?? ''), it.at ? stamp(it.at) : '', it.text])),
  )

  // ---------- 4) بيانات النشر ----------
  const info: (string | number)[][] = [
    ['الاستطلاع', survey.title_ar],
    ['البرنامج', program.name_ar],
    ['السنة', run.year],
    ['الفصل', run.term === 'annual' ? 'سنوي' : run.term],
    ['بداية الإتاحة', stamp(run.opens_at)],
    ['نهاية الإتاحة', stamp(run.closes_at)],
    ['إجمالي الاستجابات', rep.counts.total],
    ['مقر الطلاب', rep.counts.male],
    ['مقر الطالبات', rep.counts.female],
    ['تاريخ التصدير', stamp(new Date().toISOString())],
    ['ملاحظة', 'البيانات مجهولة الهوية: لا تُخزَّن أي بيانات تعريفية عن المجيب.'],
  ]
  const ws4 = XLSX.utils.aoa_to_sheet(info)
  ws4['!cols'] = [{ wch: 22 }, { wch: 60 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, 'الاستجابات')
  XLSX.utils.book_append_sheet(wb, ws2, 'الملخص')
  if (openRows.length > 1) {
    const ws3 = XLSX.utils.aoa_to_sheet(openRows)
    ws3['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 18 }, { wch: 90 }]
    XLSX.utils.book_append_sheet(wb, ws3, 'الإجابات المفتوحة')
  }
  XLSX.utils.book_append_sheet(wb, ws4, 'بيانات النشر')
  wb.Workbook = { Views: [{ RTL: true }] }

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const name = fileSafe(`استجابات ${survey.title_ar} - ${program.name_ar} - ${run.year}`)
  saveAs(new Blob([out], { type: 'application/octet-stream' }), `${name}.xlsx`)
  return { ok: true }
}
