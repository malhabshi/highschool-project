"use client";

import { useState } from "react";
import { Scratchpad } from "@/components/scratchpad";
import type { Stroke } from "@/lib/exam-session";

// Notes + pencil pad attached to a lesson or a single question.
//
// Collapsed by default: there are 129 questions on this page, and mounting a
// drawing surface for every one of them at once makes it crawl on a tablet.
// The badge shows when there's work inside, so nothing is hidden silently.
export function WorkArea({
  note,
  strokes,
  onNote,
  onStrokes,
  compact = false,
}: {
  note: string;
  strokes: Stroke[];
  onNote: (text: string) => void;
  onStrokes: (s: Stroke[]) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasNote = note.trim().length > 0;
  const hasDrawing = strokes.length > 0;
  const hasWork = hasNote || hasDrawing;

  return (
    <div className="no-print mt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`min-h-11 rounded-xl px-3 text-sm font-medium ring-1 transition ${
          hasWork
            ? "bg-amber-50 text-amber-800 ring-amber-300"
            : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
        }`}
      >
        📝 ملاحظات وكتابة بالقلم
        {hasWork && (
          <span className="mr-2 text-xs">
            {hasNote ? "✍️" : ""}
            {hasDrawing ? ` ✏️${strokes.length}` : ""}
          </span>
        )}
        <span className="mr-2 text-xs opacity-60">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <textarea
            value={note}
            onChange={(e) => onNote(e.target.value)}
            rows={compact ? 2 : 4}
            placeholder="اكتب ملاحظاتك هنا…"
            className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-800 outline-none focus:border-blue-500"
          />
          <Scratchpad value={strokes} onChange={onStrokes} />
        </div>
      )}
    </div>
  );
}
