"use client";

import { useMemo, useState } from "react";
import { useQuizQuestions, bySection, type QuizQuestion } from "@/lib/quiz";
import { MathText } from "@/components/math-text";

const LETTERS = ["a", "b", "c", "d"];

type Mode = "practice" | "review";

export function Quiz() {
  const { questions, loaded, error, setAnswer } = useQuizQuestions();
  const [mode, setMode] = useState<Mode>("practice");
  const [section, setSection] = useState<string>("");

  const sections = useMemo(() => bySection(questions), [questions]);
  const active = section || sections[0]?.section || "";
  const visible = useMemo(
    () => questions.filter((q) => q.section === active),
    [questions, active]
  );
  const unverified = questions.filter((q) => !q.verified).length;

  if (!loaded) {
    return <p className="text-sm text-slate-500">جارٍ التحميل…</p>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">لم يتم تحميل الأسئلة.</p>
        <p className="mt-1 text-amber-800">{error}</p>
        <p className="mt-2 text-amber-800">
          إذا لم يتم إنشاء الجدول بعد، شغّل{" "}
          <code className="rounded bg-amber-100 px-1">
            node scripts/run-sql.mjs supabase/quiz.sql
          </code>{" "}
          ثم <code className="rounded bg-amber-100 px-1">node scripts/seed-quiz.mjs</code>
        </p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        لا توجد أسئلة بعد. شغّل{" "}
        <code className="rounded bg-slate-100 px-1">node scripts/seed-quiz.mjs</code>{" "}
        لتحميل أسئلة المذكرة.
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ModeButton current={mode} value="practice" onClick={setMode}>
          الاختبار
        </ModeButton>
        <ModeButton current={mode} value="review" onClick={setMode}>
          مراجعة الإجابات
          {unverified > 0 && (
            <span className="mr-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">
              {unverified}
            </span>
          )}
        </ModeButton>
      </div>

      <div className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <button
            key={s.section}
            onClick={() => setSection(s.section)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              s.section === active
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {s.section}
            <span className="mr-2 text-xs opacity-70">({s.questions.length})</span>
          </button>
        ))}
      </div>

      {mode === "practice" ? (
        <Practice key={active} questions={visible} />
      ) : (
        <Review questions={visible} onConfirm={setAnswer} />
      )}
    </div>
  );
}

function ModeButton({
  current,
  value,
  onClick,
  children,
}: {
  current: Mode;
  value: Mode;
  onClick: (m: Mode) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => onClick(value)}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        current === value
          ? "bg-slate-800 text-white"
          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

// Answer one question at a time, then show a score at the end.
function Practice({ questions }: { questions: QuizQuestion[] }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);

  const q = questions[index];
  const choice = q ? picked[q.id] : undefined;
  const answered = choice !== undefined;

  if (!q) return null;

  if (done) {
    const score = questions.filter((x) => picked[x.id] === x.answerIndex).length;
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
        <p className="text-sm text-slate-500">النتيجة</p>
        <p className="mt-2 text-4xl font-bold text-slate-800">
          {score} / {questions.length}
        </p>
        <button
          onClick={() => {
            setPicked({});
            setIndex(0);
            setDone(false);
          }}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          سؤال {index + 1} من {questions.length}
        </span>
        <span className="text-xs">صفحة {q.sourcePage}</span>
      </div>

      <div className="mt-3 text-lg leading-relaxed text-slate-800">
        <MathText text={q.body} />
      </div>

      {!q.verified && (
        <p className="mt-2 text-xs text-amber-700">
          إجابة هذا السؤال غير مؤكدة من المذكرة وتحتاج مراجعة.
        </p>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {q.options.map((opt, i) => {
          const isPicked = choice === i;
          const isCorrect = i === q.answerIndex;
          let style = "bg-white ring-slate-200 hover:bg-slate-50";
          if (answered && isCorrect) style = "bg-green-50 ring-green-400";
          else if (answered && isPicked) style = "bg-red-50 ring-red-400";

          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => setPicked((p) => ({ ...p, [q.id]: i }))}
              className={`flex items-start gap-2 rounded-lg p-3 text-right ring-1 transition disabled:cursor-default ${style}`}
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                {LETTERS[i]}
              </span>
              <span className="text-slate-800">
                <MathText text={opt} />
              </span>
            </button>
          );
        })}
      </div>

      {answered && q.work && (
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          {q.work}
        </p>
      )}

      <div className="mt-4 flex justify-between">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        >
          السابق
        </button>
        {index === questions.length - 1 ? (
          <button
            onClick={() => setDone(true)}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
          >
            إنهاء
          </button>
        ) : (
          <button
            onClick={() => setIndex((i) => i + 1)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            التالي
          </button>
        )}
      </div>
    </div>
  );
}

// Admin screen: confirm each worked-out answer, or pick the right one instead.
function Review({
  questions,
  onConfirm,
}: {
  questions: QuizQuestion[];
  onConfirm: (id: string, answerIndex: number) => void;
}) {
  return (
    <div className="space-y-3">
      {questions.map((q) => (
        <div
          key={q.id}
          className={`rounded-xl border p-4 ${
            q.verified ? "border-slate-200 bg-white" : "border-amber-200 bg-amber-50/40"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              سؤال {q.number} — صفحة {q.sourcePage}
            </span>
            {q.verified ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">
                مؤكدة
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                تحتاج مراجعة
              </span>
            )}
          </div>

          <div className="mt-2 leading-relaxed text-slate-800">
            <MathText text={q.body} />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {q.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => onConfirm(q.id, i)}
                className={`flex items-start gap-2 rounded-lg p-2.5 text-right text-sm ring-1 transition ${
                  i === q.answerIndex
                    ? "bg-green-50 ring-green-400"
                    : "bg-white ring-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] text-slate-600">
                  {LETTERS[i]}
                </span>
                <span className="text-slate-800">
                  <MathText text={opt} />
                </span>
              </button>
            ))}
          </div>

          {q.work && (
            <p className="mt-2 text-sm text-slate-500">طريقة الحل: {q.work}</p>
          )}

          {!q.verified && (
            <button
              onClick={() => onConfirm(q.id, q.answerIndex)}
              className="mt-3 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
            >
              تأكيد هذه الإجابة
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
