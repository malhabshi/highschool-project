"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/components/role-context";
import { supabase } from "@/lib/supabase";
import { MeetingTable } from "@/components/meeting-table";

async function authHeader() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token ?? ""}` };
}

export function AnnualMeeting() {
  const { role } = useRole();
  const isAdmin = role === "admin";
  const [unlocked, setUnlocked] = useState(isAdmin); // admins never gated
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Employees: restore a previous unlock, or check whether a password is set.
  useEffect(() => {
    if (isAdmin) return;
    if (sessionStorage.getItem("annualMeetingUnlocked") === "1") {
      setUnlocked(true);
      return;
    }
    (async () => {
      const res = await fetch("/api/annual-meeting", {
        headers: { ...(await authHeader()) },
      });
      const d = await res.json().catch(() => ({}));
      setConfigured(!!d.configured);
    })();
  }, [isAdmin]);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/annual-meeting", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ password: pw }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (d.ok) {
      sessionStorage.setItem("annualMeetingUnlocked", "1");
      setUnlocked(true);
    } else {
      setError("Incorrect password.");
    }
  }

  // Employee, still locked.
  if (!unlocked) {
    return (
      <div className="mx-auto max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-slate-800">
          🔒 Protected page
        </h2>
        {configured === false ? (
          <p className="text-sm text-slate-500">
            The access password hasn&apos;t been set yet. Please ask an admin.
          </p>
        ) : (
          <form onSubmit={submitPassword} className="space-y-3">
            <p className="text-sm text-slate-500">
              Enter the password to access the Annual Meeting page.
            </p>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy || !pw}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300"
            >
              {busy ? "Checking…" : "Unlock"}
            </button>
          </form>
        )}
      </div>
    );
  }

  // Unlocked (admin, or employee who entered the password).
  return (
    <div className="space-y-6">
      {isAdmin && <AdminPasswordControl />}
      <MeetingTable />
    </div>
  );
}

// Admin control to set / change / clear the employee access password.
function AdminPasswordControl() {
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(clear = false) {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/annual-meeting", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ password: clear ? "" : value }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg(clear ? "Password cleared." : "Password saved.");
      setValue("");
    } else {
      setMsg("Something went wrong.");
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-800">
        Employee access password
      </h3>
      <p className="mb-2 text-xs text-slate-500">
        Employees must enter this to open the Annual Meeting page. You (admin)
        don&apos;t need it.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="New password"
          className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <button
          onClick={() => save(false)}
          disabled={busy || !value}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300"
        >
          Save
        </button>
        <button
          onClick={() => save(true)}
          disabled={busy}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Clear
        </button>
      </div>
      {msg && <p className="mt-2 text-sm text-green-700">{msg}</p>}
    </div>
  );
}
