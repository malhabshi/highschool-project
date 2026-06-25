"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uid } from "@/lib/uid";
import type { Role } from "@/lib/nav";

export type User = {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: Role;
};

export function nameOf(users: User[], id: string) {
  return users.find((u) => u.id === id)?.name ?? "Unassigned";
}

async function authHeader() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token ?? ""}` };
}

// Cloud-backed: staff accounts live in Supabase (Auth + the profiles table).
export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, phone, email, role")
      .order("name", { ascending: true });
    setUsers((data ?? []) as User[]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel(`profiles-${uid()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  // Create a real login account via the secure admin endpoint (auto-confirmed).
  const addUser = useCallback(
    async (data: {
      name: string;
      phone: string;
      email: string;
      role: Role;
      password: string;
    }) => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Failed to create user");
      }
      await refetch();
    },
    [refetch]
  );

  const updateUser = useCallback(
    async (id: string, patch: Partial<Omit<User, "id">>) => {
      await supabase.from("profiles").update(patch).eq("id", id);
      await refetch();
    },
    [refetch]
  );

  const removeUser = useCallback(
    async (id: string) => {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Failed to delete user");
      }
      await refetch();
    },
    [refetch]
  );

  const resetPassword = useCallback(async (id: string, password: string) => {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ id, password }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || "Failed to reset password");
    }
  }, []);

  return { users, addUser, updateUser, removeUser, resetPassword, loaded };
}
