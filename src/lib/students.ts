"use client";

import { useCallback, useEffect, useState } from "react";
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
};

// Other students that share the same phone number (potential duplicates).
export function duplicatesOf(students: Student[], student: Student) {
  const phone = student.phone.trim();
  if (!phone) return [];
  return students.filter(
    (s) => s.id !== student.id && s.phone.trim() === phone
  );
}

type Row = {
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
};

function fromRow(r: Row): Student {
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
  return row;
}

// Cloud-backed: students are shared across the whole team, with live updates.
export function useStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("students")
      .select("*")
      .order("created_at", { ascending: true });
    setStudents((data ?? []).map((r) => fromRow(r as Row)));
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
      if (rows?.[0]) setStudents((prev) => [...prev, fromRow(rows[0] as Row)]);
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
      // Optimistic local update for snappy UI; realtime keeps others in sync.
      setStudents((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
      );
      await supabase.from("students").update(toRow(patch)).eq("id", id);
    },
    []
  );

  const requestDeletion = useCallback(async (id: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, deletionRequested: true } : s))
    );
    await supabase
      .from("students")
      .update({ deletion_requested: true })
      .eq("id", id);
  }, []);

  const remove = useCallback(async (id: string) => {
    await supabase.from("students").delete().eq("id", id);
  }, []);

  const removeMany = useCallback(async (ids: string[]) => {
    await supabase.from("students").delete().in("id", ids);
  }, []);

  const assignMany = useCallback(async (ids: string[], staffId: string) => {
    await supabase
      .from("students")
      .update({ assigned_to: staffId })
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
