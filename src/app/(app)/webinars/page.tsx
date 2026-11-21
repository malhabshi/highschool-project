import { WebinarsManager } from "@/components/webinars-manager";

export default function WebinarsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Webinars</h1>
        <p className="text-slate-500">Schedule live sessions that anyone with the link can watch</p>
      </div>

      <WebinarsManager />
    </div>
  );
}
