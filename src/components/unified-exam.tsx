"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuizQuestions, type QuizQuestion } from "@/lib/quiz";
import { useExamSession, type Stroke } from "@/lib/exam-session";
import { MathText } from "@/components/math-text";
import { WorkArea } from "@/components/work-area";
import {
  DrawingPreview,
  DrawSurface,
  PenToolbar,
  StrokePaths,
  useDrawTools,
  CONTENT,
} from "@/components/scratchpad";
import { LessonPageContent, hasContent } from "@/components/lesson-page";
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

// A colour per lesson so students can tell where they are at a glance. Written
// out in full because Tailwind only keeps classes it can see as literal text.
const ACCENTS = [
  { solid: "bg-sky-500", soft: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  { solid: "bg-violet-500", soft: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  { solid: "bg-emerald-500", soft: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  { solid: "bg-amber-500", soft: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  { solid: "bg-rose-500", soft: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  { solid: "bg-teal-500", soft: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  { solid: "bg-indigo-500", soft: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
];
const accentFor = (i: number) => ACCENTS[i % ACCENTS.length];

type Step = { kind: "lesson"; lesson: Lesson } | { kind: "exam" } | { kind: "review" };

export function UnifiedExam() {
  const { questions, loaded, error, setAnswer } = useQuizQuestions();
  const s = useExamSession();
  const [index, setIndex] = useState(0);
  const [printing, setPrinting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const totalAnswered =
    Object.keys(s.session.classWork).length + Object.keys(s.session.quiz).length;
  const overallPct = questions.length
    ? Math.round((totalAnswered / questions.length) * 100)
    : 0;

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

  function goTo(i: number) {
    setIndex(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!loaded) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-white p-6 text-slate-500 shadow-sm">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        جارٍ التحميل…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
        <p className="text-lg font-semibold">لم يتم تحميل الأسئلة</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }

  const step = steps[index];

  return (
    <div dir="rtl" className="space-y-5 pb-24 sm:pb-6">
      <Header
        pct={overallPct}
        answered={totalAnswered}
        total={questions.length}
        s={s}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        onExport={() => setPrinting(true)}
      />

      <LessonRail steps={steps} index={index} onPick={goTo} questions={questions} s={s} />

      <div className="no-print">
        {step.kind === "lesson" && (
          <LessonStep
            lesson={step.lesson}
            accent={accentFor(index)}
            questions={questions}
            s={s}
          />
        )}
        {step.kind === "exam" && <ExamStep questions={examQuestions} s={s} />}
        {step.kind === "review" && <Review questions={questions} onConfirm={setAnswer} />}
      </div>

      <BottomNav index={index} steps={steps} onGo={goTo} />

      {printing && <PrintDocument questions={questions} s={s} />}
    </div>
  );
}

// ───────────────────────── header ─────────────────────────

function Header({
  pct,
  answered,
  total,
  s,
  menuOpen,
  setMenuOpen,
  onExport,
}: {
  pct: number;
  answered: number;
  total: number;
  s: Session;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  onExport: () => void;
}) {
  return (
    <div className="no-print overflow-hidden rounded-2xl bg-gradient-to-l from-blue-600 to-indigo-700 text-white shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h1 className="text-2xl font-bold">الاختبار الموحد</h1>
          <p className="text-sm text-blue-100">قدرات الرياضيات</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-left">
            <p className="text-3xl font-bold leading-none">{pct}%</p>
            <p className="text-xs text-blue-100">
              {answered} من {total} سؤال
            </p>
          </div>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="خيارات"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-xl transition hover:bg-white/25"
          >
            ⚙️
          </button>
        </div>
      </div>

      <div className="h-2 w-full bg-white/20">
        <div
          className="h-full bg-gradient-to-l from-emerald-300 to-emerald-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {menuOpen && (
        <div className="space-y-3 border-t border-white/20 bg-white/10 p-4 text-sm backdrop-blur">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={s.autoSave}
              onChange={(e) => s.setAutoSave(e.target.checked)}
              className="h-5 w-5"
            />
            حفظ تلقائي
            <span className="text-blue-100">
              {s.savedAt
                ? `· آخر حفظ ${new Date(s.savedAt).toLocaleTimeString("ar")}`
                : "· لم يُحفظ بعد"}
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            {!s.autoSave && (
              <MenuButton onClick={s.saveNow}>💾 حفظ الآن</MenuButton>
            )}
            <MenuButton onClick={onExport}>⬇️ تصدير PDF</MenuButton>
            <MenuButton
              onClick={() => {
                if (confirm("بدء جلسة جديدة سيمسح كل الإجابات والملاحظات والرسم. متأكد؟")) {
                  s.newSession();
                }
              }}
            >
              🔄 جلسة جديدة
            </MenuButton>
          </div>

          {s.storageError && (
            <p className="rounded-lg bg-red-500/90 p-2 text-white">{s.storageError}</p>
          )}
        </div>
      )}
    </div>
  );
}

function MenuButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="min-h-11 rounded-xl bg-white/20 px-4 py-2 font-medium transition hover:bg-white/30"
    >
      {children}
    </button>
  );
}

// ───────────────────────── lesson rail ─────────────────────────

// Horizontal scroller rather than a wrapping chip grid: on a phone the chips
// used to reflow into four cramped rows.
function LessonRail({
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
    <div className="no-print -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
      {steps.map((st, i) => {
        const active = i === index;
        const accent = accentFor(i);

        let title: string;
        let sub: string;
        let done = 0;
        let total = 0;

        if (st.kind === "lesson") {
          title = st.lesson.title;
          const items = questions.filter((q) => q.section === st.lesson.classWork);
          total = items.length;
          done = items.filter((q) => s.session.classWork[q.id] !== undefined).length;
          sub = `${done}/${total} تمرين`;
        } else if (st.kind === "exam") {
          title = "الاختبار النهائي";
          const items = questions.filter((q) => q.topic === QUIZ_TOPIC);
          total = items.length;
          done = items.filter((q) => s.session.quiz[q.id] !== undefined).length;
          sub = s.session.submitted ? "تم التسليم" : `${done}/${total} سؤال`;
        } else {
          title = "مراجعة المعلم";
          sub = "تأكيد الإجابات";
        }

        const complete = total > 0 && done === total;

        return (
          <button
            key={i}
            onClick={() => onPick(i)}
            className={`w-40 shrink-0 snap-start rounded-2xl border-2 p-3 text-right transition ${
              active
                ? `${accent.soft} ${accent.border} shadow-md`
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${
                  complete ? "bg-emerald-500" : accent.solid
                }`}
              >
                {complete ? "✓" : st.kind === "lesson" ? i + 1 : st.kind === "exam" ? "📝" : "🔍"}
              </span>
              {active && <span className="text-xs font-medium text-slate-500">هنا</span>}
            </div>
            <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-800">
              {title}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
            {total > 0 && (
              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all ${
                    complete ? "bg-emerald-500" : accent.solid
                  }`}
                  style={{ width: `${total ? (done / total) * 100 : 0}%` }}
                />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ───────────────────────── bottom nav ─────────────────────────

// Sticky on phones so moving between lessons never needs a scroll back up.
function BottomNav({
  index,
  steps,
  onGo,
}: {
  index: number;
  steps: Step[];
  onGo: (i: number) => void;
}) {
  const label = (i: number) => {
    const st = steps[i];
    if (!st) return "";
    if (st.kind === "lesson") return st.lesson.title;
    return st.kind === "exam" ? "الاختبار النهائي" : "مراجعة المعلم";
  };

  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:static sm:rounded-2xl sm:border sm:shadow-sm">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-2">
        <button
          onClick={() => onGo(Math.max(0, index - 1))}
          disabled={index === 0}
          className="min-h-12 flex-1 rounded-xl px-4 text-sm font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-40"
        >
          ← {index > 0 ? label(index - 1) : "السابق"}
        </button>
        <span className="shrink-0 text-xs text-slate-400">
          {index + 1}/{steps.length}
        </span>
        <button
          onClick={() => onGo(Math.min(steps.length - 1, index + 1))}
          disabled={index === steps.length - 1}
          className="min-h-12 flex-1 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-40"
        >
          {index < steps.length - 1 ? label(index + 1) : "النهاية"} →
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── a lesson ─────────────────────────

type Accent = (typeof ACCENTS)[number];

function LessonStep({
  lesson,
  accent,
  questions,
  s,
}: {
  lesson: Lesson;
  accent: Accent;
  questions: QuizQuestion[];
  s: Session;
}) {
  // Reading and solving are separate views. Stacking 15 questions under 6 pages
  // of theory made a scroll long enough that students lost their place.
  const [mode, setMode] = useState<"read" | "solve">("read");
  const items = questions.filter((q) => q.section === lesson.classWork);
  const noteKey = `lesson:${lesson.id}`;
  const done = items.filter((q) => s.session.classWork[q.id] !== undefined).length;
  const right = items.filter((q) => s.session.classWork[q.id] === q.answerIndex).length;

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border-2 ${accent.border} ${accent.soft} p-5`}>
        <h2 className="text-2xl font-bold text-slate-800">{lesson.title}</h2>
        <p className={`text-sm ${accent.text}`}>{lesson.titleEn}</p>
      </div>

      <div className="flex gap-2 rounded-2xl bg-slate-100 p-1.5">
        <SegButton active={mode === "read"} onClick={() => setMode("read")}>
          📖 اقرأ الدرس
        </SegButton>
        <SegButton active={mode === "solve"} onClick={() => setMode("solve")}>
          ✏️ حل التمارين
          {items.length > 0 && (
            <span className="mr-2 rounded-full bg-white/70 px-2 py-0.5 text-xs text-slate-700">
              {done}/{items.length}
            </span>
          )}
        </SegButton>
      </div>

      {mode === "read" ? (
        <div className="space-y-4">
          {lesson.pages.map((p) => (
            <AnnotatablePage key={p} page={p} title={lesson.title} s={s} />
          ))}

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-1 font-semibold text-slate-700">ملاحظات عامة على الدرس</p>
            <WorkArea
              note={s.session.notes[noteKey] ?? ""}
              strokes={s.session.drawings[noteKey] ?? []}
              onNote={(t) => s.setNote(noteKey, t)}
              onStrokes={(d) => s.setDrawing(noteKey, d)}
            />
          </div>

          {items.length > 0 && (
            <button
              onClick={() => {
                setMode("solve");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="w-full rounded-2xl bg-blue-600 p-4 text-lg font-semibold text-white shadow-md transition hover:bg-blue-700"
            >
              جاهز؟ ابدأ حل التمارين ({items.length}) ←
            </button>
          )}
        </div>
      ) : items.length === 0 ? (
        <NoQuestions />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
            <span className="text-slate-600">
              حللت <b className="text-slate-800">{done}</b> من {items.length}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
              ✓ {right} صحيحة
            </span>
          </div>

          {items.map((q, i) => (
            <PracticeCard key={q.id} q={q} index={i + 1} total={items.length} s={s} />
          ))}

          <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-800">
              أنهيت تمارين {lesson.title} 🎉
            </p>
            <p className="mt-1 text-slate-500">
              {right} إجابة صحيحة من {items.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-h-12 flex-1 rounded-xl px-4 text-base font-semibold transition ${
        active ? "bg-white text-slate-800 shadow" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

// ───────────────────────── a study page ─────────────────────────

function AnnotatablePage({
  page,
  title,
  s,
}: {
  page: number;
  title: string;
  s: Session;
}) {
  const key = `page:${page}`;
  const tools = useDrawTools();
  const [writing, setWriting] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [showScan, setShowScan] = useState(false);

  const strokes = s.session.drawings[key] ?? [];
  const note = s.session.notes[key] ?? "";
  const hasNote = note.trim().length > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="no-print flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 p-3">
        <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
          صفحة {page}
        </span>

        <ToolButton active={writing} onClick={() => setWriting(!writing)}>
          {writing ? "✏️ إيقاف القلم" : "✏️ اكتب على الصفحة"}
          {!writing && strokes.length > 0 && (
            <span className="mr-1 text-xs text-amber-600">({strokes.length})</span>
          )}
        </ToolButton>

        <ToolButton active={notesOpen} highlight={hasNote} onClick={() => setNotesOpen(!notesOpen)}>
          📝 ملاحظة {hasNote && "✍️"}
        </ToolButton>

        {hasContent(page) && (
          <ToolButton active={showScan} onClick={() => setShowScan(!showScan)}>
            {showScan ? "🌐 نسخة الموقع" : "📄 الأصلية"}
          </ToolButton>
        )}

        {writing && (
          <div className="w-full">
            <PenToolbar
              tools={tools}
              strokes={strokes}
              onChange={(d) => s.setDrawing(key, d)}
            />
          </div>
        )}
      </div>

      <div className="relative">
        {showScan || !hasContent(page) ? (
          <img
            src={`/booklet/p${String(page).padStart(2, "0")}.jpg`}
            alt={`${title} — صفحة ${page}`}
            loading="lazy"
            className="block w-full"
          />
        ) : (
          <div className="p-4 text-[17px] leading-loose sm:p-6">
            <LessonPageContent page={page} />
          </div>
        )}
        <DrawSurface
          width={CONTENT.w}
          height={CONTENT.h}
          strokes={strokes}
          onChange={(d) => s.setDrawing(key, d)}
          tools={tools}
          enabled={writing}
          className="absolute inset-0 h-full w-full"
          style={writing ? { boxShadow: "0 0 0 3px #2563eb inset" } : undefined}
        />
      </div>

      {notesOpen && (
        <div className="no-print border-t border-slate-100 p-3">
          <textarea
            value={note}
            onChange={(e) => s.setNote(key, e.target.value)}
            rows={3}
            placeholder={`ملاحظتك على صفحة ${page}…`}
            className="w-full rounded-xl border border-slate-300 p-3 text-base outline-none focus:border-blue-500"
          />
        </div>
      )}
    </div>
  );
}

function ToolButton({
  active,
  highlight,
  onClick,
  children,
}: {
  active?: boolean;
  highlight?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const base = "min-h-10 rounded-xl px-3 text-sm font-medium transition ring-1";
  const style = active
    ? "bg-blue-600 text-white ring-blue-600"
    : highlight
      ? "bg-amber-50 text-amber-800 ring-amber-300"
      : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-100";
  return (
    <button type="button" onClick={onClick} className={`${base} ${style}`}>
      {children}
    </button>
  );
}

// ───────────────────────── question cards ─────────────────────────

function PracticeCard({
  q,
  index,
  total,
  s,
}: {
  q: QuizQuestion;
  index: number;
  total: number;
  s: Session;
}) {
  const choice = s.session.classWork[q.id];
  const answered = choice !== undefined;
  const correct = answered && choice === q.answerIndex;
  const key = `q:${q.id}`;

  return (
    <div
      className={`overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition ${
        !answered
          ? "border-slate-200"
          : correct
            ? "border-emerald-300"
            : "border-rose-300"
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <span className="text-sm font-semibold text-slate-500">
          سؤال {index} <span className="font-normal text-slate-400">من {total}</span>
        </span>
        {answered && (
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              correct ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            }`}
          >
            {correct ? "✓ صحيح" : "✗ خطأ"}
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="text-[19px] leading-loose text-slate-800">
          <MathText text={q.body} />
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {q.options.map((opt, i) => (
            <OptionButton
              key={i}
              letter={LETTERS[i]}
              text={opt}
              state={
                !answered
                  ? "idle"
                  : i === q.answerIndex
                    ? "correct"
                    : i === choice
                      ? "wrong"
                      : "dim"
              }
              onClick={() => s.answerClassWork(q.id, i)}
              disabled={answered}
            />
          ))}
        </div>

        {answered && <Solution q={q} />}
        {answered && !q.verified && (
          <p className="mt-2 text-sm text-amber-700">
            ⚠️ هذه الإجابة تحتاج مراجعة المعلم.
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
    </div>
  );
}

function OptionButton({
  letter,
  text,
  state,
  onClick,
  disabled,
}: {
  letter: string;
  text: string;
  state: "idle" | "correct" | "wrong" | "dim" | "picked";
  onClick: () => void;
  disabled?: boolean;
}) {
  const styles: Record<string, string> = {
    idle: "bg-white ring-slate-200 hover:ring-blue-400 hover:bg-blue-50/50",
    picked: "bg-blue-50 ring-blue-400",
    correct: "bg-emerald-50 ring-emerald-400",
    wrong: "bg-rose-50 ring-rose-400",
    dim: "bg-white ring-slate-200 opacity-60",
  };
  const badges: Record<string, string> = {
    idle: "bg-slate-100 text-slate-600",
    picked: "bg-blue-600 text-white",
    correct: "bg-emerald-500 text-white",
    wrong: "bg-rose-500 text-white",
    dim: "bg-slate-100 text-slate-400",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-14 items-start gap-3 rounded-xl p-3.5 text-right ring-2 transition disabled:cursor-default ${styles[state]}`}
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${badges[state]}`}
      >
        {state === "correct" ? "✓" : state === "wrong" ? "✗" : letter}
      </span>
      <span className="text-[17px] text-slate-800">
        <MathText text={text} />
      </span>
    </button>
  );
}

// The worked solution. Steps are stored with maths in $...$ and rendered
// through KaTeX — as plain text the formulas were unreadable, because
// right-to-left Arabic reverses a bare "∛192 = 4∛3" into "3√4 = 192√3".
function Solution({ q }: { q: QuizQuestion }) {
  const steps = q.steps?.length ? q.steps : q.work ? [q.work] : [];
  if (steps.length === 0) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-blue-200 bg-blue-50/60">
      <p className="border-b border-blue-200 bg-blue-100/60 px-4 py-2 text-sm font-bold text-blue-900">
        💡 طريقة الحل خطوة بخطوة
      </p>
      <ol className="space-y-2.5 p-4">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {i + 1}
            </span>
            <span className="text-[17px] leading-loose text-slate-800">
              <MathText text={step} />
            </span>
          </li>
        ))}
      </ol>
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
        <ResultCard score={score} total={questions.length} pct={pct} />
      ) : (
        <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-5">
          <p className="text-lg font-semibold text-slate-800">📝 الاختبار النهائي</p>
          <p className="mt-1 text-slate-600">
            أجب على كل الأسئلة ثم سلّم لتظهر نتيجتك. لن تستطيع التعديل بعد التسليم.
          </p>
          <div className="mt-3 h-2 w-full rounded-full bg-white">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${(answered / questions.length) * 100}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-slate-600">
              أجبت على <b>{answered}</b> من {questions.length}
            </span>
            <button
              onClick={() => {
                if (
                  answered < questions.length &&
                  !confirm(`لم تجب على ${questions.length - answered} سؤال. تسليم الاختبار؟`)
                )
                  return;
                s.submitQuiz();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="min-h-12 rounded-xl bg-emerald-600 px-6 font-semibold text-white shadow transition hover:bg-emerald-700"
            >
              تسليم الاختبار
            </button>
          </div>
        </div>
      )}

      {questions.map((q, i) => {
        const key = `q:${q.id}`;
        const picked = answers[q.id];
        return (
          <div
            key={q.id}
            className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-500">
              سؤال {i + 1} <span className="font-normal text-slate-400">من {questions.length}</span>
            </div>
            <div className="p-4">
              <div className="text-[19px] leading-loose text-slate-800">
                <MathText text={q.body} />
              </div>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {q.options.map((opt, oi) => (
                  <OptionButton
                    key={oi}
                    letter={LETTERS[oi]}
                    text={opt}
                    state={
                      submitted
                        ? oi === q.answerIndex
                          ? "correct"
                          : oi === picked
                            ? "wrong"
                            : "dim"
                        : picked === oi
                          ? "picked"
                          : "idle"
                    }
                    onClick={() => s.answerQuiz(q.id, oi)}
                    disabled={submitted}
                  />
                ))}
              </div>
              {submitted && <Solution q={q} />}
              <WorkArea
                compact
                note={s.session.notes[key] ?? ""}
                strokes={s.session.drawings[key] ?? []}
                onNote={(t) => s.setNote(key, t)}
                onStrokes={(d) => s.setDrawing(key, d)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResultCard({
  score,
  total,
  pct,
}: {
  score: number;
  total: number;
  pct: number;
}) {
  const pass = pct >= 50;
  const r = 52;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="rounded-2xl bg-white p-6 text-center shadow-md">
      <div className="relative mx-auto h-36 w-36">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={pass ? "#10b981" : "#f43f5e"}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct / 100)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-slate-800">{pct}%</span>
          <span className="text-sm text-slate-500">
            {score}/{total}
          </span>
        </div>
      </div>

      <p className={`mt-4 text-2xl font-bold ${pass ? "text-emerald-600" : "text-rose-600"}`}>
        {pass ? "أحسنت! 🎉" : "تحتاج مراجعة 💪"}
      </p>
      <p className="mt-1 text-slate-500">
        {pass
          ? "نتيجة جيدة — راجع الأخطاء بالأسفل لترفعها أكثر."
          : "لا بأس، راجع الدروس ثم أعد المحاولة بجلسة جديدة."}
      </p>
    </div>
  );
}

// ───────────────────────── shared ─────────────────────────

function NoQuestions() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
      <p className="text-lg font-semibold text-slate-800">لا توجد أسئلة لعرضها</p>
      <p className="mt-1">
        إما أن الأسئلة لم تُحمَّل في قاعدة البيانات، أو أن جلسة الدخول انتهت. جرّب
        تسجيل الدخول مرة أخرى.
      </p>
      <p className="mt-2 text-slate-500">
        قسم «اقرأ الدرس» يعمل بدون قاعدة بيانات، فيمكنك المتابعة منه.
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
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
        <p className="text-lg font-semibold text-slate-800">🔍 مراجعة المعلم</p>
        <p className="mt-1 text-slate-600">
          {pending.length} إجابة تحتاج تأكيد. اضغط على الخيار الصحيح لتصحيحه، أو أكّد
          الإجابة الحالية.
        </p>
      </div>

      {pending.map((q) => (
        <div key={q.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">
            {q.section} — سؤال {q.number} — صفحة {q.sourcePage}
          </div>
          <div className="mt-2 text-[17px] leading-loose text-slate-800">
            <MathText text={q.body} />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {q.options.map((opt, i) => (
              <OptionButton
                key={i}
                letter={LETTERS[i]}
                text={opt}
                state={i === q.answerIndex ? "correct" : "idle"}
                onClick={() => onConfirm(q.id, i)}
              />
            ))}
          </div>
          <Solution q={q} />
          <button
            onClick={() => onConfirm(q.id, q.answerIndex)}
            className="mt-3 min-h-11 rounded-xl bg-emerald-600 px-4 font-medium text-white transition hover:bg-emerald-700"
          >
            تأكيد هذه الإجابة
          </button>
        </div>
      ))}

      {pending.length === 0 && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
          كل الإجابات مؤكدة ✅
        </p>
      )}
    </div>
  );
}

// ───────────────────────── printable handout ─────────────────────────

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
              <PrintPage
                key={p}
                page={p}
                strokes={s.session.drawings[`page:${p}`] ?? []}
                note={s.session.notes[`page:${p}`] ?? ""}
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

function PrintPage({
  page,
  strokes,
  note,
}: {
  page: number;
  strokes: Stroke[];
  note: string;
}) {
  return (
    <div className="print-q">
      <div style={{ position: "relative" }}>
        {hasContent(page) ? (
          <div className="print-content">
            <LessonPageContent page={page} />
          </div>
        ) : (
          <img
            src={`/booklet/p${String(page).padStart(2, "0")}.jpg`}
            alt=""
            className="print-page"
          />
        )}
        {strokes.length > 0 && (
          <svg
            viewBox={`0 0 ${CONTENT.w} ${CONTENT.h}`}
            preserveAspectRatio="none"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          >
            <StrokePaths strokes={strokes} />
          </svg>
        )}
      </div>
      {note.trim().length > 0 && (
        <p
          style={{
            fontSize: 13,
            color: "#334155",
            whiteSpace: "pre-wrap",
            marginTop: 4,
            paddingInlineStart: 10,
            borderInlineStart: "3px solid #cbd5e1",
          }}
        >
          <b>صفحة {page}:</b> {note}
        </p>
      )}
    </div>
  );
}

function PrintQuestion({ q, index, s }: { q: QuizQuestion; index: number; s: Session }) {
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
    <div
      style={{
        marginTop: 6,
        paddingInlineStart: 10,
        borderInlineStart: "3px solid #cbd5e1",
      }}
    >
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
