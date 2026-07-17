"use client";

import { useMemo } from "react";
import { useRole } from "@/components/role-context";
import { useAttendees } from "@/lib/meeting";
import { useDrawSettings, type DrawSettings } from "@/lib/draw-settings";

// Configure (and save) the filters used by the Lucky Draw. Changes are stored
// automatically and stay put — they don't reset between visits.
export function DrawSettingsPanel() {
  const { user } = useRole();
  const { attendees, loaded: attLoaded } = useAttendees({
    id: user.id,
    name: user.name,
  });
  const { settings, save, loaded } = useDrawSettings();

  // Distinct countries / majors found in the attendee list.
  const allCountries = useMemo(() => distinct(attendees.map((a) => a.country)), [attendees]);
  const allMajors = useMemo(() => distinct(attendees.map((a) => a.major)), [attendees]);

  // Live preview of how many people match the current settings.
  const matchCount = useMemo(() => {
    const inc = new Set(settings.countries);
    const exc = new Set(settings.excludedMajors);
    return attendees.filter((a) => {
      if (settings.onlyAttended && !a.attended) return false;
      if (inc.size > 0 && !inc.has((a.country || "").trim().toLowerCase()))
        return false;
      if (exc.has((a.major || "").trim().toLowerCase())) return false;
      return true;
    }).length;
  }, [attendees, settings]);

  function patch(p: Partial<DrawSettings>) {
    save({ ...settings, ...p });
  }

  function toggleCountry(c: string) {
    const key = c.toLowerCase();
    const has = settings.countries.includes(key);
    patch({
      countries: has
        ? settings.countries.filter((x) => x !== key)
        : [...settings.countries, key],
    });
  }

  function toggleMajor(m: string) {
    const key = m.toLowerCase();
    const has = settings.excludedMajors.includes(key);
    patch({
      excludedMajors: has
        ? settings.excludedMajors.filter((x) => x !== key)
        : [...settings.excludedMajors, key],
    });
  }

  if (!loaded) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        These filters control who is entered in the{" "}
        <span className="font-semibold">Lucky Draw</span>. They&apos;re saved
        automatically and won&apos;t reset.
        <span className="ml-2 font-semibold">
          {attLoaded ? `${matchCount} people match` : "…"}
        </span>
      </div>

      {/* Basic options */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Options</h2>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={settings.onlyAttended}
              onChange={(e) => patch({ onlyAttended: e.target.checked })}
              className="h-4 w-4"
            />
            Only people who attended (حضر ✓)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={settings.noRepeat}
              onChange={(e) => patch({ noRepeat: e.target.checked })}
              className="h-4 w-4"
            />
            Don&apos;t draw the same person twice
          </label>
        </div>
      </section>

      {/* Countries to include */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-800">
            Accepted country
          </h2>
          <span className="text-xs text-slate-400">
            {settings.countries.length === 0
              ? "(all countries)"
              : `(${settings.countries.length} selected)`}
          </span>
          {settings.countries.length > 0 && (
            <button
              onClick={() => patch({ countries: [] })}
              className="ml-auto text-xs font-medium text-blue-600 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        {allCountries.length === 0 ? (
          <p className="text-xs text-slate-400">
            No countries found in the attendee list yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allCountries.map((c) => {
              const on = settings.countries.includes(c.toLowerCase());
              return (
                <button
                  key={c}
                  onClick={() => toggleCountry(c)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    on
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Majors to exclude */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Exclude majors</h2>
          <span className="text-xs text-slate-400">
            {settings.excludedMajors.length === 0
              ? "(none excluded)"
              : `(${settings.excludedMajors.length} excluded)`}
          </span>
          {settings.excludedMajors.length > 0 && (
            <button
              onClick={() => patch({ excludedMajors: [] })}
              className="ml-auto text-xs font-medium text-blue-600 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        {allMajors.length === 0 ? (
          <p className="text-xs text-slate-400">
            No majors found in the attendee list yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allMajors.map((m) => {
              const off = settings.excludedMajors.includes(m.toLowerCase());
              return (
                <button
                  key={m}
                  onClick={() => toggleMajor(m)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    off
                      ? "bg-red-600 text-white line-through"
                      : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// Distinct, trimmed, non-empty values (case-insensitive), sorted for display.
function distinct(values: string[]): string[] {
  const map = new Map<string, string>();
  for (const v of values) {
    const t = (v || "").trim();
    if (t) map.set(t.toLowerCase(), t);
  }
  return [...map.values()].sort((x, y) => x.localeCompare(y));
}
