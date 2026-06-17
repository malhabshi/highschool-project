"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/lib/nav";
import { useUsers, type User } from "@/lib/users";
import { useSession } from "@/lib/auth";

type RoleContextValue = {
  user: User; // the logged-in account
  role: Role; // convenience: user.role
};

const RoleContext = createContext<RoleContextValue | null>(null);

// Provides the logged-in user to the app. Wrapped by AuthGuard, so by the
// time this renders there is always a valid session.
export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { users } = useUsers();
  const { userId } = useSession();
  const user = users.find((u) => u.id === userId) ?? users[0];

  return (
    <RoleContext.Provider value={{ user, role: user.role }}>
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
