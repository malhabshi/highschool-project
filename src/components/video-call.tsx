"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/components/role-context";
import { MESH_COMFORT_LIMIT, useVideoCall } from "@/lib/video-call";
import { useActiveSpeaker } from "@/lib/active-speaker";

export function VideoCall({ roomId }: { roomId: string }) {
  const { user } = useRole();
  const router = useRouter();
  const call = useVideoCall(roomId, user.name || user.email);
  const [copied, setCopied] = useState(false);

  const tiles = [
    {
      key: "me",
      stream: call.localStream,
      audioStream: call.micStream,
      name: `${user.name || "You"} (you)`,
      micOn: call.micOn,
      sharing: call.sharing,
      camOn: call.camOn || call.sharing,
      isLocal: true,
    },
    ...call.participants.map((p) => ({
      key: p.peerId,
      stream: p.stream,
      audioStream: p.stream,
      name: p.name,
      micOn: p.micOn,
      sharing: p.sharing,
      camOn: p.camOn || p.sharing,
      isLocal: false,
    })),
  ];
  const speaker = useActiveSpeaker(
    tiles.map((t) => ({ key: t.key, stream: t.audioStream, micOn: t.micOn }))
  );
  // A shared screen takes the full width at the top; everyone else stays in
  // the grid. (CSS-only reordering, so no <video> gets remounted.)
  const sharer = tiles.find((t) => t.sharing);

  const count = tiles.length;
  const grid =
    count === 1
      ? "grid-cols-1"
      : count <= 4 && !sharer
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-2 lg:grid-cols-3";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this meeting link:", window.location.href);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Video Call</h1>
          <p className="text-slate-500">
            Room <span className="font-mono text-slate-700">{roomId}</span> ·{" "}
            {call.status === "joining"
              ? "Joining…"
              : `${count} ${count === 1 ? "person" : "people"} in the call`}
          </p>
        </div>
        <button
          onClick={copyLink}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {copied ? "✓ Link copied" : "🔗 Copy invite link"}
        </button>
      </div>

      {call.status === "error" && (
        <Banner tone="red">
          Couldn&apos;t connect to the meeting server. Check your connection and reload.
        </Banner>
      )}
      {call.mediaError && <Banner tone="amber">{call.mediaError}</Banner>}
      {count > MESH_COMFORT_LIMIT && (
        <Banner tone="amber">
          Calls currently work best with up to {MESH_COMFORT_LIMIT} people. Video may get
          choppy for some participants.
        </Banner>
      )}

      <div className={`grid gap-3 ${grid}`}>
        {tiles.map((t) => (
          <div key={t.key} className={t === sharer ? "order-first col-span-2 lg:col-span-3" : ""}>
            <VideoTile
              stream={t.stream}
              name={t.name}
              micOn={t.micOn}
              camOn={t.camOn}
              sharing={t.sharing}
              isLocal={t.isLocal}
              speaking={count > 1 && t.key === speaker && t.micOn}
            />
          </div>
        ))}
      </div>

      {call.status === "joined" && count === 1 && (
        <p className="text-center text-sm text-slate-500">
          You&apos;re the only one here. Share the invite link so others can join.
        </p>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl bg-slate-900 p-3">
        <ControlButton
          onClick={call.toggleMic}
          disabled={!call.hasMic}
          off={!call.micOn}
          label={call.micOn ? "🎤 Mute" : "🔇 Unmute"}
        />
        <ControlButton
          onClick={call.toggleCam}
          disabled={!call.hasCam}
          off={!call.camOn}
          label={call.camOn ? "📷 Stop video" : "📷 Start video"}
        />
        <ControlButton
          onClick={call.toggleScreen}
          off={false}
          active={call.sharing}
          label={call.sharing ? "🖥️ Stop sharing" : "🖥️ Share screen"}
        />
        <button
          onClick={() => router.push("/video")}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Leave
        </button>
      </div>
    </div>
  );
}

export function VideoTile({
  stream,
  name,
  micOn,
  camOn,
  sharing,
  isLocal = false,
  speaking = false,
}: {
  stream: MediaStream | null;
  name: string;
  micOn: boolean;
  camOn: boolean;
  sharing: boolean;
  isLocal?: boolean;
  speaking?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  const initials = name
    .replace(/\(you\)/, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className={`relative aspect-video overflow-hidden rounded-xl bg-slate-800 ring-offset-2 transition-shadow ${
        speaking ? "ring-4 ring-green-500" : ""
      }`}
    >
      {/* Keep the element mounted even with video off — it also plays the audio. */}
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={isLocal}
        className={`h-full w-full ${sharing ? "object-contain" : "object-cover"} ${
          isLocal && !sharing ? "-scale-x-100" : ""
        } ${camOn && stream ? "" : "invisible"}`}
      />
      {!(camOn && stream) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-xl font-semibold text-white">
            {initials || "?"}
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
        {!micOn && <span title="Muted">🔇</span>}
        {sharing && <span title="Sharing screen">🖥️</span>}
        <span className="max-w-[12rem] truncate">{name}</span>
      </div>
    </div>
  );
}

export function ControlButton({
  onClick,
  label,
  off,
  active = false,
  disabled = false,
}: {
  onClick: () => void;
  label: string;
  off: boolean;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-blue-600 text-white hover:bg-blue-700"
          : off
            ? "bg-slate-600 text-white hover:bg-slate-500"
            : "bg-slate-700 text-slate-100 hover:bg-slate-600"
      }`}
    >
      {label}
    </button>
  );
}

export function Banner({ tone, children }: { tone: "red" | "amber"; children: React.ReactNode }) {
  const styles =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-amber-200 bg-amber-50 text-amber-800";
  return <div className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}
