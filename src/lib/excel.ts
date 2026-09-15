import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export interface ParsedAxis {
  title_ar: string
  title_en: string | null
  questions: { text_ar: string; text_en: string | null }[]
}

const HEADERS = ['المحور', 'الفقرة', 'المحور (EN)', 'الفقرة (EN)']

/** يولّد قالب إكسل فارغًا مع أمثلة توضيحية. */
export function downloadSurveyTemplate() {
  const rows = [
    HEADERS,
    ['محور جودة إدارة البرنامج', 'تعمل إدارة البرنامج على توفير بيئة أكاديمية داعمة', 'Program Management', 'The program provides a supportive academic environment'],
    ['محور جودة إدارة البرنامج', 'تطبق إدارة البرنامج آليات تضمن النزاهة والعدالة', 'Program Management', 'The program applies fairness mechanisms'],
    ['محور الإرشاد الأكاديمي', 'المرشد الأكاديمي متواجد حين أحتاجه', 'Academic Advising', 'My academic advisor is available when needed'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 30 }, { wch: 55 }, { wch: 24 }, { wch: 45 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'الاستطلاع')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([out], { type: 'application/octet-stream' }), 'قالب_استطلاع.xlsx')
}

/** يحلّل ملف إكسل وفق القالب إلى محاور وفقرات مرتبة. */
export async function parseSurveyWorkbook(file: File): Promise<ParsedAxis[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false })

  const order: string[] = []
  const map = new Map<string, ParsedAxis>()

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || []
    const axisAr = String(r[0] ?? '').trim()
    const qAr = String(r[1] ?? '').trim()
    // تخطّي صف العناوين
    if (i === 0 && (axisAr === 'المحور' || qAr === 'الفقرة')) continue
    if (!axisAr && !qAr) continue

    const axisEn = String(r[2] ?? '').trim() || null
    const qEn = String(r[3] ?? '').trim() || null

    if (axisAr) {
      if (!map.has(axisAr)) {
        map.set(axisAr, { title_ar: axisAr, title_en: axisEn, questions: [] })
        order.push(axisAr)
      }
      if (qAr) map.get(axisAr)!.questions.push({ text_ar: qAr, text_en: qEn })
    }
  }
  return order.map((k) => map.get(k)!).filter((a) => a.questions.length > 0)
}
