import { DrawSettingsPanel } from "@/components/draw-settings";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500">Lucky Draw filters (saved automatically)</p>
      </div>

      <DrawSettingsPanel />
    </div>
  );
}
