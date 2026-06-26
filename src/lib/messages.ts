"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uid } from "@/lib/uid";

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
