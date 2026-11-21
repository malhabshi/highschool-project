"use client";

import { useEffect, useRef, useState } from "react";
import { VideoTile } from "@/components/video-call";
import type { Participant } from "@/lib/video-call";
import { useActiveSpeaker } from "@/lib/active-speaker";

export type ChatMessage = {
  id: string;
  name: string;
  text: string;
  host: boolean;
  at: number;
};

export type StageTile = Pick<Participant, "name" | "micOn" | "camOn" | "sharing"> & {
  key: string;
  stream: MediaStream | null;
  audioStream?: MediaStream | null; // if the mic isn't in `stream` (own screen share)
  isLocal?: boolean;
};

// The presenters' video. The big spot goes to whoever is sharing their
// screen, otherwise to whoever is speaking (then the first tile, the host).
export function Stage({ tiles, empty }: { tiles: StageTile[]; empty: React.ReactNode }) {
  const speaker = useActiveSpeaker(
    tiles.map((t) => ({ key: t.key, stream: t.audioStream ?? t.stream, micOn: t.micOn }))
  );

  if (tiles.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl bg-slate-800 p-6 text-center text-slate-300">
        {empty}
      </div>
    );
  }
  const main =
    tiles.find((t) => t.sharing) ?? tiles.find((t) => t.key === speaker) ?? tiles[0];
  // One grid with stable keys; the main tile is moved and enlarged with CSS
  // only, so its <video> isn't remounted (which would cut the speaker's audio).
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {tiles.map((t) => (
        <div key={t.key} className={t === main ? "order-first col-span-2 sm:col-span-3" : ""}>
          <VideoTile
            stream={t.stream}
            name={t.name}
            micOn={t.micOn}
            camOn={t.camOn || t.sharing}
            sharing={t.sharing}
            isLocal={t.isLocal}
            speaking={tiles.length > 1 && t.key === speaker && t.micOn}
          />
        </div>
      ))}
    </div>
  );
}

export function ChatPanel({
  messages,
  onSend,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t.slice(0, 500));
    setText("");
  }

  return (
    <div className="flex h-96 flex-col">
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="pt-8 text-center text-sm text-slate-400">No messages yet. Say hello 👋</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="text-sm">
            <span className={`font-semibold ${m.host ? "text-blue-700" : "text-slate-800"}`}>
              {m.name}
              {m.host && (
                <span className="ml-1 rounded bg-blue-100 px-1 py-0.5 text-[10px] font-medium uppercase text-blue-700">
                  Host
                </span>
              )}
            </span>{" "}
            <span className="whitespace-pre-wrap break-words text-slate-700">{m.text}</span>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-slate-200 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          maxLength={500}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Send
        </button>
      </form>
    </div>
  );
}

// Simple tab strip for the side panel.
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; badge?: number }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-sm font-medium ${
            active === t.id
              ? "border-b-2 border-blue-600 text-blue-700"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {t.label}
          {!!t.badge && (
            <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function StatusBadge({ status }: { status: "scheduled" | "live" | "ended" }) {
  const styles = {
    scheduled: "bg-slate-100 text-slate-700",
    live: "bg-red-100 text-red-700",
    ended: "bg-slate-100 text-slate-500",
  }[status];
  const label = { scheduled: "Scheduled", live: "● Live", ended: "Ended" }[status];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles}`}>{label}</span>;
}
