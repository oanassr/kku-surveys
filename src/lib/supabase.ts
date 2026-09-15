import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** هل تم ضبط مفتاح Supabase؟ نستخدمه لعرض شاشة إعداد لطيفة بدل الانهيار. */
export const supabaseReady = Boolean(url && anonKey)

// عميل واحد؛ إن لم تُضبط القيم نستخدم بدائل حتى لا ينهار الاستيراد.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
)
