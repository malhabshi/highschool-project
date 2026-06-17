"use client";

import { useSyncExternalStore } from "react";
import { authenticate } from "@/lib/users";

const STORAGE_KEY = "masar.session";

// Holds the id of the logged-in user (or null). External store so the whole
// app reacts to login/logout instantly. Later replaced by Firebase Auth.
let session: string | null | undefined = undefined;
const listeners = new Set<() => void>();

function read(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function getSnapshot(): string | null {
  if (session === undefined) session = read();
  return session;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function setSession(id: string | null) {
  session = id;
  if (typeof window !== "undefined") {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }
  listeners.forEach((l) => l());
}

// Returns true on success.
export function login(email: string, password: string): boolean {
  const user = authenticate(email, password);
  if (user) {
    setSession(user.id);
    return true;
  }
  return false;
}

export function logout() {
  setSession(null);
}

export function useSession() {
  const userId = useSyncExternalStore(subscribe, getSnapshot, () => null);
  return { userId };
}
