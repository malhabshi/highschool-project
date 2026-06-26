"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/components/role-context";
import { uid } from "@/lib/uid";
import {
  playMessageSound,
  playStudentSound,
  primeAudio,
} from "@/lib/sound";

// Plays a chime on new chat messages (from someone else) and a different chime
// when students are added (bulk inserts are debounced into one chime).
export function NotificationSounds() {
  const { user } = useRole();
  const studentTimer = useRef<number | null>(null);
  // Skip sounds for the initial burst right after the page loads.
  const ready = useRef(false);

  // Unlock audio on the first user interaction.
  useEffect(() => {
    const prime = () => primeAudio();
    window.addEventListener("pointerdown", prime);
    window.addEventListener("keydown", prime);
    const t = window.setTimeout(() => {
      ready.current = true;
    }, 1500);
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
      window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`sounds-${uid()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          if (!ready.current) return;
          const m = payload.new as { sender_id?: string };
          if (m.sender_id && m.sender_id !== user.id) playMessageSound();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "students" },
        () => {
          if (!ready.current) return;
          if (studentTimer.current) window.clearTimeout(studentTimer.current);
          studentTimer.current = window.setTimeout(
            () => playStudentSound(),
            400
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  return null;
}
