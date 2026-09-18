"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuizQuestions, type QuizQuestion } from "@/lib/quiz";
import { useExamSession } from "@/lib/exam-session";
import { MathText } from "@/components/math-text";
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

type Tab = "study" | "classwork" | "quiz" | "review";

export function UnifiedExam() {
  const { questions, loaded, error, setAnswer } = useQuizQuestions();
  const s = useExamSession();
  const [tab, setTab] = useState<Tab>("study");
  const [printing, setPrinting] = useState(false);

  const classWork = useMemo(
    () => questions.filter((q) => q.topic !== QUIZ_TOPIC),
    [questions]
  );
  const quiz = useMemo(
    () => questions.filter((q) => q.topic === QUIZ_TOPIC),
    [questions]
  );

  // Mount the printable handout; the effect below prints once it's ready.
  function exportPdf() {
    setPrinting(true);
  }

  // Mounting the handout is not enough — printing before the booklet scans have
  // decoded produces a PDF full of blank boxes, so wait for them (with a cap so
  // a single stalled image can't block the export).
  useEffect(() => {
    if (!printing) return;
    let cancelled = false;

    async function printWhenReady() {
      // Let the handout commit and paint before looking for its images.
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

  return (
    <div dir="rtl" className="space-y-4">
      <SessionBar s={s} onExport={exportPdf} />

      <div className="no-print flex flex-wrap gap-2">
        <TabButton current={tab} value="study" onClick={setTab}>
          📚 الدراسة
        </TabButton>
        <TabButton current={tab} value="classwork" onClick={setTab}>
          ✏️ العمل الصفي
          <Count n={Object.keys(s.session.classWork).length} of={classWork.length} />
        </TabButton>
        <TabButton current={tab} value="quiz" onClick={setTab}>
          📝 الاختبار
          <Count n={Object.keys(s.session.quiz).length} of={quiz.length} />
        </TabButton>
        <TabButton current={tab} value="review" onClick={setTab}>
          🔍 مراجعة الإجابات
        </TabButton>
      </div>

      <div className="no-print">
        {tab === "study" && <Study />}
        {tab === "classwork" && <ClassWork questions={classWork} s={s} />}
        {tab === "quiz" && <Quiz questions={quiz} s={s} />}
        {tab === "review" && <Review questions={questions} onConfirm={setAnswer} />}
      </div>

      {printing && <PrintDocument classWork={classWork} quiz={quiz} />}
    </div>
  );
}

function Count({ n, of }: { n: number; of: number }) {
  if (of === 0) return null;
  return (
    <span className="mr-2 rounded-full bg-white/25 px-2 py-0.5 text-xs">
      {n}/{of}
    </span>
  );
}

function TabButton({
  current,
  value,
  onClick,
  children,
}: {
  current: Tab;
  value: Tab;
  onClick: (t: Tab) => void;
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

// ───────────────────────── session controls ─────────────────────────

function SessionBar({
  s,
  onExport,
}: {
  s: ReturnType<typeof useExamSession>;
  onExport: () => void;
}) {
  return (
    <div className="no-print flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
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
        {s.savedAt ? `آخر حفظ: ${new Date(s.savedAt).toLocaleString("ar")}` : "لم يُحفظ بعد"}
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
            if (confirm("بدء جلسة جديدة سيمسح كل الإجابات المحفوظة. هل أنت متأكد؟")) {
              s.newSession();
            }
          }}
          className="rounded-lg px-3 py-1.5 text-sm text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          🔄 جلسة جديدة
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── study ─────────────────────────

function Study() {
  const [openId, setOpenId] = useState<string>(LESSONS[0]?.id ?? "");

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        اقرأ الدرس أولاً ثم انتقل إلى العمل الصفي لحل تمارينه.
      </p>
      {LESSONS.map((lesson) => {
        const open = lesson.id === openId;
        return (
          <div key={lesson.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
              onClick={() => setOpenId(open ? "" : lesson.id)}
              className="flex w-full items-center justify-between p-4 text-right hover:bg-slate-50"
            >
              <span>
                <span className="font-semibold text-slate-800">{lesson.title}</span>
                <span className="mr-2 text-sm text-slate-400">{lesson.titleEn}</span>
              </span>
              <span className="text-sm text-slate-400">
                {lesson.pages.length} صفحات {open ? "▲" : "▼"}
              </span>
            </button>

            {open && (
              <div className="space-y-3 border-t border-slate-100 bg-slate-50 p-3">
                {lesson.pages.map((p) => (
                  <img
                    key={p}
                    src={`/booklet/p${String(p).padStart(2, "0")}.jpg`}
                    alt={`${lesson.title} — صفحة ${p}`}
                    loading="lazy"
                    className="mx-auto w-full max-w-3xl rounded-lg border border-slate-200 bg-white shadow-sm"
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// The questions table is readable by signed-in staff only, so an empty result
// usually means the session expired rather than that there are no questions.
// Say that instead of rendering a blank panel.
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

// ───────────────────────── class work ─────────────────────────

// Practice: answer at your own pace, feedback straight away, progress saved.
function ClassWork({
  questions,
  s,
}: {
  questions: QuizQuestion[];
  s: ReturnType<typeof useExamSession>;
}) {
  const sections = useMemo(() => {
    const out: { title: string; items: QuizQuestion[] }[] = [];
    for (const q of questions) {
      const last = out[out.length - 1];
      if (last && last.title === q.section) last.items.push(q);
      else out.push({ title: q.section, items: [q] });
    }
    return out;
  }, [questions]);

  const [active, setActive] = useState(sections[0]?.title ?? "");
  const current = sections.find((x) => x.title === active) ?? sections[0];
  if (!current) return <NoQuestions />;

  const done = current.items.filter((q) => s.session.classWork[q.id] !== undefined).length;
  const right = current.items.filter(
    (q) => s.session.classWork[q.id] === q.answerIndex
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {sections.map((sec) => (
          <button
            key={sec.title}
            onClick={() => setActive(sec.title)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              sec.title === active
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {sec.title}
            <span className="mr-2 text-xs opacity-70">({sec.items.length})</span>
          </button>
        ))}
      </div>

      <div className="rounded-lg bg-white p-3 text-sm text-slate-600 ring-1 ring-slate-200">
        حللت {done} من {current.items.length} — الإجابات الصحيحة {right}
      </div>

      {current.items.map((q, i) => (
        <PracticeCard
          key={q.id}
          q={q}
          index={i + 1}
          choice={s.session.classWork[q.id]}
          onChoose={(c) => s.answerClassWork(q.id, c)}
        />
      ))}
    </div>
  );
}

function PracticeCard({
  q,
  index,
  choice,
  onChoose,
}: {
  q: QuizQuestion;
  index: number;
  choice: number | undefined;
  onChoose: (c: number) => void;
}) {
  const answered = choice !== undefined;

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
          const isRight = i === q.answerIndex;
          let style = "bg-white ring-slate-200 hover:bg-slate-50";
          if (answered && isRight) style = "bg-green-50 ring-green-400";
          else if (answered && i === choice) style = "bg-red-50 ring-red-400";

          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => onChoose(i)}
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
    </div>
  );
}

// ───────────────────────── graded quiz ─────────────────────────

// Answer everything, submit once, then see the grade and what went wrong.
function Quiz({
  questions,
  s,
}: {
  questions: QuizQuestion[];
  s: ReturnType<typeof useExamSession>;
}) {
  const answers = s.session.quiz;
  const submitted = s.session.submitted;
  const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length;
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
          <button
            onClick={s.newSession}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            إعادة الاختبار (جلسة جديدة)
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-sm text-slate-600">
            أجبت على {answeredCount} من {questions.length}
          </span>
          <button
            onClick={() => {
              if (answeredCount < questions.length) {
                if (!confirm(`لم تجب على ${questions.length - answeredCount} سؤال. تسليم الاختبار؟`)) return;
              }
              s.submitQuiz();
            }}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            تسليم الاختبار وعرض النتيجة
          </button>
        </div>
      )}

      {questions.map((q, i) => (
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
        </div>
      ))}
    </div>
  );
}

// ───────────────────────── teacher review ─────────────────────────

// Kept from the previous version: 109 answers were worked out rather than taken
// from the booklet's key, and still need a teacher to confirm them.
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
        {pending.length} إجابة تحتاج تأكيد المعلم. اضغط على الخيار الصحيح لتصحيحه، أو أكّد الإجابة الحالية.
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

// Only mounted while exporting. Contains the whole booklet — lessons as page
// images followed by every question — so "Save as PDF" gives a study handout.
function PrintDocument({
  classWork,
  quiz,
}: {
  classWork: QuizQuestion[];
  quiz: QuizQuestion[];
}) {
  return (
    <div className="print-only" dir="rtl">
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>الاختبار الموحد</h1>
      <p style={{ color: "#555", marginBottom: 18 }}>
        قدرات الرياضيات — مذكرة أ. محمد جمعة العساف
      </p>

      {LESSONS.map((lesson) => (
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
        </section>
      ))}

      <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 22 }}>العمل الصفي</h2>
      {classWork.map((q, i) => (
        <PrintQuestion key={q.id} q={q} index={i + 1} />
      ))}

      <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 22 }}>الاختبار</h2>
      {quiz.map((q, i) => (
        <PrintQuestion key={q.id} q={q} index={i + 1} />
      ))}
    </div>
  );
}

function PrintQuestion({ q, index }: { q: QuizQuestion; index: number }) {
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
    </div>
  );
}
