"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uid } from "@/lib/uid";
import { newRoomCode } from "@/lib/video-room";

// The webinar's audience connects straight to the presenter's browser, so the
// presenter's upload limits how many can watch smoothly.
export const WEBINAR_VIEWER_LIMIT = 10;

export type WebinarStatus = "scheduled" | "live" | "ended";

export type Webinar = {
  id: string;
  code: string;
  title: string;
  description: string;
  scheduledAt: string; // ISO timestamp
  status: WebinarStatus;
  hostId: string | null;
  hostName: string;
};

export type Registration = {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
};

export type WebinarQuestion = {
  id: string;
  name: string;
  text: string;
  answered: boolean;
  createdAt: string;
};

export function webinarTopic(code: string) {
  return `webinar-${code}`;
}

export function publicWebinarUrl(code: string) {
  return `${window.location.origin}/w/${code}`;
}

export function formatWebinarTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuwait",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function toWebinar(r: Record<string, unknown>): Webinar {
  const host = r.host as { name?: string } | null | undefined;
  return {
    id: r.id as string,
    code: r.code as string,
    title: r.title as string,
    description: (r.description as string) ?? "",
    scheduledAt: r.scheduled_at as string,
    status: r.status as WebinarStatus,
    hostId: (r.host_id as string) ?? null,
    hostName: (r.host_name as string) ?? host?.name ?? "",
  };
}

const WEBINAR_COLUMNS =
  "id, code, title, description, scheduled_at, status, host_id, host:profiles(name)";

// ───────── Staff ─────────

export function useWebinars() {
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(async () => {
    const [{ data }, { data: regs }] = await Promise.all([
      supabase.from("webinars").select(WEBINAR_COLUMNS).order("scheduled_at", { ascending: false }),
      supabase.from("webinar_registrations").select("webinar_id"),
    ]);
    setWebinars((data ?? []).map((r) => toWebinar(r as Record<string, unknown>)));
    const c: Record<string, number> = {};
    for (const r of regs ?? []) c[r.webinar_id as string] = (c[r.webinar_id as string] ?? 0) + 1;
    setCounts(c);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel(`webinars-${uid()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "webinar_registrations" }, () =>
        refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  return { webinars, counts, loaded, refetch };
}

export async function createWebinar(input: {
  title: string;
  description: string;
  scheduledAt: string;
  hostId: string;
}): Promise<string | null> {
  const { error } = await supabase.from("webinars").insert({
    code: newRoomCode(),
    title: input.title.trim(),
    description: input.description.trim(),
    scheduled_at: input.scheduledAt,
    host_id: input.hostId,
  });
  return error ? error.message : null;
}

export async function deleteWebinar(id: string) {
  await supabase.from("webinars").delete().eq("id", id);
}

export async function setWebinarStatus(id: string, status: WebinarStatus) {
  await supabase.from("webinars").update({ status }).eq("id", id);
}

export function useWebinar(id: string) {
  const [webinar, setWebinar] = useState<Webinar | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(async () => {
    const { data } = await supabase.from("webinars").select(WEBINAR_COLUMNS).eq("id", id).maybeSingle();
    setWebinar(data ? toWebinar(data as Record<string, unknown>) : null);
    setLoaded(true);
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { webinar, loaded, refetch };
}

export function useRegistrations(webinarId: string) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("webinar_registrations")
      .select("id, name, email, phone, created_at")
      .eq("webinar_id", webinarId)
      .order("created_at", { ascending: true });
    setRegistrations(
      (data ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        email: r.email as string,
        phone: r.phone as string,
        createdAt: r.created_at as string,
      }))
    );
  }, [webinarId]);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel(`webinar-regs-${uid()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "webinar_registrations",
          filter: `webinar_id=eq.${webinarId}`,
        },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [webinarId, refetch]);

  return registrations;
}

export function useWebinarQuestions(webinarId: string) {
  const [questions, setQuestions] = useState<WebinarQuestion[]>([]);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("webinar_questions")
      .select("id, name, text, answered, created_at")
      .eq("webinar_id", webinarId)
      .order("created_at", { ascending: true });
    setQuestions(
      (data ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        text: r.text as string,
        answered: r.answered as boolean,
        createdAt: r.created_at as string,
      }))
    );
  }, [webinarId]);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel(`webinar-qs-${uid()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "webinar_questions",
          filter: `webinar_id=eq.${webinarId}`,
        },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [webinarId, refetch]);

  const setAnswered = useCallback(async (id: string, answered: boolean) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, answered } : q)));
    await supabase.from("webinar_questions").update({ answered }).eq("id", id);
  }, []);

  return { questions, setAnswered };
}

// ───────── Public (no login) ─────────

export async function getPublicWebinar(code: string): Promise<Webinar | null> {
  const { data } = await supabase.rpc("get_public_webinar", { p_code: code });
  const row = (data as Record<string, unknown>[] | null)?.[0];
  return row ? toWebinar(row) : null;
}

export async function registerForWebinar(
  code: string,
  input: { name: string; email: string; phone: string }
): Promise<string | null> {
  const { error } = await supabase.rpc("register_for_webinar", {
    p_code: code,
    p_name: input.name,
    p_email: input.email,
    p_phone: input.phone,
  });
  return error ? "Couldn't register. Please check your details and try again." : null;
}

export async function askWebinarQuestion(
  code: string,
  name: string,
  text: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc("ask_webinar_question", {
    p_code: code,
    p_name: name,
    p_text: text,
  });
  return error ? null : (data as string);
}
