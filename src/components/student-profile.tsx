"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRole } from "@/components/role-context";
import { useStudents, duplicatesOf } from "@/lib/students";
import {
  useQuestions,
  type Question,
  type QuestionType,
} from "@/lib/questions";
import { useUsers, nameOf } from "@/lib/users";

export function StudentProfile({ id }: { id: string }) {
  const router = useRouter();
  const { user, role } = useRole();
  const { students, update, requestDeletion, remove, loaded } = useStudents();
  const { questions, addQuestion, updateQuestion, removeQuestion } =
    useQuestions();
  const { users } = useUsers();
  const [managing, setManaging] = useState(false);
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
                  — assigned to {nameOf(users, d.assignedTo)}
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
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
              {student.name}
              {student.answers?.scholarship === true && (
                <span title="Wants a scholarship" className="text-green-600">
                  ✓
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-600">{student.phone}</p>
            <p className="text-sm text-slate-500">
              Assigned to {nameOf(users, student.assignedTo)}
            </p>
            {student.tag && (
              <span className="mt-1 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {student.tag}
              </span>
            )}
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

      {/* Profile questions (configurable by admin) */}
      <div className="space-y-4">
        {role === "admin" && (
          <div className="flex justify-end">
            <button
              onClick={() => setManaging((m) => !m)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              {managing ? "Done editing" : "Edit questions"}
            </button>
          </div>
        )}

        {role === "admin" && managing && (
          <QuestionManager
            questions={questions}
            addQuestion={addQuestion}
            updateQuestion={updateQuestion}
            removeQuestion={removeQuestion}
          />
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              value={student.answers?.[q.id]}
              onChange={(v) =>
                update(student.id, {
                  answers: { ...student.answers, [q.id]: v },
                })
              }
            />
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-800">Notes</h2>
        <p className="mb-3 text-sm text-slate-500">
          Write anything about this student. Saved automatically.
        </p>
        <textarea
          value={student.notes ?? ""}
          onChange={(e) => update(student.id, { notes: e.target.value })}
          rows={5}
          placeholder="Type your notes here..."
          className="w-full resize-y rounded-lg border border-slate-300 p-3 text-sm text-slate-800 outline-none focus:border-blue-500"
        />
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: boolean | string[] | undefined;
  onChange: (v: boolean | string[]) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-slate-800">{question.label}</h2>

      {question.type === "yesno" ? (
        <div className="mt-3 flex gap-6">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name={`q-${question.id}`}
              checked={value === true}
              onChange={() => onChange(true)}
              className="h-4 w-4"
            />
            Yes
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name={`q-${question.id}`}
              checked={value === false}
              onChange={() => onChange(false)}
              className="h-4 w-4"
            />
            No
          </label>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">Select all that apply.</p>
          <div className="flex flex-wrap gap-4">
            {(question.options ?? []).map((opt) => {
              const arr = Array.isArray(value) ? value : [];
              const selected = arr.includes(opt);
              return (
                <label
                  key={opt}
                  className="flex items-center gap-2 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) =>
                      onChange(
                        e.target.checked
                          ? [...arr, opt]
                          : arr.filter((x) => x !== opt)
                      )
                    }
                    className="h-4 w-4"
                  />
                  {opt}
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function QuestionManager({
  questions,
  addQuestion,
  updateQuestion,
  removeQuestion,
}: {
  questions: Question[];
  addQuestion: (q: Omit<Question, "id">) => void;
  updateQuestion: (id: string, patch: Partial<Omit<Question, "id">>) => void;
  removeQuestion: (id: string) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<QuestionType>("yesno");
  const [newOptions, setNewOptions] = useState("");

  function parseOptions(text: string) {
    return text
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }

  function add() {
    if (!newLabel.trim()) return;
    addQuestion({
      label: newLabel.trim(),
      type: newType,
      options: newType === "multi" ? parseOptions(newOptions) : undefined,
    });
    setNewLabel("");
    setNewOptions("");
    setNewType("yesno");
  }

  return (
    <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50 p-5">
      <h3 className="font-semibold text-slate-800">Manage questions</h3>

      {/* Existing questions */}
      <div className="space-y-3">
        {questions.map((q) => (
          <div
            key={q.id}
            className="space-y-2 rounded-lg border border-slate-200 bg-white p-3"
          >
            <div className="flex items-center gap-2">
              <input
                value={q.label}
                onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
              <span className="whitespace-nowrap text-xs text-slate-500">
                {q.type === "yesno" ? "Yes/No" : "Multiple"}
              </span>
              <button
                onClick={() => {
                  if (confirm("Delete this question?")) removeQuestion(q.id);
                }}
                className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-600 hover:text-white"
              >
                Delete
              </button>
            </div>
            {q.type === "multi" && (
              <input
                value={(q.options ?? []).join(", ")}
                onChange={(e) =>
                  updateQuestion(q.id, { options: parseOptions(e.target.value) })
                }
                placeholder="Options, comma separated"
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            )}
          </div>
        ))}
      </div>

      {/* Add a new question */}
      <div className="space-y-2 border-t border-blue-200 pt-3">
        <p className="text-sm font-medium text-slate-700">Add a question</p>
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Question text"
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as QuestionType)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
          >
            <option value="yesno">Yes / No</option>
            <option value="multi">Multiple choice</option>
          </select>
          {newType === "multi" && (
            <input
              value={newOptions}
              onChange={(e) => setNewOptions(e.target.value)}
              placeholder="Options, comma separated"
              className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
          )}
          <button
            onClick={add}
            disabled={!newLabel.trim()}
            className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-300"
          >
            Add
          </button>
        </div>
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
