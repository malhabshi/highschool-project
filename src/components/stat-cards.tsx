"use client";

import { useRole } from "@/components/role-context";
import type { Role } from "@/lib/nav";

type Stat = {
  label: string;
  value: string;
  icon: string;
  roles: Role[];
};

const stats: Stat[] = [
  { label: "Total Students", value: "0", icon: "🎓", roles: ["admin", "employee"] },
  { label: "Staff Users", value: "0", icon: "👥", roles: ["admin"] },
];

export function StatCards() {
  const { role } = useRole();
  const visible = stats.filter((s) => s.roles.includes(role));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {visible.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xl">{s.icon}</span>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-800">{s.value}</p>
          <p className="text-sm text-slate-500">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
