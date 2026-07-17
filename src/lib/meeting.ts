"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  major: string; // major they were accepted in
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
  major: string;
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
    major: r.major ?? "",
  };
}

// Cloud-backed list of people attending the annual meeting.
// `actor` is the logged-in user, recorded in the activity log for each action.
export function useAttendees(actor: { id: string; name: string }) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Keep the latest list so mutations can look up a person's name to log.
  const attendeesRef = useRef<Attendee[]>([]);
  attendeesRef.current = attendees;

  const log = useCallback(
    async (action: string, detail: string) => {
      await supabase.from("activity_log").insert({
        user_id: actor.id,
        user_name: actor.name,
        action,
        detail,
      });
    },
    [actor.id, actor.name]
  );

  const refetch = useCallback(async () => {
    // Supabase caps each request at 1000 rows, so page through until we've
    // fetched everyone (we now have well over 1000 attendees).
    const pageSize = 1000;
    const all: Row[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("meeting_attendees")
        .select("*")
        .order("created_at", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error || !data || data.length === 0) break;
      all.push(...(data as Row[]));
      if (data.length < pageSize) break;
    }
    setAttendees(all.map((r) => fromRow(r)));
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
      major: string;
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
          major: data.major,
        })
        .select();
      if (error) throw new Error(error.message);
      if (rows?.[0])
        setAttendees((prev) => [...prev, fromRow(rows[0] as Row)]);
      await log("Added person", data.name || data.phone || "—");
    },
    [log]
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
        major: string;
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
        major: d.major,
      }));
      for (let i = 0; i < mapped.length; i += chunk) {
        await supabase
          .from("meeting_attendees")
          .insert(mapped.slice(i, i + chunk));
      }
      await refetch();
      await log("Bulk import", `${list.length} people`);
    },
    [refetch, log]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<Attendee, "id">>) => {
      setAttendees((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...patch } : a))
      );
      await supabase.from("meeting_attendees").update(toDb(patch)).eq("id", id);
      const person = attendeesRef.current.find((a) => a.id === id);
      const who = person?.name || person?.phone || "someone";
      const { action, detail } = describeUpdate(patch, who);
      await log(action, detail);
    },
    [log]
  );

  const remove = useCallback(
    async (id: string) => {
      const person = attendeesRef.current.find((a) => a.id === id);
      const who = person?.name || person?.phone || "someone";
      setAttendees((prev) => prev.filter((a) => a.id !== id));
      await supabase.from("meeting_attendees").delete().eq("id", id);
      await log("Removed person", who);
    },
    [log]
  );

  const removeAll = useCallback(async () => {
    const count = attendeesRef.current.length;
    setAttendees([]);
    // Delete every row (a filter is required, so match all real ids).
    await supabase
      .from("meeting_attendees")
      .delete()
      .not("id", "is", null);
    await log("Deleted all attendees", `${count} people`);
  }, [log]);

  return { attendees, add, addMany, update, remove, removeAll, loaded };
}

export type LogEntry = {
  id: string;
  userName: string;
  action: string;
  detail: string;
  createdAt: string;
};

// Admin activity log for the annual meeting actions (live).
export function useActivityLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("activity_log")
      .select("id, user_name, action, detail, created_at")
      .order("created_at", { ascending: false });
    setEntries(
      (data ?? []).map((r) => ({
        id: r.id as string,
        userName: (r.user_name as string) ?? "",
        action: (r.action as string) ?? "",
        detail: (r.detail as string) ?? "",
        createdAt: (r.created_at as string) ?? "",
      }))
    );
    setLoaded(true);
  }, []);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel(`activity-${uid()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_log" },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  return { entries, loaded };
}

// Map a camelCase attendee patch to the snake_case DB columns.
function toDb(patch: Partial<Omit<Attendee, "id">>) {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.country !== undefined) row.country = patch.country;
  if (patch.applied !== undefined) row.applied = patch.applied;
  if (patch.masarEmployee !== undefined) row.masar_employee = patch.masarEmployee;
  if (patch.ielts !== undefined) row.ielts = patch.ielts;
  if (patch.otherOffice !== undefined) row.other_office = patch.otherOffice;
  if (patch.attended !== undefined) row.attended = patch.attended;
  if (patch.ticket !== undefined) row.ticket = patch.ticket;
  if (patch.major !== undefined) row.major = patch.major;
  return row;
}

// A human-readable action + detail for the activity log.
function describeUpdate(patch: Partial<Omit<Attendee, "id">>, who: string) {
  if ("attended" in patch)
    return {
      action: "Attendance (حضر؟)",
      detail: `${who}: ${patch.attended ? "attended" : "not attended"}`,
    };
  if ("ielts" in patch)
    return { action: "IELTS", detail: `${who}: ${patch.ielts ? "yes" : "no"}` };
  if ("otherOffice" in patch)
    return {
      action: "Another office",
      detail: `${who}: ${patch.otherOffice ? "yes" : "no"}`,
    };
  if ("ticket" in patch)
    return {
      action: "Ticket number",
      detail: `${who}: #${patch.ticket || "cleared"}`,
    };
  if ("major" in patch)
    return {
      action: "Major",
      detail: `${who}: ${patch.major || "cleared"}`,
    };
  if ("applied" in patch)
    return { action: "Applied with us", detail: `${who}: ${patch.applied}` };
  return { action: "Edited", detail: who };
}
