"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRole } from "@/components/role-context";
import { useStudents, duplicatesOf } from "@/lib/students";
import { staffName } from "@/lib/staff";

export function StudentProfile({ id }: { id: string }) {
  const router = useRouter();
  const { user, role } = useRole();
  const { students, update, requestDeletion, remove, loaded } = useStudents();
  const student = students.find((s) => s.id === id);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [school, setSchool] = useState("");
  const [error, setError] = useState("");

  const backLink = (
    <Link href="/students" className="text-sm text-blue-600 hover:underline">
      ← Back to Students
    </Link>
  );

  // Wait until the store has loaded before deciding "not found".
  if (!loaded) {
    return <div className="text-sm text-slate-500">Loading…</div>;
  }

  if (!student) {
    return (
      <div className="space-y-4">
        {backLink}
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          Student not found.
        </div>
      </div>
    );
  }

  // Admin or the assigned employee may view and edit.
  const canEdit = role === "admin" || student.assignedTo === user.id;
  if (!canEdit) {
    return (
      <div className="space-y-4">
        {backLink}
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-red-700 shadow-sm">
          You don&apos;t have access to this student.
        </div>
      </div>
    );
  }

  function startEdit() {
    if (!student) return;
    setName(student.name);
    setPhone(student.phone);
    setSchool(student.school);
    setError("");
    setEditing(true);
  }

  function save() {
    if (!student) return;
    if (!name.trim()) return setError("Name is required.");
    if (!/^\d{8}$/.test(phone)) return setError("Phone must be exactly 8 digits.");
    if (!school.trim()) return setError("School name is required.");
    update(student.id, {
      name: name.trim(),
      phone,
      school: school.trim(),
    });
    setEditing(false);
  }

  function handleDelete() {
    if (!student) return;
    if (confirm(`Permanently delete ${student.name}'s profile?`)) {
      remove(student.id);
      router.push("/students");
    }
  }

  function handleRequestDeletion() {
    if (!student) return;
    requestDeletion(student.id);
  }

  // Duplicate detection by phone number.
  const duplicates = duplicatesOf(students, student);
  const isAdmin = role === "admin";

  // The list this user can navigate (admin: all; employee: their own),
  // in the same order as the Students table.
  const accessible =
    role === "admin"
      ? students
      : students.filter((s) => s.assignedTo === user.id);
  const idx = accessible.findIndex((s) => s.id === id);
  const prev = idx > 0 ? accessible[idx - 1] : null;
  const next =
    idx >= 0 && idx < accessible.length - 1 ? accessible[idx + 1] : null;

  return (
    <div className="space-y-6">
      {/* Top navigation: prev / back / next */}
      <div className="flex items-center justify-between">
        <ArrowButton href={prev ? `/student/${prev.id}` : null} dir="prev" />
        {backLink}
        <ArrowButton href={next ? `/student/${next.id}` : null} dir="next" />
      </div>

      {/* Duplicate-profile flag */}
      {duplicates.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="font-semibold text-amber-800">
            ⚠ Duplicated profile
          </p>
          <p className="text-sm text-amber-700">
            Another profile uses this phone number ({student.phone}).
          </p>
          {isAdmin && (
            <ul className="mt-2 space-y-1 text-sm text-amber-800">
              {duplicates.map((d) => (
                <li key={d.id}>
                  •{" "}
                  <Link
                    href={`/student/${d.id}`}
                    className="font-medium underline"
                  >
                    {d.name}
                  </Link>{" "}
                  — assigned to {staffName(d.assignedTo)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {student.name}
            </h1>
            <p className="text-sm text-slate-600">{student.phone}</p>
            <p className="text-sm text-slate-500">
              Assigned to {staffName(student.assignedTo)}
            </p>
          </div>
          {!editing && (
            <button
              onClick={startEdit}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Edit
            </button>
          )}
        </div>

        {/* Details (view mode) */}
        {!editing && (
          <>
            <dl className="space-y-3 pt-6 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">School name</dt>
                <dd className="font-medium text-slate-800">{student.school}</dd>
              </div>
            </dl>

            {/* Delete / deletion request */}
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6">
              {student.deletionRequested ? (
                <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">
                  Deletion requested
                </span>
              ) : (
                <span className="text-sm text-slate-400">
                  {isAdmin
                    ? "Admins can delete this profile."
                    : "Request an admin to delete this profile."}
                </span>
              )}

              {isAdmin ? (
                <button
                  onClick={handleDelete}
                  className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-600 hover:text-white"
                >
                  Delete profile
                </button>
              ) : (
                <button
                  onClick={handleRequestDeletion}
                  disabled={student.deletionRequested}
                  className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                >
                  Request deletion
                </button>
              )}
            </div>
          </>
        )}

        {/* Edit form */}
        {editing && (
          <div className="space-y-4 pt-6">
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </Field>
            <Field label="Phone number (8 digits)">
              <input
                value={phone}
                inputMode="numeric"
                maxLength={8}
                onChange={(e) =>
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </Field>
            <Field label="School name">
              <input
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </Field>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Save changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ArrowButton({
  href,
  dir,
}: {
  href: string | null;
  dir: "prev" | "next";
}) {
  const label = dir === "prev" ? "Previous" : "Next";
  const content =
    dir === "prev" ? `‹ ${label}` : `${label} ›`;
  const base =
    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors";

  if (!href) {
    return (
      <span
        className={`${base} cursor-not-allowed border-slate-200 bg-white text-slate-300`}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`${base} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
    >
      {content}
    </Link>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}
