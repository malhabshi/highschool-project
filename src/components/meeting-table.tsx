"use client";

import { useEffect, useState } from "react";
import { useAttendees, useAttendeeAssignments } from "@/lib/meeting";
import { useRole } from "@/components/role-context";
import { telHref } from "@/lib/phone";

// A person can have 1-3 numbers stored together; split them for display.
function splitPhones(raw: string): string[] {
  return (raw ?? "")
    .split(/[\/,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Join up to 3 entered numbers into one stored string.
function joinPhones(...nums: string[]): string {
  return nums.map((n) => n.trim()).filter(Boolean).join(" / ");
}

// Inline, free-text major field (saves on blur).
function MajorInput({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v.trim() !== value) onSave(v.trim());
      }}
      placeholder="—"
      className="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
    />
  );
}

// Inline, digits-only ticket-number field (saves on blur).
function TicketInput({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      value={v}
      inputMode="numeric"
      onChange={(e) => setV(e.target.value.replace(/\D/g, ""))}
      onBlur={() => {
        if (v !== value) onSave(v);
      }}
      placeholder="—"
      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
    />
  );
}

export function MeetingTable() {
  const { user, role } = useRole();
  const isAdmin = role === "admin";
  const { attendees, add, addMany, update, remove, removeAll, loaded } =
    useAttendees({
      id: user.id,
      name: user.name,
    });
  // Match attendees (by phone) to their student record + assigned account user.
  const { matchFor } = useAttendeeAssignments(attendees);
  const [adding, setAdding] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [search, setSearch] = useState("");

  const term = search.trim().toLowerCase();
  const phoneQuery = search.replace(/\D/g, "");
  const shown = term
    ? attendees.filter(
        (a) =>
          a.name.toLowerCase().includes(term) ||
          (phoneQuery.length > 0 && a.phone.includes(phoneQuery))
      )
    : attendees;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-800">
          Meeting attendees
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{attendees.length} total</span>
          {isAdmin && attendees.length > 0 && (
            <button
              onClick={() => {
                if (
                  confirm(
                    `Delete ALL ${attendees.length} attendees? This cannot be undone.`
                  )
                )
                  removeAll();
              }}
              className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-600 hover:text-white"
            >
              Delete all
            </button>
          )}
          <button
            onClick={() => setBulkOpen(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Bulk import
          </button>
          <button
            onClick={() => setAdding(true)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            + Add person
          </button>
        </div>
      </div>

      {bulkOpen && (
        <BulkImportPanel
          onCancel={() => setBulkOpen(false)}
          onImport={(list) => addMany(list)}
        />
      )}

      {adding && (
        <AddAttendeeForm
          onCancel={() => setAdding(false)}
          onAdd={async (data) => {
            await add(data);
            setAdding(false);
          }}
        />
      )}

      {attendees.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-3 py-3 sm:px-5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search name or phone…"
            className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
          />
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-1.5 rounded-sm bg-blue-500" /> Applied with
              MASAR
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-1.5 rounded-sm bg-red-500" /> Other agent /
              none
            </span>
          </div>
        </div>
      )}

      {!loaded ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : attendees.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          No one added yet. Click “Add person”.
        </p>
      ) : shown.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          No matches.
        </p>
      ) : (
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[1120px] whitespace-nowrap text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="px-3 py-3 font-medium sm:px-5">Ticket #</th>
                <th className="px-3 py-3 font-medium sm:px-5">Name</th>
                <th className="px-3 py-3 font-medium sm:px-5">Phone</th>
                <th className="px-3 py-3 font-medium sm:px-5">Accepted in</th>
                <th className="px-3 py-3 font-medium sm:px-5">Major</th>
                <th className="px-3 py-3 font-medium sm:px-5">Applied with us</th>
                <th className="px-3 py-3 font-medium sm:px-5">
                  Assigned to (account)
                </th>
                <th
                  className="px-3 py-3 text-center font-medium sm:px-5"
                  dir="rtl"
                >
                  حضر؟
                </th>
                <th className="px-3 py-3 text-center font-medium sm:px-5">
                  IELTS?
                </th>
                <th
                  className="px-3 py-3 text-center font-medium sm:px-5"
                  dir="rtl"
                >
                  مقدم مع مكتب ثاني ؟
                </th>
                <th className="px-3 py-3 text-right font-medium sm:px-5">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => {
                // Red if they applied with another office, or didn't apply with
                // MASAR. Blue only when it's a clean MASAR applicant.
                const red = a.otherOffice || a.applied !== "MASAR";
                // Matching student in the account (by phone) + who owns them.
                const match = matchFor(a);
                return (
                <tr
                  key={a.id}
                  className={`border-b border-white last:border-0 ${
                    red
                      ? "bg-red-100 hover:bg-red-200"
                      : "bg-blue-100 hover:bg-blue-200"
                  }`}
                >
                  <td
                    className={`border-l-8 px-3 py-3 sm:px-5 ${
                      red ? "border-red-600" : "border-blue-600"
                    }`}
                  >
                    <TicketInput
                      value={a.ticket}
                      onSave={(v) => update(a.id, { ticket: v })}
                    />
                  </td>
                  <td className="px-3 py-3 sm:px-5 font-medium text-slate-800">
                    <div>{a.name || "—"}</div>
                    {a.otherOffice && (
                      <div
                        className="mt-1 w-fit rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white"
                        dir="rtl"
                      >
                        ⚠️ مقدم مع مكتب ثاني
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 sm:px-5">
                    {splitPhones(a.phone).length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {splitPhones(a.phone).map((p, i) => (
                          <a
                            key={i}
                            href={telHref(p)}
                            className="text-blue-600 hover:underline"
                          >
                            {p}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 sm:px-5 text-slate-600">
                    {a.country || "—"}
                  </td>
                  <td className="px-3 py-3 sm:px-5">
                    <MajorInput
                      value={a.major}
                      onSave={(v) => update(a.id, { major: v })}
                    />
                  </td>
                  <td className="px-3 py-3 sm:px-5">
                    {a.applied === "MASAR" ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="w-fit rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                          MASAR
                        </span>
                        {a.masarEmployee && (
                          <span className="text-xs text-slate-500">
                            👤 {a.masarEmployee}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">no</span>
                    )}
                  </td>
                  <td className="px-3 py-3 sm:px-5">
                    {match ? (
                      match.assignedName ? (
                        <span className="w-fit rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                          👤 {match.assignedName}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600">
                          student · unassigned
                        </span>
                      )
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 sm:px-5 text-center">
                    <input
                      type="checkbox"
                      checked={a.attended}
                      onChange={(e) =>
                        update(
                          a.id,
                          { attended: e.target.checked },
                          e.target.checked && match
                            ? `assigned to ${match.assignedName || "unassigned"}`
                            : undefined
                        )
                      }
                      aria-label="حضر؟"
                      className="h-5 w-5"
                    />
                  </td>
                  <td className="px-3 py-3 sm:px-5 text-center">
                    <input
                      type="checkbox"
                      checked={a.ielts}
                      onChange={(e) =>
                        update(a.id, { ielts: e.target.checked })
                      }
                      aria-label="IELTS?"
                      className="h-5 w-5"
                    />
                  </td>
                  <td className="px-3 py-3 sm:px-5 text-center">
                    <input
                      type="checkbox"
                      checked={a.otherOffice}
                      onChange={(e) =>
                        update(a.id, { otherOffice: e.target.checked })
                      }
                      aria-label="مقدم مع مكتب ثاني ؟"
                      className="h-5 w-5"
                    />
                  </td>
                  <td className="px-3 py-3 sm:px-5 text-right">
                    {isAdmin ? (
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${a.name || "this person"}?`))
                            remove(a.id);
                        }}
                        className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-600 hover:text-white"
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
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

// Minimal CSV parser (handles quoted fields and commas inside quotes).
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

function BulkImportPanel({
  onImport,
  onCancel,
}: {
  onImport: (
    list: {
      name: string;
      phone: string;
      country: string;
      applied: string;
      masarEmployee: string;
      ielts: boolean;
      otherOffice: boolean;
      ticket: string;
      major: string;
    }[]
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const [result, setResult] = useState("");

  function downloadTemplate() {
    const content =
      "Name,Phone,Phone 2,Phone 3,Country,Major,Applied with us,MASAR Employee,IELTS,Another office,Ticket\n" +
      "Example Person,90001234,90009999,,UK,Business,MASAR,Ahmad Dashti,yes,no,101\n" +
      "Someone Else,90005678,,,USA,Engineering,,,no,yes,\n";
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attendees-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result ?? "");
      const rows = parseCSV(text).filter((r) => r.some((c) => c.trim() !== ""));
      const head0 = rows[0]?.[0]?.trim().toLowerCase();
      if (head0 === "name") rows.shift();

      const valid: {
        name: string;
        phone: string;
        country: string;
        applied: string;
        masarEmployee: string;
        ielts: boolean;
        otherOffice: boolean;
        ticket: string;
        major: string;
      }[] = [];
      let skipped = 0;
      const yes = new Set(["yes", "y", "1", "true", "✓", "نعم"]);
      for (const r of rows) {
        const name = (r[0] ?? "").trim();
        // Up to 3 numbers combined into one field.
        const phone = joinPhones(r[1] ?? "", r[2] ?? "", r[3] ?? "");
        const country = (r[4] ?? "").trim();
        const major = (r[5] ?? "").trim();
        // Applied-with-us column: counts as MASAR only if it contains the word
        // "MASAR" (case-insensitive). Anything else => not MASAR.
        const applied = (r[6] ?? "").toLowerCase().includes("masar")
          ? "MASAR"
          : "no";
        // Employee name only kept when they applied with us.
        const masarEmployee = applied === "MASAR" ? (r[7] ?? "").trim() : "";
        const ielts = yes.has((r[8] ?? "").trim().toLowerCase());
        const otherOffice = yes.has((r[9] ?? "").trim().toLowerCase());
        const ticket = (r[10] ?? "").replace(/\D/g, "");
        if (!name && !phone) {
          skipped++;
          continue;
        }
        valid.push({
          name,
          phone,
          country,
          applied,
          masarEmployee,
          ielts,
          otherOffice,
          ticket,
          major,
        });
      }
      if (valid.length) await onImport(valid);
      setResult(
        `Imported ${valid.length} person(s)` +
          (skipped ? `, skipped ${skipped} empty row(s).` : ".")
      );
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
      <h3 className="font-semibold text-slate-800">Bulk import attendees</h3>
      <p className="text-sm text-slate-500">
        Download the template, fill it in (columns:{" "}
        <span className="font-medium">
          Name, Phone, Phone 2, Phone 3, Country, Major, Applied with us, MASAR
          Employee, IELTS, Another office, Ticket
        </span>
        ), then upload it. Each person can have up to 3 numbers (Phone, Phone 2,
        Phone 3). A row needs at least a Name or a Phone. For IELTS and Another
        office, write yes or leave blank/no. In the{" "}
        <span className="font-medium">Applied with us</span> column, write{" "}
        <span className="font-medium">MASAR</span> if they applied with us —
        anything else (or blank) counts as not with MASAR. Put the helping
        employee&apos;s name in{" "}
        <span className="font-medium">MASAR Employee</span> (only used when they
        applied with us). For <span className="font-medium">IELTS</span>, write
        yes or leave blank/no.
      </p>
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

function AddAttendeeForm({
  onAdd,
  onCancel,
}: {
  onAdd: (data: {
    name: string;
    phone: string;
    country: string;
    applied: string;
    masarEmployee: string;
    ielts: boolean;
    otherOffice: boolean;
    ticket: string;
    major: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [phone1, setPhone1] = useState("");
  const [phone2, setPhone2] = useState("");
  const [phone3, setPhone3] = useState("");
  const [country, setCountry] = useState("");
  const [major, setMajor] = useState("");
  const [applied, setApplied] = useState(false);
  const [masarEmployee, setMasarEmployee] = useState("");
  const [ielts, setIelts] = useState(false);
  const [otherOffice, setOtherOffice] = useState(false);
  const [ticket, setTicket] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return setError("Name is required.");
    setBusy(true);
    try {
      await onAdd({
        name: name.trim(),
        phone: joinPhones(phone1, phone2, phone3),
        country: country.trim(),
        applied: applied ? "MASAR" : "no",
        masarEmployee: applied ? masarEmployee.trim() : "",
        ielts,
        otherOffice,
        ticket,
        major: major.trim(),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
      <h3 className="font-semibold text-slate-800">Add a person</h3>
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
            Phone numbers <span className="text-slate-400">(up to 3)</span>
          </span>
          <div className="space-y-2">
            <input
              value={phone1}
              inputMode="tel"
              onChange={(e) => setPhone1(e.target.value)}
              placeholder="Phone 1"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <input
              value={phone2}
              inputMode="tel"
              onChange={(e) => setPhone2(e.target.value)}
              placeholder="Phone 2 (optional)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <input
              value={phone3}
              inputMode="tel"
              onChange={(e) => setPhone3(e.target.value)}
              placeholder="Phone 3 (optional)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            Accepted in (country)
          </span>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="e.g. UK, USA, Australia…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            Major (accepted in)
          </span>
          <input
            value={major}
            onChange={(e) => setMajor(e.target.value)}
            placeholder="e.g. Business, Engineering…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </label>
      </div>

      <label className="block max-w-xs">
        <span className="mb-1 block text-sm font-medium text-slate-600">
          Ticket # <span className="text-slate-400">(numbers only)</span>
        </span>
        <input
          value={ticket}
          inputMode="numeric"
          onChange={(e) => setTicket(e.target.value.replace(/\D/g, ""))}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={applied}
          onChange={(e) => setApplied(e.target.checked)}
          className="h-5 w-5"
        />
        Applied with us (MASAR)
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={ielts}
          onChange={(e) => setIelts(e.target.checked)}
          className="h-5 w-5"
        />
        Has IELTS
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700" dir="rtl">
        <input
          type="checkbox"
          checked={otherOffice}
          onChange={(e) => setOtherOffice(e.target.checked)}
          className="h-5 w-5"
        />
        مقدم مع مكتب ثاني ؟
      </label>

      {applied && (
        <label className="block max-w-xs">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            MASAR employee (who helped)
          </span>
          <input
            value={masarEmployee}
            onChange={(e) => setMasarEmployee(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </label>
      )}

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
          {busy ? "Adding…" : "Add person"}
        </button>
      </div>
    </div>
  );
}
