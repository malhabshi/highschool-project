"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRole } from "@/components/role-context";
import {
  useStudentSearch,
  useStudentFacets,
  useStudentMutations,
  type SearchParams,
} from "@/lib/students-search";
import { useQuestions } from "@/lib/questions";
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

const PAGE_SIZE = 50;

export function StudentsTable() {
  const { user, role } = useRole();
  const isAdmin = role === "admin";
  const { users } = useUsers();
  const employees = users.filter((u) => u.role === "employee");
  const { questions } = useQuestions();
  const cardB = questions[1]?.id ?? null; // the "B" question
  const cardD = questions[3]?.id ?? null; // the "D" question

  const mutations = useStudentMutations();

  // Filter state.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState(""); // debounced
  const [assignFilter, setAssignFilter] = useState("any");
  const [schoolFilter, setSchoolFilter] = useState("any");
  const [majorFilter, setMajorFilter] = useState("any");
  const [genderFilter, setGenderFilter] = useState("any");
  const [listFilter, setListFilter] = useState("any");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const setFilter = (id: string, v: string) =>
    setFilters((prev) => ({ ...prev, [id]: v }));

  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignTarget, setAssignTarget] = useState("");
  const [adding, setAdding] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  // Debounce the search box (don't hit the server on every keystroke).
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to page 1 when a filter/search changes.
  useEffect(() => {
    setPage(1);
  }, [
    assignFilter,
    schoolFilter,
    majorFilter,
    genderFilter,
    listFilter,
    search,
    filters,
  ]);

  // Translate the question filters into the yes/no + multi maps the server wants.
  const yesno: Record<string, string> = {};
  const multi: Record<string, string> = {};
  for (const q of questions) {
    const f = filters[q.id] ?? "any";
    if (f === "any") continue;
    if (q.type === "yesno") yesno[q.id] = f === "yes" ? "true" : "false";
    else multi[q.id] = f;
  }

  const params: SearchParams = {
    search,
    assignMode:
      assignFilter === "any"
        ? "any"
        : assignFilter === "unassigned"
          ? "unassigned"
          : "employee",
    assigned:
      assignFilter !== "any" && assignFilter !== "unassigned"
        ? assignFilter
        : null,
    school: schoolFilter === "any" ? null : schoolFilter,
    major: majorFilter === "any" ? null : majorFilter,
    gender: genderFilter === "any" ? null : genderFilter,
    tag: listFilter === "any" ? null : listFilter,
    yesno,
    multi,
    cardB,
    cardD,
    admin: isAdmin,
    userId: user.id,
    page,
    pageSize: PAGE_SIZE,
  };

  const { rows, dupIds, total, loading, refetch } = useStudentSearch(params);
  const { schools, majors, tags } = useStudentFacets(isAdmin, user.id);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, totalPages);

  const isCardBYes = (s: { answers?: Record<string, unknown> }) =>
    !!cardB && s.answers?.[cardB] === true;
  const isImportant = (s: {
    answers?: Record<string, unknown>;
    sentToMasarAt?: string | null;
  }) =>
    isAdmin &&
    !s.sentToMasarAt &&
    isCardBYes(s) &&
    !!cardD &&
    s.answers?.[cardD] === true;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Select / deselect only the rows on the current page.
  function toggleAll() {
    const pageIds = rows.map((r) => r.id);
    const allOnPage =
      pageIds.length > 0 && pageIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPage) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function deleteSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (confirm(`Delete ${ids.length} selected profile(s)?`)) {
      await mutations.removeMany(ids);
      setSelected(new Set());
      refetch();
    }
  }

  async function assignSelected() {
    const ids = [...selected];
    if (ids.length === 0 || !assignTarget) return;
    await mutations.assignMany(ids, assignTarget);
    setSelected(new Set());
    setAssignTarget("");
    refetch();
  }

  async function unassignSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (confirm(`Unassign ${ids.length} selected profile(s)?`)) {
      await mutations.assignMany(ids, "");
      setSelected(new Set());
      refetch();
    }
  }

  const allSelected =
    rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-800">
          {isAdmin ? "All Students" : "My Students"}
        </h2>
        {isAdmin && selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
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
              onClick={unassignSelected}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Unassign ({selected.size})
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
            <span className="text-sm text-slate-500">{total} total</span>
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
          onAdd={async (data) => {
            await mutations.addStudent(data);
            setAdding(false);
            refetch();
          }}
        />
      )}

      {/* Bulk upload (admin) */}
      {isAdmin && bulkOpen && (
        <BulkUploadPanel
          onCancel={() => setBulkOpen(false)}
          onImport={async (list) => {
            await mutations.addStudentsBulk(list);
            refetch();
          }}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 px-5 py-3">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="🔍 Search name or phone…"
          className="min-w-[14rem] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
        />
        <span className="text-xs font-medium uppercase text-slate-400">
          Filters
        </span>
        {isAdmin && (
          <FilterSelect
            label="Employee"
            value={assignFilter}
            onChange={setAssignFilter}
            options={[
              { v: "any", l: "Any" },
              { v: "unassigned", l: "Unassigned" },
              ...employees.map((e) => ({ v: e.id, l: e.name })),
            ]}
          />
        )}
        <FilterSelect
          label="School"
          value={schoolFilter}
          onChange={setSchoolFilter}
          options={[
            { v: "any", l: "Any" },
            ...schools.map((sc) => ({ v: sc, l: sc })),
          ]}
        />
        <FilterSelect
          label="Major"
          value={majorFilter}
          onChange={setMajorFilter}
          options={[
            { v: "any", l: "Any" },
            ...majors.map((m) => ({ v: m, l: m })),
          ]}
        />
        <FilterSelect
          label="Gender"
          value={genderFilter}
          onChange={setGenderFilter}
          options={[
            { v: "any", l: "Any" },
            { v: "M", l: "M" },
            { v: "F", l: "F" },
            { v: "N/A", l: "N/A" },
          ]}
        />
        <FilterSelect
          label="List name"
          value={listFilter}
          onChange={setListFilter}
          options={[
            { v: "any", l: "Any" },
            ...tags.map((t) => ({ v: t, l: t })),
          ]}
        />
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

      {loading && rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
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
                <th className="px-5 py-3 font-medium">Accepted in</th>
                <th className="px-5 py-3 font-medium">Major</th>
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
              {rows.map((s) => {
                const isDuplicate = dupIds.has(s.id);
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
                      {s.tag && (
                        <div className="mb-1">
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                            {s.tag}
                          </span>
                        </div>
                      )}
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
                    <td className="px-5 py-3">
                      <a
                        href={telHref(s.phone)}
                        className="text-blue-600 hover:underline"
                      >
                        {s.phone}
                      </a>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {s.school || "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {s.acceptedCountry || "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {s.major || "—"}
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
                              onClick={async () => {
                                await mutations.update(s.id, {
                                  sent_to_masar_at: new Date().toISOString(),
                                });
                                refetch();
                              }}
                              className="rounded-md bg-blue-800 px-2 py-0.5 text-xs font-semibold text-white transition-colors hover:bg-blue-900"
                            >
                              Send to Masar
                            </button>
                          ))}
                        {!isDuplicate &&
                          !s.deletionRequested &&
                          !(isAdmin && isCardBYes(s)) && (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={async () => {
                            if (confirm(`Delete ${s.name}'s profile?`)) {
                              await mutations.remove(s.id);
                              refetch();
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

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm">
          <span className="text-slate-500">
            Showing {(current - 1) * PAGE_SIZE + 1}–
            {Math.min(current * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(1)}
              disabled={current === 1}
              className="hidden rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 sm:inline-flex"
            >
              « First
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={current === 1}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              ‹ Prev
            </button>
            <span className="px-1 text-slate-600">
              Page {current} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={current === totalPages}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Next ›
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={current === totalPages}
              className="hidden rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 sm:inline-flex"
            >
              Last »
            </button>
          </div>
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
  gender?: string;
  studentNumber?: string;
  phone2?: string;
  acceptedCountry?: string;
  major?: string;
};

// Normalize a free-text gender cell to "M" | "F" | "N/A".
function normGender(raw: string) {
  const v = raw.trim().toUpperCase();
  if (v === "M" || v === "MALE") return "M";
  if (v === "F" || v === "FEMALE") return "F";
  return "N/A";
}

// Normalize a phone cell: keep digits only and strip the Kuwait country code.
function normPhone(raw: string) {
  let p = (raw ?? "").replace(/\D/g, "");
  if (p.startsWith("00965")) p = p.slice(5);
  else if (p.startsWith("965") && p.length > 8) p = p.slice(3);
  return p;
}

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
      "Name,Phone,Phone 2,School,Gender,Student Number,Accepted Country,Major\n" +
      "Example Student,90001234,90005678,Example School,M,2024001,UK,Engineering\n";
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
      const head0 = rows[0]?.[0]?.trim().toLowerCase();
      if (head0 === "name" || head0 === "phone") rows.shift();

      const valid: BulkRow[] = [];
      let skipped = 0;
      for (const r of rows) {
        let name = (r[0] ?? "").trim();
        let phone = normPhone(r[1] ?? "");
        // If the phone column is empty but the first column holds the number
        // (a phone-only file), use that instead.
        if (!phone && normPhone(name)) {
          phone = normPhone(name);
          name = "";
        }
        const phone2 = normPhone(r[2] ?? "");
        const school = (r[3] ?? "").trim();
        const gender = normGender(r[4] ?? "");
        const studentNumber = (r[5] ?? "").trim();
        const acceptedCountry = (r[6] ?? "").trim();
        const major = (r[7] ?? "").trim();
        // Only the phone is required; everything else is optional.
        if (!phone) {
          skipped++;
          continue;
        }
        // Imported unassigned, tagged with the list name.
        valid.push({
          name: name || phone,
          phone,
          school,
          assignedTo: "",
          tag: listTag,
          gender,
          studentNumber,
          phone2,
          acceptedCountry,
          major,
        });
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
        <span className="font-medium">
          Name, Phone, Phone 2, School, Gender, Student Number, Accepted
          Country, Major
        </span>
        ), then upload it.{" "}
        <span className="font-medium">Only Phone is required</span> — everything
        else is optional. Numbers with the Kuwait country code (965…) are
        accepted and trimmed automatically. Rows with no name show the phone
        number as the name. Uploaded students come in{" "}
        <span className="font-medium">unassigned</span> — select them in the list
        and use <span className="font-medium">Assign</span> to give them to an
        employee.
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
    gender: string;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [school, setSchool] = useState("");
  const [gender, setGender] = useState("N/A");
  const [assignedTo, setAssignedTo] = useState(employees[0]?.id ?? "");
  const [error, setError] = useState("");

  function submit() {
    if (!name.trim()) return setError("Name is required.");
    if (!/^\d{8}$/.test(phone)) return setError("Phone must be exactly 8 digits.");
    if (!assignedTo) return setError("Please assign an employee.");
    onAdd({ name: name.trim(), phone, school: school.trim(), assignedTo, gender });
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
