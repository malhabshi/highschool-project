"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRole } from "@/components/role-context";
import { useAttendees, useMeetingCountry, type Attendee } from "@/lib/meeting";
import { useDrawSettings } from "@/lib/draw-settings";
import { supabase } from "@/lib/supabase";

// Pick n unique random items from an array.
function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.max(0, n));
}

// Admin-only prize draw. Picks the number of winners configured in Settings
// (some with MASAR, some not) from the Annual Meeting attendees. The MASAR
// split is used internally but never shown.
export function LuckyDraw() {
  const { user } = useRole();
  const { attendees, loaded } = useAttendees({ id: user.id, name: user.name });
  const { settings } = useDrawSettings();
  const { country: lockCountry } = useMeetingCountry();

  // Winners drawn so far this session (for no-repeat + history), newest first.
  const [winners, setWinners] = useState<Attendee[]>([]);
  const wonIds = useMemo(() => new Set(winners.map((w) => w.id)), [winners]);
  // The most recent draw's winners (what we reveal on stage).
  const [batch, setBatch] = useState<Attendee[]>([]);
  // How many of the batch have been revealed (they appear one by one).
  const [revealCount, setRevealCount] = useState(0);

  // Animation state.
  const [rolling, setRolling] = useState(false);
  const [display, setDisplay] = useState<Attendee | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // True while winners are still being revealed one at a time.
  const revealing = batch.length > 0 && revealCount < batch.length;

  // Full-screen presentation mode (for the big screen).
  const [presenting, setPresenting] = useState(false);

  // Everyone eligible (based on the saved settings), then split by MASAR.
  const pool = useMemo(() => {
    const include = new Set(settings.countries);
    const exclude = new Set(settings.excludedMajors);
    const lock = (lockCountry || "").trim().toLowerCase();
    return attendees.filter((a) => {
      if (lock && (a.country || "").trim().toLowerCase() !== lock) return false;
      if (settings.onlyAttended && !a.attended) return false;
      if (settings.noRepeat && wonIds.has(a.id)) return false;
      if (settings.applied === "masar" && a.applied !== "MASAR") return false;
      if (settings.applied === "no" && a.applied === "MASAR") return false;
      if (include.size > 0 && !include.has((a.country || "").trim().toLowerCase()))
        return false;
      if (exclude.has((a.major || "").trim().toLowerCase())) return false;
      return true;
    });
  }, [attendees, settings, wonIds, lockCountry]);

  const masarPool = useMemo(() => pool.filter((a) => a.applied === "MASAR"), [pool]);
  const nonMasarPool = useMemo(
    () => pool.filter((a) => a.applied !== "MASAR"),
    [pool]
  );

  // How many we'll actually draw (clamped to what's available).
  const drawMasar = Math.min(settings.masarCount, masarPool.length);
  const drawNon = Math.min(settings.nonMasarCount, nonMasarPool.length);
  const totalToDraw = drawMasar + drawNon;

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
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    return () => timers.current.forEach(clearTimeout);
  }, []);

  function draw() {
    if (rolling || revealing || totalToDraw === 0) return;
    setBatch([]);
    setRevealCount(0);
    setRolling(true);
    timers.current.forEach(clearTimeout);
    timers.current = [];

    // Winners come from the filtered MASAR + non-MASAR pools, then are shuffled
    // together so the order doesn't reveal who is which.
    const finalBatch = sample(
      [...sample(masarPool, drawMasar), ...sample(nonMasarPool, drawNon)],
      drawMasar + drawNon
    );
    // During the ~5s shuffle we flash EVERY attendee's name.
    const shuffleNames = attendees.length ? attendees : pool;
    let elapsed = 0;
    const total = 5000;
    const interval = () => 28 + Math.floor(elapsed / 1400) * 22;
    const tick = () => {
      setDisplay(shuffleNames[Math.floor(Math.random() * shuffleNames.length)]);
      elapsed += interval();
      if (elapsed < total) {
        timers.current.push(setTimeout(tick, interval()));
      } else {
        setBatch(finalBatch);
        setRolling(false);
        setWinners((prev) => [...finalBatch, ...prev]);
        // Reveal the winners one at a time.
        setRevealCount(1); // reveal the first straight away
        for (let k = 2; k <= finalBatch.length; k++) {
          timers.current.push(setTimeout(() => setRevealCount(k), (k - 1) * 1500));
        }
        // Record each winner in the activity log for the admin report.
        for (const w of finalBatch) {
          supabase
            .from("activity_log")
            .insert({
              user_id: user.id,
              user_name: user.name,
              action: "Draw winner",
              detail: `${w.name || "—"}${w.ticket ? ` · 🎟️ ${w.ticket}` : ""}`,
            })
            .then(() => {});
        }
      }
    };
    tick();
  }

  function reset() {
    setWinners([]);
    setBatch([]);
    setRevealCount(0);
    setDisplay(null);
  }

  // The winners revealed so far (one by one). Newest one is emphasized.
  const batchNames = (big: boolean) => {
    const shown = batch.slice(0, revealCount);
    return (
      <div className="flex flex-wrap items-stretch justify-center gap-2.5">
        {shown.map((w, i) => {
          const isNewest = i === shown.length - 1;
          return (
            <div
              key={w.id}
              className={`flex items-center gap-2.5 rounded-xl bg-white/15 px-4 py-2 ring-1 backdrop-blur-sm transition-all ${
                isNewest
                  ? "scale-105 bg-white/25 ring-2 ring-white"
                  : "ring-white/25"
              }`}
            >
              <span
                className={`flex shrink-0 items-center justify-center rounded-full bg-white/25 font-bold ${
                  big ? "h-8 w-8 text-base" : "h-6 w-6 text-xs"
                }`}
              >
                {i + 1}
              </span>
              <div className="text-left">
                <div
                  className={`font-bold leading-tight ${
                    big ? "text-xl sm:text-3xl" : "text-base sm:text-lg"
                  }`}
                  dir="auto"
                >
                  {w.name || "—"}
                </div>
                <div
                  className={`text-blue-100 ${big ? "text-sm" : "text-[11px]"}`}
                  dir="ltr"
                >
                  🎟️ {w.ticket || "—"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const drawLabel = rolling
    ? "Drawing…"
    : revealing
    ? "Revealing…"
    : batch.length
    ? "🎲 Draw again"
    : "🎲 Draw";

  return (
    <>
      <div className="mx-auto max-w-3xl space-y-5">
        {/* Stage */}
        <div className="relative flex min-h-[18rem] flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 p-8 text-center text-white shadow-lg">
          {/* soft glow */}
          <div className="pointer-events-none absolute -top-16 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-white/15 blur-3xl" />
          <div className="relative z-10 flex w-full flex-col items-center gap-4">
            {pool.length === 0 && !rolling ? (
              <p className="max-w-md text-base text-blue-50">
                {loaded
                  ? "No eligible people to draw. Import attendees in the Annual Meeting page (or adjust the filters in Settings)."
                  : "Loading attendees…"}
              </p>
            ) : rolling ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-200">
                  Drawing…
                </p>
                <div className="text-2xl font-extrabold opacity-80 blur-[1px] sm:text-4xl" dir="auto">
                  {display ? display.name || "—" : "🎲"}
                </div>
              </>
            ) : batch.length ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-200">
                  🎉 Winner{batch.length > 1 ? "s" : ""} {revealCount}/{batch.length} 🎉
                </p>
                {batchNames(false)}
              </>
            ) : (
              <>
                <div className="text-6xl drop-shadow-lg">🎲</div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-200">
                  {totalToDraw > 0
                    ? `Ready — will draw ${totalToDraw} winner${
                        totalToDraw > 1 ? "s" : ""
                      }`
                    : "Set how many to draw in Settings"}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={draw}
            disabled={rolling || revealing || totalToDraw === 0}
            className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-3.5 text-base font-bold text-white shadow-md transition-all hover:shadow-lg hover:brightness-110 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none sm:flex-none"
          >
            {drawLabel}
          </button>
          <button
            onClick={enterFullscreen}
            className="rounded-2xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            ⛶ Full screen
          </button>
          {winners.length > 0 && (
            <button
              onClick={reset}
              disabled={rolling || revealing}
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>

        {/* Winners history */}
        {winners.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">
                All winners
              </h3>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                {winners.length}
              </span>
            </div>
            <ol className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {winners.map((w, i) => (
                <li key={`${w.id}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
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
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <span className="text-lg font-semibold text-blue-100">🎲 Lucky Draw</span>
            <button
              onClick={exitFullscreen}
              className="rounded-lg bg-white/15 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/25"
            >
              ✕ Exit full screen
            </button>
          </div>

          {/* Center stage */}
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            {totalToDraw === 0 && !rolling && batch.length === 0 ? (
              <p className="text-2xl text-blue-50">
                Set how many to draw in Settings, then press Draw.
              </p>
            ) : rolling ? (
              <>
                <p className="mb-6 text-xl uppercase tracking-[0.3em] text-blue-200 sm:text-2xl">
                  Drawing…
                </p>
                <div className="px-4 text-4xl font-extrabold leading-tight opacity-80 blur-[2px] sm:text-6xl" dir="auto">
                  {display ? display.name || "—" : "🎲"}
                </div>
              </>
            ) : batch.length ? (
              <>
                <p className="mb-8 text-2xl uppercase tracking-[0.3em] text-blue-200 sm:text-3xl">
                  🎉 Winner{batch.length > 1 ? "s" : ""} {revealCount}/{batch.length} 🎉
                </p>
                {batchNames(true)}
              </>
            ) : (
              <div className="text-8xl">🎲</div>
            )}
          </div>

          {/* Bottom controls */}
          <div className="flex items-center justify-center gap-4 px-6 py-8">
            <button
              onClick={draw}
              disabled={rolling || revealing || totalToDraw === 0}
              className="rounded-2xl bg-white px-12 py-5 text-2xl font-bold text-blue-700 shadow-lg transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            >
              {drawLabel}
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
