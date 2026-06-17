"use client";

import { createContext, useContext, useState } from "react";
import type { Role } from "@/lib/nav";
import { staff, type Staff } from "@/lib/staff";

type RoleContextValue = {
  user: Staff; // the person currently being viewed as
  role: Role; // convenience: user.role
  setUserId: (id: string) => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);

// Temporary session provider for previewing before real login exists.
// Once auth is added, `user` will come from the logged-in account instead.
export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState("admin");
  const user = staff.find((s) => s.id === userId) ?? staff[0];

  return (
    <RoleContext.Provider value={{ user, role: user.role, setUserId }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return ctx;
}
