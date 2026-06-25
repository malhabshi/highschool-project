"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uid } from "@/lib/uid";

export type EventItem = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  createdAt: number;
};

// Today's date (YYYY-MM-DD) in Kuwait local time.
export function kuwaitTodayStr() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuwait",
  }).format(new Date());
}

// Cloud-backed: events are shared across all users/devices via Supabase.
export function useEvents() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(async () => {
    // Remove events that have already passed (Kuwait time).
    await supabase.from("events").delete().lt("date", kuwaitTodayStr());
    const { data } = await supabase
      .from("events")
      .select("id, title, date, created_at")
      .order("date", { ascending: true });
    setEvents(
      (data ?? []).map((r) => ({
        id: r.id as string,
        title: r.title as string,
        date: r.date as string,
        createdAt: new Date(r.created_at as string).getTime(),
      }))
    );
    setLoaded(true);
  }, []);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel(`events-${uid()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const add = useCallback(
    async (title: string, date: string) => {
      const trimmed = title.trim();
      if (!trimmed || !date) return;
      await supabase.from("events").insert({ title: trimmed, date });
      refetch();
    },
    [refetch]
  );

  const remove = useCallback(
    async (id: string) => {
      await supabase.from("events").delete().eq("id", id);
      refetch();
    },
    [refetch]
  );

  return { events, add, remove, loaded };
}
