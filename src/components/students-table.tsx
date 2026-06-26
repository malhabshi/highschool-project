"use client";

import { useState } from "react";
import Link from "next/link";
import { useRole } from "@/components/role-context";
import { useStudents, duplicatesOf } from "@/lib/students";
import { useQuestions } from "@/lib/questions";
import { useUsers, nameOf } from "@/lib/users";

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

export function StudentsTable() {
  const { user, role } = useRole();
  const { users } = useUsers();
  const employees = users.filter((u) => u.role === "employee");
  const {
    students: all,
    addStudent,
    addStudentsBulk,
    remove,
    removeMany,
    assignMany,
    update,
  } = useStudents();
  const isAdmin = role === "admin";

  const { questions } = useQuestions();
  const cardB = questions[1]?.id; // the "B" question
  const cardD = questions[3]?.id; // the "D" question
  const isCardBYes = (s: { answers?: Record<string, unknown> }) =>
    !!cardB && s.answers?.[cardB] === true;
  const isCardDYes = (s: { answers?: Record<string, unknown> }) =>
    !!cardD && s.answers?.[cardD] === true;
  // "Important" = answered Yes to both B and D, not yet sent (admin only).
  const isImportant = (s: {
    answers?: Record<string, unknown>;
    sentToMasarAt?: string | null;
  }) => isAdmin && !s.sentToMasarAt && isCardBYes(s) && isCardDYes(s);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignTarget, setAssignTarget] = useState("");
  const [adding, setAdding] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  // Filters keyed by question id (value "any" by default).
  const [filters, setFilters] = useState<Record<string, string>>({});
  const setFilter = (id: string, v: string) =>
    setFilters((prev) => ({ ...prev, [id]: v }));

  // Keep this page separate from the My Students page: hide students that were
  // created over there.
  const base = all.filter((s) => s.source !== "my-students");

  // Admin sees every student; an employee sees only their assigned students.
  const roleList = isAdmin
    ? base
    : base.filter((s) => s.assignedTo === user.id);

  // Apply the question filters.
  const students = roleList.filter((s) => {
    for (const q of questions) {
      const f = filters[q.id] ?? "any";
      if (f === "any") continue;
      const answer = s.answers?.[q.id];
      if (q.type === "yesno") {
        if (f === "yes" && answer !== true) return false;
        if (f === "no" && answer !== false) return false;
      } else {
        const arr = Array.isArray(answer) ? answer : [];
        if (!arr.includes(f)) return false;
      }
    }
    return true;
  });

  // Ranking for ordering: Important (B & D) at the very top, then Yes-to-B,
  // then everyone else.
  const rank = (s: { answers?: Record<string, unknown> }) =>
    isImportant(s) ? 2 : isCardBYes(s) ? 1 : 0;
  const ordered = cardB
    ? [...students].sort((a, b) => rank(b) - rank(a))
    : students;

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
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              {students.length} total
            </span>
            {isAdmin && (
              <>
                <button
                  onClick={() => setBulkOpen(true)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Bulk upload
                </button>
                <button
                  onClick={() => setAdding(true)}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  + Add student
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Add-student form (admin) */}
      {isAdmin && adding && (
        <AddStudentForm
          employees={employees}
          onCancel={() => setAdding(false)}
          onAdd={(data) => {
            addStudent(data);
            setAdding(false);
          }}
        />
      )}

      {/* Bulk upload (admin) */}
      {isAdmin && bulkOpen && (
        <BulkUploadPanel
          onCancel={() => setBulkOpen(false)}
          onImport={(list) => addStudentsBulk(list)}
        />
      )}

      {/* Filters (generated from the configurable questions) */}
      {questions.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 px-5 py-3">
          <span className="text-xs font-medium uppercase text-slate-400">
            Filters
          </span>
          {questions.map((q) => (
            <FilterSelect
              key={q.id}
              label={q.label}
              value={filters[q.id] ?? "any"}
              onChange={(v) => setFilter(q.id, v)}
              options={
                q.type === "yesno"
                  ? [
                      { v: "any", l: "Any" },
                      { v: "yes", l: "Yes" },
                      { v: "no", l: "No" },
                    ]
                  : [
                      { v: "any", l: "Any" },
                      ...(q.options ?? []).map((o) => ({ v: o, l: o })),
                    ]
              }
            />
          ))}
        </div>
      )}

      {students.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          No students match.
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
              <th className="px-5 py-3 font-medium">Phone</th>
              <th className="px-5 py-3 font-medium">School</th>
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
            {ordered.map((s) => {
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
                    <span className="flex items-center gap-1.5">
                      <Link
                        href={`/student/${s.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {s.name}
                      </Link>
                      {isCardBYes(s) && (
                        <span
                          title="Answered Yes to question B"
                          className="text-green-600"
                        >
                          ✓
                        </span>
                      )}
                      {isImportant(s) && (
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                          Important
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{s.phone}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {s.school || "—"}
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3 text-slate-600">
                      {s.assignedTo ? (
                        nameOf(users, s.assignedTo)
                      ) : (
                        <span className="text-amber-600">Unassigned</span>
                      )}
                    </td>
                  )}
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {s.tag && (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                          {s.tag}
                        </span>
                      )}
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
                      {isAdmin &&
                        isCardBYes(s) &&
                        (s.sentToMasarAt ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Sent to Masar · {fmtKuwait(s.sentToMasarAt)}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              update(s.id, {
                                sentToMasarAt: new Date().toISOString(),
                              })
                            }
                            className="rounded-md bg-blue-800 px-2 py-0.5 text-xs font-semibold text-white transition-colors hover:bg-blue-900"
                          >
                            Send to Masar
                          </button>
                        ))}
                      {!s.tag &&
                        !isDuplicate &&
                        !s.deletionRequested &&
                        !(isAdmin && isCardBYes(s)) && (
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

// Minimal CSV parser that handles quoted fields and commas inside quotes.
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

type BulkRow = {
  name: string;
  phone: string;
  school?: string;
  assignedTo: string;
  tag?: string;
};

function BulkUploadPanel({
  onImport,
  onCancel,
}: {
  onImport: (list: BulkRow[]) => void;
  onCancel: () => void;
}) {
  const [result, setResult] = useState("");
  const [tag, setTag] = useState("");

  function downloadTemplate() {
    const content =
      "Name,Phone,School\n" + "Example Student,90001234,Example School\n";
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const listTag = tag.trim();
    if (!listTag) {
      setResult("");
      alert("Please enter a list name before uploading.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const rows = parseCSV(text).filter((r) => r.some((c) => c.trim() !== ""));
      // Drop the header row if it looks like one.
      if (rows[0]?.[0]?.trim().toLowerCase() === "name") rows.shift();

      const valid: BulkRow[] = [];
      let skipped = 0;
      for (const r of rows) {
        const name = (r[0] ?? "").trim();
        const phone = (r[1] ?? "").replace(/\D/g, "");
        const school = (r[2] ?? "").trim();
        if (!name || !/^\d{8}$/.test(phone)) {
          skipped++;
          continue;
        }
        // Imported unassigned, tagged with the list name.
        valid.push({ name, phone, school, assignedTo: "", tag: listTag });
      }
      if (valid.length) onImport(valid);
      setResult(
        `Imported ${valid.length} student(s) into list "${listTag}"` +
          (skipped ? `, skipped ${skipped} invalid row(s).` : ".") +
          (valid.length ? " They are unassigned — select them and assign." : "")
      );
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
      <h3 className="font-semibold text-slate-800">Bulk upload students</h3>
      <p className="text-sm text-slate-500">
        Download the template, fill it in (columns:{" "}
        <span className="font-medium">Name, Phone, School</span>), then upload
        it. Name and an 8-digit Phone are required; School is optional.
        Uploaded students come in <span className="font-medium">unassigned</span>
        {" "}— select them in the list and use{" "}
        <span className="font-medium">Assign</span> to give them to an employee.
      </p>
      <label className="block max-w-xs">
        <span className="mb-1 block text-sm font-medium text-slate-600">
          List name <span className="text-red-500">*</span>
        </span>
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="e.g. Instagram June, School visit…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={downloadTemplate}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          ⬇ Download template
        </button>
        <label className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
          Upload CSV
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="hidden"
          />
        </label>
        <button
          onClick={onCancel}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          Close
        </button>
      </div>
      {result && <p className="text-sm font-medium text-green-700">{result}</p>}
    </div>
  );
}

function AddStudentForm({
  employees,
  onAdd,
  onCancel,
}: {
  employees: { id: string; name: string }[];
  onAdd: (data: {
    name: string;
    phone: string;
    school?: string;
    assignedTo: string;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [school, setSchool] = useState("");
  const [assignedTo, setAssignedTo] = useState(employees[0]?.id ?? "");
  const [error, setError] = useState("");

  function submit() {
    if (!name.trim()) return setError("Name is required.");
    if (!/^\d{8}$/.test(phone)) return setError("Phone must be exactly 8 digits.");
    if (!assignedTo) return setError("Please assign an employee.");
    onAdd({ name: name.trim(), phone, school: school.trim(), assignedTo });
  }

  return (
    <div className="space-y-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
      <h3 className="font-semibold text-slate-800">Add a student</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            Phone number (8 digits) <span className="text-red-500">*</span>
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
            School name <span className="text-slate-400">(optional)</span>
          </span>
          <input
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            Assign to
          </span>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      </div>

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
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Add student
        </button>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-slate-600">
      {label}:
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}
