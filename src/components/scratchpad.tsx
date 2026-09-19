"use client";

import { useRef, useState } from "react";
import type { Stroke } from "@/lib/exam-session";

// Freehand writing for tablets and phones, used two ways: as a blank pad under
// a question, and as a transparent overlay for writing directly on a lesson
// page.
//
// Strokes are SVG polylines rather than canvas pixels for three reasons: they
// stay sharp when the PDF handout is printed, they scale to any screen size,
// and they serialise to localStorage far smaller than an image would.
//
// Coordinates live in the surface's own viewBox space, so writing started on a
// phone still lines up when the session is reopened on a tablet.

export const PAD = { w: 1000, h: 600 };
// Overlay space for a lesson page. The page is now HTML, so its height depends
// on the screen; a square space stretched to fit (preserveAspectRatio="none")
// keeps marks in the same relative spot as the text reflows.
export const CONTENT = { w: 1000, h: 1000 };

const COLOURS = [
  { name: "أسود", value: "#0f172a" },
  { name: "أزرق", value: "#2563eb" },
  { name: "أحمر", value: "#dc2626" },
];

export type Tool = "pen" | "eraser";

export function useDrawTools() {
  const [tool, setTool] = useState<Tool>("pen");
  const [colour, setColour] = useState(COLOURS[0].value);
  return { tool, setTool, colour, setColour };
}

export function PenToolbar({
  tools,
  strokes,
  onChange,
}: {
  tools: ReturnType<typeof useDrawTools>;
  strokes: Stroke[];
  onChange: (s: Stroke[]) => void;
}) {
  const { tool, setTool, colour, setColour } = tools;
  return (
    <div className="flex flex-wrap items-center gap-2">
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
            colour === c.value && tool === "pen" ? "ring-slate-800" : "ring-transparent"
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
        onClick={() => onChange(strokes.slice(0, -1))}
        disabled={strokes.length === 0}
        className="rounded-lg bg-white px-3 py-1.5 text-sm text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
      >
        ↩️ تراجع
      </button>
      <button
        type="button"
        onClick={() => onChange([])}
        disabled={strokes.length === 0}
        className="rounded-lg bg-white px-3 py-1.5 text-sm text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
      >
        🗑️ مسح الكل
      </button>
    </div>
  );
}

// The drawing surface itself. `enabled` is what lets a page still be scrolled:
// while writing is off the overlay ignores pointers entirely, so a finger drag
// scrolls the lesson instead of drawing on it.
export function DrawSurface({
  width,
  height,
  strokes,
  onChange,
  tools,
  enabled = true,
  className,
  style,
}: {
  width: number;
  height: number;
  strokes: Stroke[];
  onChange: (s: Stroke[]) => void;
  tools: ReturnType<typeof useDrawTools>;
  enabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [live, setLive] = useState<Stroke | null>(null);
  const drawing = useRef(false);
  const { tool, colour } = tools;

  function toLocal(e: React.PointerEvent): [number, number] {
    const rect = ref.current!.getBoundingClientRect();
    return [
      ((e.clientX - rect.left) / rect.width) * width,
      ((e.clientY - rect.top) / rect.height) * height,
    ];
  }

  // A stylus reports real pressure; mouse and finger usually report 0 or 0.5,
  // so fall back to a steady width rather than letting the line vanish.
  function widthFor(e: React.PointerEvent) {
    const base = (3 * width) / PAD.w;
    if (e.pointerType === "pen" && e.pressure > 0) {
      return Math.max(0.8, base * (0.4 + e.pressure * 1.4));
    }
    return base;
  }

  function eraseAt(x: number, y: number) {
    const r = (22 * width) / PAD.w;
    const kept = strokes.filter((s) => {
      for (let i = 0; i < s.p.length; i += 2) {
        if (Math.hypot(s.p[i] - x, s.p[i + 1] - y) < r) return false;
      }
      return true;
    });
    if (kept.length !== strokes.length) onChange(kept);
  }

  function onDown(e: React.PointerEvent) {
    if (!enabled || drawing.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const [x, y] = toLocal(e);
    if (tool === "eraser") return eraseAt(x, y);
    setLive({ c: colour, w: widthFor(e), p: [x, y] });
  }

  function onMove(e: React.PointerEvent) {
    if (!enabled || !drawing.current) return;
    const [x, y] = toLocal(e);
    if (tool === "eraser") return eraseAt(x, y);
    setLive((s) => (s ? { ...s, p: [...s.p, x, y] } : s));
  }

  function onUp() {
    if (!drawing.current) return;
    drawing.current = false;
    if (live && live.p.length >= 4) onChange([...strokes, live]);
    setLive(null);
  }

  const all = live ? [...strokes, live] : strokes;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
      className={className}
      style={{
        // Without touch-action:none the browser pans the page mid-stroke.
        touchAction: enabled ? "none" : "auto",
        pointerEvents: enabled ? "auto" : "none",
        ...style,
      }}
    >
      <StrokePaths strokes={all} />
    </svg>
  );
}

// Blank pad, used under a question.
export function Scratchpad({
  value,
  onChange,
}: {
  value: Stroke[];
  onChange: (s: Stroke[]) => void;
}) {
  const tools = useDrawTools();
  return (
    <div>
      <div className="mb-2">
        <PenToolbar tools={tools} strokes={value} onChange={onChange} />
      </div>
      <DrawSurface
        width={PAD.w}
        height={PAD.h}
        strokes={value}
        onChange={onChange}
        tools={tools}
        className="w-full rounded-lg border border-slate-300 bg-white"
      />
      <p className="mt-1 text-xs text-slate-400">
        اكتب بالقلم أو بإصبعك. الرسم يُحفظ مع إجاباتك.
      </p>
    </div>
  );
}

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
export function DrawingPreview({
  strokes,
  width = PAD.w,
  height = PAD.h,
}: {
  strokes: Stroke[];
  width?: number;
  height?: number;
}) {
  if (!strokes || strokes.length === 0) return null;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full rounded-lg border border-slate-300 bg-white"
    >
      <StrokePaths strokes={strokes} />
    </svg>
  );
}
