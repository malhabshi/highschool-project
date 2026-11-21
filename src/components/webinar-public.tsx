"use client";

import { useCallback, useEffect, useState } from "react";
import { Banner, ControlButton } from "@/components/video-call";
import {
  ChatPanel,
  PeopleList,
  QuestionsList,
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
  askWebinarQuestion,
  formatWebinarTime,
  getGuestKey,
  getPublicWebinar,
  guestEndWebinar,
  guestIsHost,
  registerForWebinar,
  useGuestQuestions,
  type GuestKey,
  webinarTopic,
  type Webinar,
} from "@/lib/webinars";

type Viewer = { name: string; email: string; phone: string };

const VIEWER_KEY = "masar-webinar-viewer";

function loadViewer(): Viewer {
  try {
    const v = JSON.parse(localStorage.getItem(VIEWER_KEY) ?? "null");
    if (v && typeof v.name === "string") return v;
  } catch {
    // storage unavailable — start blank
  }
  return { name: "", email: "", phone: "" };
}

function saveViewer(v: Viewer) {
  try {
    localStorage.setItem(VIEWER_KEY, JSON.stringify(v));
  } catch {
    // storage unavailable — fine
  }
}

// The public webinar page (no login): register, wait, watch, take part.
export function WebinarPublic({ code }: { code: string }) {
  const [webinar, setWebinar] = useState<Webinar | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [phase, setPhase] = useState<"landing" | "registered" | "room" | "ended" | "full">(
    "landing"
  );
  const [viewer, setViewer] = useState<Viewer>({ name: "", email: "", phone: "" });
  const [guestKey, setGuestKey] = useState<GuestKey | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getPublicWebinar(code), getGuestKey(code)]).then(([w, key]) => {
      if (!active) return;
      setWebinar(w);
      setGuestKey(key);
      setViewer(loadViewer());
      if (w?.status === "ended") setPhase("ended");
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [code]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <span className="text-lg font-bold tracking-tight text-slate-800">Masar</span>
          <span className="ml-2 text-sm text-slate-400">Webinar</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {!loaded ? (
          <p className="text-center text-sm text-slate-500">Loading…</p>
        ) : !webinar ? (
          <Notice title="Webinar not found" body="Please check your link and try again." />
        ) : phase === "ended" ? (
          <Notice
            title="This webinar has ended"
            body={`Thank you for your interest in “${webinar.title}”.`}
          />
        ) : phase === "full" ? (
          <Notice
            title="This webinar is full"
            body="We've reached the maximum number of viewers. Please try again a little later."
          />
        ) : phase === "room" && guestKey ? (
          <ViewerRoom
            webinar={webinar}
            name={viewer.name}
            guestKey={guestKey}
            onEnded={() => setPhase("ended")}
            onFull={() => setPhase("full")}
            onLeave={() => setPhase("landing")}
          />
        ) : (
          <Landing
            webinar={webinar}
            viewer={viewer}
            registered={phase === "registered"}
            onChange={setViewer}
            onRegistered={() => setPhase("registered")}
            onJoin={() => setPhase("room")}
          />
        )}
      </main>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-xl font-bold text-slate-800">{title}</h1>
      <p className="mt-2 text-slate-500">{body}</p>
    </div>
  );
}

