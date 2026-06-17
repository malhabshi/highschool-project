"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth";

// Redirects to /login when there is no active session.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { userId } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!userId) router.replace("/login");
  }, [userId, router]);

  if (!userId) return null;
  return <>{children}</>;
}
