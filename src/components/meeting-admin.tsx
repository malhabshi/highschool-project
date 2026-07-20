"use client";

import { useMemo, useState } from "react";
import {
  useAttendees,
  useMeetingArchives,
  useMeetingCountry,
} from "@/lib/meeting";
import { useRole } from "@/components/role-context";

// Admin controls for the Annual Meeting: lock to one country + saved archives.
export function MeetingAdmin() {
  const { user } = useRole();
  const { attendees } = useAttendees({ id: user.id, name: user.name });
  const { country, setCountry } = useMeetingCountry();
  const { archives, saveSnapshot, remove, fetchAttendees } =
    useMeetingArchives();

  const [custom, setCustom] = useState("");

  // Distinct countries currently in the live list, for quick-lock buttons.
  const countries = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of attendees) {
      const c = (a.country || "").trim();
      if (c) m.set(c.toLowerCase(), c);
    }
    return [...m.values()].sort((x, y) => x.localeCompare(y));
  }, [attendees]);

  async function downloadArchive(id: string, label: string) {
    const rows = await fetchAttendees(id);
    const cell = (v: unknown) => {
      const s = (v ?? "").toString();
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const yn = (b: unknown) => (b ? "yes" : "no");
    const header = [
      "Ticket",
      "Name",
      "Phone",
      "Accepted in",
      "Major",
      "Applied with us",
      "MASAR Employee",
      "حضر؟",
      "IELTS",
      "مقدم مع مكتب ثاني؟",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      const applied = r.applied === "MASAR" ? "MASAR" : "no";
      lines.push(
        [
          r.ticket,
          r.name,
          r.phone,
          r.country,
          r.major,
          applied,
          applied === "MASAR" ? r.masar_employee : "",
          yn(r.attended),
          yn(r.ielts),
          yn(r.other_office),
        ]
          .map(cell)
          .join(",")
      );
    }
    const blob = new Blob(["﻿" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${label.replace(/[^\w\-]+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Country lock */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-800">
          Lock meeting to one country
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          When set, the Meeting attendees table and the Lucky Draw only use this
          country. Leave empty to allow all countries.
        </p>
        {country ? (
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-blue-600 px-3 py-1 text-sm font-semibold text-white">
              🔒 {country}
            </span>
            <button
              onClick={() => setCountry(null)}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Unlock (all countries)
            </button>
          </div>
        ) : (
          <p className="mb-3 text-sm text-slate-500">
            Not locked — all countries allowed.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {countries.map((c) => (
            <button
              key={c}
              onClick={() => setCountry(c)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                country?.toLowerCase() === c.toLowerCase()
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
              }`}
            >
              {c}
            </button>
          ))}
          <div className="flex items-center gap-1">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Type a country…"
              className="w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
            />
            <button
              onClick={() => {
                if (custom.trim()) {
                  setCountry(custom.trim());
                  setCustom("");
                }
              }}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Lock
            </button>
          </div>
        </div>
      </div>

      {/* Saved archives */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">
          Saved meetings (archives)
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          Past meetings you saved before resetting. Download any as an Excel/CSV
          file.
        </p>
        {archives.length === 0 ? (
          <p className="text-sm text-slate-400">No saved meetings yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {archives.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-3 py-2.5 text-sm"
              >
                <span className="font-medium text-slate-800">{a.label}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {a.count} people
                </span>
                <span className="text-xs text-slate-400">
                  {a.createdAt ? new Date(a.createdAt).toLocaleString() : ""}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => downloadArchive(a.id, a.label)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    ⬇ Download
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete the saved meeting "${a.label}"?`))
                        remove(a.id);
                    }}
                    className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
