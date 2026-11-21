"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROOM_CODE, newRoomCode } from "@/lib/video-room";

export function VideoLobby() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function join(e: React.FormEvent) {
    e.preventDefault();
    // Accept either a bare code or a full pasted invite link.
    const room = code.trim().toLowerCase().split("/").filter(Boolean).pop() ?? "";
    if (!ROOM_CODE.test(room)) {
      setError("That doesn't look like a meeting code or link.");
      return;
    }
    router.push(`/video/${room}`);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-800">Start a meeting</h2>
        <p className="mt-1 text-sm text-slate-500">
          Opens a new room. Copy the invite link inside and send it to the people you
          want to join.
        </p>
        <button
          onClick={() => router.push(`/video/${newRoomCode()}`)}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          📹 New meeting
        </button>
      </div>

      <form onSubmit={join} className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-800">Join a meeting</h2>
        <p className="mt-1 text-sm text-slate-500">Paste the meeting code or invite link.</p>
        <div className="mt-4 flex gap-2">
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
            }}
            placeholder="e.g. k3f9-a2xq-7m1c"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Join
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
