"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { uid } from "@/lib/uid";

// Video rooms run peer-to-peer over WebRTC as a "mesh": participants connect
// directly to each other. Supabase Realtime only carries the small setup
// messages (signaling), who's in the room (presence), and room messages such
// as chat — the audio/video itself never passes through our servers.
//
// Members are either "on stage" (sending camera/mic) or watching. Two members
// are connected only if at least one of them is on stage, so in a webinar the
// audience doesn't connect to each other. In a plain video call everyone is
// on stage.
//
// Supabase rate-limits presence updates per client (and drops the client from
// the channel when exceeded), so presence is tracked once on join with just
// the fixed details. Things that change — mic, camera, stage, raised hand —
// go out as broadcast "state" messages, re-announced whenever someone joins.
//
// A mesh works well up to ~4–5 people on stage, or one presenter and ~10
// viewers. To go bigger, swap this hook for one backed by a self-hosted media
// server (e.g. LiveKit) that returns the same shape; the UI won't need to
// change.

export const MESH_COMFORT_LIMIT = 5;

export type Presence = {
  name: string;
  host: boolean; // webinar host/co-host (always false in plain calls)
  joinedAt: number;
  onStage: boolean;
  micOn: boolean;
  camOn: boolean;
  sharing: boolean;
  hand: boolean; // raised hand (webinars)
};

type Member = Pick<Presence, "name" | "host" | "joinedAt">;
type LiveState = Omit<Presence, keyof Member>;

const OFF_STAGE: LiveState = {
  onStage: false,
  micOn: false,
  camOn: false,
  sharing: false,
  hand: false,
};

export type Participant = Presence & {
  peerId: string;
  stream: MediaStream | null;
};

// App-level messages broadcast to the room (chat, invites, …). `to` targets a
// single peer; `from` is filled in automatically.
export type RoomMessage = { type: string; to?: string; from?: string } & Record<
  string,
  unknown
>;

type Signal =
  | { to: string; from: string; description: RTCSessionDescriptionInit }
  | { to: string; from: string; candidates: RTCIceCandidateInit[] };

type Peer = {
  pc: RTCPeerConnection;
  polite: boolean; // on an offer collision, the polite side backs off
  makingOffer: boolean;
  ignoreOffer: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  outbox: RTCIceCandidateInit[]; // our candidates, sent in small batches
  flushTimer: ReturnType<typeof setTimeout> | null;
  audioSender: RTCRtpSender | null;
  videoSender: RTCRtpSender | null;
  queue: Promise<void>; // processes this peer's signals one at a time
};

export type RoomActions = {
  toggleMic: () => void;
  toggleCam: () => void;
  toggleScreen: () => Promise<void>;
  goOnStage: () => Promise<void>;
  leaveStage: () => void;
  setHand: (up: boolean) => void;
  send: (msg: RoomMessage) => void;
};