function Landing({
  webinar,
  viewer,
  registered,
  onChange,
  onRegistered,
  onJoin,
}: {
  webinar: Webinar;
  viewer: Viewer;
  registered: boolean;
  onChange: (v: Viewer) => void;
  onRegistered: () => void;
  onJoin: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = webinar.status === "live";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!viewer.name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!viewer.email.trim() && !viewer.phone.trim()) {
      setError("Please enter your email or phone number.");
      return;
    }
    setBusy(true);
    setError(null);
    const err = await registerForWebinar(webinar.code, viewer);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    saveViewer(viewer);
    if (live) onJoin();
    else onRegistered();
  }

  const field =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-800">{webinar.title}</h1>
          <StatusBadge status={webinar.status} />
        </div>
        <p className="mt-1 text-slate-500">
          {formatWebinarTime(webinar.scheduledAt)} (Kuwait time)
          {webinar.hostName && ` · Hosted by ${webinar.hostName}`}
        </p>
        {webinar.description && (
          <p className="mt-3 whitespace-pre-wrap text-slate-700">{webinar.description}</p>
        )}
      </div>

      {registered ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6">
          <h2 className="text-lg font-semibold text-green-800">You&apos;re registered ✓</h2>
          <p className="mt-1 text-sm text-green-700">
            Come back to this same link at {formatWebinarTime(webinar.scheduledAt)}. You can also
            wait in the waiting room — the webinar will appear as soon as it starts.
          </p>
          <button
            onClick={onJoin}
            className="mt-4 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
          >
            Enter waiting room
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-800">
            {live ? "Join the webinar" : "Register"}
          </h2>
          <input
            value={viewer.name}
            onChange={(e) => onChange({ ...viewer, name: e.target.value })}
            placeholder="Full name"
            maxLength={120}
            className={field}
          />
          <input
            type="email"
            value={viewer.email}
            onChange={(e) => onChange({ ...viewer, email: e.target.value })}
            placeholder="Email"
            maxLength={200}
            className={field}
          />
          <input
            type="tel"
            value={viewer.phone}
            onChange={(e) => onChange({ ...viewer, phone: e.target.value })}
            placeholder="Phone (optional if you gave an email)"
            maxLength={40}
            className={field}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              live ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {busy ? "Please wait…" : live ? "● Join now" : "Register"}
          </button>
        </form>
      )}
    </div>
  );
}

type Tab = "chat" | "qa" | "people";
type MyQuestion = { id: string; text: string; answered: boolean };

