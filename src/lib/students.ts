"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uid } from "@/lib/uid";

// Student records. `assignedTo` is the user id (profile) who manages them.
export type Student = {
  id: string;
  name: string;
  phone: string;
  school: string;
  assignedTo: string; // profile id, or "" when unassigned
  deletionRequested?: boolean;
  tag?: string;
  notes?: string;
  answers?: Record<string, boolean | string[]>;
  pipeline?: string; // "yellow" | "blue"
  source?: string; // "my-students" for ones created on the My Students page
  blueSeen?: boolean; // admin has reviewed this dark-blue student
  sentToMasarAt?: string | null; // ISO timestamp when admin sent it to Masar
  createdAt?: string;
  gender?: string; // "M" | "F" | "N/A"
  studentNumber?: string; // set for students imported via bulk upload
  phone2?: string; // optional second phone number
  acceptedCountry?: string; // country the student was accepted in
  major?: string;
  withMasar?: boolean; // student applied/enrolled with MASAR
  masarEmployee?: string; // which MASAR employee is helping them
};

// Other students that share the same phone number (potential duplicates).
export function duplicatesOf(students: Student[], student: Student) {
  const phone = student.phone.trim();
  if (!phone) return [];
  return students.filter(
    (s) => s.id !== student.id && s.phone.trim() === phone
  );
}

export type Row = {
  id: string;
  name: string;
  phone: string;
  school: string;
  assigned_to: string | null;
  deletion_requested: boolean;
  tag: string | null;
  notes: string | null;
  answers: Record<string, boolean | string[]> | null;
  pipeline: string | null;
  source: string | null;
  blue_seen: boolean | null;
  sent_to_masar_at: string | null;
  created_at: string | null;
  gender: string | null;
  student_number: string | null;
  phone2: string | null;
  accepted_country: string | null;
  major: string | null;
  with_masar: boolean | null;
  masar_employee: string | null;
};

export function fromRow(r: Row): Student {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    school: r.school,
    assignedTo: r.assigned_to ?? "",
    deletionRequested: r.deletion_requested,
    tag: r.tag ?? undefined,
    notes: r.notes ?? "",
    answers: r.answers ?? {},
    pipeline: r.pipeline ?? undefined,
    source: r.source ?? undefined,
    blueSeen: r.blue_seen ?? false,
    sentToMasarAt: r.sent_to_masar_at ?? null,
    createdAt: r.created_at ?? undefined,
    gender: r.gender ?? "N/A",
    studentNumber: r.student_number ?? undefined,
    phone2: r.phone2 ?? "",
    acceptedCountry: r.accepted_country ?? "",
    major: r.major ?? "",
    withMasar: r.with_masar ?? false,
    masarEmployee: r.masar_employee ?? "",
  };
}

// Map a camelCase patch to the snake_case DB columns.
function toRow(patch: Partial<Omit<Student, "id">>) {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.school !== undefined) row.school = patch.school;
  if (patch.assignedTo !== undefined) row.assigned_to = patch.assignedTo || null;
  if (patch.deletionRequested !== undefined)
    row.deletion_requested = patch.deletionRequested;
  if (patch.tag !== undefined) row.tag = patch.tag ?? null;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.answers !== undefined) row.answers = patch.answers;
  if (patch.pipeline !== undefined) row.pipeline = patch.pipeline ?? null;
  if (patch.source !== undefined) row.source = patch.source ?? null;
  if (patch.blueSeen !== undefined) row.blue_seen = patch.blueSeen;
  if (patch.sentToMasarAt !== undefined) row.sent_to_masar_at = patch.sentToMasarAt;
  if (patch.gender !== undefined) row.gender = patch.gender ?? null;
  if (patch.studentNumber !== undefined)
    row.student_number = patch.studentNumber ?? null;
  if (patch.phone2 !== undefined) row.phone2 = patch.phone2 ?? "";
  if (patch.acceptedCountry !== undefined)
    row.accepted_country = patch.acceptedCountry ?? "";
  if (patch.major !== undefined) row.major = patch.major ?? "";
  if (patch.withMasar !== undefined) row.with_masar = patch.withMasar;
  if (patch.masarEmployee !== undefined)
    row.masar_employee = patch.masarEmployee ?? "";
  return row;
}

