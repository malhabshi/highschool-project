"use client";

import { useRole } from "@/components/role-context";
import { useStudents } from "@/lib/students";
import { useUsers } from "@/lib/users";
import type { Role } from "@/lib/nav";

export function StatCards() {
  const { user, role } = useRole();
  const isAdmin = role === "admin";
  const { students } = useStudents();
  const { users } = useUsers();

  // Admin sees everyone; an employee sees only their own students.
  const mine = isAdmin
    ? students
    : students.filter((s) => s.assignedTo === user.id);

  const totalStudents = mine.length;
  const sentToMasar = mine.filter((s) => s.sentToMasarAt).length;
  const staffUsers = users.filter((u) => u.role === "employee").length;

  const stats: { label: string; value: number; icon: string; roles: Role[] }[] =
    [
      {
        label: "Total Students",
        value: totalStudents,
        icon: "🎓",
        roles: ["admin", "employee"],
      },
      {
        label: "Sent to Masar",
        value: sentToMasar,
        icon: "📤",
        roles: ["admin", "employee"],
      },
      { label: "Staff Users", value: staffUsers, icon: "👥", roles: ["admin"] },
    ];

  const visible = stats.filter((s) => s.roles.includes(role));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
