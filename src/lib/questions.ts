"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type QuestionType = "yesno" | "multi";

export type Question = {
  id: string;
  label: string;
  type: QuestionType;
  options?: string[]; // used when type === "multi"
};

// The yes/no "scholarship" question (matched by name), used by the green ✓ flag.
export function scholarshipQuestionId(questions: Question[]): string | null {
  const q = questions.find(
    (q) => q.type === "yesno" && q.label.toLowerCase().includes("scholarship")
  );
  return q?.id ?? null;
}

type Row = {
  id: string;
  label: string;
  type: QuestionType;
  options: string[] | null;
};

function mapRow(r: Row): Question {
  return { id: r.id, label: r.label, type: r.type, options: r.options ?? [] };
}

// Cloud-backed: the configurable questions are shared across everyone.
export function useQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("questions")
      .select("id, label, type, options, position")
      .order("position", { ascending: true });
    setQuestions((data ?? []).map((r) => mapRow(r as Row)));
    setLoaded(true);
  }, []);

  useEffect(() => {
    refetch();
    // Listen only for added/removed questions (not letter-by-letter edits).
    const channel = supabase
      .channel("questions-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "questions" },
        () => refetch()
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "questions" },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const addQuestion = useCallback(
    async (q: Omit<Question, "id">) => {
      await supabase.from("questions").insert({
        label: q.label,
        type: q.type,
        options: q.options ?? [],
        position: questions.length,
      });
      refetch();
    },
    [refetch, questions.length]
  );

  const updateQuestion = useCallback(
    async (id: string, patch: Partial<Omit<Question, "id">>) => {
      // Optimistic local update (keeps typing responsive).
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, ...patch } : q))
      );
      await supabase.from("questions").update(patch).eq("id", id);
    },
    []
  );

  const removeQuestion = useCallback(
    async (id: string) => {
      await supabase.from("questions").delete().eq("id", id);
      refetch();
    },
    [refetch]
  );

  return { questions, addQuestion, updateQuestion, removeQuestion, loaded };
}