// STUN lets each browser discover its public address. TURN relays media for
// users on strict networks (some offices/mobile carriers) — set the TURN env
// vars once you host a coturn server.
function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: process.env.NEXT_PUBLIC_STUN_URL || "stun:stun.l.google.com:19302" },
  ];
  const turn = process.env.NEXT_PUBLIC_TURN_URL;
  if (turn) {
    servers.push({
      urls: turn,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }
  return servers;
}

// supabase.channel(topic) hands back an existing channel with the same topic,
// even one that's still closing. Rejoining a room right after leaving it (or
// React's dev double-mount) waits for the old channel to finish closing.
const closingChannels = new Map<string, Promise<unknown>>();

function liveState(p: Presence): LiveState {
  return { onStage: p.onStage, micOn: p.micOn, camOn: p.camOn, sharing: p.sharing, hand: p.hand };
}

export function useMeshRoom({
  topic,
  name,
  host = false,
  startOnStage = true,
  onMessage,
}: {
  topic: string;
  name: string;
  host?: boolean;
  startOnStage?: boolean;
  onMessage?: (msg: RoomMessage, actions: RoomActions) => void;
}) {
  const [myId] = useState(() => uid());
  const [status, setStatus] = useState<"joining" | "joined" | "error">("joining");
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [members, setMembers] = useState<Record<string, Member>>({});
  const [liveStates, setLiveStates] = useState<Record<string, LiveState>>({});
  const [me, setMe] = useState<Presence>({ name, host, joinedAt: 0, ...OFF_STAGE });

  const stateRef = useRef(me);
  const actionsRef = useRef<RoomActions | null>(null);
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  useEffect(() => {
    let cancelled = false;
    let joined = false;
    const peers = new Map<string, Peer>();
    let others: Record<string, Member> = {};
    const states: Record<string, LiveState> = {};
    let knownPeers = new Set<string>();
    let local: MediaStream | null = null; // camera + mic
    let screen: MediaStreamTrack | null = null;
    let channel: RealtimeChannel | null = null;
    let announceTimer: ReturnType<typeof setTimeout> | null = null;

    function announceState() {
      channel?.send({
        type: "broadcast",
        event: "state",
        payload: { from: myId, ...liveState(stateRef.current) },
      });
    }

    function publish(patch: Partial<Presence>) {
      stateRef.current = { ...stateRef.current, ...patch };
      setMe(stateRef.current);
      if (joined) announceState();
    }

    function signal(msg: Signal) {
      channel?.send({ type: "broadcast", event: "signal", payload: msg });
    }

    // Starts sending our current mic + video (camera or screen) to a peer.
    function attachMedia(peer: Peer) {
      const audio = local?.getAudioTracks()[0];
      if (audio && !peer.audioSender) peer.audioSender = peer.pc.addTrack(audio, local!);
      const video = screen ?? local?.getVideoTracks()[0] ?? null;
      if (video && !peer.videoSender) {
        peer.videoSender = peer.pc.addTrack(video, local ?? new MediaStream());
      }
    }

    function detachMedia(peer: Peer) {
      for (const sender of [peer.audioSender, peer.videoSender]) {
        if (sender && peer.pc.signalingState !== "closed") peer.pc.removeTrack(sender);
      }
      peer.audioSender = null;
      peer.videoSender = null;
    }

    function getPeer(remoteId: string): Peer {
      const existing = peers.get(remoteId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      const peer: Peer = {
        pc,
        polite: myId < remoteId,
        makingOffer: false,
        ignoreOffer: false,
        pendingCandidates: [],
        outbox: [],
        flushTimer: null,
        audioSender: null,
        videoSender: null,
        queue: Promise.resolve(),
      };
      peers.set(remoteId, peer);

      // "Perfect negotiation": either side may (re)offer at any time; offer
      // collisions are resolved by the polite/impolite roles above.
      pc.onnegotiationneeded = async () => {
        try {
          peer.makingOffer = true;
          await pc.setLocalDescription();
          signal({ to: remoteId, from: myId, description: pc.localDescription!.toJSON() });
        } catch (e) {
          console.error("video room: offer failed", e);
        } finally {
          peer.makingOffer = false;
        }
      };
      // Candidates trickle in quickly; batch them to keep message counts low.
      pc.onicecandidate = ({ candidate }) => {
        if (!candidate) return;
        peer.outbox.push(candidate.toJSON());
        if (peer.flushTimer) return;
        peer.flushTimer = setTimeout(() => {
          peer.flushTimer = null;
          signal({ to: remoteId, from: myId, candidates: peer.outbox.splice(0) });
        }, 150);
      };
      pc.ontrack = ({ track, streams }) => {
        const tracks = streams[0]?.getTracks() ?? [track];
        // A fresh MediaStream object so the <video> element picks up new tracks.
        setRemoteStreams((prev) => ({ ...prev, [remoteId]: new MediaStream(tracks) }));
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") pc.restartIce();
      };

      if (stateRef.current.onStage) attachMedia(peer);
      return peer;
    }

    function dropPeer(remoteId: string) {
      const peer = peers.get(remoteId);
      if (peer?.flushTimer) clearTimeout(peer.flushTimer);
      peer?.pc.close();
      peers.delete(remoteId);
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[remoteId];
        return next;
      });
    }

    // Connect to everyone we need a link with; drop links nobody needs.
    function reconcile() {
      const mineOnStage = stateRef.current.onStage;
      for (const id of Object.keys(others)) {
        const theirs = states[id];
        if (mineOnStage || theirs?.onStage) getPeer(id);
        // Drop only once we know they're off stage — a presenter's offer can
        // arrive before their state does.
        else if (theirs && peers.has(id)) dropPeer(id);
      }
      // Only drop peers we've seen leave — a peer's offer can arrive
      // slightly before their presence does.
      for (const id of knownPeers) if (!others[id]) dropPeer(id);
      knownPeers = new Set(Object.keys(others));
    }

    async function addCandidates(peer: Peer, candidates: RTCIceCandidateInit[]) {
      for (const c of candidates) {
        try {
          await peer.pc.addIceCandidate(c);
        } catch (e) {
          if (!peer.ignoreOffer) console.warn("video room: bad candidate", e);
        }
      }
    }

    async function handleSignal(peer: Peer, msg: Signal) {
      const { pc } = peer;
      if ("description" in msg) {
        const desc = msg.description;
        const collision =
          desc.type === "offer" && (peer.makingOffer || pc.signalingState !== "stable");
        peer.ignoreOffer = !peer.polite && collision;
        if (peer.ignoreOffer) return;

        await pc.setRemoteDescription(desc);
        await addCandidates(peer, peer.pendingCandidates.splice(0));
        if (desc.type === "offer") {
          await pc.setLocalDescription();
          signal({ to: msg.from, from: myId, description: pc.localDescription!.toJSON() });
        }
      } else if (!pc.remoteDescription) {
        peer.pendingCandidates.push(...msg.candidates);
      } else {
        await addCandidates(peer, msg.candidates);
      }
    }

    function onSignal(msg: Signal) {
      if (msg.to !== myId) return;
      // Only an offer may open a new connection; stray candidates are ignored.
      if (!peers.has(msg.from) && !("description" in msg && msg.description.type === "offer")) {
        return;
      }
      const peer = getPeer(msg.from);
      peer.queue = peer.queue
        .then(() => handleSignal(peer, msg))
        .catch((e) => console.error("video room: signaling error", e));
    }

    async function acquireMedia(): Promise<MediaStream | null> {
      setMediaError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaError("Camera and microphone need a secure (https) connection.");
        return null;
      }
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: { width: { ideal: 640 }, height: { ideal: 360 } },
        });
      } catch {
        // fall through to audio only
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMediaError("No camera available — you're on audio only.");
        return stream;
      } catch {
        setMediaError("Couldn't access your camera or microphone. Check your browser permissions.");
        return null;
      }
    }

    // Sends `track` as our video to everyone (camera, screen, or nothing).
    function setOutgoingVideo(track: MediaStreamTrack | null) {
      for (const peer of peers.values()) {
        if (peer.videoSender) {
          peer.videoSender.replaceTrack(track);
        } else if (track) {
          peer.videoSender = peer.pc.addTrack(track, local ?? new MediaStream());
        }
      }
    }

    function stopScreen() {
      if (!screen) return;
      screen.stop();
      screen = null;
      setScreenStream(null);
      setOutgoingVideo(local?.getVideoTracks()[0] ?? null);
      publish({ sharing: false });
    }

    function mediaState(stream: MediaStream | null) {
      return {
        micOn: !!stream?.getAudioTracks().length,
        camOn: !!stream?.getVideoTracks().length,
      };
    }

    const actions: RoomActions = {
      toggleMic() {
        const track = local?.getAudioTracks()[0];
        if (!track) return;
        track.enabled = !track.enabled;
        publish({ micOn: track.enabled });
      },
      toggleCam() {
        const track = local?.getVideoTracks()[0];
        if (!track) return;
        track.enabled = !track.enabled;
        publish({ camOn: track.enabled });
      },
      async toggleScreen() {
        if (screen) {
          stopScreen();
          return;
        }
        let display: MediaStream;
        try {
          display = await navigator.mediaDevices.getDisplayMedia({ video: true });
        } catch {
          return; // user cancelled the picker
        }
        const track = display.getVideoTracks()[0];
        track.onended = stopScreen; // "Stop sharing" from the browser's own bar
        screen = track;
        setScreenStream(display);
        setOutgoingVideo(track);
        publish({ sharing: true });
      },
      async goOnStage() {
        if (stateRef.current.onStage) return;
        const stream = await acquireMedia();
        if (cancelled) {
          stream?.getTracks().forEach((t) => t.stop());
          return;
        }
        local = stream;
        setLocalStream(stream);
        publish({ onStage: true, hand: false, ...mediaState(stream) });
        for (const peer of peers.values()) attachMedia(peer);
        reconcile();
      },
      leaveStage() {
        if (!stateRef.current.onStage) return;
        stopScreen();
        for (const peer of peers.values()) detachMedia(peer);
        local?.getTracks().forEach((t) => t.stop());
        local = null;
        setLocalStream(null);
        setMediaError(null);
        publish({ onStage: false, micOn: false, camOn: false });
        reconcile();
      },
      setHand(up) {
        publish({ hand: up });
      },
      send(msg) {
        channel?.send({ type: "broadcast", event: "app", payload: { ...msg, from: myId } });
      },
    };
    actionsRef.current = actions;

    async function start() {
      if (startOnStage) {
        local = await acquireMedia();
        if (cancelled) {
          local?.getTracks().forEach((t) => t.stop());
          return;
        }
        setLocalStream(local);
        stateRef.current = { ...stateRef.current, onStage: true, ...mediaState(local) };
      }
      stateRef.current = { ...stateRef.current, joinedAt: Date.now() };
      setMe(stateRef.current);

      await closingChannels.get(topic);
      if (cancelled) return;
      const ch = supabase.channel(topic, {
        config: { broadcast: { self: false }, presence: { key: myId } },
      });
      channel = ch;

      ch.on("broadcast", { event: "signal" }, ({ payload }) => onSignal(payload as Signal))
        .on("broadcast", { event: "state" }, ({ payload }) => {
          const { from, ...state } = payload as LiveState & { from: string };
          states[from] = state;
          setLiveStates({ ...states });
          reconcile();
        })
        .on("broadcast", { event: "app" }, ({ payload }) => {
          const msg = payload as RoomMessage;
          if (!msg.to || msg.to === myId) onMessageRef.current?.(msg, actions);
        })
        .on("presence", { event: "sync" }, () => {
          const state = ch.presenceState<Member>();
          const next: Record<string, Member> = {};
          for (const [key, metas] of Object.entries(state)) {
            if (key !== myId && metas.length) {
              const m = metas[metas.length - 1];
              next[key] = { name: m.name, host: m.host, joinedAt: m.joinedAt };
            }
          }
          // Someone new: tell them our current mic/camera/stage state (once,
          // even if several people arrive together).
          if (Object.keys(next).some((id) => !others[id]) && !announceTimer) {
            announceTimer = setTimeout(() => {
              announceTimer = null;
              announceState();
            }, 300);
          }
          for (const id of Object.keys(states)) if (!next[id]) delete states[id];
          others = next;
          setMembers(next);
          setLiveStates({ ...states });
          reconcile();
        })
        .subscribe(async (s) => {
          if (cancelled) return;
          if (s === "SUBSCRIBED") {
            const { name, host, joinedAt } = stateRef.current;
            await ch.track({ name, host, joinedAt });
            joined = true;
            announceState();
            setStatus("joined");
          } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
            setStatus("error");
          }
        });
    }

    start();

    return () => {
      cancelled = true;
      actionsRef.current = null;
      if (announceTimer) clearTimeout(announceTimer);
      for (const peer of peers.values()) {
        if (peer.flushTimer) clearTimeout(peer.flushTimer);
        peer.pc.close();
      }
      peers.clear();
      if (channel) {
        const closing = supabase.removeChannel(channel);
        closingChannels.set(topic, closing);
        closing.finally(() => {
          if (closingChannels.get(topic) === closing) closingChannels.delete(topic);
        });
      }
      channel = null;
      local?.getTracks().forEach((t) => t.stop());
      screen?.stop();
    };
  }, [topic, myId, startOnStage]);

  const participants: Participant[] = Object.entries(members)
    .map(([peerId, m]) => ({
      ...m,
      ...(liveStates[peerId] ?? OFF_STAGE),
      peerId,
      stream: remoteStreams[peerId] ?? null,
    }))
    .sort((a, b) => a.joinedAt - b.joinedAt);

  return {
    myId,
    status,
    mediaError,
    me,
    localStream: screenStream ?? localStream,
    hasMic: !!localStream?.getAudioTracks().length,
    hasCam: !!localStream?.getVideoTracks().length,
    micOn: me.micOn,
    camOn: me.camOn,
    sharing: me.sharing,
    participants,
    toggleMic: () => actionsRef.current?.toggleMic(),
    toggleCam: () => actionsRef.current?.toggleCam(),
    toggleScreen: () => actionsRef.current?.toggleScreen(),
    goOnStage: () => actionsRef.current?.goOnStage(),
    leaveStage: () => actionsRef.current?.leaveStage(),
    setHand: (up: boolean) => actionsRef.current?.setHand(up),
    send: (msg: RoomMessage) => actionsRef.current?.send(msg),
  };
}

// A plain video call: everyone is on stage.
export function useVideoCall(roomId: string, name: string) {
  return useMeshRoom({ topic: `video-${roomId}`, name });
}
