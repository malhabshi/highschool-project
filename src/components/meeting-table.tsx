"use client";

import { useState } from "react";
import { useAttendees } from "@/lib/meeting";
import { telHref } from "@/lib/phone";

export function MeetingTable() {
  const { attendees, add, remove, loaded } = useAttendees();
  const [adding, setAdding] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-800">
          Meeting attendees
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{attendees.length} total</span>
          <button
            onClick={() => setAdding(true)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            + Add person
          </button>
        </div>
      </div>

      {adding && (
        <AddAttendeeForm
          onCancel={() => setAdding(false)}
          onAdd={async (data) => {
            await add(data);
            setAdding(false);
          }}
        />
      )}

      {!loaded ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : attendees.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          No one added yet. Click “Add person”.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium">Accepted in</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {attendees.map((a) => (
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

function AddAttendeeForm({
  onAdd,
  onCancel,
}: {
  onAdd: (data: {
    name: string;
    phone: string;
    country: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
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
