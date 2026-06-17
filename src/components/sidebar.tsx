"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav";
import { useRole } from "@/components/role-context";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { role } = useRole();

  // Only show menu items this role is allowed to see.
  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-slate-900 text-slate-100">
      {/* Brand / logo */}
      <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-6">
        <span className="text-xl font-bold tracking-tight">Masar</span>
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
