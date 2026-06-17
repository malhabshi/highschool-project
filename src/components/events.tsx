"use client";

import { useState } from "react";
import { useEvents, kuwaitTodayStr } from "@/lib/events";
import { useRole } from "@/components/role-context";

// "in 3 days", "Today", "Tomorrow", etc. (relative to Kuwait today)
function countdown(date: string) {
  const today = new Date(kuwaitTodayStr());
  const target = new Date(date);
  const days = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}

export function Events() {
  const { events, add, remove, loaded } = useEvents();
  const { role } = useRole();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");

  const isAdmin = role === "admin";

  // Show only upcoming events (today or later), soonest first.
  const upcoming = events
    .filter((e) => e.date >= kuwaitTodayStr())
    .sort((a, b) => a.date.localeCompare(b.date));

  function handleAdd() {
    add(title, date);
    setTitle("");
    setDate("");
  }

  return (
    <div className="space-y-4">
      {/* Admin-only add-event box */}
      {isAdmin && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800">Add an upcoming event</h3>
          <p className="mb-3 text-sm text-slate-500">
            This will show on the dashboard for all users.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event name (e.g. Team meeting)"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
            />
            <input
              type="date"
              value={date}
              min={kuwaitTodayStr()}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
            />
            <button
              onClick={handleAdd}
              disabled={!title.trim() || !date}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Add event
            </button>
          </div>
        </div>
      )}

      {/* Upcoming events list (visible to everyone) */}
      {loaded && upcoming.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-800">Upcoming events</h3>
          <div className="space-y-2">
            {upcoming.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3"
              >
                <span className="text-lg">📅</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{e.title}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(e.date).toLocaleDateString(undefined, {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <span className="rounded-full bg-amber-200 px-2 py-1 text-xs font-medium text-amber-800">
                  {countdown(e.date)}
                </span>
                {isAdmin && (
                  <button
                    onClick={() => {
                      if (confirm("Delete this event?")) remove(e.id);
                    }}
                    className="flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-600 hover:text-white"
                    aria-label="Delete event"
                  >
                    🗑
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
