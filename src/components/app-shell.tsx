"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { RoleSwitcher } from "@/components/role-switcher";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile backdrop */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-hidden
        />
      )}

      {/* Sidebar: static on desktop, slide-in drawer on mobile */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transform transition-transform md:static md:z-auto md:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onNavigate={() => setMenuOpen(false)} />
      </div>

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-2">
            {/* Hamburger (mobile only) */}
            <button
              onClick={() => setMenuOpen(true)}
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
              aria-label="Open menu"
            >
              ☰
            </button>
            <RoleSwitcher />
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
            M
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
