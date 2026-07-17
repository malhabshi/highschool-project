"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRole } from "@/components/role-context";
import { useStudentProfile } from "@/lib/students";
import {
  useQuestions,
  scholarshipQuestionId,
  type Question,
  type QuestionType,
} from "@/lib/questions";
import { useUsers, nameOf } from "@/lib/users";
import { telHref } from "@/lib/phone";

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

export function StudentProfile({ id }: { id: string }) {
  const router = useRouter();
  const { user, role } = useRole();
  const {
    student,
    duplicates,
    prevId,
    nextId,
    update,
    requestDeletion,
    remove,
    loaded,
  } = useStudentProfile(id, role, user.id);
  const { questions, addQuestion, updateQuestion, removeQuestion } =
    useQuestions();
  const { users } = useUsers();
  const [managing, setManaging] = useState(false);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phone2, setPhone2] = useState("");
  const [school, setSchool] = useState("");
  const [gender, setGender] = useState("N/A");
  const [acceptedCountry, setAcceptedCountry] = useState("");
  const [major, setMajor] = useState("");
  const [withMasar, setWithMasar] = useState(false);
  const [masarEmployee, setMasarEmployee] = useState("");
  const [error, setError] = useState("");

  // Notes is edited locally and saved on blur (so live updates don't interrupt typing).
  const [noteDraft, setNoteDraft] = useState("");
  useEffect(() => {
    setNoteDraft(student?.notes ?? "");
  }, [student?.id, student?.notes]);

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
    setPhone2(student.phone2 ?? "");
    setSchool(student.school);
    setGender(student.gender ?? "N/A");
    setAcceptedCountry(student.acceptedCountry ?? "");
    setMajor(student.major ?? "");
    setWithMasar(student.withMasar ?? false);
    setMasarEmployee(student.masarEmployee ?? "");
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
      phone2: phone2.replace(/\D/g, ""),
      school: school.trim(),
      gender,
      acceptedCountry: acceptedCountry.trim(),
      major: major.trim(),
      withMasar,
      masarEmployee: withMasar ? masarEmployee.trim() : "",
    });
    setEditing(false);
  }

  function handleDelete() {
    if (!student) return;
    if (confirm(`Permanently delete ${student.name}'s profile?`)) {
      remove();
      router.push("/students");
    }
  }

  function handleRequestDeletion() {
    requestDeletion();
  }

  const isAdmin = role === "admin";

  // "Send to Masar" is admin-only and applies to students who answered Yes to
  // question B.
  const cardB = questions[1]?.id;
  const cardBYes = !!cardB && student.answers?.[cardB] === true;

  return (
    <div className="space-y-6">
      {/* Top navigation: prev / back / next */}
      <div className="flex items-center justify-between">
        <ArrowButton href={prevId ? `/student/${prevId}` : null} dir="prev" />
        {backLink}
        <ArrowButton href={nextId ? `/student/${nextId}` : null} dir="next" />
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
                  — held by{" "}
                  <span className="font-medium">
                    {nameOf(users, d.assignedTo)}
                  </span>
                  , added by{" "}
                  <span className="font-medium">
                    {d.source === "my-students" ? "an employee" : "the admin"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 break-words text-xl font-bold text-slate-800 sm:text-2xl">
              {student.name}
              {scholarshipQuestionId(questions) &&
                student.answers?.[scholarshipQuestionId(questions)!] ===
                  true && (
                  <span title="Wants a scholarship" className="text-green-600">
                    ✓
                  </span>
                )}
            </h1>
            <p className="text-sm">
              <a
                href={telHref(student.phone)}
                className="text-blue-600 hover:underline"
              >
                {student.phone}
              </a>
              {student.phone2 && (
                <>
                  {" · "}
                  <a
                    href={telHref(student.phone2)}
                    className="text-blue-600 hover:underline"
                  >
                    {student.phone2}
                  </a>
                </>
              )}
            </p>
            <p className="text-sm text-slate-500">
              Assigned to {nameOf(users, student.assignedTo)}
            </p>
            {student.tag && (
              <span className="mt-1 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {student.tag}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isAdmin && cardBYes && (
              student.sentToMasarAt ? (
                <span className="rounded-full bg-green-100 px-3 py-1.5 text-sm font-medium text-green-700">
                  Sent to Masar · {fmtKuwait(student.sentToMasarAt)}
                </span>
              ) : (
                <button
                  onClick={() =>
                    update(student.id, {
                      sentToMasarAt: new Date().toISOString(),
                    })
                  }
                  className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-900"
                >
                  Send to Masar
                </button>
              )
            )}
            {!editing && (
              <button
                onClick={startEdit}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Details (view mode) */}
        {!editing && (
          <>
            <dl className="space-y-3 pt-6 text-sm">
              {student.studentNumber && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Student number</dt>
                  <dd className="font-medium text-slate-800">
                    {student.studentNumber}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">School name</dt>
                <dd className="font-medium text-slate-800">{student.school}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Gender</dt>
                <dd className="font-medium text-slate-800">
                  {student.gender ?? "N/A"}
                </dd>
              </div>
              {student.acceptedCountry && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Accepted in</dt>
                  <dd className="font-medium text-slate-800">
                    {student.acceptedCountry}
                  </dd>
                </div>
              )}
              {student.major && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Major</dt>
                  <dd className="font-medium text-slate-800">{student.major}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">With MASAR</dt>
                <dd className="font-medium text-slate-800">
                  {student.withMasar ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                      MASAR
                      {student.masarEmployee ? ` · ${student.masarEmployee}` : ""}
                    </span>
                  ) : (
                    "No"
                  )}
                </dd>
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
            <Field label="Phone number 2 (optional)">
              <input
                value={phone2}
                inputMode="numeric"
                onChange={(e) =>
                  setPhone2(e.target.value.replace(/\D/g, "").slice(0, 8))
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
            <Field label="Gender">
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="M">M</option>
                <option value="F">F</option>
                <option value="N/A">N/A</option>
              </select>
            </Field>
            <Field label="Accepted in (country)">
              <input
                value={acceptedCountry}
                onChange={(e) => setAcceptedCountry(e.target.value)}
                placeholder="e.g. UK, USA, Australia…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </Field>
            <Field label="Major">
              <input
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                placeholder="e.g. Engineering, Business…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={withMasar}
                onChange={(e) => setWithMasar(e.target.checked)}
                className="h-5 w-5"
              />
              Student is with MASAR
            </label>
            {withMasar && (
              <Field label="MASAR employee (who is helping)">
                <input
                  value={masarEmployee}
                  onChange={(e) => setMasarEmployee(e.target.value)}
                  placeholder="e.g. Ahmad Dashti"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </Field>
            )}

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
          {questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              letter={String.fromCharCode(65 + i)}
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
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => {
            if (noteDraft !== (student.notes ?? "")) {
              update(student.id, { notes: noteDraft });
            }
          }}
          rows={5}
          placeholder="Type your notes here..."
          className="w-full resize-y rounded-lg border border-slate-300 p-3 text-sm text-slate-800 outline-none focus:border-blue-500"
        />
      </div>
    </div>
  );
}

function QuestionCard({
  letter,
  question,
  value,
  onChange,
}: {
  letter: string;
  question: Question;
  value: boolean | string[] | undefined;
  onChange: (v: boolean | string[]) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="flex items-start gap-2 font-semibold text-slate-800">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {letter}
        </span>
        <span>{question.label}</span>
      </h2>

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
