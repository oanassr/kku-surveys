// أنواع صفوف قاعدة البيانات (يدوية، مطابقة لـ supabase/schema.sql)

export type DegreeLevel = 'bachelor' | 'master' | 'phd'
export type LangCode = 'ar' | 'en'
export type AudienceType =
  | 'student'
  | 'graduate'
  | 'faculty'
  | 'employee'
  | 'employer'
  | 'trainee'
  | 'supervision'
  | 'other'
export type RunStatus = 'draft' | 'open' | 'closed'
export type RunTerm = 'annual' | 's1' | 's2' | 'summer'
export type Campus = 'male' | 'female'
export type AppRole = 'admin' | 'coordinator'
export type IndicatorKind = 'kpi' | 'objective' | 'initiative'

export interface College {
  id: string
  name_ar: string
  name_en: string | null
  created_at: string
}

export interface Department {
  id: string
  college_id: string
  name_ar: string
  name_en: string | null
  created_at: string
}

export interface Program {
  id: string
  department_id: string
  name_ar: string
  name_en: string | null
  degree: DegreeLevel
  language: LangCode
  created_at: string
}

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  role: AppRole
  is_active: boolean
  created_at: string
}

export interface SurveyTemplate {
  id: string
  title_ar: string
  title_en: string | null
  description: string | null
  audience: AudienceType
  degree_level: DegreeLevel | null
  language: LangCode
  is_active: boolean
  is_recurring: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SurveyAxis {
  id: string
  survey_id: string
  title_ar: string
  title_en: string | null
  position: number
  created_at: string
}

export interface SurveyQuestion {
  id: string
  axis_id: string
  text_ar: string
  text_en: string | null
  position: number
  is_active: boolean
  created_at: string
}

export interface Indicator {
  id: string
  kind: IndicatorKind
  code: string | null
  name_ar: string
  name_en: string | null
  program_id: string | null
  created_by: string | null
  created_at: string
}

export interface SurveyRun {
  id: string
  survey_id: string
  program_id: string
  year: number
  term: RunTerm
  opens_at: string
  closes_at: string
  status: RunStatus
  access_token: string
  created_by: string | null
  published_at: string | null
  created_at: string
}

export interface ResponseRow {
  id: string
  run_id: string
  campus: Campus
  submitted_at: string
  meta: Record<string, unknown>
}

export interface AnswerRow {
  id: string
  response_id: string
  question_id: string
  value: number
}

export interface ImprovementPlan {
  run_id: string
  strengths: string | null
  weaknesses: string | null
  actions: string | null
  notes: string | null
  updated_by: string | null
  updated_at: string
}

// أشكال مركّبة للاستخدام في الواجهة
export interface AxisWithQuestions extends SurveyAxis {
  questions: SurveyQuestion[]
}

export interface SurveyWithAxes extends SurveyTemplate {
  axes: AxisWithQuestions[]
}
