"use client";

import { useCallback, useEffect, useState } from "react";

// Saved filter settings for the Lucky Draw. Persisted in localStorage so they
// stay put between visits (they never reset on their own).
export type DrawSettings = {
  onlyAttended: boolean;
  noRepeat: boolean;
  countries: string[]; // lowercased country keys to include (empty = all)
  excludedMajors: string[]; // lowercased major keys to exclude
};

const KEY = "drawSettings";
const CHANGED_EVENT = "draw-settings-changed";

export const DRAW_DEFAULTS: DrawSettings = {
  onlyAttended: false,
  noRepeat: true,
  countries: [],
  excludedMajors: [],
};

function load(): DrawSettings {
  if (typeof window === "undefined") return DRAW_DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DRAW_DEFAULTS;
    const p = JSON.parse(raw);
    return {
      onlyAttended: !!p.onlyAttended,
      noRepeat: p.noRepeat !== false, // default true
      countries: Array.isArray(p.countries) ? p.countries : [],
      excludedMajors: Array.isArray(p.excludedMajors) ? p.excludedMajors : [],
    };
  } catch {
    return DRAW_DEFAULTS;
  }
}

export function useDrawSettings() {
  const [settings, setSettings] = useState<DrawSettings>(DRAW_DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSettings(load());
    setLoaded(true);
    // Stay in sync if settings change elsewhere (other tab or the Draw page).
    const onChange = () => setSettings(load());
    window.addEventListener("storage", onChange);
    window.addEventListener(CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(CHANGED_EVENT, onChange);
    };
  }, []);

  const save = useCallback((next: DrawSettings) => {
    setSettings(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(CHANGED_EVENT));
    }
  }, []);

  return { settings, save, loaded };
}
