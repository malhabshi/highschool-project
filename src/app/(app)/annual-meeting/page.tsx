import { AnnualMeeting } from "@/components/annual-meeting";

export default function AnnualMeetingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Annual Meeting</h1>
        <p className="text-slate-500">Plan and manage the annual meeting</p>
      </div>

      <AnnualMeeting />
    </div>
  );
}