// Cloud-backed: students are shared across the whole team, with live updates.
export function useStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Guards against overlapping refetches: only the newest one may write state.
  const reqId = useRef(0);

  const refetch = useCallback(async () => {
    const my = ++reqId.current;
    // Supabase caps a request at 1000 rows. Instead of paging sequentially,
    // get the count and fetch every page in PARALLEL — total time ≈ one request
    // rather than N. The list is then set once (no blink).
    const pageSize = 1000;
    const { count } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true });
    if (my !== reqId.current) return;
    const pages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
    const results = await Promise.all(
      Array.from({ length: pages }, (_, i) =>
        supabase
          .from("students")
          .select("*")
          .order("created_at", { ascending: true })
          .range(i * pageSize, i * pageSize + pageSize - 1)
      )
    );
    if (my !== reqId.current) return;
    const rows: Student[] = [];
    for (const r of results) {
      if (r.data) rows.push(...r.data.map((d) => fromRow(d as Row)));
    }
    setStudents(rows);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel(`students-${uid()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students" },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const addStudent = useCallback(
    async (data: {
      name: string;
      phone: string;
      school?: string;
      assignedTo: string;
      pipeline?: string;
      source?: string;
      gender?: string;
    }) => {
      const { data: rows, error } = await supabase
        .from("students")
        .insert({
          name: data.name,
          phone: data.phone,
          school: data.school ?? "",
          assigned_to: data.assignedTo || null,
          pipeline: data.pipeline ?? null,
          source: data.source ?? null,
          gender: data.gender ?? "N/A",
        })
        .select();
      if (error) throw new Error(error.message);
      // Optimistically show it right away (realtime will reconcile).
      if (rows?.[0]) {
        reqId.current++;
        setStudents((prev) => [...prev, fromRow(rows[0] as Row)]);
      }
    },
    []
  );

  const addStudentsBulk = useCallback(
    async (
      list: {
        name: string;
        phone: string;
        school?: string;
        assignedTo: string;
        tag?: string;
        gender?: string;
        studentNumber?: string;
      }[]
    ) => {
      await supabase.from("students").insert(
        list.map((d) => ({
          name: d.name,
          phone: d.phone,
          school: d.school ?? "",
          assigned_to: d.assignedTo || null,
          tag: d.tag ?? null,
          gender: d.gender ?? "N/A",
          student_number: d.studentNumber ?? null,
        }))
      );
    },
    []
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<Student, "id">>) => {
      reqId.current++; // cancel any in-flight refetch so it can't revert this
      // Optimistic local update for snappy UI; realtime keeps others in sync.
      setStudents((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
      );
      await supabase.from("students").update(toRow(patch)).eq("id", id);
    },
    []
  );

  const requestDeletion = useCallback(async (id: string) => {
    reqId.current++;
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, deletionRequested: true } : s))
    );
    await supabase
      .from("students")
      .update({ deletion_requested: true })
      .eq("id", id);
  }, []);

  const remove = useCallback(async (id: string) => {
    reqId.current++;
    setStudents((prev) => prev.filter((s) => s.id !== id));
    await supabase.from("students").delete().eq("id", id);
  }, []);

  const removeMany = useCallback(async (ids: string[]) => {
    const set = new Set(ids);
    reqId.current++;
    // Optimistically drop them so the UI updates instantly.
    setStudents((prev) => prev.filter((s) => !set.has(s.id)));
    await supabase.from("students").delete().in("id", ids);
  }, []);

  const assignMany = useCallback(async (ids: string[], staffId: string) => {
    const set = new Set(ids);
    reqId.current++; // cancel any in-flight refetch so it can't revert this
    // Optimistically reflect the new assignment (empty target = unassign).
    setStudents((prev) =>
      prev.map((s) => (set.has(s.id) ? { ...s, assignedTo: staffId } : s))
    );
    await supabase
      .from("students")
      .update({ assigned_to: staffId || null })
      .in("id", ids);
  }, []);

  return {
    students,
    addStudent,
    addStudentsBulk,
    update,
    requestDeletion,
    remove,
    removeMany,
    assignMany,
    loaded,
  };
}

// Lightweight hook for the My Students page: loads ONLY the "my-students" pool
// (a small set) instead of the whole students table.
export function useMyStudentsData() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loaded, setLoaded] = useState(false);
  const reqId = useRef(0);

  const refetch = useCallback(async () => {
    const my = ++reqId.current;
    const { data } = await supabase
      .from("students")
      .select("*")
      .eq("source", "my-students")
      .order("created_at", { ascending: true });
    if (my !== reqId.current) return;
    setStudents((data ?? []).map((r) => fromRow(r as Row)));
    setLoaded(true);
  }, []);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel(`my-students-${uid()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "students",
          filter: "source=eq.my-students",
        },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const addStudent = useCallback(
    async (data: {
      name: string;
      phone: string;
      school?: string;
      assignedTo: string;
      gender?: string;
    }) => {
      reqId.current++;
      const { data: rows, error } = await supabase
        .from("students")
        .insert({
          name: data.name,
          phone: data.phone,
          school: data.school ?? "",
          assigned_to: data.assignedTo || null,
          gender: data.gender ?? "N/A",
          source: "my-students",
        })
        .select();
      if (error) throw new Error(error.message);
      if (rows?.[0]) setStudents((prev) => [...prev, fromRow(rows[0] as Row)]);
    },
    []
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<Student, "id">>) => {
      reqId.current++;
      setStudents((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
      );
      await supabase.from("students").update(toRow(patch)).eq("id", id);
    },
    []
  );

  const requestDeletion = useCallback(async (id: string) => {
    reqId.current++;
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, deletionRequested: true } : s))
    );
    await supabase
      .from("students")
      .update({ deletion_requested: true })
      .eq("id", id);
  }, []);

  const remove = useCallback(async (id: string) => {
    reqId.current++;
    setStudents((prev) => prev.filter((s) => s.id !== id));
    await supabase.from("students").delete().eq("id", id);
  }, []);

  return { students, addStudent, update, requestDeletion, remove, loaded };
}

