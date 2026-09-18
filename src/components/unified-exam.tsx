"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuizQuestions, type QuizQuestion } from "@/lib/quiz";
import { useExamSession, type Stroke } from "@/lib/exam-session";
import { MathText } from "@/components/math-text";
import { WorkArea } from "@/components/work-area";
import { DrawingPreview } from "@/components/scratchpad";
import lessonData from "@/data/lessons.json";

const LETTERS = ["a", "b", "c", "d"];
const QUIZ_TOPIC = "mock-exam";

type Lesson = {
  id: string;
  title: string;
  titleEn: string;
  pages: number[];
  classWork: string;
};
const LESSONS = lessonData.lessons as Lesson[];

type Session = ReturnType<typeof useExamSession>;

// The page walks the booklet in its own order: each lesson's pages followed by
// that lesson's exercises, then the final exam, then the teacher's review.
type Step = { kind: "lesson"; lesson: Lesson } | { kind: "exam" } | { kind: "review" };

export function UnifiedExam() {
  const { questions, loaded, error, setAnswer } = useQuizQuestions();
  const s = useExamSession();
  const [index, setIndex] = useState(0);
  const [printing, setPrinting] = useState(false);

  const steps: Step[] = useMemo(
    () => [
      ...LESSONS.map((lesson) => ({ kind: "lesson" as const, lesson })),
      { kind: "exam" as const },
      { kind: "review" as const },
    ],
    []
  );

  const examQuestions = useMemo(
    () => questions.filter((q) => q.topic === QUIZ_TOPIC),
    [questions]
  );

  function exportPdf() {
    setPrinting(true);
  }

  // Printing before the booklet scans have decoded produces a PDF full of blank
  // boxes, so wait for them (capped, so one stalled image can't block export).
  useEffect(() => {
    if (!printing) return;
    let cancelled = false;

    async function printWhenReady() {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const images = Array.from(
        document.querySelectorAll<HTMLImageElement>(".print-only img")
      );
      const pending = images
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            })
        );

      await Promise.race([
        Promise.all(pending),
        new Promise((r) => setTimeout(r, 15000)),
      ]);
      if (cancelled) return;

      window.print();
      setPrinting(false);
    }

    printWhenReady();
    return () => {
      cancelled = true;
    };
  }, [printing]);

  if (!loaded) return <p className="text-sm text-slate-500">جارٍ التحميل…</p>;

  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">لم يتم تحميل الأسئلة.</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }

  const step = steps[index];

  return (
    <div dir="rtl" className="space-y-4">
      <SessionBar s={s} onExport={exportPdf} />
      <Stepper steps={steps} index={index} onPick={setIndex} questions={questions} s={s} />

      <div className="no-print">
        {step.kind === "lesson" && (
          <LessonStep lesson={step.lesson} questions={questions} s={s} />
        )}
        {step.kind === "exam" && <ExamStep questions={examQuestions} s={s} />}
        {step.kind === "review" && (
          <Review questions={questions} onConfirm={setAnswer} />
        )}
      </div>

      <Nav index={index} total={steps.length} onGo={setIndex} />

      {printing && <PrintDocument questions={questions} s={s} />}
    </div>
  );
}

// ───────────────────────── chrome ─────────────────────────

