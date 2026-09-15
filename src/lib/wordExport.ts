import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { saveAs } from 'file-saver'
import { fmtMean } from './ratings'
import type { AxisStat, QuestionStat, ReportData } from './report'

type Align = (typeof AlignmentType)[keyof typeof AlignmentType]

const BRAND = '0B3B6F'
const GOLD = 'E3A812'
const HEAD_BG = '0B3B6F'
const AXIS_BG = 'EEF5FD'

function P(text: string, opts: { bold?: boolean; color?: string; align?: Align; size?: number } = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: opts.align ?? AlignmentType.RIGHT,
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        color: opts.color,
        size: opts.size ?? 20,
        font: 'Arial',
        rightToLeft: true,
      }),
    ],
  })
}

function cell(text: string, opts: { bold?: boolean; color?: string; bg?: string; align?: Align; span?: number } = {}) {
  return new TableCell({
    columnSpan: opts.span,
    shading: opts.bg ? { fill: opts.bg, color: 'auto', type: 'clear' } : undefined,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children: [
      P(text, {
        bold: opts.bold,
        color: opts.color,
        align: opts.align ?? AlignmentType.CENTER,
        size: 18,
      }),
    ],
  })
}

const B = { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' }
const borders = { top: B, bottom: B, left: B, right: B, insideHorizontal: B, insideVertical: B }

function pct(n: number | null) {
  return n == null ? '—' : `${n}%`
}

function mainTable(data: ReportData, lang: 'ar' | 'en') {
  const rows: TableRow[] = []

  // header
  rows.push(
    new TableRow({
      tableHeader: true,
      children: [
        cell('العبارات', { bold: true, color: 'FFFFFF', bg: HEAD_BG }),
        cell('متوسط (ذكور)', { bold: true, color: 'FFFFFF', bg: HEAD_BG }),
        cell('متوسط (إناث)', { bold: true, color: 'FFFFFF', bg: HEAD_BG }),
        cell('نسبة (ذكور)', { bold: true, color: 'FFFFFF', bg: HEAD_BG }),
        cell('نسبة (إناث)', { bold: true, color: 'FFFFFF', bg: HEAD_BG }),
        cell('مستوى التقدير', { bold: true, color: 'FFFFFF', bg: HEAD_BG }),
        cell('التطوير المطلوب', { bold: true, color: 'FFFFFF', bg: HEAD_BG }),
      ],
    }),
  )

  for (const ax of data.axes) {
    rows.push(
      new TableRow({
        children: [cell(ax.title_ar, { bold: true, color: BRAND, bg: AXIS_BG, span: 7, align: AlignmentType.RIGHT })],
      }),
    )
    for (const q of ax.questions) {
      rows.push(
        new TableRow({
          children: [
            cell(q.text_ar, { align: AlignmentType.RIGHT }),
            cell(fmtMean(q.meanMale)),
            cell(fmtMean(q.meanFemale)),
            cell(pct(q.percentAll != null && q.meanMale != null ? q.percentAll : null)),
            cell(pct(q.percentAll != null && q.meanFemale != null ? q.percentAll : null)),
            cell(q.band?.labelAr ?? '—', { color: q.band ? undefined : '94A3B8' }),
            cell(q.needsDev ? '✔' : '', { color: GOLD, bold: true }),
          ],
        }),
      )
    }
  }
  void lang
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
    visuallyRightToLeft: true,
    rows,
  })
}

function summaryTable(data: ReportData) {
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        cell('م', { bold: true, color: 'FFFFFF', bg: HEAD_BG }),
        cell('المحور', { bold: true, color: 'FFFFFF', bg: HEAD_BG }),
        cell('المتوسط', { bold: true, color: 'FFFFFF', bg: HEAD_BG }),
        cell('النسبة المئوية', { bold: true, color: 'FFFFFF', bg: HEAD_BG }),
        cell('مستوى التقدير', { bold: true, color: 'FFFFFF', bg: HEAD_BG }),
      ],
    }),
  ]
  data.axes.forEach((ax: AxisStat, i: number) => {
    rows.push(
      new TableRow({
        children: [
          cell(String(i + 1)),
          cell(ax.title_ar, { align: AlignmentType.RIGHT }),
          cell(fmtMean(ax.meanAll)),
          cell(pct(ax.percentAll)),
          cell(ax.band?.labelAr ?? '—'),
        ],
      }),
    )
  })
  rows.push(
    new TableRow({
      children: [
        cell('', { bg: AXIS_BG }),
        cell('المتوسط العام', { bold: true, color: BRAND, bg: AXIS_BG, align: AlignmentType.RIGHT }),
        cell(fmtMean(data.overallMean), { bold: true, bg: AXIS_BG }),
        cell(pct(data.overallPercent), { bold: true, bg: AXIS_BG }),
        cell('', { bg: AXIS_BG }),
      ],
    }),
  )
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
    visuallyRightToLeft: true,
    rows,
  })
}

function bulletList(items: QuestionStat[]) {
  if (!items.length) return [P('—')]
  return items.map((q) =>
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      bullet: { level: 0 },
      children: [
        new TextRun({ text: q.text_ar, size: 20, font: 'Arial', rightToLeft: true }),
        new TextRun({ text: `  (${fmtMean(q.meanAll)})`, size: 18, color: BRAND, font: 'Arial' }),
      ],
    }),
  )
}

export async function exportReportDocx(
  data: ReportData,
  plan: { strengths?: string | null; weaknesses?: string | null; actions?: string | null } | null,
  lang: 'ar' | 'en' = 'ar',
) {
  const title = `تحليل نتائج ${data.survey.title_ar}`
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial' } } } },
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            bidirectional: true,
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: title, bold: true, size: 30, color: BRAND, font: 'Arial', rightToLeft: true })],
          }),
          new Paragraph({
            bidirectional: true,
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: data.program.name_ar, size: 24, color: GOLD, font: 'Arial', rightToLeft: true })],
          }),
          P(
            `السنة: ${data.run.year} · إجمالي الاستجابات: ${data.counts.total} (ذكور: ${data.counts.male}، إناث: ${data.counts.female})`,
            { align: AlignmentType.CENTER, size: 18, color: '5B6B82' },
          ),
          new Paragraph({ text: '' }),
          mainTable(data, lang),
          new Paragraph({ text: '' }),
          P('إجمالي التقييم حسب المحور', { bold: true, color: BRAND, size: 24 }),
          new Paragraph({ text: '' }),
          summaryTable(data),
          new Paragraph({ text: '' }),
          P('أبرز نقاط القوة', { bold: true, color: '16A34A', size: 24 }),
          ...(plan?.strengths ? [P(plan.strengths)] : bulletList(data.strengths)),
          new Paragraph({ text: '' }),
          P('أبرز نقاط الضعف', { bold: true, color: 'DC2626', size: 24 }),
          ...(plan?.weaknesses ? [P(plan.weaknesses)] : bulletList(data.weaknesses)),
          new Paragraph({ text: '' }),
          P('خطة التحسين للفصل القادم', { bold: true, color: BRAND, size: 24 }),
          P(plan?.actions || '—'),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${title} - ${data.program.name_ar}.docx`)
}
