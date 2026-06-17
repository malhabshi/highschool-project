"use client";

import { useRole } from "@/components/role-context";
import { staff } from "@/lib/staff";

// Temporary control to preview the app as different people.
// Remove this once real login decides who is signed in.
export function RoleSwitcher() {
  const { user, setUserId } = useRole();

  return (
    <label className="flex items-center gap-2 text-sm text-slate-500">
      Viewing as:
      <select
        value={user.id}
        onChange={(e) => setUserId(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-medium text-slate-700"
      >
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.role === "employee" ? " (Employee)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
