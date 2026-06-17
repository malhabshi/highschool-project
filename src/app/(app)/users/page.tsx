import { UsersManager } from "@/components/users-manager";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Users</h1>
        <p className="text-slate-500">Manage staff accounts</p>
      </div>

      <UsersManager />
    </div>
  );
}
