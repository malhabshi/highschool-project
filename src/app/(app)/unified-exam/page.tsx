import { UnifiedExam } from "@/components/unified-exam";

export default function UnifiedExamPage() {
  return (
    <div className="space-y-6">
      <div className="no-print">
        <h1 className="text-2xl font-bold text-slate-800">الاختبار الموحد</h1>
        <p className="text-slate-500">
          ادرس الدرس، ثم حل العمل الصفي، ثم اختبر نفسك واحصل على النتيجة
        </p>
      </div>

      <UnifiedExam />
    </div>
  );
}
