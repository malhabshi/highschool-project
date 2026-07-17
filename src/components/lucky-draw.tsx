"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRole } from "@/components/role-context";
import { useAttendees, type Attendee } from "@/lib/meeting";
import { useDrawSettings } from "@/lib/draw-settings";
import { supabase } from "@/lib/supabase";

// Admin-only prize draw. Picks a random winner from the Annual Meeting
// "Meeting attendees" list, using the filters saved on the Settings page.
export function LuckyDraw() {
  const { user } = useRole();
  const { attendees, loaded } = useAttendees({ id: user.id, name: user.name });
  const { settings } = useDrawSettings();

  // Winners drawn so far this session (newest first).
  const [winners, setWinners] = useState<Attendee[]>([]);
  const wonIds = useMemo(() => new Set(winners.map((w) => w.id)), [winners]);

  // Animation state.
  const [rolling, setRolling] = useState(false);
  const [display, setDisplay] = useState<Attendee | null>(null);
  const [winner, setWinner] = useState<Attendee | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Full-screen presentation mode (for the big screen).
  const [presenting, setPresenting] = useState(false);

  async function enterFullscreen() {
    setPresenting(true);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // Native fullscreen may be blocked; the overlay still covers the screen.
    }
  }

  async function exitFullscreen() {
    setPresenting(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen?.();
    } catch {
      // ignore
    }
  }

  // Keep our state in sync if the user leaves fullscreen with Esc.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Everyone eligible for the *next* draw (based on the saved settings).
  const pool = useMemo(() => {
    const include = new Set(settings.countries);
    const exclude = new Set(settings.excludedMajors);
    return attendees.filter((a) => {
      if (settings.onlyAttended && !a.attended) return false;
      if (settings.noRepeat && wonIds.has(a.id)) return false;
      if (settings.applied === "masar" && a.applied !== "MASAR") return false;
      if (settings.applied === "no" && a.applied === "MASAR") return false;
      if (include.size > 0 && !include.has((a.country || "").trim().toLowerCase()))
        return false;
      if (exclude.has((a.major || "").trim().toLowerCase())) return false;
      return true;
    });
  }, [attendees, settings, wonIds]);

  // Clean up any running timers on unmount.
  useEffect(() => {
    return () => timers.current.forEach(clearTimeout);
  }, []);

  function draw() {
    if (rolling || pool.length === 0) return;
    setWinner(null);
    setRolling(true);
    timers.current.forEach(clearTimeout);
    timers.current = [];

    // The winner is chosen only from the filtered pool...
    const finalPick = pool[Math.floor(Math.random() * pool.length)];
    // ...but during the ~5s shuffle we flash EVERY attendee's name (ignoring
    // the filters), slowing down toward the end.
    const shuffleNames = attendees.length ? attendees : pool;
    let elapsed = 0;
    const total = 5000;
    // Flash names very fast, easing out only slightly near the very end.
    const interval = () => 28 + Math.floor(elapsed / 1400) * 22;
    const tick = () => {
      setDisplay(shuffleNames[Math.floor(Math.random() * shuffleNames.length)]);
      elapsed += interval();
      if (elapsed < total) {
        timers.current.push(setTimeout(tick, interval()));
      } else {
        setDisplay(finalPick);
        setWinner(finalPick);
        setRolling(false);
        setWinners((prev) => [finalPick, ...prev]);
        // Record in the activity log so it shows in the admin report.
        supabase
          .from("activity_log")
          .insert({
            user_id: user.id,
            user_name: user.name,
            action: "Draw winner",
            detail: `${finalPick.name || "—"}${
              finalPick.ticket ? ` · 🎟️ ${finalPick.ticket}` : ""
            }`,
          })
          .then(() => {});
      }
    };
    tick();
  }

  function reset() {
    setWinners([]);
    setWinner(null);
    setDisplay(null);
  }

  return (
    <>
    <div className="space-y-6">
      {/* Stage */}
      <div className="relative flex min-h-[16rem] flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-center text-white shadow-sm">
        {pool.length === 0 && !rolling ? (
          <p className="text-lg text-blue-50">
            {loaded
              ? "No eligible people to draw. Import attendees in the Annual Meeting page (or adjust the filters in Settings)."
              : "Loading attendees…"}
          </p>
        ) : (
          <>
            <p className="text-sm uppercase tracking-widest text-blue-200">
              {rolling ? "Drawing…" : winner ? "🎉 Winner 🎉" : "Ready to draw"}
            </p>
            <div
              className={`text-3xl font-extrabold sm:text-5xl ${
                rolling ? "opacity-80 blur-[1px]" : ""
              } ${winner ? "animate-pulse" : ""}`}
              dir="auto"
            >
              {display ? display.name || "—" : "🎲"}
            </div>
            {winner && !rolling && (
              <div className="text-blue-50">
                <div className="text-xl font-semibold" dir="ltr">
                  🎟️ Ticket #{winner.ticket || "—"}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={draw}
          disabled={rolling || pool.length === 0}
          className="rounded-xl bg-blue-600 px-8 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {rolling ? "Drawing…" : winner ? "🎲 Draw again" : "🎲 Draw a winner"}
        </button>
        <button
          onClick={enterFullscreen}
          className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          ⛶ Full screen
        </button>
        {winners.length > 0 && (
          <button
            onClick={reset}
            disabled={rolling}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Clear winners
          </button>
        )}
      </div>

      {/* Winners list */}
      {winners.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">
              Winners ({winners.length})
            </h3>
          </div>
          <ol className="divide-y divide-slate-100">
            {winners.map((w, i) => (
              <li
                key={w.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                  {winners.length - i}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800" dir="auto">
                  {w.name || "—"}
                </span>
                <span className="shrink-0 font-medium text-blue-600" dir="ltr">
                  🎟️ {w.ticket || "—"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>

    {/* Full-screen presentation overlay */}
    {presenting && (
      <div className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold text-blue-100">
            🎲 Lucky Draw · {pool.length} in the draw
          </span>
          <button
            onClick={exitFullscreen}
            className="rounded-lg bg-white/15 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/25"
          >
            ✕ Exit full screen
          </button>
        </div>

        {/* Center stage */}
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          {pool.length === 0 && !rolling ? (
            <p className="text-2xl text-blue-50">
              No eligible people to draw. Adjust the filters in Settings.
            </p>
          ) : (
            <>
              <p className="mb-6 text-xl uppercase tracking-[0.3em] text-blue-200 sm:text-2xl">
                {rolling ? "Drawing…" : winner ? "🎉 Winner 🎉" : "Ready to draw"}
              </p>
              <div
                className={`px-4 text-6xl font-extrabold leading-tight sm:text-8xl ${
                  rolling ? "opacity-80 blur-[2px]" : ""
                } ${winner ? "animate-pulse" : ""}`}
                dir="auto"
              >
                {display ? display.name || "—" : "🎲"}
              </div>
              {winner && !rolling && (
                <div className="mt-8 text-4xl font-semibold text-blue-50 sm:text-5xl" dir="ltr">
                  🎟️ Ticket #{winner.ticket || "—"}
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom controls */}
        <div className="flex items-center justify-center gap-4 px-6 py-8">
          <button
            onClick={draw}
            disabled={rolling || pool.length === 0}
            className="rounded-2xl bg-white px-12 py-5 text-2xl font-bold text-blue-700 shadow-lg transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          >
            {rolling ? "Drawing…" : winner ? "🎲 Draw again" : "🎲 Draw a winner"}
          </button>
          {winners.length > 0 && (
            <button
              onClick={reset}
              disabled={rolling}
              className="rounded-2xl border border-white/40 px-6 py-5 text-lg font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              Clear ({winners.length})
            </button>
          )}
        </div>
      </div>
    )}
    </>
  );
}
