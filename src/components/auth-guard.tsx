"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth";

// Redirects to /login when there is no active Supabase session.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { userId, loaded } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loaded && !userId) router.replace("/login");
  }, [loaded, userId, router]);

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }
  if (!userId) return null;
  return <>{children}</>;
}
