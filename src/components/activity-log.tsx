"use client";

import { useMemo, useState } from "react";
import { useActivityLog, type LogEntry } from "@/lib/meeting";

function fmtKuwait(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Kuwait",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function toCsv(rows: LogEntry[]) {
  const esc = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
  const header = ["Time (Kuwait)", "User", "Action", "Detail"];
  const lines = rows.map((r) =>
    [fmtKuwait(r.createdAt), r.userName, r.action, r.detail].map(esc).join(",")
  );
  // BOM so Excel reads Arabic/UTF-8 correctly.
  return "﻿" + [header.map(esc).join(","), ...lines].join("\r\n");
}

export function ActivityLog() {
  const { entries, loaded } = useActivityLog();
  const [actionFilter, setActionFilter] = useState("all");

  const actions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.action))).sort(),
    [entries]
  );

  const shown =
    actionFilter === "all"
      ? entries
      : entries.filter((e) => e.action === actionFilter);

  function exportExcel() {
    const blob = new Blob([toCsv(shown)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "annual-meeting-activity.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-800">
          Activity log{" "}
          <span className="text-sm font-normal text-slate-500">
            ({shown.length})
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            Action:
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
            >
              <option value="all">All</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={exportExcel}
            disabled={shown.length === 0}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:bg-slate-300"
          >
            ⬇ Export to Excel
          </button>
        </div>
      </div>

      {!loaded ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          No activity yet.
        </p>
      ) : (
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="px-3 py-3 font-medium sm:px-5">Time</th>
                <th className="px-3 py-3 font-medium sm:px-5">User</th>
                <th className="px-3 py-3 font-medium sm:px-5">Action</th>
                <th className="px-3 py-3 font-medium sm:px-5">Detail</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-3 py-3 text-slate-500 sm:px-5">
                    {fmtKuwait(e.createdAt)}
                  </td>
                  <td className="px-3 py-3 font-medium text-slate-800 sm:px-5">
                    {e.userName || "—"}
                  </td>
                  <td className="px-3 py-3 text-slate-700 sm:px-5">
                    {e.action}
                  </td>
                  <td className="px-3 py-3 text-slate-600 sm:px-5">
                    {e.detail}
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