function ViewerRoom({
  webinar,
  name,
  guestKey,
  onEnded,
  onFull,
  onLeave,
}: {
  webinar: Webinar;
  name: string;
  guestKey: GuestKey;
  onEnded: () => void;
  onFull: () => void;
  onLeave: () => void;
}) {
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [tab, setTab] = useState<Tab>("chat");
  const [seenChat, setSeenChat] = useState(0);
  const [invited, setInvited] = useState(false);
  const [myQuestions, setMyQuestions] = useState<MyQuestion[]>([]);
  const [question, setQuestion] = useState("");
  const [qError, setQError] = useState<string | null>(null);
  // Made host by staff (a "guest host"): presenter controls, Q&A and ending.
  const [isHost, setIsHost] = useState(false);
  const [hostNotice, setHostNotice] = useState<string | null>(null);
  const guestQ = useGuestQuestions(webinar.code, guestKey, isHost);

  const becomeHost = useCallback(
    (actions: { setHost: (on: boolean) => void; goOnStage: () => unknown }) => {
      setIsHost(true);
      setInvited(false);
      actions.setHost(true);
      actions.goOnStage();
      setHostNotice(
        "You're now a host. You can present, share your screen, invite speakers, answer questions and end the webinar."
      );
    },
    []
  );

  const room = useMeshRoom({
    topic: webinarTopic(webinar.code),
    name,
    secretHash: guestKey.hash,
    startOnStage: false,
    onMessage: (m, actions) => {
      if (m.type === "chat") {
        setChat((prev) => [...prev, m as unknown as ChatMessage]);
      } else if (m.type === "stage") {
        setInvited(!!m.on);
        if (!m.on) actions.leaveStage(); // the host took us off stage
      } else if (m.type === "host") {
        if (m.on) becomeHost(actions);
        else {
          setIsHost(false);
          actions.setHost(false);
          actions.leaveStage();
          setTab("chat");
          setHostNotice("You're no longer a host.");
        }
      } else if (m.type === "answered") {
        setMyQuestions((prev) =>
          prev.map((q) => (q.id === m.id ? { ...q, answered: !!m.answered } : q))
        );
        guestQ.refetch();
      } else if (m.type === "qa-asked") {
        guestQ.refetch();
      } else if (m.type === "ended") {
        onEnded();
      }
    },
  });

  // A guest host who reloaded the page is still host.
  const { setHost, goOnStage } = room;
  const joined = room.status === "joined";
  useEffect(() => {
    if (!joined) return;
    let active = true;
    guestIsHost(webinar.code, guestKey).then((yes) => {
      if (yes && active) becomeHost({ setHost, goOnStage });
    });
    return () => {
      active = false;
    };
  }, [joined, webinar.code, guestKey, becomeHost, setHost, goOnStage]);
  const hosts = room.participants.filter((p) => p.host);
  const audience = room.participants.filter((p) => !p.staff);
  const live = hosts.some((h) => h.onStage);
  // Remember that it has started, so a host stepping away reads as a pause.
  const [wasLive, setWasLive] = useState(false);
  if (live && !wasLive) setWasLive(true);

  // Viewers are admitted in the order they arrived, up to the limit.
  const aheadOfMe = room.participants.filter(
    (p) =>
      !p.host &&
      (p.joinedAt < room.me.joinedAt || (p.joinedAt === room.me.joinedAt && p.peerId < room.myId))
  ).length;
  const full = room.status === "joined" && aheadOfMe >= WEBINAR_VIEWER_LIMIT;
  useEffect(() => {
    if (full) onFull();
  }, [full, onFull]);

  const tiles: StageTile[] = [
    ...room.participants
      .filter((p) => p.onStage)
      .sort((a, b) => Number(b.host) - Number(a.host))
      .map((p) => ({ key: p.peerId, ...p })),
    ...(room.me.onStage
      ? [
          {
            key: room.myId,
            stream: room.localStream,
            audioStream: room.micStream,
            name: `${name} (you)`,
            micOn: room.micOn,
            camOn: room.camOn,
            sharing: room.sharing,
            isLocal: true,
          },
        ]
      : []),
  ];

  function sendChat(text: string) {
    const msg: ChatMessage = { id: uid(), name, text, host: isHost, at: Date.now() };
    room.send({ type: "chat", ...msg });
    setChat((prev) => [...prev, msg]);
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const text = question.trim();
    if (!text) return;
    setQError(null);
    const id = await askWebinarQuestion(webinar.code, name, text.slice(0, 1000));
    if (!id) {
      setQError("Couldn't send your question. Questions open once the webinar is live.");
      return;
    }
    setMyQuestions((prev) => [...prev, { id, text, answered: false }]);
    setQuestion("");
    room.send({ type: "qa-asked" }); // lets guest hosts refresh their list
  }

  function markAnswered(id: string, answered: boolean) {
    guestQ.setAnswered(id, answered);
    room.send({ type: "answered", id, answered });
  }

  async function endWebinar() {
    if (!window.confirm("End the webinar for everyone?")) return;
    if (!(await guestEndWebinar(webinar.code, guestKey))) {
      window.alert("Couldn't end the webinar. You may no longer be a host.");
      return;
    }
    room.send({ type: "ended" });
    onEnded();
  }

  function joinStage(withDevices: boolean) {
    setInvited(false);
    room.goOnStage(withDevices ? {} : { mic: false, cam: false });
  }

  function changeTab(t: Tab) {
    setTab(t);
    if (t === "chat") setSeenChat(chat.length);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-slate-800">{webinar.title}</h1>
        {live && <StatusBadge status="live" />}
      </div>

      {room.status === "error" && (
        <Banner tone="red">Couldn&apos;t connect. Check your internet connection and reload.</Banner>
      )}
      {room.mediaError && room.me.onStage && <Banner tone="amber">{room.mediaError}</Banner>}
      {hostNotice && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span className="flex-1">⭐ {hostNotice}</span>
          <button onClick={() => setHostNotice(null)} className="font-medium hover:underline">
            OK
          </button>
        </div>
      )}
      {invited && !room.me.onStage && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span className="flex-1">
            🎤 The host invited you to speak. You can mute yourself or turn your camera off at any
            time.
          </span>
          <button
            onClick={() => joinStage(true)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
          >
            Join stage
          </button>
          <button
            onClick={() => joinStage(false)}
            className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100"
          >
            Join muted, camera off
          </button>
          <button
            onClick={() => setInvited(false)}
            className="rounded-lg px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100"
          >
            Not now
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          <Stage
            tiles={tiles}
            empty={
              room.status === "joining" ? (
                "Connecting…"
              ) : (
                wasLive ? (
                  <div>
                    <p className="text-lg font-semibold text-white">The host will be right back</p>
                    <p className="mt-1 text-sm">Please stay on this page.</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg font-semibold text-white">Waiting for the host to start</p>
                    <p className="mt-1 text-sm">
                      Scheduled for {formatWebinarTime(webinar.scheduledAt)}. Keep this page open.
                    </p>
                  </div>
                )
              )
            }
          />
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl bg-slate-900 p-3">
            {room.me.onStage ? (
              <>
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
                {isHost && (
                  <ControlButton
                    onClick={room.toggleScreen}
                    off={false}
                    active={room.sharing}
                    label={room.sharing ? "🖥️ Stop sharing" : "🖥️ Share screen"}
                  />
                )}
                <ControlButton onClick={room.leaveStage} off={false} label="⬇️ Leave stage" />
              </>
            ) : isHost ? (
              <ControlButton onClick={() => room.goOnStage()} off={false} label="🎥 Join stage" />
            ) : (
              <ControlButton
                onClick={() => room.setHand(!room.me.hand)}
                off={false}
                active={room.me.hand}
                label={room.me.hand ? "✋ Lower hand" : "✋ Raise hand"}
              />
            )}
            <button
              onClick={onLeave}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Leave
            </button>
            {isHost && (
              <button
                onClick={endWebinar}
                className="rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900"
              >
                End webinar
              </button>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <Tabs<Tab>
            tabs={
              isHost
                ? [
                    { id: "chat", label: "Chat", badge: tab === "chat" ? 0 : chat.length - seenChat },
                    {
                      id: "qa",
                      label: "Q&A",
                      badge: guestQ.questions.filter((q) => !q.answered).length,
                    },
                    {
                      id: "people",
                      label: "People",
                      badge: audience.filter((p) => p.hand && !p.onStage).length,
                    },
                  ]
                : [
                    { id: "chat", label: "Chat", badge: tab === "chat" ? 0 : chat.length - seenChat },
                    { id: "qa", label: "Ask a question" },
                  ]
            }
            active={tab}
            onChange={changeTab}
          />
          {tab === "chat" ? (
            <ChatPanel messages={chat} onSend={sendChat} />
          ) : isHost && tab === "qa" ? (
            <div className="h-96 overflow-y-auto">
              <QuestionsList questions={guestQ.questions} onAnswered={markAnswered} />
            </div>
          ) : isHost && tab === "people" ? (
            <div className="h-96 overflow-y-auto">
              <PeopleList
                people={audience}
                onStage={(p, on) => room.send({ type: "stage", to: p.peerId, on })}
              />
            </div>
          ) : (
            <div className="flex h-96 flex-col">
              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {myQuestions.length === 0 ? (
                  <p className="pt-8 text-center text-sm text-slate-400">
                    Questions go privately to the host.
                  </p>
                ) : (
                  myQuestions.map((q) => (
                    <div key={q.id} className="rounded-lg bg-slate-50 p-2.5 text-sm">
                      <p className="whitespace-pre-wrap break-words text-slate-700">{q.text}</p>
                      <p className={`mt-1 text-xs ${q.answered ? "text-green-700" : "text-slate-400"}`}>
                        {q.answered ? "✓ Answered" : "Sent to the host"}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={ask} className="space-y-2 border-t border-slate-200 p-3">
                {qError && <p className="text-xs text-red-600">{qError}</p>}
                <div className="flex gap-2">
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Your question…"
                    maxLength={1000}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Ask
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
