// ============================================================================
// مقياس التقدير المعتمد (جامعة الملك خالد) — 5 نطاقات
//   ≥ 4.5            → 5 نقاط  → مستوفٍ بتميز
//   3.5 إلى < 4.5    → 4 نقاط  → مستوفٍ بإتقان
//   2.5 إلى < 3.5    → 3 نقاط  → مستوفٍ
//   1.5 إلى < 2.5    → 2 نقطة  → مستوفٍ جزئيًا
//   < 1.5            → 1 نقطة  → غير مستوفٍ
// ============================================================================

export interface RatingBand {
  level: 1 | 2 | 3 | 4 | 5
  min: number // inclusive
  labelAr: string
  labelEn: string
  descAr: string
  descEn: string
  color: string // CSS var token
}

export const RATING_BANDS: RatingBand[] = [
  {
    level: 5,
    min: 4.5,
    labelAr: 'مستوفٍ بتميز',
    labelEn: 'Fully met — Distinguished',
    descAr: 'يتوفر العنصر ويطبق بمستوى متميز.',
    descEn: 'Element present and applied at a distinguished level.',
    color: 'var(--color-rate-5)',
  },
  {
    level: 4,
    min: 3.5,
    labelAr: 'مستوفٍ بإتقان',
    labelEn: 'Fully met — Proficient',
    descAr: 'يتوفر العنصر ويطبق بمستوى متقن.',
    descEn: 'Element present and applied proficiently.',
    color: 'var(--color-rate-4)',
  },
  {
    level: 3,
    min: 2.5,
    labelAr: 'مستوفٍ',
    labelEn: 'Met',
    descAr: 'يتوفر العنصر ويطبق بمستوى جيد.',
    descEn: 'Element present and applied at a good level.',
    color: 'var(--color-rate-3)',
  },
  {
    level: 2,
    min: 1.5,
    labelAr: 'مستوفٍ جزئيًا',
    labelEn: 'Partially met',
    descAr: 'يتوفر العنصر ويطبق بمستوى ضعيف.',
    descEn: 'Element present but weakly applied.',
    color: 'var(--color-rate-2)',
  },
  {
    level: 1,
    min: -Infinity,
    labelAr: 'غير مستوفٍ',
    labelEn: 'Not met',
    descAr: 'لا يتوفر العنصر ولا يطبق أو يطبق بمستوى ضعيف جدًا.',
    descEn: 'Element absent or applied very weakly.',
    color: 'var(--color-rate-1)',
  },
]

/** يعيد نطاق التقدير لمتوسط معيّن. القيم null تُعامل كغير محدد. */
export function bandFor(mean: number | null | undefined): RatingBand | null {
  if (mean == null || Number.isNaN(mean)) return null
  return RATING_BANDS.find((b) => mean >= b.min) ?? RATING_BANDS[RATING_BANDS.length - 1]
}

/** النسبة المئوية من المتوسط (مقياس 5). */
export function meanToPercent(mean: number | null | undefined): number | null {
  if (mean == null || Number.isNaN(mean)) return null
  return Math.round((mean / 5) * 1000) / 10 // خانة عشرية واحدة
}

/** هل تحتاج الفقرة إلى تطوير؟ (مستوى 3 فأقل حسب عرف التقارير) */
export function needsDevelopment(mean: number | null | undefined): boolean {
  const b = bandFor(mean)
  return b != null && b.level <= 3
}

export function fmtMean(mean: number | null | undefined): string {
  if (mean == null || Number.isNaN(mean)) return '—'
  return (Math.round(mean * 100) / 100).toFixed(2)
}
