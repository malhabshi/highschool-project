"use client";

import { useState } from "react";
import { useRole } from "@/components/role-context";
import { useUsers } from "@/lib/users";
import { useUnreadCounts } from "@/lib/messages";
import { Chat } from "@/components/chat";

// Admin-only: pick an employee and chat with them.
export function AdminMessages() {
  const { role } = useRole();
  const { users, loaded } = useUsers();
  const { counts } = useUnreadCounts();
  const employees = users.filter((u) => u.role === "employee");
  const [selected, setSelected] = useState<string | null>(null);

  if (role !== "admin") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-red-700 shadow-sm">
        Admins only.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[16rem_1fr]">
      {/* Employee list */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
          Employees
        </div>
        <div className="max-h-[28rem] overflow-y-auto p-2">
          {!loaded ? (
            <p className="px-2 py-4 text-sm text-slate-400">Loading…</p>
          ) : employees.length === 0 ? (
            <p className="px-2 py-4 text-sm text-slate-400">No employees yet.</p>
          ) : (
            employees.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelected(e.id)}
                className={`mb-1 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  selected === e.id
                    ? "bg-blue-600 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="truncate">{e.name || e.email}</span>
                {counts[e.id] > 0 && selected !== e.id && (
                  <span className="ml-auto shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                    {counts[e.id]}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Conversation */}
      <div>
        {selected ? (
          <Chat employeeId={selected} />
        ) : (
          <div className="flex h-[28rem] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-400">
            Pick an employee to start chatting.
          </div>
        )}
      </div>
    </div>
  );
}
