"use client";

import { useState } from "react";
import Link from "next/link";
import { useRole } from "@/components/role-context";
import { useStudents, duplicatesOf, type Student } from "@/lib/students";
import { useUsers, nameOf, type User } from "@/lib/users";

// Format an ISO timestamp in Kuwait local time.
function fmtKuwait(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Kuwait",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Newest first, oldest last.
function byNewest(a: Student, b: Student) {
  return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
}

// Shows the students assigned to the logged-in user, split into 3 pipeline
// columns, and lets them add new ones.
export function MyStudents() {
  const { user, role } = useRole();
  const isAdmin = role === "admin";
  const { users } = useUsers();
  const { students, addStudent, update, requestDeletion, remove, loaded } =
    useStudents();
  const [adding, setAdding] = useState(false);

  // Only students created here on the My Students page (kept separate from the
  // Students page pool). Each user manages their own.
  const onPage = students.filter((s) => s.source === "my-students");
  const mine = onPage.filter((s) => s.assignedTo === user.id);

  const none = mine
    .filter((s) => s.pipeline !== "yellow" && s.pipeline !== "blue")
    .sort(byNewest);

  // Yellow: an employee sees their own. The admin sees their own plus any
  // employee's yellow student that has a pending deletion request.
  const yellow = (
    isAdmin
      ? onPage.filter(
          (s) =>
            s.pipeline === "yellow" &&
            (s.assignedTo === user.id || s.deletionRequested)
        )
      : mine.filter((s) => s.pipeline === "yellow")
  ).sort(byNewest);

  // Dark blue: an employee sees their own; the admin sees everyone's, so they
  // can review what each user moved into the dark-blue stage.
  const blue = (isAdmin ? onPage : mine)
    .filter((s) => s.pipeline === "blue")
    .sort(byNewest);

  // Setting a student's pipeline. Entering Dark blue marks it unseen so the
  // admin gets a "New" badge until they review it.
  const setPipeline = (id: string, v: string) =>
    update(id, v === "blue" ? { pipeline: v, blueSeen: false } : { pipeline: v });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{mine.length} total</span>
        <button
          onClick={() => setAdding(true)}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          + Add student
        </button>
      </div>

      {adding && (
        <AddMyStudentForm
          onCancel={() => setAdding(false)}
          onAdd={async (data) => {
            await addStudent({
              ...data,
              assignedTo: user.id,
              source: "my-students",
            });
            setAdding(false);
          }}
        />
      )}

      {!loaded ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <Column
            title="No pipeline yet"
            accent="bg-slate-300"
            students={none}
            onSet={setPipeline}
            all={students}
            users={users}
            isAdmin={isAdmin}
            onRequestDelete={!isAdmin ? requestDeletion : undefined}
            onDelete={isAdmin ? remove : undefined}
          />
          <Column
            title="Dark blue"
            accent="bg-blue-800"
            students={blue}
            onSet={setPipeline}
            badgeFor={isAdmin ? (s) => nameOf(users, s.assignedTo) : undefined}
            onSend={
              isAdmin
                ? (id) =>
                    update(id, {
                      blueSeen: true,
                      sentToMasarAt: new Date().toISOString(),
                    })
                : undefined
            }
            all={students}
            users={users}
            isAdmin={isAdmin}
            onRequestDelete={!isAdmin ? requestDeletion : undefined}
            onDelete={isAdmin ? remove : undefined}
          />
          <Column
            title="Yellow"
            accent="bg-yellow-400"
            students={yellow}
            onSet={setPipeline}
            badgeFor={isAdmin ? (s) => nameOf(users, s.assignedTo) : undefined}
            all={students}
            users={users}
            isAdmin={isAdmin}
            onRequestDelete={!isAdmin ? requestDeletion : undefined}
            onDelete={isAdmin ? remove : undefined}
          />
        </div>
      )}
    </div>
  );
}

