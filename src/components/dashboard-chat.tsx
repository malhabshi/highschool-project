"use client";

import { useRole } from "@/components/role-context";
import { Chat } from "@/components/chat";

// Employee dashboard chat box — talks to the admin. Hidden for admins
// (they use the Messages page instead).
export function DashboardChat() {
  const { user, role } = useRole();
  if (role !== "employee") return null;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-slate-800">Chat with admin</h3>
      <Chat employeeId={user.id} />
    </div>
  );
}
