"use client";

import { useCallback, useEffect, useState } from "react";
import { uid } from "@/lib/uid";

export type QuestionType = "yesno" | "multi";

export type Question = {
  id: string;
  label: string;
  type: QuestionType;
  options?: string[]; // used when type === "multi"
};

// The starting questions (used the first time the app runs).
export const DEFAULT_QUESTIONS: Question[] = [
  { id: "answeredCall", label: "Did the student answer our call?", type: "yesno" },
  { id: "scholarship", label: "Does the student want a scholarship?", type: "yesno" },
  {
    id: "countries",
    label: "Which countries does the student want to apply for?",
    type: "multi",
    options: ["UK", "USA", "AZ/NZ"],
  },
];

const STORAGE_KEY = "masar.questions";

// Temporary local store. Later this is replaced by Firebase.
export function useQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setQuestions(JSON.parse(raw));
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_QUESTIONS));
        setQuestions(DEFAULT_QUESTIONS);
      }
    } catch {
      setQuestions(DEFAULT_QUESTIONS);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setQuestions(JSON.parse(e.newValue));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function persist(next: Question[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  const addQuestion = useCallback((q: Omit<Question, "id">) => {
    setQuestions((prev) => persist([...prev, { ...q, id: uid() }]));
  }, []);

  const updateQuestion = useCallback(
    (id: string, patch: Partial<Omit<Question, "id">>) => {
      setQuestions((prev) =>
        persist(prev.map((q) => (q.id === id ? { ...q, ...patch } : q)))
      );
    },
    []
  );

  const removeQuestion = useCallback((id: string) => {
    setQuestions((prev) => persist(prev.filter((q) => q.id !== id)));
  }, []);

  return { questions, addQuestion, updateQuestion, removeQuestion, loaded };
}
