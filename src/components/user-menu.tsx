"use client";

import { useRouter } from "next/navigation";
import { useRole } from "@/components/role-context";
import { logout } from "@/lib/auth";

export function UserMenu() {
  const { user } = useRole();
  const router = useRouter();

  return (
    <div className="flex items-center gap-3">
      <div className="text-right leading-tight">
        <p className="text-sm font-medium text-slate-800">{user.name}</p>
        <p className="text-xs text-slate-500">
          {user.role === "admin" ? "Admin" : "Employee"}
        </p>
      </div>
      <button
        onClick={() => {
          logout();
          router.replace("/login");
        }}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
      >
        Log out
      </button>
    </div>
  );
}
