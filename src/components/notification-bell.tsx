"use client";

import Link from "next/link";
import { useRole } from "@/components/role-context";
import { useStudents } from "@/lib/students";

// Notifies the admin how many students want a scholarship.
export function NotificationBell() {
  const { role } = useRole();
  const { students } = useStudents();

  if (role !== "admin") return null;

  const count = students.filter((s) => s.answers?.scholarship === true).length;

  return (
    <Link
      href="/students"
      title={`${count} student(s) want a scholarship`}
      className="relative rounded-md p-2 text-lg text-slate-600 hover:bg-slate-100"
    >
      🔔
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-green-600 px-1 text-xs font-semibold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