function Column({
  title,
  accent,
  students,
  onSet,
  badgeFor,
  onSend,
  all,
  users,
  isAdmin,
  onRequestDelete,
  onDelete,
}: {
  title: string;
  accent: string;
  students: Student[];
  onSet: (id: string, v: string) => void;
  badgeFor?: (s: Student) => string;
  onSend?: (id: string) => void;
  all: Student[];
  users: User[];
  isAdmin: boolean;
  onRequestDelete?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${accent}`} />
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        </div>
        <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
          {students.length} {students.length === 1 ? "student" : "students"}
        </span>
      </div>

      <div className="space-y-3 p-3">
        {students.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-slate-400">
            No students here.
          </p>
        ) : (
          students.map((s) => {
            const dups = duplicatesOf(all, s);
            return (
            <div
              key={s.id}
              className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Link
                  href={`/student/${s.id}`}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {s.name}
                </Link>
                {badgeFor && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                    {badgeFor(s)}
                  </span>
                )}
                {onSend && !s.blueSeen && (
                  <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                    New
                  </span>
                )}
                {s.deletionRequested && (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                    Deletion requested
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-500">{s.phone}</div>
              {s.school && (
                <div className="text-xs text-slate-500">{s.school}</div>
              )}
              {dups.length > 0 && (
                <div className="mt-1">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    Duplicated phone
                  </span>
                  {isAdmin && (
                    <div className="mt-0.5 text-[11px] text-amber-700">
                      Also held by{" "}
                      {dups
                        .map(
                          (d) =>
                            `${nameOf(users, d.assignedTo)} (${
                              d.source === "my-students" ? "employee" : "admin"
                            })`
                        )
                        .join(", ")}
                    </div>
                  )}
                </div>
              )}
              {s.sentToMasarAt && (
                <div className="mt-1 text-xs font-medium text-green-700">
                  Sent to Masar · {fmtKuwait(s.sentToMasarAt)}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                <PipelinePicker
                  value={s.pipeline}
                  onChange={(v) => onSet(s.id, v)}
                />
                <div className="flex items-center gap-2">
                  {/* Employee: request the admin to delete this student. */}
                  {onRequestDelete && !s.deletionRequested && (
                    <button
                      type="button"
                      onClick={() => onRequestDelete(s.id)}
                      className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      Request delete
                    </button>
                  )}
                  {/* Admin: delete the student outright. */}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete ${s.name}'s profile?`))
                          onDelete(s.id);
                      }}
                      className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-600 hover:text-white"
                    >
                      Delete
                    </button>
                  )}
                  {onSend && !s.sentToMasarAt && (
                    <button
                      type="button"
                      onClick={() => onSend(s.id)}
                      className="rounded-md bg-blue-800 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-blue-900"
                    >
                      Send to Masar
                    </button>
                  )}
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Clickable yellow/blue buttons to move a student between pipeline columns.
// Clicking the active color again clears it (back to "No pipeline yet").
function PipelinePicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v: string) => void;
}) {
  const options = [
    { v: "yellow", label: "Yellow", dot: "bg-yellow-400", ring: "ring-yellow-400" },
    { v: "blue", label: "Dark blue", dot: "bg-blue-800", ring: "ring-blue-800" },
  ];
  return (
    <div className="flex items-center gap-2">
      {options.map((opt) => {
        const active = value === opt.v;
        return (
          <button
            key={opt.v}
            type="button"
            title={opt.label}
            onClick={() => onChange(active ? "" : opt.v)}
            className={`h-5 w-5 rounded-full ${opt.dot} transition ${
              active
                ? `ring-2 ring-offset-1 ${opt.ring}`
                : "opacity-40 hover:opacity-100"
            }`}
          />
        );
      })}
    </div>
  );
}

function AddMyStudentForm({
  onAdd,
  onCancel,
}: {
  onAdd: (data: {
    name: string;
    phone: string;
    school: string;
    gender: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [school, setSchool] = useState("");
  const [gender, setGender] = useState("N/A");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return setError("Name is required.");
    if (!/^\d{8}$/.test(phone)) return setError("Phone must be exactly 8 digits.");
    setBusy(true);
    try {
      await onAdd({ name: name.trim(), phone, school: school.trim(), gender });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 shadow-sm">
      <h3 className="font-semibold text-slate-800">Add a student</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            Name <span className="text-red-500">*</span>
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            Phone (8 digits) <span className="text-red-500">*</span>
          </span>
          <input
            value={phone}
            inputMode="numeric"
            maxLength={8}
            onChange={(e) =>
              setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            School <span className="text-slate-400">(optional)</span>
          </span>
          <input
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            Gender
          </span>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="M">M</option>
            <option value="F">F</option>
            <option value="N/A">N/A</option>
          </select>
        </label>
      </div>

      <p className="text-xs text-slate-500">
        New students start in “No pipeline yet”. Pick Yellow or Dark blue on the
        card to move them.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300"
        >
          {busy ? "Adding…" : "Add student"}
        </button>
      </div>
    </div>
  );
}
