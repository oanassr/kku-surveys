// Edge Function: admin-create-user
// ينشئ مستخدمًا (منسّق/مدير) — يُستدعى من الأدمن فقط.
// النشر:  supabase functions deploy admin-create-user
// الأسرار المطلوبة (تُضبط تلقائيًا في مشاريع Supabase): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization') ?? ''
    // 1) تحقّق من هوية المستدعي
    const asCaller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user: caller },
    } = await asCaller.auth.getUser()
    if (!caller) return json({ error: 'unauthorized' }, 401)

    // 2) تحقّق أنه أدمن
    const admin = createClient(url, serviceKey)
    const { data: prof } = await admin
      .from('profiles')
      .select('role, is_active')
      .eq('id', caller.id)
      .single()
    if (!prof || prof.role !== 'admin' || !prof.is_active)
      return json({ error: 'forbidden' }, 403)

    // 3) أنشئ المستخدم
    const body = await req.json()
    const { email, password, full_name, role = 'coordinator', program_ids = [] } = body
    if (!email || !password) return json({ error: 'email and password required' }, 400)

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })
    if (createErr || !created?.user)
      return json({ error: createErr?.message ?? 'create failed' }, 400)

    const uid = created.user.id

    // 4) اضبط الملف الشخصي (الـ trigger أنشأ صفًّا؛ نحدّثه)
    await admin
      .from('profiles')
      .upsert({ id: uid, email, full_name: full_name ?? email, role, is_active: true })

    // 5) اربطه بالبرامج (إن كان منسّقًا)
    if (role === 'coordinator' && Array.isArray(program_ids) && program_ids.length) {
      await admin
        .from('program_coordinators')
        .insert(program_ids.map((pid: string) => ({ user_id: uid, program_id: pid })))
    }

    return json({ ok: true, id: uid, email })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
