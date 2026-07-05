"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Role } from "@/lib/nav";
import { useSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export type Profile = {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: Role;
};

type RoleContextValue = {
  user: Profile; // the logged-in account (guaranteed inside the app shell)
  role: Role;
};

const RoleContext = createContext<RoleContextValue | null>(null);

// Loads the logged-in user's profile from Supabase. While it loads, shows a
// small loading screen so children can always assume a valid `user`.
export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { userId, loaded } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setProfileLoaded(loaded);
      return;
    }
    let active = true;
    setProfileLoaded(false);
    setFailed(false);

    async function load() {
      for (let attempt = 0; attempt < 4 && active; attempt++) {
        try {
          // Race the request against an 8s timeout so a stalled connection
          // doesn't leave the whole app stuck on "Loading…".
          const req = supabase
            .from("profiles")
            .select("id, name, phone, email, role")
            .eq("id", userId)
            .single();
          const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 8000)
          );
          const { data } = (await Promise.race([req, timeout])) as {
            data: Profile | null;
          };
          if (!active) return;
          setProfile(data ?? null);
          setProfileLoaded(true);
          return;
        } catch {
          if (!active) return;
          await new Promise((r) => setTimeout(r, 1200)); // brief backoff, retry
        }
      }
      if (active) setFailed(true);
    }
    load();

    return () => {
      active = false;
    };
  }, [userId, loaded]);

  if (failed) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-slate-700">
          Couldn&apos;t reach the server. Please check your connection.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Reload
        </button>
      </div>
    );
  }

  if (!profileLoaded) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-slate-700">
          Your account has no profile yet. Ask an admin to set it up.
        </p>
      </div>
    );
  }

  return (
    <RoleContext.Provider value={{ user: profile, role: profile.role }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return ctx;
}
