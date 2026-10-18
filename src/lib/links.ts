// روابط الأدوات الخارجية المرتبطة بالنظام (تطبيقات مستقلة لا تحفظ بياناتها هنا)

/** مولّد تقارير استطلاعات الطلاب حول جودة المقررات (تطبيق مستقل — يمكن تغييره عبر VITE_COURSE_REPORT_URL). */
export const COURSE_REPORT_URL =
  (import.meta.env.VITE_COURSE_REPORT_URL as string | undefined) || 'https://course-report-v2.onrender.com/'
