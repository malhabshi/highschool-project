"use client";

import { useState } from "react";
import { useRole } from "@/components/role-context";
import { useUsers, type User } from "@/lib/users";
import type { Role } from "@/lib/nav";

export function UsersManager() {
  const { role } = useRole();
  const { users, addUser, updateUser, removeUser } = useUsers();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  // Only admins manage users.
  if (role !== "admin") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-red-700 shadow-sm">
        You don&apos;t have access to this page.
      </div>
    );
  }

  function openAdd() {
    setEditing(null);
    setShowForm(true);
  }
  function openEdit(u: User) {
    setEditing(u);
    setShowForm(true);
  }

  function resetPassword(u: User) {
    const pw = prompt(`Set a new password for ${u.name}:`);
    if (pw && pw.trim()) {
      updateUser(u.id, { password: pw.trim() });
      alert(`Password updated for ${u.name}.`);
    }
  }

  function deleteUser(u: User) {
    const admins = users.filter((x) => x.role === "admin");
    if (u.role === "admin" && admins.length <= 1) {
      alert("You can't delete the only admin.");
      return;
    }
    if (confirm(`Delete user ${u.name}?`)) removeUser(u.id);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-800">Users</h2>
        <button
          onClick={openAdd}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          + Add user
        </button>
      </div>

      {showForm && (
        <UserForm
          key={editing?.id ?? "new"}
          initial={editing}
          onCancel={() => setShowForm(false)}
          onSubmit={(data) => {
            if (editing) updateUser(editing.id, data);
            else addUser(data);
            setShowForm(false);
          }}
        />
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Phone</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
              >
                <td className="px-5 py-3 font-medium text-slate-800">
                  {u.name}
                </td>
                <td className="px-5 py-3 text-slate-600">{u.email}</td>
                <td className="px-5 py-3 text-slate-600">{u.phone}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.role === "admin"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {u.role === "admin" ? "Admin" : "Employee"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      onClick={() => openEdit(u)}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => resetPassword(u)}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Reset password
                    </button>
                    <button
                      onClick={() => deleteUser(u)}
                      className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-600 hover:text-white"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: User | null;
  onSubmit: (data: Omit<User, "id">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [roleVal, setRoleVal] = useState<Role>(initial?.role ?? "employee");
  const [password, setPassword] = useState(initial?.password ?? "");
  const [error, setError] = useState("");

  function submit() {
    if (!name.trim()) return setError("Name is required.");
    if (!/^\d{8}$/.test(phone)) return setError("Phone must be exactly 8 digits.");
    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (!password.trim()) return setError("Password is required.");
    onSubmit({
      name: name.trim(),
      phone,
      email: email.trim(),
      role: roleVal,
      password: password.trim(),
    });
  }

  return (
    <div className="space-y-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
      <h3 className="font-semibold text-slate-800">
        {initial ? "Edit user" : "Add a user"}
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </Field>
        <Field label="Phone number (8 digits)">
          <input
            value={phone}
            inputMode="numeric"
            maxLength={8}
            onChange={(e) =>
              setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </Field>
        <Field label="Email address">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </Field>
        <Field label="Type of user">
          <select
            value={roleVal}
            onChange={(e) => setRoleVal(e.target.value as Role)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <Field label="Password">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </Field>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          {initial ? "Save changes" : "Add user"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}
