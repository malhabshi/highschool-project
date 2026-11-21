"use client";

import { useState } from "react";
import Link from "next/link";
import { useRole } from "@/components/role-context";
import { StatusBadge } from "@/components/webinar-shared";
import {
  createWebinar,
  deleteWebinar,
  formatWebinarTime,
  publicWebinarUrl,
  useMyLiveWebinars,
  useWebinars,
  type Webinar,
} from "@/lib/webinars";

export function WebinarsManager() {
  const { user, role } = useRole();
  const { webinars, counts, loaded, refetch } = useWebinars();
  const hosting = useMyLiveWebinars(user.id);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [when, setWhen] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !when) {
      setError("Please add a title and a date & time.");
      return;
    }
    setSaving(true);
    setError(null);
    const err = await createWebinar({
      title,
      description,
      scheduledAt: new Date(when).toISOString(),
      hostId: user.id,
    });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setTitle("");
    setDescription("");
    setWhen("");
    refetch();
  }

  const upcoming = webinars
    .filter((w) => w.status !== "ended")
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const past = webinars.filter((w) => w.status === "ended");

  return (
    <div className="space-y-6">
      {hosting.map((w) => (
        <div
          key={w.id}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4"
        >
          <span className="flex-1 text-sm text-red-800">
            🔴 You&apos;re the host of <strong>{w.title}</strong> — it&apos;s live now.
          </span>
          <Link
            href={`/webinars/${w.id}`}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Join as host
          </Link>
        </div>
      ))}

      <form onSubmit={create} className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-800">Schedule a webinar</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title, e.g. Studying in the UK — Q&A"
            maxLength={150}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's it about? (shown on the public registration page)"
          rows={2}
          maxLength={1000}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Create webinar"}
        </button>
      </form>

      <WebinarList
        title="Upcoming & live"
        webinars={upcoming}
        counts={counts}
        canDelete={(w) => role === "admin" || w.hostId === user.id}
        empty={loaded ? "No upcoming webinars." : "Loading…"}
        onDeleted={refetch}
      />
      {past.length > 0 && (
        <WebinarList
          title="Past"
          webinars={past}
          counts={counts}
          canDelete={(w) => role === "admin" || w.hostId === user.id}
          empty=""
          onDeleted={refetch}
        />
      )}
    </div>
  );
}

function WebinarList({
  title,
  webinars,
  counts,
  canDelete,
  empty,
  onDeleted,
}: {
  title: string;
  webinars: Webinar[];
  counts: Record<string, number>;
  canDelete: (w: Webinar) => boolean;
  empty: string;
  onDeleted: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(w: Webinar) {
    const url = publicWebinarUrl(w.code);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(w.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("Copy this webinar link:", url);
    }
  }

  async function remove(w: Webinar) {
    if (!window.confirm(`Delete "${w.title}"? Its registrations and questions will be deleted too.`)) {
      return;
    }
    await deleteWebinar(w.id);
    onDeleted();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <h2 className="border-b border-slate-200 px-6 py-4 text-lg font-semibold text-slate-800">
        {title}
      </h2>
      {webinars.length === 0 ? (
        <p className="px-6 py-6 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {webinars.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center gap-3 px-6 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-800">{w.title}</span>
                  <StatusBadge status={w.status} />
                </div>
                <p className="text-sm text-slate-500">
                  {formatWebinarTime(w.scheduledAt)}
                  {w.hostName && ` · Host: ${w.hostName}`} · {counts[w.id] ?? 0} registered
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {w.status !== "ended" && (
                  <button
                    onClick={() => copy(w)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {copied === w.id ? "✓ Copied" : "🔗 Copy link"}
                  </button>
                )}
                <Link
                  href={`/webinars/${w.id}`}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  {w.status === "ended" ? "View" : "Open studio"}
                </Link>
                {canDelete(w) && (
                  <button
                    onClick={() => remove(w)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
