"use client";

import { useState } from "react";
import Link from "next/link";
import { useRole } from "@/components/role-context";
import { useUsers } from "@/lib/users";
import { Banner, ControlButton } from "@/components/video-call";
import {
  ChatPanel,
  Stage,
  StatusBadge,
  Tabs,
  type ChatMessage,
  type StageTile,
} from "@/components/webinar-shared";
import { useMeshRoom } from "@/lib/video-call";
import { uid } from "@/lib/uid";
import {
  WEBINAR_VIEWER_LIMIT,
  formatWebinarTime,
  publicWebinarUrl,
  setWebinarHost,
  setWebinarStatus,
  useRegistrations,
  useWebinar,
  useWebinarQuestions,
  webinarTopic,
  type Webinar,
  type WebinarQuestion,
} from "@/lib/webinars";

export function WebinarStudio({ id }: { id: string }) {
  const { webinar, loaded, refetch } = useWebinar(id);
  const [inRoom, setInRoom] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!loaded) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!webinar) {
    return (
      <div className="space-y-3">
        <p className="text-slate-700">This webinar doesn&apos;t exist anymore.</p>
        <Link href="/webinars" className="text-sm font-medium text-blue-600 hover:underline">
          ← Back to webinars
        </Link>
      </div>
    );
  }

  async function copyLink() {
    const url = publicWebinarUrl(webinar!.code);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this webinar link:", url);
    }
  }

  async function goLive() {
    if (webinar!.status !== "live") {
      await setWebinarStatus(webinar!.id, "live");
      await refetch();
    }
    setInRoom(true);
  }

  async function endWebinar() {
    await setWebinarStatus(webinar!.id, "ended");
    setInRoom(false);
    refetch();
  }

  // Step out but keep the webinar live (optionally handing it to someone).
  async function leave(newHostId: string | null) {
    if (newHostId && newHostId !== webinar!.hostId) await setWebinarHost(webinar!.id, newHostId);
    setInRoom(false);
    refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/webinars" className="text-sm font-medium text-blue-600 hover:underline">
            ← Webinars
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800">{webinar.title}</h1>
            <StatusBadge status={webinar.status} />
          </div>
          <p className="text-slate-500">{formatWebinarTime(webinar.scheduledAt)}</p>
          {webinar.status !== "ended" && <HostPicker webinar={webinar} onChanged={refetch} />}
        </div>
        {webinar.status !== "ended" && (
          <button
            onClick={copyLink}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {copied ? "✓ Link copied" : "🔗 Copy public link"}
          </button>
        )}
      </div>

      {inRoom ? (
        <HostRoom webinar={webinar} onEnd={endWebinar} onLeave={leave} />
      ) : (
        <>
          {webinar.status !== "ended" && (
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-800">
                {webinar.status === "live" ? "This webinar is live" : "Ready when you are"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {webinar.status === "live"
                  ? "Join to present. Viewers are waiting on the public page."
                  : "Going live turns on your camera and lets viewers in. Anyone opening the link early waits until you start."}
              </p>
              <button
                onClick={goLive}
                className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                {webinar.status === "live" ? "Join as host" : "● Go live"}
              </button>
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white">
              <h2 className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">
                Registrations
              </h2>
              <RegistrationsList webinarId={webinar.id} />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white">
              <h2 className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">
                Questions
              </h2>
              <QuestionsPanel webinarId={webinar.id} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

type Tab = "chat" | "qa" | "people" | "registrations";

function HostRoom({
  webinar,
  onEnd,
  onLeave,
}: {
  webinar: Webinar;
  onEnd: () => void;
  onLeave: (newHostId: string | null) => void;
}) {
  const { user } = useRole();
  const [leaving, setLeaving] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [tab, setTab] = useState<Tab>("chat");
  const [seenChat, setSeenChat] = useState(0);
  const myName = user.name || user.email;

  const room = useMeshRoom({
    topic: webinarTopic(webinar.code),
    name: myName,
    host: true,
    startOnStage: true,
    onMessage: (m) => {
      if (m.type === "chat") setChat((prev) => [...prev, m as unknown as ChatMessage]);
    },
  });
  const { questions, setAnswered } = useWebinarQuestions(webinar.id);

  const audience = room.participants.filter((p) => !p.host);
  const hands = audience.filter((p) => p.hand && !p.onStage);
  const unanswered = questions.filter((q) => !q.answered).length;

  const tiles: StageTile[] = [
    {
      key: room.myId,
      stream: room.localStream,
      audioStream: room.micStream,
      name: `${myName} (you)`,
      micOn: room.micOn,
      camOn: room.camOn,
      sharing: room.sharing,
      isLocal: true,
    },
    ...room.participants
      .filter((p) => p.onStage)
      .map((p) => ({ key: p.peerId, ...p })),
  ];

  function sendChat(text: string) {
    const msg: ChatMessage = { id: uid(), name: myName, text, host: true, at: Date.now() };
    room.send({ type: "chat", ...msg });
    setChat((prev) => [...prev, msg]);
  }

  function markAnswered(id: string, answered: boolean) {
    setAnswered(id, answered);
    room.send({ type: "answered", id, answered });
  }

  function end() {
    if (!window.confirm("End the webinar for everyone?")) return;
    room.send({ type: "ended" });
    onEnd();
  }

  function changeTab(t: Tab) {
    setTab(t);
    if (t === "chat") setSeenChat(chat.length);
  }

  return (
    <div className="space-y-3">
      {leaving && (
        <LeaveDialog
          webinar={webinar}
          otherHostsPresent={room.participants.some((p) => p.host)}
          onCancel={() => setLeaving(false)}
          onLeave={(newHostId) => {
            setLeaving(false);
            room.send({ type: "host-away" });
            onLeave(newHostId);
          }}
        />
      )}
      {room.status === "error" && (
        <Banner tone="red">
          Couldn&apos;t connect to the webinar server. Check your connection and rejoin.
        </Banner>
      )}
      {room.mediaError && <Banner tone="amber">{room.mediaError}</Banner>}
      {audience.length > WEBINAR_VIEWER_LIMIT && (
        <Banner tone="amber">
          {audience.length} viewers — more than {WEBINAR_VIEWER_LIMIT} may make video choppy.
        </Banner>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          <Stage tiles={tiles} empty="Starting your camera…" />
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl bg-slate-900 p-3">
            <span className="mr-auto px-2 text-sm text-slate-300">
              👀 {audience.length} watching
            </span>
            <ControlButton
              onClick={room.toggleMic}
              disabled={!room.hasMic}
              off={!room.micOn}
              label={room.micOn ? "🎤 Mute" : "🔇 Unmute"}
            />
            <ControlButton
              onClick={room.toggleCam}
              disabled={!room.hasCam}
              off={!room.camOn}
              label={room.camOn ? "📷 Stop video" : "📷 Start video"}
            />
            <ControlButton
              onClick={room.toggleScreen}
              off={false}
              active={room.sharing}
              label={room.sharing ? "🖥️ Stop sharing" : "🖥️ Share screen"}
            />
            <button
              onClick={() => setLeaving(true)}
              className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-500"
            >
              Leave
            </button>
            <button
              onClick={end}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              End webinar
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <Tabs<Tab>
            tabs={[
              { id: "chat", label: "Chat", badge: tab === "chat" ? 0 : chat.length - seenChat },
              { id: "qa", label: "Q&A", badge: unanswered },
              { id: "people", label: "People", badge: hands.length },
              { id: "registrations", label: "Registered" },
            ]}
            active={tab}
            onChange={changeTab}
          />
          {tab === "chat" && <ChatPanel messages={chat} onSend={sendChat} />}
          {tab === "qa" && (
            <div className="h-96 overflow-y-auto">
              <QuestionsList questions={questions} onAnswered={markAnswered} />
            </div>
          )}
          {tab === "people" && (
            <div className="h-96 overflow-y-auto">
              {audience.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-400">No viewers yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {[...audience]
                    .sort((a, b) => Number(b.hand) - Number(a.hand))
                    .map((p) => (
                      <li key={p.peerId} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                        <span className="min-w-0 flex-1 truncate text-slate-800">
                          {p.hand && !p.onStage && "✋ "}
                          {p.name}
                          {p.onStage && (
                            <span className="ml-1.5 text-xs font-medium text-green-700">on stage</span>
                          )}
                        </span>
                        {p.onStage ? (
                          <button
                            onClick={() => room.send({ type: "stage", to: p.peerId, on: false })}
                            className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Remove from stage
                          </button>
                        ) : (
                          <button
                            onClick={() => room.send({ type: "stage", to: p.peerId, on: true })}
                            className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            Invite to speak
                          </button>
                        )}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
          {tab === "registrations" && (
            <div className="h-96 overflow-y-auto">
              <RegistrationsList webinarId={webinar.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Who hosts the webinar. The host (or an admin) can hand it to a colleague;
// they'll see it highlighted under Webinars.
function HostPicker({ webinar, onChanged }: { webinar: Webinar; onChanged: () => void }) {
  const { user, role } = useRole();
  const { users } = useUsers();
  const canChange = role === "admin" || webinar.hostId === user.id;

  if (!canChange) {
    return <p className="text-sm text-slate-500">Host: {webinar.hostName || "—"}</p>;
  }
  return (
    <label className="mt-1 flex items-center gap-2 text-sm text-slate-500">
      Host:
      <select
        value={webinar.hostId ?? ""}
        onChange={async (e) => {
          await setWebinarHost(webinar.id, e.target.value);
          onChanged();
        }}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
      >
        {!webinar.hostId && <option value="">— Choose —</option>}
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name || u.email}
            {u.id === user.id ? " (you)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function LeaveDialog({
  webinar,
  otherHostsPresent,
  onCancel,
  onLeave,
}: {
  webinar: Webinar;
  otherHostsPresent: boolean;
  onCancel: () => void;
  onLeave: (newHostId: string | null) => void;
}) {
  const { user } = useRole();
  const { users } = useUsers();
  const [next, setNext] = useState(webinar.hostId ?? user.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Leave the webinar?</h2>
          <p className="mt-1 text-sm text-slate-500">
            The webinar stays live for viewers.{" "}
            {otherHostsPresent
              ? "Another host is still presenting."
              : "Until a host joins, viewers will see “The host will be right back”."}
          </p>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Who should host it now?</span>
          <select
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
                {u.id === user.id ? " (you — come back later)" : ""}
              </option>
            ))}
          </select>
          <span className="block text-xs text-slate-400">
            They&apos;ll see a red LIVE badge on Webinars and can join from there.
          </span>
        </label>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Stay
          </button>
          <button
            onClick={() => onLeave(next)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

function RegistrationsList({ webinarId }: { webinarId: string }) {
  const registrations = useRegistrations(webinarId);

  function downloadCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      ["Name", "Email", "Phone", "Registered at"],
      ...registrations.map((r) => [r.name, r.email, r.phone, r.createdAt]),
    ];
    const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "webinar-registrations.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (registrations.length === 0) {
    return <p className="p-6 text-center text-sm text-slate-400">No registrations yet.</p>;
  }
  return (
    <div>
      <div className="flex items-center justify-between px-4 py-2 text-sm text-slate-500">
        <span>{registrations.length} registered</span>
        <button onClick={downloadCsv} className="font-medium text-blue-600 hover:underline">
          Download CSV
        </button>
      </div>
      <ul className="divide-y divide-slate-100">
        {registrations.map((r) => (
          <li key={r.id} className="px-4 py-2.5 text-sm">
            <div className="font-medium text-slate-800">{r.name}</div>
            <div className="text-slate-500">{[r.email, r.phone].filter(Boolean).join(" · ")}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Questions outside the live room (before going live / after it ended).
function QuestionsPanel({ webinarId }: { webinarId: string }) {
  const { questions, setAnswered } = useWebinarQuestions(webinarId);
  return <QuestionsList questions={questions} onAnswered={setAnswered} />;
}

function QuestionsList({
  questions,
  onAnswered,
}: {
  questions: WebinarQuestion[];
  onAnswered: (id: string, answered: boolean) => void;
}) {
  if (questions.length === 0) {
    return <p className="p-6 text-center text-sm text-slate-400">No questions yet.</p>;
  }
  const ordered = [...questions].sort((a, b) => Number(a.answered) - Number(b.answered));
  return (
    <ul className="divide-y divide-slate-100">
      {ordered.map((q) => (
        <li key={q.id} className={`px-4 py-3 text-sm ${q.answered ? "opacity-50" : ""}`}>
          <div className="font-medium text-slate-800">{q.name}</div>
          <p className="whitespace-pre-wrap break-words text-slate-700">{q.text}</p>
          <button
            onClick={() => onAnswered(q.id, !q.answered)}
            className="mt-1 text-xs font-medium text-blue-600 hover:underline"
          >
            {q.answered ? "Mark unanswered" : "✓ Mark answered"}
          </button>
        </li>
      ))}
    </ul>
  );
}
