"use client";

import { useCallback, useEffect, useState } from "react";
import { uid } from "@/lib/uid";

// Student records. `assignedTo` is the staff id who manages the student.
export type Student = {
  id: string;
  name: string;
  phone: string;
  school: string;
  assignedTo: string; // user id (see lib/users.ts)
  deletionRequested?: boolean; // employee asked an admin to delete
  tag?: string; // label for the bulk-upload list this student came from
  notes?: string; // free-text notes from the employee
  // Answers to the configurable questions, keyed by question id.
  // yes/no questions store a boolean; multi questions store a string[].
  answers?: Record<string, boolean | string[]>;
};

// Other students that share the same phone number (potential duplicates).
export function duplicatesOf(students: Student[], student: Student) {
  const phone = student.phone.trim();
  if (!phone) return [];
  return students.filter(
    (s) => s.id !== student.id && s.phone.trim() === phone
  );
}

// Seed data used the first time the app runs (before Firebase exists).
export const SAMPLE_STUDENTS: Student[] = [
  { id: "1", name: "Fatima Al-Salem", phone: "90001111", school: "Kuwait English School", assignedTo: "sara" },
  { id: "2", name: "Yousef Al-Ali", phone: "90002222", school: "Al-Bayan Bilingual School", assignedTo: "ahmed" },
  { id: "3", name: "Noor Hassan", phone: "90003333", school: "American School of Kuwait", assignedTo: "sara" },
  { id: "4", name: "Omar Khalid", phone: "90004444", school: "Gulf English School", assignedTo: "mariam" },
  { id: "5", name: "Layla Ahmad", phone: "90005555", school: "The English Academy", assignedTo: "ahmed" },
];

const STORAGE_KEY = "masar.students";

// Temporary local store. Later this is replaced by Firebase Firestore.
export function useStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setStudents(JSON.parse(raw));
      } else {
        // First run: seed with sample data.
        localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_STUDENTS));
        setStudents(SAMPLE_STUDENTS);
      }
    } catch {
      setStudents(SAMPLE_STUDENTS);
    }
    setLoaded(true);
  }, []);

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setStudents(JSON.parse(e.newValue));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Create a new student (admin only — enforced in the UI).
  const addStudent = useCallback(
    (data: { name: string; phone: string; school?: string; assignedTo: string }) => {
      setStudents((prev) => {
        const next: Student[] = [
          ...prev,
          {
            id: uid(),
            name: data.name,
            phone: data.phone,
            school: data.school ?? "",
            assignedTo: data.assignedTo,
          },
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  // Add many students at once (bulk CSV upload).
  const addStudentsBulk = useCallback(
    (
      list: {
        name: string;
        phone: string;
        school?: string;
        assignedTo: string;
        tag?: string;
      }[]
    ) => {
      setStudents((prev) => {
        const next: Student[] = [
          ...prev,
          ...list.map((d) => ({
            id: uid(),
            name: d.name,
            phone: d.phone,
            school: d.school ?? "",
            assignedTo: d.assignedTo,
            tag: d.tag,
          })),
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const update = useCallback((id: string, patch: Partial<Omit<Student, "id">>) => {
    setStudents((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Employee asks for a profile to be deleted (admin must approve).
  const requestDeletion = useCallback((id: string) => {
    setStudents((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, deletionRequested: true } : s
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Permanently remove a student (admin only — enforced in the UI).
  const remove = useCallback((id: string) => {
    setStudents((prev) => {
      const next = prev.filter((s) => s.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Remove several students at once (admin bulk delete).
  const removeMany = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setStudents((prev) => {
      const next = prev.filter((s) => !idSet.has(s.id));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Reassign several students to one staff member at once (admin bulk assign).
  const assignMany = useCallback((ids: string[], staffId: string) => {
    const idSet = new Set(ids);
    setStudents((prev) => {
      const next = prev.map((s) =>
        idSet.has(s.id) ? { ...s, assignedTo: staffId } : s
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
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
