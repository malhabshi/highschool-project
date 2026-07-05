"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/components/role-context";
import { uid } from "@/lib/uid";
import type { Role } from "@/lib/nav";

// Uses lightweight COUNT queries (no row payloads) so the dashboard loads fast.
export function StatCards() {
  const { user, role } = useRole();
  const isAdmin = role === "admin";
  const [totalStudents, setTotalStudents] = useState<number | null>(null);
  const [sentToMasar, setSentToMasar] = useState<number | null>(null);
  const [staffUsers, setStaffUsers] = useState<number | null>(null);

  const refetch = useCallback(async () => {
    let totalQ = supabase
      .from("students")
      .select("*", { count: "exact", head: true });
    let sentQ = supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .not("sent_to_masar_at", "is", null);
    if (!isAdmin) {
      totalQ = totalQ.eq("assigned_to", user.id);
      sentQ = sentQ.eq("assigned_to", user.id);
    }

    const [total, sent, staff] = await Promise.all([
      totalQ,
      sentQ,
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "employee"),
    ]);

    setTotalStudents(total.count ?? 0);
    setSentToMasar(sent.count ?? 0);
    setStaffUsers(staff.count ?? 0);
  }, [isAdmin, user.id]);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel(`stats-${uid()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students" },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const stats: { label: string; value: number | null; icon: string; roles: Role[] }[] =
    [
      {
        label: "Total Students",
        value: totalStudents,
        icon: "🎓",
        roles: ["admin", "employee"],
      },
      {
        label: "Sent to Masar",
        value: sentToMasar,
        icon: "📤",
        roles: ["admin", "employee"],
      },
      { label: "Staff Users", value: staffUsers, icon: "👥", roles: ["admin"] },
    ];

  const visible = stats.filter((s) => s.roles.includes(role));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xl">{s.icon}</span>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-800">
            {s.value === null ? "…" : s.value}
          </p>
          <p className="text-sm text-slate-500">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
