"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uid } from "@/lib/uid";

export type Attendee = {
  id: string;
  name: string;
  phone: string;
  country: string;
  attended: boolean;
  applied: string; // "MASAR" | "no"
};

type Row = {
  id: string;
  name: string;
  phone: string;
  country: string;
  attended: boolean;
  applied: string;
};

function fromRow(r: Row): Attendee {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    country: r.country,
    attended: r.attended ?? false,
    applied: r.applied ?? "no",
  };
}

// Cloud-backed list of people attending the annual meeting.
export function useAttendees() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("meeting_attendees")
      .select("*")
      .order("created_at", { ascending: true });
    setAttendees((data ?? []).map((r) => fromRow(r as Row)));
    setLoaded(true);
  }, []);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel(`attendees-${uid()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meeting_attendees" },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const add = useCallback(
    async (data: {
      name: string;
      phone: string;
      country: string;
      applied: string;
    }) => {
      const { data: rows, error } = await supabase
        .from("meeting_attendees")
        .insert(data)
        .select();
      if (error) throw new Error(error.message);
      if (rows?.[0])
        setAttendees((prev) => [...prev, fromRow(rows[0] as Row)]);
    },
    []
  );

  const addMany = useCallback(
    async (
      list: {
        name: string;
        phone: string;
        country: string;
        applied: string;
      }[]
    ) => {
      const chunk = 500;
      for (let i = 0; i < list.length; i += chunk) {
        await supabase
          .from("meeting_attendees")
          .insert(list.slice(i, i + chunk));
      }
      await refetch();
    },
    [refetch]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<Attendee, "id">>) => {
      setAttendees((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...patch } : a))
      );
      await supabase.from("meeting_attendees").update(patch).eq("id", id);
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    setAttendees((prev) => prev.filter((a) => a.id !== id));
    await supabase.from("meeting_attendees").delete().eq("id", id);
  }, []);

  return { attendees, add, addMany, update, remove, loaded };
}
