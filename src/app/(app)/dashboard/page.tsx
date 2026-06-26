import { Announcements } from "@/components/announcements";
import { Events } from "@/components/events";
import { StatCards } from "@/components/stat-cards";
import { DashboardChat } from "@/components/dashboard-chat";

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

      {/* Employee chat with the admin (hidden for admins) */}
      <DashboardChat />
    </div>
  );
}
