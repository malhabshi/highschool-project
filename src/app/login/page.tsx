"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { login, useSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { userId } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Already logged in → go to the app.
  useEffect(() => {
    if (userId) router.replace("/dashboard");
  }, [userId, router]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (login(email, password)) {
      router.replace("/dashboard");
    } else {
      setError("Wrong email or password.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">Masar</h1>
          <p className="text-sm text-slate-500">Sign in to your account</p>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            Email address
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@masar.com"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
