"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type QuizQuestion = {
  id: string;
  topic: string;
  section: string;
  sourcePage: number | null;
  number: number | null;
  body: string;
  options: string[];
  answerIndex: number;
  // false = the answer was worked out rather than taken from the booklet's
  // answer key, so it still needs a human check.
  verified: boolean;
  work: string;
  steps: string[];
};

type Row = {
  id: string;
  topic: string;
  section: string;
  source_page: number | null;
  number: number | null;
  body: string;
  options: string[] | null;
  answer_index: number;
  verified: boolean;
  work: string | null;
  steps: string[] | null;
};

function mapRow(r: Row): QuizQuestion {
  return {
    id: r.id,
    topic: r.topic,
    section: r.section,
    sourcePage: r.source_page,
    number: r.number,
    body: r.body,
    options: r.options ?? [],
    answerIndex: r.answer_index,
    verified: r.verified,
    work: r.work ?? "",
    steps: r.steps ?? [],
  };
}

const COLUMNS =
  "id, topic, section, source_page, number, body, options, answer_index, verified, work, steps, position";

export function useQuizQuestions() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from("quiz_questions")
      .select(COLUMNS)
      .order("position", { ascending: true });

    if (error) {
      // Most likely the table hasn't been created yet — say so plainly rather
      // than rendering an empty quiz that looks like there are no questions.
      setError(error.message);
      setLoaded(true);
      return;
    }
    setError(null);
    setQuestions((data ?? []).map((r) => mapRow(r as Row)));
    setLoaded(true);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Used by the review screen: confirm the worked-out answer, or correct it.
  const setAnswer = useCallback(
    async (id: string, answerIndex: number) => {
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === id ? { ...q, answerIndex, verified: true } : q
        )
      );
      await supabase
        .from("quiz_questions")
        .update({ answer_index: answerIndex, verified: true })
        .eq("id", id);
    },
    []
  );

  return { questions, loaded, error, refetch, setAnswer };
}

// Groups questions by their printed section, preserving seed order.
export function bySection(questions: QuizQuestion[]) {
  const groups: { section: string; topic: string; questions: QuizQuestion[] }[] = [];
  for (const q of questions) {
    const last = groups[groups.length - 1];
    if (last && last.section === q.section) last.questions.push(q);
    else groups.push({ section: q.section, topic: q.topic, questions: [q] });
  }
  return groups;
}