function Stepper({
  steps,
  index,
  onPick,
  questions,
  s,
}: {
  steps: Step[];
  index: number;
  onPick: (i: number) => void;
  questions: QuizQuestion[];
  s: Session;
}) {
  return (
    <div className="no-print flex flex-wrap gap-2">
      {steps.map((st, i) => {
        const active = i === index;
        let label: string;
        let done = 0;
        let total = 0;

        if (st.kind === "lesson") {
          label = st.lesson.title;
          const items = questions.filter((q) => q.section === st.lesson.classWork);
          total = items.length;
          done = items.filter((q) => s.session.classWork[q.id] !== undefined).length;
        } else if (st.kind === "exam") {
          label = "📝 الاختبار النهائي";
          const items = questions.filter((q) => q.topic === QUIZ_TOPIC);
          total = items.length;
          done = items.filter((q) => s.session.quiz[q.id] !== undefined).length;
        } else {
          label = "🔍 مراجعة المعلم";
        }

        return (
          <button
            key={i}
            onClick={() => onPick(i)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {st.kind === "lesson" && <span className="ml-1 opacity-60">{i + 1}.</span>}
            {label}
            {total > 0 && (
              <span
                className={`mr-2 rounded-full px-2 py-0.5 text-xs ${
                  active ? "bg-white/20" : "bg-slate-100"
                }`}
              >
                {done}/{total}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Nav({
  index,
  total,
  onGo,
}: {
  index: number;
  total: number;
  onGo: (i: number) => void;
}) {
  return (
    <div className="no-print flex justify-between">
      <button
        onClick={() => onGo(Math.max(0, index - 1))}
        disabled={index === 0}
        className="rounded-lg px-4 py-2 text-sm text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
      >
        ← السابق
      </button>
      <button
        onClick={() => {
          onGo(Math.min(total - 1, index + 1));
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        disabled={index === total - 1}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
      >
        التالي →
      </button>
    </div>
  );
}

function SessionBar({ s, onExport }: { s: Session; onExport: () => void }) {
  return (
    <div className="no-print space-y-2">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={s.autoSave}
            onChange={(e) => s.setAutoSave(e.target.checked)}
            className="h-4 w-4"
          />
          حفظ تلقائي
        </label>

        {!s.autoSave && (
          <button
            onClick={s.saveNow}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            حفظ الآن
          </button>
        )}

        <span className="text-xs text-slate-500">
          {s.savedAt
            ? `آخر حفظ: ${new Date(s.savedAt).toLocaleString("ar")}`
            : "لم يُحفظ بعد"}
        </span>

        <div className="mr-auto flex gap-2">
          <button
            onClick={onExport}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            ⬇️ تصدير PDF
          </button>
          <button
            onClick={() => {
              if (
                confirm(
                  "بدء جلسة جديدة سيمسح كل الإجابات والملاحظات والرسم. هل أنت متأكد؟"
                )
              ) {
                s.newSession();
              }
            }}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            🔄 جلسة جديدة
          </button>
        </div>
      </div>

      {s.storageError && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {s.storageError}
        </p>
      )}
    </div>
  );
}

// ───────────────────────── a lesson: study then solve ─────────────────────────

function LessonStep({
  lesson,
  questions,
  s,
}: {
  lesson: Lesson;
  questions: QuizQuestion[];
  s: Session;
}) {
  const items = questions.filter((q) => q.section === lesson.classWork);
  const noteKey = `lesson:${lesson.id}`;
  const done = items.filter((q) => s.session.classWork[q.id] !== undefined).length;
  const right = items.filter(
    (q) => s.session.classWork[q.id] === q.answerIndex
  ).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-xl font-bold text-slate-800">{lesson.title}</h2>
        <p className="text-sm text-slate-400">{lesson.titleEn}</p>
      </div>

      {/* Study */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-500">📚 الدراسة</h3>
        {lesson.pages.map((p) => (
          <img
            key={p}
            src={`/booklet/p${String(p).padStart(2, "0")}.jpg`}
            alt={`${lesson.title} — صفحة ${p}`}
            loading="lazy"
            className="mx-auto w-full max-w-3xl rounded-lg border border-slate-200 bg-white shadow-sm"
          />
        ))}
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <WorkArea
            note={s.session.notes[noteKey] ?? ""}
            strokes={s.session.drawings[noteKey] ?? []}
            onNote={(t) => s.setNote(noteKey, t)}
            onStrokes={(d) => s.setDrawing(noteKey, d)}
          />
        </div>
      </section>

      {/* Solve */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-500">
          ✏️ العمل الصفي — {lesson.classWork}
        </h3>

        {items.length === 0 ? (
          <NoQuestions />
        ) : (
          <>
            <div className="rounded-lg bg-white p-3 text-sm text-slate-600 ring-1 ring-slate-200">
              حللت {done} من {items.length} — الإجابات الصحيحة {right}
            </div>
            {items.map((q, i) => (
              <PracticeCard key={q.id} q={q} index={i + 1} s={s} />
            ))}
          </>
        )}
      </section>
    </div>
  );
}

function PracticeCard({
  q,
  index,
  s,
}: {
  q: QuizQuestion;
  index: number;
  s: Session;
}) {
  const choice = s.session.classWork[q.id];
  const answered = choice !== undefined;
  const key = `q:${q.id}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>سؤال {index}</span>
        <span>صفحة {q.sourcePage}</span>
      </div>

      <div className="mt-2 text-lg leading-relaxed text-slate-800">
        <MathText text={q.body} />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {q.options.map((opt, i) => {
          let style = "bg-white ring-slate-200 hover:bg-slate-50";
          if (answered && i === q.answerIndex) style = "bg-green-50 ring-green-400";
          else if (answered && i === choice) style = "bg-red-50 ring-red-400";

          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => s.answerClassWork(q.id, i)}
              className={`flex items-start gap-2 rounded-lg p-3 text-right ring-1 transition disabled:cursor-default ${style}`}
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-600">
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
          طريقة الحل: {q.work}
        </p>
      )}
      {answered && !q.verified && (
        <p className="mt-2 text-xs text-amber-700">
          هذه الإجابة غير مؤكدة من المذكرة وتحتاج مراجعة المعلم.
        </p>
      )}

      <WorkArea
        compact
        note={s.session.notes[key] ?? ""}
        strokes={s.session.drawings[key] ?? []}
        onNote={(t) => s.setNote(key, t)}
        onStrokes={(d) => s.setDrawing(key, d)}
      />
    </div>
  );
}

// ───────────────────────── final exam ─────────────────────────

function ExamStep({ questions, s }: { questions: QuizQuestion[]; s: Session }) {
  const answers = s.session.quiz;
  const submitted = s.session.submitted;
  const answered = questions.filter((q) => answers[q.id] !== undefined).length;
  const score = questions.filter((q) => answers[q.id] === q.answerIndex).length;
  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;

  if (questions.length === 0) return <NoQuestions />;

  return (
    <div className="space-y-4">
      {submitted ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-500">النتيجة النهائية</p>
          <p className="mt-1 text-5xl font-bold text-slate-800">
            {score}
            <span className="text-2xl text-slate-400"> / {questions.length}</span>
          </p>
          <p
            className={`mt-2 text-lg font-semibold ${
              pct >= 50 ? "text-green-600" : "text-red-600"
            }`}
          >
            {pct}% — {pct >= 50 ? "ناجح" : "راسب"}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-sm text-slate-600">
            أجبت على {answered} من {questions.length}
          </span>
          <button
            onClick={() => {
              if (
                answered < questions.length &&
                !confirm(
                  `لم تجب على ${questions.length - answered} سؤال. تسليم الاختبار؟`
                )
              )
                return;
              s.submitQuiz();
            }}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            تسليم الاختبار وعرض النتيجة
          </button>
        </div>
      )}

      {questions.map((q, i) => {
        const key = `q:${q.id}`;
        return (
          <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>سؤال {i + 1}</span>
              <span>صفحة {q.sourcePage}</span>
            </div>

            <div className="mt-2 text-lg leading-relaxed text-slate-800">
              <MathText text={q.body} />
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {q.options.map((opt, oi) => {
                const picked = answers[q.id] === oi;
                let style = "bg-white ring-slate-200 hover:bg-slate-50";
                if (submitted && oi === q.answerIndex) style = "bg-green-50 ring-green-400";
                else if (submitted && picked) style = "bg-red-50 ring-red-400";
                else if (!submitted && picked) style = "bg-blue-50 ring-blue-400";

                return (
                  <button
                    key={oi}
                    disabled={submitted}
                    onClick={() => s.answerQuiz(q.id, oi)}
                    className={`flex items-start gap-2 rounded-lg p-3 text-right ring-1 transition disabled:cursor-default ${style}`}
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-600">
                      {LETTERS[oi]}
                    </span>
                    <span className="text-slate-800">
                      <MathText text={opt} />
                    </span>
                  </button>
                );
              })}
            </div>

            {submitted && q.work && (
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                طريقة الحل: {q.work}
              </p>
            )}

            <WorkArea
              compact
              note={s.session.notes[key] ?? ""}
              strokes={s.session.drawings[key] ?? []}
              onNote={(t) => s.setNote(key, t)}
              onStrokes={(d) => s.setDrawing(key, d)}
            />
          </div>
        );
      })}
    </div>
  );
}

// ───────────────────────── shared ─────────────────────────

// quiz_questions is readable by signed-in staff only, so an empty result
// usually means the session expired rather than that there are no questions.
function NoQuestions() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
      <p className="font-medium text-slate-800">لا توجد أسئلة لعرضها.</p>
      <p className="mt-1">
        إما أن الأسئلة لم تُحمَّل بعد في قاعدة البيانات، أو أن جلسة الدخول انتهت.
        جرّب تسجيل الدخول مرة أخرى، أو شغّل{" "}
        <code className="rounded bg-slate-100 px-1">node scripts/seed-quiz.mjs</code>
      </p>
      <p className="mt-2 text-slate-500">
        قسم «الدراسة» يعمل بدون قاعدة بيانات، فيمكنك المتابعة منه.
      </p>
    </div>
  );
}

function Review({
  questions,
  onConfirm,
}: {
  questions: QuizQuestion[];
  onConfirm: (id: string, answerIndex: number) => void;
}) {
  const pending = questions.filter((q) => !q.verified);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {pending.length} إجابة تحتاج تأكيد المعلم. اضغط على الخيار الصحيح لتصحيحه، أو
        أكّد الإجابة الحالية.
      </p>
      {pending.map((q) => (
        <div key={q.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <div className="text-xs text-slate-500">
            {q.section} — سؤال {q.number} — صفحة {q.sourcePage}
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
          {q.work && <p className="mt-2 text-sm text-slate-500">طريقة الحل: {q.work}</p>}
          <button
            onClick={() => onConfirm(q.id, q.answerIndex)}
            className="mt-3 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
          >
            تأكيد هذه الإجابة
          </button>
        </div>
      ))}
      {pending.length === 0 && (
        <p className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          كل الإجابات مؤكدة ✅
        </p>
      )}
    </div>
  );
}

// ───────────────────────── printable handout ─────────────────────────

// Only mounted while exporting. Follows the same booklet order as the page and
// carries the student's notes and pencil work through into the PDF.
function PrintDocument({ questions, s }: { questions: QuizQuestion[]; s: Session }) {
  const exam = questions.filter((q) => q.topic === QUIZ_TOPIC);

  return (
    <div className="print-only" dir="rtl">
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>الاختبار الموحد</h1>
      <p style={{ color: "#555", marginBottom: 18 }}>
        قدرات الرياضيات — مذكرة أ. محمد جمعة العساف
      </p>

      {LESSONS.map((lesson) => {
        const items = questions.filter((q) => q.section === lesson.classWork);
        const key = `lesson:${lesson.id}`;
        return (
          <section key={lesson.id} className="print-section">
            <h2 style={{ fontSize: 19, fontWeight: 700, margin: "14px 0 8px" }}>
              {lesson.title}
            </h2>
            {lesson.pages.map((p) => (
              <img
                key={p}
                src={`/booklet/p${String(p).padStart(2, "0")}.jpg`}
                alt=""
                className="print-page"
              />
            ))}
            <PrintWork
              note={s.session.notes[key] ?? ""}
              strokes={s.session.drawings[key] ?? []}
            />
            {items.map((q, i) => (
              <PrintQuestion key={q.id} q={q} index={i + 1} s={s} />
            ))}
          </section>
        );
      })}

      <section className="print-section">
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>الاختبار النهائي</h2>
        {exam.map((q, i) => (
          <PrintQuestion key={q.id} q={q} index={i + 1} s={s} />
        ))}
      </section>
    </div>
  );
}

function PrintQuestion({
  q,
  index,
  s,
}: {
  q: QuizQuestion;
  index: number;
  s: Session;
}) {
  const key = `q:${q.id}`;
  return (
    <div className="print-q">
      <div style={{ fontSize: 15, marginBottom: 6 }}>
        <b>{index}.</b> <MathText text={q.body} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
        {q.options.map((opt, i) => (
          <div key={i} style={{ fontSize: 14 }}>
            <b>{LETTERS[i]})</b> <MathText text={opt} />
          </div>
        ))}
      </div>
      <PrintWork
        note={s.session.notes[key] ?? ""}
        strokes={s.session.drawings[key] ?? []}
      />
    </div>
  );
}

function PrintWork({ note, strokes }: { note: string; strokes: Stroke[] }) {
  const hasNote = note.trim().length > 0;
  if (!hasNote && strokes.length === 0) return null;
  return (
    <div style={{ marginTop: 6, paddingInlineStart: 10, borderInlineStart: "3px solid #cbd5e1" }}>
      {hasNote && (
        <p style={{ fontSize: 13, color: "#334155", whiteSpace: "pre-wrap" }}>{note}</p>
      )}
      {strokes.length > 0 && (
        <div style={{ maxWidth: 520 }}>
          <DrawingPreview strokes={strokes} />
        </div>
      )}
    </div>
  );
}
