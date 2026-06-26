"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRole } from "@/components/role-context";
import {
  useMessages,
  markThreadRead,
  getLastRead,
} from "@/lib/messages";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Kuwait",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// One admin↔employee conversation, identified by the employee's id.
export function Chat({ employeeId }: { employeeId: string }) {
  const { user } = useRole();
  const { messages, send, loaded } = useMessages(employeeId);
  const [draft, setDraft] = useState("");
  // The "last read" point captured when this thread was opened — used to draw
  // the "N unread messages" divider. Frozen for the viewing session.
  const [baseline, setBaseline] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // On opening the thread: capture my last-read point, then mark it read.
  useEffect(() => {
    let active = true;
    (async () => {
      const last = await getLastRead(user.id, employeeId);
      if (!active) return;
      setBaseline(last ?? "1970-01-01T00:00:00Z");
      await markThreadRead(user.id, employeeId);
    })();
    return () => {
      active = false;
    };
  }, [employeeId, user.id]);

  // Keep marking read as new messages arrive while I'm viewing.
  useEffect(() => {
    if (baseline !== null && loaded) markThreadRead(user.id, employeeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // First incoming message newer than my last-read point, and how many.
  const firstUnreadIdx =
    baseline === null
      ? -1
      : messages.findIndex(
          (m) => m.senderId !== user.id && m.createdAt > baseline
        );
  const unreadCount =
    baseline === null
      ? 0
      : messages.filter((m) => m.senderId !== user.id && m.createdAt > baseline)
          .length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await send(user.id, text);
  }

  return (
    <div className="flex h-[28rem] flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {!loaded ? (
          <p className="text-center text-sm text-slate-400">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            No messages yet. Say hello 👋
          </p>
        ) : (
          messages.map((m, i) => {
            const mine = m.senderId === user.id;
            return (
              <Fragment key={m.id}>
                {i === firstUnreadIdx && unreadCount > 0 && (
                  <div className="my-2 flex items-center gap-2 text-xs font-medium text-red-500">
                    <div className="h-px flex-1 bg-red-200" />
                    {unreadCount} unread message{unreadCount > 1 ? "s" : ""}
                    <div className="h-px flex-1 bg-red-200" />
                  </div>
                )}
              <div
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                  <div
                    className={`mt-0.5 text-[10px] ${
                      mine ? "text-blue-100" : "text-slate-400"
                    }`}
                  >
                    {fmtTime(m.createdAt)}
                  </div>
                </div>
              </div>
              </Fragment>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={submit}
        className="flex gap-2 border-t border-slate-200 p-3"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300"
        >
          Send
        </button>
      </form>
    </div>
  );
}
