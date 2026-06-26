import { AdminMessages } from "@/components/admin-messages";

export default function MessagesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Messages</h1>
        <p className="text-slate-500">Chat with your employees</p>
      </div>

      <AdminMessages />
    </div>
  );
}
