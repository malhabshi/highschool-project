"use client";

import { useEffect, useRef, useState } from "react";

export type AudioSource = {
  key: string;
  stream: MediaStream | null;
  micOn: boolean;
};

const SPEAKING_LEVEL = 0.02; // RMS of the waveform; normal speech is ~0.03–0.2
const SAMPLE_EVERY_MS = 150;
const WINDOW = 10; // samples looked at (~1.5 s)
const MIN_TALKING = 4; // must be talking in ≥ 4 of them to take the spotlight

// Returns the key of whoever is speaking. Speech has little gaps between
// words, so "talking" means loud for a good part of the last ~1.5 s. It stays
// on the last speaker during pauses, and a cough or "mm-hmm" isn't enough to
// make the layout jump.
export function useActiveSpeaker(sources: AudioSource[]): string | null {
  const [speaker, setSpeaker] = useState<string | null>(null);
  const sourcesRef = useRef(sources);
  useEffect(() => {
    sourcesRef.current = sources;
  });

  // Rebuild the meters only when the set of audio tracks changes.
  const signature = sources
    .map((s) => `${s.key}:${s.stream?.getAudioTracks()[0]?.id ?? ""}`)
    .join("|");

  useEffect(() => {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const meters = new Map<string, AnalyserNode>();
    for (const s of sourcesRef.current) {
      const track = s.stream?.getAudioTracks()[0];
      if (!track) continue;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(new MediaStream([track])).connect(analyser);
      meters.set(s.key, analyser);
    }
    if (meters.size === 0) {
      ctx.close();
      return;
    }

    const samples = new Float32Array(512);
    const history = new Map<string, boolean[]>();
    let current: string | null = null;

    const timer = setInterval(() => {
      // Browsers may start audio suspended until the page has been clicked.
      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      const talking = new Map<string, number>();
      for (const [key, analyser] of meters) {
        let loud = false;
        if (sourcesRef.current.find((s) => s.key === key)?.micOn) {
          analyser.getFloatTimeDomainData(samples);
          let sum = 0;
          for (const v of samples) sum += v * v;
          loud = Math.sqrt(sum / samples.length) > SPEAKING_LEVEL;
        }
        const h = history.get(key) ?? [];
        h.push(loud);
        if (h.length > WINDOW) h.shift();
        history.set(key, h);
        talking.set(key, h.filter(Boolean).length);
      }

      let best = current;
      let bestCount = current ? (talking.get(current) ?? 0) : 0;
      for (const [key, count] of talking) {
        if (count >= MIN_TALKING && count > bestCount) {
          best = key;
          bestCount = count;
        }
      }
      if (best !== current) {
        current = best;
        setSpeaker(best);
      }
    }, SAMPLE_EVERY_MS);

    return () => {
      clearInterval(timer);
      ctx.close();
    };
  }, [signature]);

  return speaker;
}
