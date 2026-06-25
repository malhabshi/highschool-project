"use client";

import Link from "next/link";
import { useRole } from "@/components/role-context";
import { useStudents } from "@/lib/students";

// Shows only the students assigned to the currently logged-in user.
export function MyStudents() {
  const { user } = useRole();
  const { students, loaded } = useStudents();

  const mine = students.filter((s) => s.assignedTo === user.id);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-800">My Students</h2>
        <span className="text-sm text-slate-500">{mine.length} total</span>
      </div>

      {!loaded ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : mine.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          No students are assigned to you yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium">School</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/student/${s.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{s.phone}</td>
                  <td className="px-5 py-3 text-slate-600">{s.school || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
