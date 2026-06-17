"use client";

import { useSyncExternalStore } from "react";
import type { Role } from "@/lib/nav";

export type User = {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: Role;
  password: string;
};

export const DEFAULT_USERS: User[] = [
  { id: "admin", name: "Admin", phone: "90000000", email: "admin@masar.com", role: "admin", password: "admin123" },
  { id: "sara", name: "Sara", phone: "90001001", email: "sara@masar.com", role: "employee", password: "sara123" },
  { id: "ahmed", name: "Ahmed", phone: "90001002", email: "ahmed@masar.com", role: "employee", password: "ahmed123" },
  { id: "mariam", name: "Mariam", phone: "90001003", email: "mariam@masar.com", role: "employee", password: "mariam123" },
];

const STORAGE_KEY = "masar.users";

// Small external store so every component (shell, switcher, pages) stays in
// sync live. Later this is replaced by Firebase Auth + Firestore.
let state: User[] | null = null;
const listeners = new Set<() => void>();

function read(): User[] {
  if (typeof window === "undefined") return DEFAULT_USERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return DEFAULT_USERS;
}

function getSnapshot(): User[] {
  if (state === null) {
    state = read();
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }
  return state;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function mutate(next: User[]) {
  state = next;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((l) => l());
}

export function nameOf(users: User[], id: string) {
  return users.find((u) => u.id === id)?.name ?? "Unassigned";
}

// Check email + password against the stored accounts.
export function authenticate(email: string, password: string): User | null {
  const list = getSnapshot();
  const match = list.find(
    (u) =>
      u.email.trim().toLowerCase() === email.trim().toLowerCase() &&
      u.password === password
  );
  return match ?? null;
}

export function useUsers() {
  const users = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_USERS);

  return {
    users,
    addUser: (u: Omit<User, "id">) =>
      mutate([...getSnapshot(), { ...u, id: crypto.randomUUID() }]),
    updateUser: (id: string, patch: Partial<Omit<User, "id">>) =>
      mutate(getSnapshot().map((u) => (u.id === id ? { ...u, ...patch } : u))),
    removeUser: (id: string) =>
      mutate(getSnapshot().filter((u) => u.id !== id)),
  };
}
