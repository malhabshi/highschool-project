"use client";

import { useState } from "react";
import Link from "next/link";
import { useRole } from "@/components/role-context";
import { useStudents, type Student } from "@/lib/students";

// Shows the students assigned to the logged-in user, split into 3 pipeline
// columns, and lets them add new ones.
export function MyStudents() {
  const { user } = useRole();
  const { students, addStudent, update, loaded } = useStudents();
  const [adding, setAdding] = useState(false);

  const mine = students.filter((s) => s.assignedTo === user.id);
  const none = mine.filter((s) => s.pipeline !== "yellow" && s.pipeline !== "blue");
  const yellow = mine.filter((s) => s.pipeline === "yellow");
  const blue = mine.filter((s) => s.pipeline === "blue");

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
            await addStudent({ ...data, assignedTo: user.id });
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
            onSet={(id, v) => update(id, { pipeline: v })}
          />
          <Column
            title="Yellow"
            accent="bg-yellow-400"
            students={yellow}
            onSet={(id, v) => update(id, { pipeline: v })}
          />
          <Column
            title="Dark blue"
            accent="bg-blue-800"
            students={blue}
            onSet={(id, v) => update(id, { pipeline: v })}
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
}: {
  title: string;
  accent: string;
  students: Student[];
  onSet: (id: string, v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${accent}`} />
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        </div>
        <span className="text-xs text-slate-500">{students.length}</span>
      </div>

      <div className="space-y-3 p-3">
        {students.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-slate-400">
            No students here.
          </p>
        ) : (
          students.map((s) => (
            <div
              key={s.id}
              className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
            >
              <Link
                href={`/student/${s.id}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {s.name}
              </Link>
              <div className="mt-1 text-xs text-slate-500">{s.phone}</div>
              {s.school && (
                <div className="text-xs text-slate-500">{s.school}</div>
              )}
              <div className="mt-2 border-t border-slate-100 pt-2">
                <PipelinePicker
                  value={s.pipeline}
                  onChange={(v) => onSet(s.id, v)}
                />
              </div>
            </div>
          ))
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
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [school, setSchool] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return setError("Name is required.");
    if (!/^\d{8}$/.test(phone)) return setError("Phone must be exactly 8 digits.");
    setBusy(true);
    try {
      await onAdd({ name: name.trim(), phone, school: school.trim() });
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
