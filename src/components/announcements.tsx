"use client";

import { useState } from "react";
import { useAnnouncements } from "@/lib/announcements";
import { useRole } from "@/components/role-context";

export function Announcements() {
  const { announcements, add, remove, loaded } = useAnnouncements();
  const { role } = useRole();
  const [draft, setDraft] = useState("");

  const isAdmin = role === "admin";

  function handlePost() {
    add(draft);
    setDraft("");
  }

  return (
    <div className="space-y-4">
      {/* Admin-only compose box */}
      {isAdmin && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800">Send an announcement</h3>
          <p className="mb-3 text-sm text-slate-500">
            This will show on the dashboard for all users.
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write your announcement..."
            rows={3}
            className="w-full resize-none rounded-lg border border-slate-300 p-3 text-sm text-slate-800 outline-none focus:border-blue-500"
          />
          <div className="mt-3 flex justify-end">
            <button
              onClick={handlePost}
              disabled={!draft.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Post announcement
            </button>
          </div>
        </div>
      )}

      {/* Announcement list (visible to everyone) */}
      {loaded && announcements.length > 0 && (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4"
            >
              <span className="text-lg">📢</span>
              <div className="flex-1">
                <p className="whitespace-pre-wrap text-sm text-slate-800">
                  {a.text}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(a.createdAt).toLocaleString()}
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => {
                    if (confirm("Delete this announcement?")) remove(a.id);
                  }}
                  className="flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-600 hover:text-white"
                  aria-label="Delete announcement"
                >
                  🗑 Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
