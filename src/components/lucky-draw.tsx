"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRole } from "@/components/role-context";
import { useAttendees, type Attendee } from "@/lib/meeting";
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

// Admin-only prize draw. Picks a chosen number of winners — some WITH MASAR and
// some NOT — from the Annual Meeting attendees, using the saved Settings filters.
export function LuckyDraw() {
  const { user } = useRole();
  const { attendees, loaded } = useAttendees({ id: user.id, name: user.name });
  const { settings } = useDrawSettings();

  // How many to pick from each group.
  const [masarCount, setMasarCount] = useState(1);
  const [nonMasarCount, setNonMasarCount] = useState(1);

  // Winners drawn so far this session (for no-repeat + history), newest first.
  const [winners, setWinners] = useState<Attendee[]>([]);
  const wonIds = useMemo(() => new Set(winners.map((w) => w.id)), [winners]);
  // The most recent draw's winners (what we reveal big on stage).
  const [batch, setBatch] = useState<Attendee[]>([]);

  // Animation state.
  const [rolling, setRolling] = useState(false);
  const [display, setDisplay] = useState<Attendee | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Full-screen presentation mode (for the big screen).
  const [presenting, setPresenting] = useState(false);

  // Everyone eligible (based on the saved settings), then split by MASAR.
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

  const masarPool = useMemo(() => pool.filter((a) => a.applied === "MASAR"), [pool]);
  const nonMasarPool = useMemo(
    () => pool.filter((a) => a.applied !== "MASAR"),
    [pool]
  );

  // How many we'll actually draw (clamped to what's available).
  const drawMasar = Math.min(masarCount, masarPool.length);
  const drawNon = Math.min(nonMasarCount, nonMasarPool.length);
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
    if (rolling || totalToDraw === 0) return;
    setBatch([]);
    setRolling(true);
    timers.current.forEach(clearTimeout);
    timers.current = [];

    // Winners come only from the filtered pools (MASAR + non-MASAR)...
    const finalBatch = [
      ...sample(masarPool, drawMasar),
      ...sample(nonMasarPool, drawNon),
    ];
    // ...but during the ~5s shuffle we flash EVERY attendee's name.
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
        // Record each winner in the activity log for the admin report.
        for (const w of finalBatch) {
          supabase
            .from("activity_log")
            .insert({
              user_id: user.id,
              user_name: user.name,
              action: "Draw winner",
              detail: `${w.name || "—"}${w.ticket ? ` · 🎟️ ${w.ticket}` : ""} · ${
                w.applied === "MASAR" ? "MASAR" : "non-MASAR"
              }`,
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
    setDisplay(null);
  }

  // The count inputs (shared between normal + fullscreen).
  const countControls = (compact = false) => (
    <div className={`flex flex-wrap items-end gap-4 ${compact ? "" : ""}`}>
      <label className="flex flex-col gap-1">
        <span
          className={compact ? "text-sm text-blue-100" : "text-xs font-medium text-slate-500"}
        >
          With MASAR ({masarPool.length} avail.)
        </span>
        <input
          type="number"
          min={0}
          value={masarCount}
          onChange={(e) =>
            setMasarCount(Math.max(0, parseInt(e.target.value || "0", 10) || 0))
          }
          className={`w-24 rounded-lg border px-3 py-2 text-center text-lg font-semibold outline-none ${
            compact
              ? "border-white/30 bg-white/10 text-white"
              : "border-slate-300 text-slate-800 focus:border-blue-500"
          }`}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span
          className={compact ? "text-sm text-blue-100" : "text-xs font-medium text-slate-500"}
        >
          Not with MASAR ({nonMasarPool.length} avail.)
        </span>
        <input
          type="number"
          min={0}
          value={nonMasarCount}
          onChange={(e) =>
            setNonMasarCount(Math.max(0, parseInt(e.target.value || "0", 10) || 0))
          }
          className={`w-24 rounded-lg border px-3 py-2 text-center text-lg font-semibold outline-none ${
            compact
              ? "border-white/30 bg-white/10 text-white"
              : "border-slate-300 text-slate-800 focus:border-blue-500"
          }`}
        />
      </label>
    </div>
  );

  // A big grid of the winners just drawn (names shown large).
  const batchNames = (big: boolean) => (
    <div className="flex flex-wrap items-stretch justify-center gap-3">
      {batch.map((w) => (
        <div
          key={w.id}
          className={`rounded-2xl px-5 py-3 ${
            w.applied === "MASAR"
              ? "bg-white/20 ring-2 ring-emerald-300"
              : "bg-white/20 ring-2 ring-amber-300"
          }`}
        >
          <div
            className={`font-extrabold leading-tight ${
              big ? "text-3xl sm:text-5xl" : "text-xl sm:text-2xl"
            }`}
            dir="auto"
          >
            {w.name || "—"}
          </div>
          <div
            className={`mt-1 flex items-center justify-center gap-2 ${
              big ? "text-lg" : "text-xs"
            } text-blue-50`}
          >
            <span>🎟️ {w.ticket || "—"}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                w.applied === "MASAR"
                  ? "bg-emerald-400/30 text-emerald-50"
                  : "bg-amber-400/30 text-amber-50"
              }`}
            >
              {w.applied === "MASAR" ? "MASAR" : "non-MASAR"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  const drawLabel = rolling
    ? "Drawing…"
    : batch.length
    ? `🎲 Draw again (${totalToDraw})`
    : `🎲 Draw ${totalToDraw || ""}`.trim();

  return (
    <>
      <div className="space-y-6">
        {/* Count inputs */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm font-medium text-slate-700">
            How many students to draw?
          </p>
          {countControls(false)}
        </div>

        {/* Stage */}
        <div className="relative flex min-h-[16rem] flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-center text-white shadow-sm">
          {pool.length === 0 && !rolling ? (
            <p className="text-lg text-blue-50">
              {loaded
                ? "No eligible people to draw. Import attendees in the Annual Meeting page (or adjust the filters in Settings)."
                : "Loading attendees…"}
            </p>
          ) : rolling ? (
            <>
              <p className="text-sm uppercase tracking-widest text-blue-200">
                Drawing…
              </p>
              <div className="text-3xl font-extrabold opacity-80 blur-[1px] sm:text-5xl" dir="auto">
                {display ? display.name || "—" : "🎲"}
              </div>
            </>
          ) : batch.length ? (
            <>
              <p className="text-sm uppercase tracking-widest text-blue-200">
                🎉 {batch.length} Winner{batch.length > 1 ? "s" : ""} 🎉
              </p>
              {batchNames(false)}
            </>
          ) : (
            <>
              <p className="text-sm uppercase tracking-widest text-blue-200">
                Ready to draw
              </p>
              <div className="text-5xl">🎲</div>
            </>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={draw}
            disabled={rolling || totalToDraw === 0}
            className="rounded-xl bg-blue-600 px-8 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {drawLabel}
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

        {/* Winners history */}
        {winners.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">
                All winners ({winners.length})
              </h3>
            </div>
            <ol className="divide-y divide-slate-100">
              {winners.map((w, i) => (
                <li key={`${w.id}-${i}`} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                    {winners.length - i}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800" dir="auto">
                    {w.name || "—"}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      w.applied === "MASAR"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {w.applied === "MASAR" ? "MASAR" : "non-MASAR"}
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
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <span className="text-lg font-semibold text-blue-100">
              🎲 Lucky Draw · MASAR {masarPool.length} · non-MASAR{" "}
              {nonMasarPool.length}
            </span>
            {countControls(true)}
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
                Set how many to draw above, then press Draw.
              </p>
            ) : rolling ? (
              <>
                <p className="mb-6 text-xl uppercase tracking-[0.3em] text-blue-200 sm:text-2xl">
                  Drawing…
                </p>
                <div className="px-4 text-6xl font-extrabold leading-tight opacity-80 blur-[2px] sm:text-8xl" dir="auto">
                  {display ? display.name || "—" : "🎲"}
                </div>
              </>
            ) : batch.length ? (
              <>
                <p className="mb-8 text-2xl uppercase tracking-[0.3em] text-blue-200 sm:text-3xl">
                  🎉 {batch.length} Winner{batch.length > 1 ? "s" : ""} 🎉
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
              disabled={rolling || totalToDraw === 0}
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
