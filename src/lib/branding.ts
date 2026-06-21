"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "masar.logo";

// One global logo (stored as a data URL) shared by everyone. External store
// so it updates live everywhere. Later this moves to Firebase Storage.
let state: string | null | undefined = undefined;
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
  if (state === undefined) state = read();
  return state;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function setState(value: string | null) {
  state = value;
  if (typeof window !== "undefined") {
    if (value) localStorage.setItem(STORAGE_KEY, value);
    else localStorage.removeItem(STORAGE_KEY);
  }
  listeners.forEach((l) => l());
}

export function useLogo() {
  const logo = useSyncExternalStore(subscribe, getSnapshot, () => null);
  return {
    logo,
    setLogo: (value: string) => setState(value),
    clearLogo: () => setState(null),
  };
}
