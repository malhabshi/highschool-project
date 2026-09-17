import { Quiz } from "@/components/quiz";

export default function QuizPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">اختبار القدرات</h1>
        <p className="text-slate-500">
          أسئلة اختيار من متعدد من مذكرة قدرات الرياضيات
        </p>
      </div>

      <Quiz />
    </div>
  );
}