// Targeted data for a single student profile: the student, its duplicates, and
// its prev/next neighbours — without loading the whole table.
export function useStudentProfile(id: string, role: string, userId: string) {
  const [student, setStudent] = useState<Student | null>(null);
  const [duplicates, setDuplicates] = useState<Student[]>([]);
  const [prevId, setPrevId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const my = ++reqId.current;
    setLoaded(false);
    const { data } = await supabase
      .from("students")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (my !== reqId.current) return;
    const s = data ? fromRow(data as Row) : null;
    setStudent(s);
    setLoaded(true);
    if (!s) {
      setDuplicates([]);
      setPrevId(null);
      setNextId(null);
      return;
    }

    const created = s.createdAt ?? "";
    // Neighbour query: same pool bucket + (employees only see their own).
    const neighbour = (dir: "next" | "prev") => {
      let q = supabase.from("students").select("id");
      q = dir === "next" ? q.gt("created_at", created) : q.lt("created_at", created);
      q =
        s.source === "my-students"
          ? q.eq("source", "my-students")
          : q.or("source.is.null,source.neq.my-students");
      if (role !== "admin") q = q.eq("assigned_to", userId);
      return q.order("created_at", { ascending: dir === "next" }).limit(1);
    };

    const [dups, nextRow, prevRow] = await Promise.all([
      supabase.from("students").select("*").eq("phone", s.phone).neq("id", id),
      neighbour("next"),
      neighbour("prev"),
    ]);
    if (my !== reqId.current) return;
    setDuplicates(((dups.data ?? []) as Row[]).map((r) => fromRow(r)));
    setNextId((nextRow.data?.[0]?.id as string) ?? null);
    setPrevId((prevRow.data?.[0]?.id as string) ?? null);
  }, [id, role, userId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`student-${id}-${uid()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students", filter: `id=eq.${id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, id]);

  const update = useCallback(
    async (_id: string, patch: Partial<Omit<Student, "id">>) => {
      reqId.current++;
      setStudent((prev) => (prev ? { ...prev, ...patch } : prev));
      await supabase.from("students").update(toRow(patch)).eq("id", id);
    },
    [id]
  );

  const requestDeletion = useCallback(async () => {
    reqId.current++;
    setStudent((prev) => (prev ? { ...prev, deletionRequested: true } : prev));
    await supabase
      .from("students")
      .update({ deletion_requested: true })
      .eq("id", id);
  }, [id]);

  const remove = useCallback(async () => {
    await supabase.from("students").delete().eq("id", id);
  }, [id]);

  return {
    student,
    duplicates,
    prevId,
    nextId,
    loaded,
    update,
    requestDeletion,
    remove,
  };
}
