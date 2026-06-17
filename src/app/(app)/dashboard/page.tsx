import { Announcements } from "@/components/announcements";
import { Events } from "@/components/events";
import { StatCards } from "@/components/stat-cards";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Welcome to Masar</h2>
        <p className="text-slate-500">Student consultancy dashboard</p>
      </div>

      {/* Announcements */}
      <Announcements />

      {/* Upcoming events */}
      <Events />

      {/* Stat cards (Staff Users only shows for admin) */}
      <StatCards />

      {/* Placeholder panel */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-slate-800">Recent activity</h3>
        <p className="mt-2 text-sm text-slate-500">
          Nothing here yet. We&apos;ll fill this in as we add students.
        </p>
      </div>
    </div>
  );
}
