"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uid } from "@/lib/uid";
import { useRole } from "@/components/role-context";

// Sentinel thread id for the shared admin↔admin group channel (not a profile).
export const ADMIN_THREAD = "00000000-0000-0000-0000-000000000000";

// A chat message inside one admin↔employee thread (keyed by employeeId).
export type Message = {
  id: string;
  employeeId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

type Row = {
  id: string;
  employee_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function fromRow(r: Row): Message {
  return {
    id: r.id,
    employeeId: r.employee_id,
    senderId: r.sender_id,
    body: r.body,
    createdAt: r.created_at,
  };
}

// Live messages for one employee's thread.
export function useMessages(employeeId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(async () => {
    if (!employeeId) {
      setMessages([]);
      setLoaded(true);
      return;
    }
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: true });
    setMessages((data ?? []).map((r) => fromRow(r as Row)));
    setLoaded(true);
  }, [employeeId]);

  useEffect(() => {
    refetch();
    if (!employeeId) return;
    const channel = supabase
      .channel(`messages-${employeeId}-${uid()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `employee_id=eq.${employeeId}`,
        },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [employeeId, refetch]);

  const send = useCallback(
    async (senderId: string, body: string) => {
      const text = body.trim();
      if (!text || !employeeId) return;
      // Optimistic append (realtime reconciles).
      const optimistic: Message = {
        id: uid(),
        employeeId,
        senderId,
        body: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      await supabase
        .from("messages")
        .insert({ employee_id: employeeId, sender_id: senderId, body: text });
    },
    [employeeId]
  );

  return { messages, send, loaded };
}

// The timestamp I last read this thread (null if never).
export async function getLastRead(userId: string, employeeId: string) {
  const { data } = await supabase
    .from("message_reads")
    .select("last_read_at")
    .eq("user_id", userId)
    .eq("employee_id", employeeId)
    .maybeSingle();
  return (data?.last_read_at as string) ?? null;
}

// Mark a thread as read for the current user (records "now" as last read).
export async function markThreadRead(userId: string, employeeId: string) {
  await supabase
    .from("message_reads")
    .upsert(
      { user_id: userId, employee_id: employeeId, last_read_at: new Date().toISOString() },
      { onConflict: "user_id,employee_id" }
    );
}

// Unread message counts for the current user.
// Admin: a count per employee thread. Employee: their own thread only.
export function useUnreadCounts() {
  const { user, role } = useRole();
  const [counts, setCounts] = useState<Record<string, number>>({});

  const refetch = useCallback(async () => {
    // When each thread was last read by me.
    const { data: reads } = await supabase
      .from("message_reads")
      .select("employee_id, last_read_at")
      .eq("user_id", user.id);
    const readMap = new Map(
      (reads ?? []).map((r) => [r.employee_id as string, r.last_read_at as string])
    );

    // Messages not sent by me (limited to my own thread if I'm an employee).
    let q = supabase
      .from("messages")
      .select("employee_id, created_at, sender_id")
      .neq("sender_id", user.id);
    if (role === "employee") q = q.eq("employee_id", user.id);
    const { data: msgs } = await q;

    const c: Record<string, number> = {};
    for (const m of msgs ?? []) {
      const last = readMap.get(m.employee_id as string);
      if (!last || (m.created_at as string) > last) {
        c[m.employee_id as string] = (c[m.employee_id as string] ?? 0) + 1;
      }
    }
    setCounts(c);
  }, [user.id, role]);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel(`unread-${uid()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => refetch()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reads" },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, total };
}
