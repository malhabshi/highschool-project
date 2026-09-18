"use client";

import { useRef, useState } from "react";
import type { Stroke } from "@/lib/exam-session";

// Freehand working-out pad for tablets and phones.
//
// Strokes are SVG polylines rather than canvas pixels for three reasons: they
// stay sharp when the PDF handout is printed, they scale to any screen size,
// and they serialise to localStorage far smaller than an image would.
//
// Coordinates live in a fixed 1000×600 space, so a drawing started on a phone
// still lines up when the session is reopened on a tablet.
const W = 1000;
const H = 600;

const COLOURS = [
  { name: "أسود", value: "#0f172a" },
  { name: "أزرق", value: "#2563eb" },
  { name: "أحمر", value: "#dc2626" },
];

type Tool = "pen" | "eraser";

export function Scratchpad({
  value,
  onChange,
}: {
  value: Stroke[];
  onChange: (strokes: Stroke[]) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [colour, setColour] = useState(COLOURS[0].value);
  // The in-progress stroke is local state so each move doesn't write to the
  // saved session; it's committed once on pointer up.
  const [live, setLive] = useState<Stroke | null>(null);
  const drawing = useRef(false);

  function toPad(e: React.PointerEvent): [number, number] {
    const rect = svgRef.current!.getBoundingClientRect();
    return [
      ((e.clientX - rect.left) / rect.width) * W,
      ((e.clientY - rect.top) / rect.height) * H,
    ];
  }

  // A stylus reports real pressure; mouse and finger usually report 0 or 0.5,
  // so fall back to a steady width rather than letting the line vanish.
  function widthFor(e: React.PointerEvent) {
    const base = 3;
    if (e.pointerType === "pen" && e.pressure > 0) {
      return Math.max(1, base * (0.4 + e.pressure * 1.4));
    }
    return base;
  }

  function eraseAt(x: number, y: number) {
    const R = 22;
    const kept = value.filter((s) => {
      for (let i = 0; i < s.p.length; i += 2) {
        if (Math.hypot(s.p[i] - x, s.p[i + 1] - y) < R) return false;
      }
      return true;
    });
    if (kept.length !== value.length) onChange(kept);
  }

  function onDown(e: React.PointerEvent) {
    // Ignore the palm/second finger once a stroke is going.
    if (drawing.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const [x, y] = toPad(e);
    if (tool === "eraser") {
      eraseAt(x, y);
      return;
    }
    setLive({ c: colour, w: widthFor(e), p: [x, y] });
  }

  function onMove(e: React.PointerEvent) {
    if (!drawing.current) return;
    const [x, y] = toPad(e);
    if (tool === "eraser") {
      eraseAt(x, y);
      return;
    }
    setLive((s) => (s ? { ...s, p: [...s.p, x, y] } : s));
  }

  function onUp() {
    if (!drawing.current) return;
    drawing.current = false;
    if (live && live.p.length >= 4) onChange([...value, live]);
    setLive(null);
  }

  const strokes = live ? [...value, live] : value;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {COLOURS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => {
              setColour(c.value);
              setTool("pen");
            }}
            aria-label={c.name}
            className={`h-7 w-7 rounded-full ring-2 transition ${
              colour === c.value && tool === "pen"
                ? "ring-slate-800"
                : "ring-transparent"
            }`}
            style={{ background: c.value }}
          />
        ))}
        <button
          type="button"
          onClick={() => setTool(tool === "eraser" ? "pen" : "eraser")}
          className={`rounded-lg px-3 py-1.5 text-sm ring-1 transition ${
            tool === "eraser"
              ? "bg-slate-800 text-white ring-slate-800"
              : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
          }`}
        >
          🧽 ممحاة
        </button>
        <button
          type="button"
          onClick={() => onChange(value.slice(0, -1))}
          disabled={value.length === 0}
          className="rounded-lg bg-white px-3 py-1.5 text-sm text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
        >
          ↩️ تراجع
        </button>
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={value.length === 0}
          className="rounded-lg bg-white px-3 py-1.5 text-sm text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
        >
          🗑️ مسح الكل
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
        // Without this the browser pans the page instead of drawing on touch.
        style={{ touchAction: "none" }}
        className="w-full rounded-lg border border-slate-300 bg-white"
      >
        <StrokePaths strokes={strokes} />
      </svg>

      <p className="mt-1 text-xs text-slate-400">
        اكتب بالقلم أو بإصبعك. الرسم يُحفظ مع إجاباتك.
      </p>
    </div>
  );
}

// Shared by the pad and the printable handout so both draw identically.
export function StrokePaths({ strokes }: { strokes: Stroke[] }) {
  return (
    <>
      {strokes.map((s, i) => (
        <polyline
          key={i}
          points={pointsOf(s)}
          fill="none"
          stroke={s.c}
          strokeWidth={s.w}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </>
  );
}

function pointsOf(s: Stroke) {
  const out: string[] = [];
  for (let i = 0; i < s.p.length; i += 2) out.push(`${s.p[i]},${s.p[i + 1]}`);
  return out.join(" ");
}

// Read-only copy of a drawing, used in the PDF handout.
export function DrawingPreview({ strokes }: { strokes: Stroke[] }) {
  if (!strokes || strokes.length === 0) return null;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full rounded-lg border border-slate-300 bg-white"
    >
      <StrokePaths strokes={strokes} />
    </svg>
  );
}
