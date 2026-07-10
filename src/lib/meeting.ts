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
  masarEmployee: string; // employee who helped (only meaningful when MASAR)
  ielts: boolean;
  otherOffice: boolean; // applied with another office?
  ticket: string; // ticket number (digits)
};

type Row = {
  id: string;
  name: string;
  phone: string;
  country: string;
  attended: boolean;
  applied: string;
  masar_employee: string;
  ielts: boolean;
  other_office: boolean;
  ticket: string;
};

function fromRow(r: Row): Attendee {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    country: r.country,
    attended: r.attended ?? false,
    applied: r.applied ?? "no",
    masarEmployee: r.masar_employee ?? "",
    ielts: r.ielts ?? false,
    otherOffice: r.other_office ?? false,
    ticket: r.ticket ?? "",
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
      masarEmployee: string;
      ielts: boolean;
      otherOffice: boolean;
      ticket: string;
    }) => {
      const { data: rows, error } = await supabase
        .from("meeting_attendees")
        .insert({
          name: data.name,
          phone: data.phone,
          country: data.country,
          applied: data.applied,
          masar_employee: data.masarEmployee,
          ielts: data.ielts,
          other_office: data.otherOffice,
          ticket: data.ticket,
        })
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
        masarEmployee: string;
        ielts: boolean;
        otherOffice: boolean;
        ticket: string;
      }[]
    ) => {
      const chunk = 500;
      const mapped = list.map((d) => ({
        name: d.name,
        phone: d.phone,
        country: d.country,
        applied: d.applied,
        masar_employee: d.masarEmployee,
        ielts: d.ielts,
        other_office: d.otherOffice,
        ticket: d.ticket,
      }));
      for (let i = 0; i < mapped.length; i += chunk) {
        await supabase
          .from("meeting_attendees")
          .insert(mapped.slice(i, i + chunk));
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
