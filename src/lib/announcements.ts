"use client";

import { useCallback, useEffect, useState } from "react";

export type Announcement = {
  id: string;
  text: string;
  createdAt: number;
};

const STORAGE_KEY = "masar.announcements";

// Temporary local store (browser localStorage). Later this will be replaced
// by Firebase Firestore so announcements are shared across all real users.
export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setAnnouncements(JSON.parse(raw));
    } catch {
      // ignore malformed data
    }
    setLoaded(true);
  }, []);

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setAnnouncements(e.newValue ? JSON.parse(e.newValue) : []);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setAnnouncements((prev) => {
      const next: Announcement[] = [
        { id: crypto.randomUUID(), text: trimmed, createdAt: Date.now() },
        ...prev,
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setAnnouncements((prev) => {
      const next = prev.filter((a) => a.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { announcements, add, remove, loaded };
}
