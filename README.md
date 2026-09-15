# منصة استطلاعات الرأي — جامعة الملك خالد

نظام موحّد لبناء استطلاعات رأي البرامج الأكاديمية، جمع الاستجابات مباشرةً (بلا نماذج خارجية)، وتوليد تقارير تحليلية معتمدة قابلة للتصدير إلى Word.

## التقنيات
- React + Vite + TypeScript
- Supabase (Auth · PostgreSQL · RLS)
- Tailwind CSS v4 · Recharts · docx · SheetJS (xlsx) · qrcode.react
- ثنائي اللغة (عربي/إنجليزي) مع دعم RTL كامل

## الأدوار
- **مدير النظام:** إدارة الكليات/الأقسام/البرامج، بناء الاستطلاعات، استيراد من إكسل، المؤشرات، المستخدمون، كل التقارير.
- **منسّق البرنامج:** نشر الاستطلاعات لبرامجه، فترة الإتاحة، رابط/QR، متابعة الاستجابات، تصدير التقارير.
- **المستفيد (بلا تسجيل):** يختار الكلية/القسم/الدرجة/البرنامج والمقر ويعبّئ خلال فترة الإتاحة.

## التشغيل محليًا
```bash
npm install
cp .env.example .env.local   # واملأ VITE_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:5180
```

## إعداد قاعدة البيانات (Supabase SQL Editor)
شغّل الملفات بالترتيب:
1. `supabase/schema.sql` — الجداول + سياسات RLS + الدوال.
2. `supabase/seed_surveys.sql` — 7 استطلاعات رسمية (اختياري).
3. `supabase/seed_demo.sql` — أقسام/برامج + نشر تجريبي (اختياري).

### إنشاء مدير النظام
Supabase → Authentication → **Add user** (فعّل Auto Confirm) بإيميلك وكلمة مرور من اختيارك، ثم:
```sql
update profiles set role = 'admin' where email = 'YOUR_EMAIL';
```

## إنشاء المنسّقين من داخل النظام (Edge Function)
صفحة «المستخدمون» تتيح للمدير إنشاء منسّقين مباشرةً. يتطلب ذلك نشر الدالة مرة واحدة:
```bash
# ثبّت Supabase CLI ثم:
supabase login
supabase link --project-ref pepdmklqstryuvnxoptx
supabase functions deploy admin-create-user
```
> تستخدم الدالة `SUPABASE_SERVICE_ROLE_KEY` (مضبوط تلقائيًا في بيئة الدوال) ولا يُكشف أبدًا في الواجهة. تعطيل المستخدم لا يحتاج الدالة (تبديل `is_active`).

## قالب استيراد الإكسل
من صفحة تحرير الاستطلاع: **تنزيل القالب** ثم املأه (أعمدة: المحور · الفقرة · المحور EN · الفقرة EN) و**استيراد إكسل**.

## النشر
### Vercel (موصى به)
اربط المستودع، أضف متغيّرَي البيئة `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY`. ملف `vercel.json` يتكفّل بتوجيه SPA.

### GitHub Pages
- Settings → Pages → Source = **GitHub Actions**.
- Settings → Secrets and variables → Actions → أضف `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY`.
- ادفع إلى فرع `main` — سيبني ويُنشر تلقائيًا عبر `.github/workflows/deploy-pages.yml`.
