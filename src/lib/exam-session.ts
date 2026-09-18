"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// One freehand stroke. Points are flattened [x,y,x,y,…] in the pad's own
// 1000×600 coordinate space, so a drawing made on a phone still lines up when
// the same session is opened on a tablet or printed.
export type Stroke = { c: string; w: number; p: number[] };

// A student's progress through the unified exam. Kept in the browser so work
// survives a refresh without needing a login per student.
export type Session = {
  startedAt: string;
  // question id -> chosen option index, for the lesson exercises
  classWork: Record<string, number>;
  // question id -> chosen option index, for the graded exam
  quiz: Record<string, number>;
  // once submitted the exam is locked and the grade is shown
  submitted: boolean;
  // typed notes, keyed "lesson:<id>" or "q:<questionId>"
  notes: Record<string, string>;
  // pencil work, keyed the same way
  drawings: Record<string, Stroke[]>;
};

const KEY = "unified-exam-session-v2";
const AUTOSAVE_KEY = "unified-exam-autosave-v1";

function emptySession(startedAt: string): Session {
  return {
    startedAt,
    classWork: {},
    quiz: {},
    submitted: false,
    notes: {},
    drawings: {},
  };
}

export function useExamSession() {
  const [session, setSession] = useState<Session>(() => emptySession(""));
  const [autoSave, setAutoSave] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // Nothing is read from localStorage during render, so the server and the
  // first client render agree; we load once mounted.
  const [loaded, setLoaded] = useState(false);
  const firstRun = useRef(true);

  useEffect(() => {
    try {
      const auto = window.localStorage.getItem(AUTOSAVE_KEY);
      if (auto !== null) setAutoSave(auto === "true");

      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Session>;
        setSession({
          startedAt: parsed.startedAt ?? new Date().toISOString(),
          classWork: parsed.classWork ?? {},
          quiz: parsed.quiz ?? {},
          submitted: Boolean(parsed.submitted),
          notes: parsed.notes ?? {},
          drawings: parsed.drawings ?? {},
        });
        setSavedAt(parsed.startedAt ?? null);
      } else {
        setSession(emptySession(new Date().toISOString()));
      }
    } catch {
      // Corrupt or unavailable storage shouldn't stop someone working.
      setSession(emptySession(new Date().toISOString()));
    }
    setLoaded(true);
  }, []);

  const [storageError, setStorageError] = useState<string | null>(null);

  const persist = useCallback((next: Session) => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
      setSavedAt(new Date().toISOString());
      setStorageError(null);
      return true;
    } catch {
      // Pencil drawings are the one thing here big enough to fill the quota.
      setStorageError(
        "تعذّر الحفظ — مساحة التخزين ممتلئة. امسح بعض الرسم بالقلم أو ابدأ جلسة جديدة."
      );
      return false;
    }
  }, []);

  // Persist on every change while auto-save is on.
  useEffect(() => {
    if (!loaded) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!autoSave) return;
    persist(session);
  }, [session, autoSave, loaded, persist]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(AUTOSAVE_KEY, String(autoSave));
    } catch {
      /* ignore */
    }
  }, [autoSave, loaded]);

  const answerClassWork = useCallback((id: string, choice: number) => {
    setSession((s) => ({ ...s, classWork: { ...s.classWork, [id]: choice } }));
  }, []);

  const answerQuiz = useCallback((id: string, choice: number) => {
    setSession((s) =>
      s.submitted ? s : { ...s, quiz: { ...s.quiz, [id]: choice } }
    );
  }, []);

  const setNote = useCallback((key: string, text: string) => {
    setSession((s) => ({ ...s, notes: { ...s.notes, [key]: text } }));
  }, []);

  const setDrawing = useCallback((key: string, strokes: Stroke[]) => {
    setSession((s) => ({ ...s, drawings: { ...s.drawings, [key]: strokes } }));
  }, []);

  const submitQuiz = useCallback(() => {
    setSession((s) => ({ ...s, submitted: true }));
  }, []);

  const newSession = useCallback(() => {
    setSession(emptySession(new Date().toISOString()));
    setSavedAt(null);
    setStorageError(null);
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // Explicit save, for when auto-save is switched off.
  const saveNow = useCallback(() => persist(session), [persist, session]);

  return {
    session,
    loaded,
    autoSave,
    setAutoSave,
    savedAt,
    storageError,
    answerClassWork,
    answerQuiz,
    setNote,
    setDrawing,
    submitQuiz,
    newSession,
    saveNow,
  };
}
