"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav";
import { useRole } from "@/components/role-context";
import { useUnreadCounts } from "@/lib/messages";
import { useMyLiveWebinars } from "@/lib/webinars";
import { BrandLogo } from "@/components/brand-logo";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { role, user } = useRole();
  const { total: unread } = useUnreadCounts();
  // A live webinar I'm the host of (e.g. a colleague just handed it to me).
  const hostingLive = useMyLiveWebinars(user.id).length > 0;

  // Only show menu items this role is allowed to see.
  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  // Where the unread-message badge lives: Messages for admin, Dashboard
  // (which holds the chat box) for employees.
  const badgeHref = role === "admin" ? "/messages" : "/dashboard";

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-slate-900 text-slate-100">
      {/* Brand / logo */}
      <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-6">
        <BrandLogo />
      </div>

      {/* Menu */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
              {item.href === "/webinars" && hostingLive && (
                <span className="ml-auto animate-pulse rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                  LIVE
                </span>
              )}
              {item.href === badgeHref && unread > 0 && (
                <span className="ml-auto rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                  {unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 px-6 py-4 text-xs text-slate-400">
        Masar Consultancy
      </div>
    </aside>
  );
}
