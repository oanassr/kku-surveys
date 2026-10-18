// تصدير الخطة التشغيلية إلى Word (RTL، قابل للتعديل) بنفس هيكل نموذج الخطة المعتمد:
// غلاف ← مقدمة ← الرسائل ← الأهداف ← مصفوفات المواءمة ← لكل هدف: جدول الخطة + تقرير المؤشرات + طرق الحساب
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type ISectionOptions,
} from 'docx'
import { saveAs } from 'file-saver'
import {
  LEVELS,
  generateNarrative,
  goalKpiIds,
  isBlank,
  type GoalNode,
  type PlanFull,
} from './plans'

type Align = (typeof AlignmentType)[keyof typeof AlignmentType]

const BRAND = '0E435D'
const GOLD = 'C4880A'
const HEAD_BG = '0E435D'
const SOFT_BG = 'E6F3F7'
const FONT = 'Arial'

const ORD_M = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر']
const ORD_F = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة']
const SUB = ['أولاً', 'ثانياً', 'ثالثاً', 'رابعاً', 'خامساً', 'سادساً', 'سابعاً', 'ثامناً', 'تاسعاً', 'عاشراً']
const ordM = (i: number) => ORD_M[i] ?? `(${i + 1})`
const ordF = (i: number) => ORD_F[i] ?? `(${i + 1})`
const sub = (i: number) => SUB[i] ?? `(${i + 1})`

function run(text: string, o: { bold?: boolean; color?: string; size?: number } = {}) {
  return new TextRun({ text, bold: o.bold, color: o.color, size: o.size ?? 21, font: FONT, rightToLeft: true })
}
function P(
  text: string,
  o: { bold?: boolean; color?: string; size?: number; align?: Align; before?: number; after?: number } = {},
) {
  return new Paragraph({
    bidirectional: true,
    alignment: o.align ?? AlignmentType.RIGHT,
    spacing: { before: o.before ?? 0, after: o.after ?? 100, line: 320 },
    children: [run(text, o)],
  })
}
function H(text: string, level: 1 | 2 | 3 = 2) {
  const size = level === 1 ? 34 : level === 2 ? 28 : 24
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    spacing: { before: 280, after: 140 },
    keepNext: true,
    children: [run(text, { bold: true, color: BRAND, size })],
  })
}
const blank = () => new Paragraph({ children: [] })

const B = { style: BorderStyle.SINGLE, size: 4, color: 'B8C7D3' }
const borders = { top: B, bottom: B, left: B, right: B, insideHorizontal: B, insideVertical: B }

function cell(
  text: string,
  w: number,
  o: { bold?: boolean; color?: string; bg?: string; align?: Align; rowSpan?: number; size?: number; span?: number } = {},
) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    rowSpan: o.rowSpan,
    columnSpan: o.span,
    verticalAlign: VerticalAlign.CENTER,
    shading: o.bg ? { fill: o.bg, color: 'auto', type: ShadingType.CLEAR } : undefined,
    margins: { top: 50, bottom: 50, left: 70, right: 70 },
    children: String(text)
      .split('\n')
      .map(
        (line) =>
          new Paragraph({
            bidirectional: true,
            alignment: o.align ?? AlignmentType.CENTER,
            children: [run(line, { bold: o.bold, color: o.color, size: o.size ?? 18 })],
          }),
      ),
  })
}
const hcell = (t: string, w: number) => cell(t, w, { bold: true, color: 'FFFFFF', bg: HEAD_BG })

function table(widths: number[], rows: TableRow[]) {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    borders,
    visuallyRightToLeft: true,
    rows,
  })
}

// ---------------------------------------------------------------------------
const DEFAULT_INTRO = (program: string) =>
  `حرصت إدارة ${program} على وضع خطة تشغيلية تتضمن أهدافًا تشغيلية واقعية، قريبة المدى، وقابلة للقياس، تتوافق مع طموحات جميع الأطراف المعنية، وتراعي الفترة الزمنية المحددة بعام دراسي، بما يهيئ الفرص لتجسير فجوات الأداء. والهدف الرئيس من الخطة التشغيلية هو تحديد ما يجب تنفيذه لتحقيق الأهداف التشغيلية للبرنامج، والمساهمة في تحقيق الأهداف الاستراتيجية للكلية. وبناءً على ذلك وُضعت المبادرات والأنشطة التي تقاس وفق مؤشرات الأداء الرئيسة الصادرة من الهيئة الوطنية للتقويم والاعتماد الأكاديمي (NCAAA) ومؤشرات أداء البرنامج الفرعية المحددة بناءً على الأنشطة والمبادرات، ويتم قياسها سنويًا، ويستفيد البرنامج من التغذية الراجعة لتحسين الأداء.`
