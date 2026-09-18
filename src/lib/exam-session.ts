"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// A student's progress through the unified exam. Kept in the browser so work
// survives a refresh or an accidental tab close without needing a login per
// student. "Start a new session" clears it.
export type Session = {
  startedAt: string;
  // question id -> chosen option index, for the class-work section
  classWork: Record<string, number>;
  // question id -> chosen option index, for the graded quiz
  quiz: Record<string, number>;
  // once submitted the quiz is locked and the grade is shown
  submitted: boolean;
};

const KEY = "unified-exam-session-v1";
const AUTOSAVE_KEY = "unified-exam-autosave-v1";

function emptySession(startedAt: string): Session {
  return { startedAt, classWork: {}, quiz: {}, submitted: false };
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
        const parsed = JSON.parse(raw) as Session;
        setSession({
          startedAt: parsed.startedAt ?? new Date().toISOString(),
          classWork: parsed.classWork ?? {},
          quiz: parsed.quiz ?? {},
          submitted: Boolean(parsed.submitted),
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

  // Persist on every change while auto-save is on.
  useEffect(() => {
    if (!loaded) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!autoSave) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(session));
      setSavedAt(new Date().toISOString());
    } catch {
      // Out of quota or private mode — keep working, just don't persist.
    }
  }, [session, autoSave, loaded]);

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

  const submitQuiz = useCallback(() => {
    setSession((s) => ({ ...s, submitted: true }));
  }, []);

  const newSession = useCallback(() => {
    const fresh = emptySession(new Date().toISOString());
    setSession(fresh);
    setSavedAt(null);
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // Explicit save, for when auto-save is switched off.
  const saveNow = useCallback(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(session));
      setSavedAt(new Date().toISOString());
    } catch {
      /* ignore */
    }
  }, [session]);

  return {
    session,
    loaded,
    autoSave,
    setAutoSave,
    savedAt,
    answerClassWork,
    answerQuiz,
    submitQuiz,
    newSession,
    saveNow,
  };
}
