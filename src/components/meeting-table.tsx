"use client";

import { useState } from "react";
import { useAttendees } from "@/lib/meeting";
import { telHref } from "@/lib/phone";

export function MeetingTable() {
  const { attendees, add, addMany, update, remove, loaded } = useAttendees();
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
        <div className="border-b border-slate-200 px-5 py-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search name or phone…"
            className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
          />
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium">Accepted in</th>
                <th className="px-5 py-3 font-medium">Applied with us</th>
                <th className="px-5 py-3 text-center font-medium" dir="rtl">
                  حضر؟
                </th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-5 py-3 font-medium text-slate-800">
                    {a.name || "—"}
                  </td>
                  <td className="px-5 py-3">
                    {a.phone ? (
                      <a
                        href={telHref(a.phone)}
                        className="text-blue-600 hover:underline"
                      >
                        {a.phone}
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {a.country || "—"}
                  </td>
                  <td className="px-5 py-3">
                    {a.applied === "MASAR" ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                        MASAR
                      </span>
                    ) : (
                      <span className="text-slate-400">no</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={a.attended}
                      onChange={(e) =>
                        update(a.id, { attended: e.target.checked })
                      }
                      aria-label="حضر؟"
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${a.name || "this person"}?`))
                          remove(a.id);
                      }}
                      className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-600 hover:text-white"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
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
    }[]
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const [result, setResult] = useState("");

  function downloadTemplate() {
    const content =
      "Name,Phone,Country,Applied with us\n" +
      "Example Person,90001234,UK,MASAR\n" +
      "Someone Else,90005678,USA,\n";
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
      }[] = [];
      let skipped = 0;
      for (const r of rows) {
        const name = (r[0] ?? "").trim();
        const phone = (r[1] ?? "").trim();
        const country = (r[2] ?? "").trim();
        // Applied-with-us column: anything filled in => MASAR, blank => no.
        const applied = (r[3] ?? "").trim() ? "MASAR" : "no";
        if (!name && !phone) {
          skipped++;
          continue;
        }
        valid.push({ name, phone, country, applied });
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
        <span className="font-medium">Name, Phone, Country, Applied with us</span>
        ), then upload it. A row needs at least a Name or a Phone. In the{" "}
        <span className="font-medium">Applied with us</span> column, put anything
        (e.g. MASAR) if they applied with us — leave it blank if not.
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
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return setError("Name is required.");
    setBusy(true);
    try {
      await onAdd({
        name: name.trim(),
        phone: phone.trim(),
        country: country.trim(),
        applied: applied ? "MASAR" : "no",
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
            Phone number
          </span>
          <input
            value={phone}
            inputMode="tel"
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
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
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={applied}
          onChange={(e) => setApplied(e.target.checked)}
          className="h-4 w-4"
        />
        Applied with us (MASAR)
      </label>

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