export const defaultPlanIntro = DEFAULT_INTRO

export async function exportPlanDocx(full: PlanFull) {
  const { plan, program } = full
  const college = program.department?.college?.name_ar ?? ''
  const dept = program.department?.name_ar ?? ''
  const title = `الخطة التشغيلية لـ${program.name_ar}`
  const ctx = plan.context ?? {}

  const footer = new Footer({
    children: [
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.CENTER,
        children: [
          run(`${title} — ${plan.year_label} — صفحة `, { size: 16, color: '5B6B82' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '5B6B82', font: FONT }),
        ],
      }),
    ],
  })

  // ============== القسم الأول: الغلاف + الإطار ==============
  const front: (Paragraph | Table)[] = []
  const coverLines = [college && `كلية ${college.replace(/^كلية\s*/, '')}`, dept].filter(Boolean) as string[]
  front.push(blank(), blank(), blank())
  coverLines.forEach((l) =>
    front.push(P(l, { bold: true, color: BRAND, size: 30, align: AlignmentType.CENTER, after: 120 })),
  )
  front.push(blank(), blank())
  const NB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const noBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB }
  const coverP = (t: string, size: number, color: string, bold = false, after = 120) =>
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      spacing: { after },
      children: [run(t, { bold, color, size })],
    })
  front.push(
    new Table({
      width: { size: 9000, type: WidthType.DXA },
      columnWidths: [9000],
      borders: noBorders,
      visuallyRightToLeft: true,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 9000, type: WidthType.DXA },
              shading: { fill: BRAND, color: 'auto', type: ShadingType.CLEAR },
              margins: { top: 520, bottom: 520, left: 400, right: 400 },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                coverP('الخطة التشغيلية', 64, 'FFFFFF', true, 200),
                coverP(program.name_ar, 34, 'F0C14B', true, 200),
                coverP(
                  `العام ${plan.year_label}${plan.target_year_label ? ` — المستهدفات الجديدة للعام ${plan.target_year_label}` : ''}`,
                  24,
                  'D2EEF3',
                ),
              ],
            }),
          ],
        }),
      ],
    }),
  )
  front.push(P('الأهداف · المبادرات · الأنشطة · مؤشرات الأداء', { color: '5B6B82', size: 22, align: AlignmentType.CENTER, before: 300 }))
  front.push(new Paragraph({ children: [], pageBreakBefore: true }))

  front.push(H('مقدمة الخطة التشغيلية', 1))
  front.push(P(plan.intro?.trim() || DEFAULT_INTRO(program.name_ar), { after: 160 }))

  // الرسائل
  const missionRows: [string, string][] = [
    ['رسالة الجامعة', ctx.missions?.university ?? ''],
    ['رسالة الكلية', ctx.missions?.college ?? ''],
    ['رسالة القسم', ctx.missions?.department ?? ''],
    ['رسالة البرنامج', ctx.missions?.program ?? ''],
  ].filter(([, t]) => t.trim()) as [string, string][]
  if (missionRows.length) {
    front.push(H('الرسائل', 2))
    front.push(
      table(
        [1900, 7100],
        missionRows.map(
          ([k, v]) =>
            new TableRow({
              children: [cell(v, 7100, { align: AlignmentType.RIGHT, size: 19 }), cell(k, 1900, { bold: true, color: BRAND, bg: SOFT_BG })],
            }),
        ),
      ),
    )
  }

  // الأهداف
  const lists: [string, string[]][] = [
    ...LEVELS.map((l) => [`أهداف ${l.label}`, ctx.lists?.[l.key] ?? []] as [string, string[]]),
    [`أهداف ${program.name_ar}`, full.goals.map((g) => g.text_ar)],
  ].filter(([, l]) => l.length) as [string, string[]][]
  if (lists.length) {
    front.push(H('الأهداف', 2))
    for (const [label, items] of lists) {
      front.push(P(label, { bold: true, color: BRAND, size: 23, before: 100 }))
      items.forEach((t, i) =>
        front.push(
          new Paragraph({
            bidirectional: true,
            alignment: AlignmentType.RIGHT,
            spacing: { after: 60, line: 300 },
            children: [run(`${i + 1}. `, { bold: true, color: GOLD }), run(t)],
          }),
        ),
      )
    }
  }

  // مصفوفات المواءمة
  for (const lv of LEVELS) {
    const goalsOfLevel = ctx.lists?.[lv.key] ?? []
    if (!goalsOfLevel.length || !full.goals.length) continue
    front.push(H(`مواءمة أهداف البرنامج مع أهداف ${lv.label}`, 2))
    const first = 4200
    const w = Math.max(700, Math.floor((9000 - first) / goalsOfLevel.length))
    const widths = [first, ...goalsOfLevel.map(() => w)]
    const rows = [
      new TableRow({
        tableHeader: true,
        children: [hcell('هدف البرنامج', first), ...goalsOfLevel.map((_, i) => hcell(String(i + 1), w))],
      }),
      ...full.goals.map(
        (g) =>
          new TableRow({
            children: [
              cell(g.text_ar, first, { align: AlignmentType.RIGHT, size: 17 }),
              ...goalsOfLevel.map((_, i) =>
                cell((g.aligns?.[lv.key] ?? []).includes(i) ? '✓' : '', w, { bold: true, color: GOLD, size: 22 }),
              ),
            ],
          }),
      ),
    ]
    front.push(table(widths, rows))
    front.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { before: 80, after: 120 },
        children: [run(goalsOfLevel.map((t, i) => `${i + 1}) ${t}`).join('   '), { size: 16, color: '5B6B82' })],
      }),
    )
  }

  const sections: ISectionOptions[] = [
    { properties: {}, footers: { default: footer }, children: front },
  ]

  // ============== أقسام الأهداف (أفقية) ==============
  const COLS = [2300, 2900, 1500, 2400, 1000, 900, 1100, 900, 1000, 1100] // = 15100
  const cellOf = (id: string, f: 'actual' | 'benchmark' | 'target' | 'new_target') => {
    const v = full.values.get(id)?.[f]
    return isBlank(v) ? '' : String(v)
  }

  full.goals.forEach((g: GoalNode, gi) => {
    const kids: (Paragraph | Table)[] = []
    kids.push(P(`الخطة التشغيلية للهدف ${ordM(gi)}`, { bold: true, color: BRAND, size: 34, after: 60 }))
    kids.push(P(g.text_ar, { color: GOLD, size: 24, after: 160, bold: true }))

    // ---- جدول الخطة بدمج الخلايا
    const head = new TableRow({
      tableHeader: true,
      children: [
        'المبادرات',
        'الأنشطة والإجراءات التنفيذية',
        'الجهة المنفذة',
        'مؤشرات الأداء',
        'رمز المؤشر',
        'الأداء الفعلي',
        'المقارنة المرجعية الداخلية',
        'الأداء المستهدف',
        'الأداء المستهدف الجديد',
        'الميزانية التقديرية',
      ].map((t, i) => hcell(t, COLS[i])),
    })
    const rows: TableRow[] = [head]
    for (const ini of g.initiatives) {
      const iniRows = ini.activities.reduce((n, a) => n + Math.max(1, a.kpiIds.length), 0) || 1
      let firstOfInitiative = true
      const acts = ini.activities.length ? ini.activities : [null]
      for (const a of acts) {
        const kpis = a && a.kpiIds.length ? a.kpiIds : [null]
        kpis.forEach((kid, ki) => {
          const k = kid ? full.kpis.get(kid) : undefined
          const cells: TableCell[] = []
          if (firstOfInitiative) cells.push(cell(ini.text_ar, COLS[0], { rowSpan: iniRows, bold: true, color: BRAND, bg: SOFT_BG, align: AlignmentType.RIGHT }))
          if (ki === 0) {
            cells.push(cell(a?.text_ar ?? '', COLS[1], { rowSpan: kpis.length, align: AlignmentType.RIGHT }))
            cells.push(cell(a?.executor ?? '', COLS[2], { rowSpan: kpis.length }))
          }
          cells.push(cell(k?.name_ar ?? '', COLS[3], { align: AlignmentType.RIGHT }))
          cells.push(cell(k?.code ?? '', COLS[4], { bold: true, color: BRAND, size: 16 }))
          cells.push(cell(kid ? cellOf(kid, 'actual') : '', COLS[5], { bold: true }))
          cells.push(cell(kid ? cellOf(kid, 'benchmark') : '', COLS[6]))
          cells.push(cell(kid ? cellOf(kid, 'target') : '', COLS[7]))
          cells.push(cell(kid ? cellOf(kid, 'new_target') : '', COLS[8], { bold: true, color: GOLD }))
          if (ki === 0) cells.push(cell(a?.budget ?? '', COLS[9], { rowSpan: kpis.length, size: 16 }))
          rows.push(new TableRow({ children: cells, cantSplit: true }))
          firstOfInitiative = false
        })
      }
    }
    kids.push(table(COLS, rows))

    // ---- التقرير التفصيلي لمؤشرات الهدف
    kids.push(new Paragraph({ children: [], pageBreakBefore: true }))
    kids.push(H(`تقرير تفصيلي لمؤشرات أداء الهدف ${ordM(gi)}: ${g.text_ar}`, 2))
    kids.push(
      P(
        `في إطار سعي البرنامج لتحقيق أهدافه وبما يسهم في تحقيق رؤية ورسالة وأهداف الكلية، وُضعت خطة تشغيلية لهدف البرنامج ${ordM(gi)} (${g.text_ar})، وتتكون من ${g.initiatives.length} ${g.initiatives.length === 1 ? 'مبادرة' : 'مبادرات'}.`,
      ),
    )
    g.initiatives.forEach((ini, ii) => {
      kids.push(P(`${sub(ii)}: مؤشرات أداء المبادرة ${ordF(ii)}: ${ini.text_ar}`, { bold: true, color: BRAND, size: 23, before: 160 }))
      const ids: string[] = []
      ini.activities.forEach((a) => a.kpiIds.forEach((k) => !ids.includes(k) && ids.push(k)))
      if (!ids.length) kids.push(P('لا توجد مؤشرات مرتبطة بأنشطة هذه المبادرة بعد.', { color: '5B6B82' }))
      ids.forEach((id) => {
        const k = full.kpis.get(id)
        if (!k) return
        const v = full.values.get(id)
        const text = v?.narrative?.trim() || generateNarrative(k, v, plan.target_year_label)
        kids.push(
          new Paragraph({
            bidirectional: true,
            alignment: AlignmentType.RIGHT,
            spacing: { after: 110, line: 320 },
            children: [run(`${k.name_ar}${k.code ? ` (${k.code})` : ''}: `, { bold: true, color: BRAND }), run(text)],
          }),
        )
      })
    })

    // ---- كيفية حساب المؤشرات
    const ids = goalKpiIds(g)
    if (ids.length) {
      kids.push(H(`مؤشرات الأداء وكيفية حساب المؤشر للهدف ${ordM(gi)}`, 2))
      const W = [700, 4400, 1500, 6300, 2200]
      kids.push(
        table(W, [
          new TableRow({ tableHeader: true, children: ['م', 'مؤشر الأداء', 'رمز المؤشر', 'كيفية حساب المؤشر', 'روابط الأدلة'].map((t, i) => hcell(t, W[i])) }),
          ...ids.map((id, i) => {
            const k = full.kpis.get(id)
            return new TableRow({
              cantSplit: true,
              children: [
                cell(String(i + 1), W[0]),
                cell(k?.name_ar ?? '', W[1], { align: AlignmentType.RIGHT }),
                cell(k?.code ?? '', W[2], { bold: true, color: BRAND }),
                cell(k?.calc_method ?? '', W[3], { align: AlignmentType.RIGHT }),
                cell(k?.evidence_url ?? '', W[4], { size: 15 }),
              ],
            })
          }),
        ]),
      )
    }

    sections.push({
      properties: { page: { size: { orientation: PageOrientation.LANDSCAPE, width: 11906, height: 16838 }, margin: { top: 850, bottom: 850, left: 850, right: 850 } } },
      footers: { default: footer },
      children: kids,
    })
  })

  const doc = new Document({
    creator: 'منصة القياس غير المباشر',
    title,
    styles: { default: { document: { run: { font: FONT } } } },
    sections,
  })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${title} - ${plan.year_label}.docx`)
}
