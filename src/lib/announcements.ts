"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uid } from "@/lib/uid";

export type Announcement = {
  id: string;
  text: string;
  createdAt: number;
};

// Cloud-backed: announcements are shared across all users/devices via Supabase.
export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("announcements")
      .select("id, text, created_at")
      .order("created_at", { ascending: false });
    setAnnouncements(
      (data ?? []).map((r) => ({
        id: r.id as string,
        text: r.text as string,
        createdAt: new Date(r.created_at as string).getTime(),
      }))
    );
    setLoaded(true);
  }, []);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel(`announcements-${uid()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const add = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      await supabase.from("announcements").insert({ text: trimmed });
      refetch();
    },
    [refetch]
  );

  const remove = useCallback(
    async (id: string) => {
      await supabase.from("announcements").delete().eq("id", id);
      refetch();
    },
    [refetch]
  );

  return { announcements, add, remove, loaded };
}
