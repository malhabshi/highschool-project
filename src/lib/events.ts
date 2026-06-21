"use client";

import { useCallback, useEffect, useState } from "react";
import { uid } from "@/lib/uid";

export type EventItem = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD (the day the event happens)
  createdAt: number;
};

const STORAGE_KEY = "masar.events";

// Today's date (YYYY-MM-DD) in Kuwait local time, regardless of the
// viewer's own timezone. en-CA formats as YYYY-MM-DD.
export function kuwaitTodayStr() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuwait",
  }).format(new Date());
}

// Keep only events whose day is today or later (in Kuwait time).
function purgePast(list: EventItem[]) {
  const today = kuwaitTodayStr();
  return list.filter((e) => e.date >= today);
}

// Temporary local store (browser localStorage). Later this will be replaced
// by Firebase Firestore so events are shared across all real users.
export function useEvents() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load once on mount and remove any events that have already passed.
  useEffect(() => {
    let current: EventItem[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) current = JSON.parse(raw);
    } catch {
      // ignore malformed data
    }
    const purged = purgePast(current);
    if (purged.length !== current.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(purged));
    }
    setEvents(purged);
    setLoaded(true);
  }, []);

  // Re-check every minute so events vanish right after they pass in Kuwait,
  // even if the app stays open past midnight.
  useEffect(() => {
    const interval = setInterval(() => {
      setEvents((prev) => {
        const purged = purgePast(prev);
        if (purged.length !== prev.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(purged));
          return purged;
        }
        return prev;
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setEvents(e.newValue ? JSON.parse(e.newValue) : []);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((title: string, date: string) => {
    const trimmed = title.trim();
    if (!trimmed || !date) return;
    setEvents((prev) => {
      const next: EventItem[] = [
        { id: uid(), title: trimmed, date, createdAt: Date.now() },
        ...prev,
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setEvents((prev) => {
      const next = prev.filter((e) => e.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { events, add, remove, loaded };
}
