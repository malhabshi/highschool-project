import { LuckyDraw } from "@/components/lucky-draw";

export default function DrawPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Lucky Draw</h1>
        <p className="text-slate-500">
          Pick a random winner from the Annual Meeting attendees
        </p>
      </div>

      <LuckyDraw />
    </div>
  );
}
