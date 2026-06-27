"use client";

import { useState } from "react";
import Link from "next/link";
import { useRole } from "@/components/role-context";
import { useStudents } from "@/lib/students";
import { useQuestions, scholarshipQuestionId } from "@/lib/questions";
import { useUsers, nameOf } from "@/lib/users";

// Admin notifications: pending deletion requests + scholarship interest.
export function NotificationBell() {
  const { role } = useRole();
  const { students } = useStudents();
  const { questions } = useQuestions();
  const { users } = useUsers();
  const [open, setOpen] = useState(false);

  if (role !== "admin") return null;

  const deletionRequests = students.filter((s) => s.deletionRequested);
  const sid = scholarshipQuestionId(questions);
  const scholarshipCount = sid
    ? students.filter((s) => s.answers?.[sid] === true).length
    : 0;

  // Badge = the actionable new items (deletion requests).
  const badge = deletionRequests.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        className="relative rounded-md p-2 text-lg text-slate-600 hover:bg-slate-100"
      >
        🔔
        {badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-800">
              Notifications
            </div>
            <div className="max-h-96 overflow-y-auto p-2">
              {deletionRequests.length === 0 && scholarshipCount === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-slate-400">
                  Nothing new.
                </p>
              ) : (
                <>
                  {deletionRequests.length > 0 && (
                    <div className="mb-2">
                      <p className="px-2 py-1 text-xs font-medium uppercase text-slate-400">
                        Deletion requests ({deletionRequests.length})
                      </p>
                      {deletionRequests.map((s) => (
                        <Link
                          key={s.id}
                          href={`/student/${s.id}`}
                          onClick={() => setOpen(false)}
                          className="block rounded-lg px-2 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100"
                        >
                          🗑️ <span className="font-medium">{s.name}</span>
                          <span className="text-slate-500">
                            {" "}
                            — requested by {nameOf(users, s.assignedTo)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {scholarshipCount > 0 && (
                    <Link
                      href="/students"
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-2 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      🎓{" "}
                      <span className="font-medium">{scholarshipCount}</span>{" "}
                      student(s) want a scholarship
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
