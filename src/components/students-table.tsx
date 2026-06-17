"use client";

import { useState } from "react";
import Link from "next/link";
import { useRole } from "@/components/role-context";
import { useStudents, duplicatesOf } from "@/lib/students";
import { staff, staffName } from "@/lib/staff";

const employees = staff.filter((s) => s.role === "employee");

export function StudentsTable() {
  const { user, role } = useRole();
  const { students: all, remove, removeMany, assignMany } = useStudents();
  const isAdmin = role === "admin";

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignTarget, setAssignTarget] = useState("");

  // Admin sees every student; an employee sees only their assigned students.
  const students = isAdmin
    ? all
    : all.filter((s) => s.assignedTo === user.id);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === students.length
        ? new Set()
        : new Set(students.map((s) => s.id))
    );
  }

  function deleteSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (confirm(`Delete ${ids.length} selected profile(s)?`)) {
      removeMany(ids);
      setSelected(new Set());
    }
  }

  function assignSelected() {
    const ids = [...selected];
    if (ids.length === 0 || !assignTarget) return;
    assignMany(ids, assignTarget);
    setSelected(new Set());
    setAssignTarget("");
  }

  const allSelected =
    students.length > 0 && selected.size === students.length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-800">
          {isAdmin ? "All Students" : "My Students"}
        </h2>
        {isAdmin && selected.size > 0 ? (
          <div className="flex items-center gap-2">
            <select
              value={assignTarget}
              onChange={(e) => setAssignTarget(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700"
            >
              <option value="">Assign to…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <button
              onClick={assignSelected}
              disabled={!assignTarget}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Assign ({selected.size})
            </button>
            <button
              onClick={deleteSelected}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              Delete selected ({selected.size})
            </button>
          </div>
        ) : (
          <span className="text-sm text-slate-500">{students.length} total</span>
        )}
      </div>

      {students.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          No students assigned to you yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr className="border-b border-slate-100">
              {isAdmin && (
                <th className="px-5 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
              )}
              <th className="px-5 py-3 font-medium">Student</th>
              {isAdmin && (
                <th className="px-5 py-3 font-medium">Assigned To</th>
              )}
              <th className="px-5 py-3 font-medium">Status</th>
              {isAdmin && (
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const isDuplicate = duplicatesOf(all, s).length > 0;
              return (
                <tr
                  key={s.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                >
                  {isAdmin && (
                    <td className="px-5 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggleOne(s.id)}
                        aria-label={`Select ${s.name}`}
                      />
                    </td>
                  )}
                  <td className="px-5 py-3">
                    <Link
                      href={`/student/${s.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {s.name}
                    </Link>
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3 text-slate-600">
                      {staffName(s.assignedTo)}
                    </td>
                  )}
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {isDuplicate && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Duplicated profile
                        </span>
                      )}
                      {s.deletionRequested && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                          Deletion requested
                        </span>
                      )}
                      {!isDuplicate && !s.deletionRequested && (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${s.name}'s profile?`)) {
                            remove(s.id);
                          }
                        }}
                        className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-600 hover:text-white"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
