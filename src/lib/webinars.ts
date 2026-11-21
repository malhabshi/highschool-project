"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uid } from "@/lib/uid";
import { newRoomCode } from "@/lib/video-room";
import type { Participant } from "@/lib/video-call";

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

export async function setWebinarHost(id: string, hostId: string) {
  await supabase.from("webinars").update({ host_id: hostId }).eq("id", id);
}

// Live webinars the given staff member is the host of (for the sidebar badge
// and the "you're hosting" banner — e.g. after a colleague hands one over).
export function useMyLiveWebinars(userId: string) {
  const [live, setLive] = useState<Webinar[]>([]);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("webinars")
      .select(WEBINAR_COLUMNS)
      .eq("status", "live")
      .eq("host_id", userId);
    setLive((data ?? []).map((r) => toWebinar(r as Record<string, unknown>)));
  }, [userId]);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel(`my-webinars-${uid()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "webinars" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  return live;
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
    const channel = supabase
      .channel(`webinar-${id}-${uid()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "webinars", filter: `id=eq.${id}` },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, refetch]);

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

// ───────── Guest hosts (attendees made host by staff) ─────────

export type GuestKey = { secret: string; hash: string };

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// This browser's secret for a webinar. Kept for the tab's session so a guest
// host who reloads the page is still host. Only the hash is ever shared.
export async function getGuestKey(code: string): Promise<GuestKey> {
  const storageKey = `masar-webinar-secret-${code}`;
  let secret = "";
  try {
    secret = sessionStorage.getItem(storageKey) ?? "";
  } catch {
    // storage unavailable — a fresh secret works, it just won't survive a reload
  }
  if (!secret) {
    secret = uid() + uid();
    try {
      sessionStorage.setItem(storageKey, secret);
    } catch {
      // see above
    }
  }
  // crypto.subtle needs https; without it this attendee can't be made host.
  const hash = crypto.subtle ? await sha256Hex(secret) : "";
  return { secret, hash };
}

export async function grantGuestHost(webinarId: string, secretHash: string, name: string) {
  const { error } = await supabase
    .from("webinar_guest_hosts")
    .upsert(
      { webinar_id: webinarId, secret_hash: secretHash, name, revoked: false },
      { onConflict: "webinar_id,secret_hash" }
    );
  return !error;
}

export async function revokeGuestHost(webinarId: string, secretHash: string) {
  await supabase
    .from("webinar_guest_hosts")
    .update({ revoked: true })
    .eq("webinar_id", webinarId)
    .eq("secret_hash", secretHash);
}

export async function guestIsHost(code: string, key: GuestKey): Promise<boolean> {
  const { data } = await supabase.rpc("guest_is_host", { p_code: code, p_secret: key.secret });
  return data === true;
}

export async function guestEndWebinar(code: string, key: GuestKey): Promise<boolean> {
  const { error } = await supabase.rpc("guest_end_webinar", { p_code: code, p_secret: key.secret });
  return !error;
}

// Q&A for a guest host (they can't read the table directly). Refreshes every
// few seconds; call `refetch` when a room message says something changed.
export function useGuestQuestions(code: string, key: GuestKey, enabled: boolean) {
  const [questions, setQuestions] = useState<WebinarQuestion[]>([]);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase.rpc("guest_list_questions", {
      p_code: code,
      p_secret: key.secret,
    });
    if (error) return;
    setQuestions(
      ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        text: r.text as string,
        answered: r.answered as boolean,
        createdAt: r.created_at as string,
      }))
    );
  }, [code, key.secret]);

  useEffect(() => {
    if (!enabled) return;
    refetch();
    const timer = setInterval(refetch, 8000);
    return () => clearInterval(timer);
  }, [enabled, refetch]);

  const setAnswered = useCallback(
    async (id: string, answered: boolean) => {
      setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, answered } : q)));
      await supabase.rpc("guest_set_question_answered", {
        p_code: code,
        p_secret: key.secret,
        p_id: id,
        p_answered: answered,
      });
    },
    [code, key.secret]
  );

  return { questions, setAnswered, refetch };
}

// ───────── Verified hosts (for private chat) ─────────

export async function registerStaffHostKey(webinarId: string, peerId: string, publicKey: string) {
  await supabase
    .from("webinar_host_keys")
    .upsert(
      { webinar_id: webinarId, peer_id: peerId, public_key: publicKey },
      { onConflict: "webinar_id,peer_id" }
    );
}

export async function guestRegisterHostKey(
  code: string,
  key: GuestKey,
  peerId: string,
  publicKey: string
) {
  await supabase.rpc("guest_register_host_key", {
    p_code: code,
    p_secret: key.secret,
    p_peer_id: peerId,
    p_public_key: publicKey,
  });
}

// Peer ids of people who are really hosts: they say so AND their encryption
// key is registered in the database. Messages "to the hosts" only go to them,
// and attendees only obey room controls from them. `refresh` re-checks now
// (e.g. when a message arrives from someone who claims to be a host).
export function useVerifiedHosts(code: string, participants: Participant[]) {
  const [listed, setListed] = useState<Map<string, string>>(new Map());
  const [nonce, setNonce] = useState(0);
  const lastRefresh = useRef(0);

  const claimed = participants.filter((p) => p.host && p.publicKey);
  const signature = claimed.map((p) => `${p.peerId}:${p.publicKey}`).join("|");

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase.rpc("get_webinar_host_keys", { p_code: code });
      if (!active) return;
      setListed(
        new Map(
          ((data ?? []) as { peer_id: string; public_key: string }[]).map((r) => [
            r.peer_id,
            r.public_key,
          ])
        )
      );
    }
    load();
    // A new host registers their key a moment after they appear; check again.
    const soon = setTimeout(load, 2500);
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearTimeout(soon);
      clearInterval(timer);
    };
  }, [code, signature, nonce]);

  const refresh = useCallback(() => {
    // At most once a second, however many messages arrive.
    if (Date.now() - lastRefresh.current < 1000) return;
    lastRefresh.current = Date.now();
    setNonce((n) => n + 1);
  }, []);

  const ids = new Set(
    claimed.filter((p) => listed.get(p.peerId) === p.publicKey).map((p) => p.peerId)
  );
  return { ids, refresh };
}
