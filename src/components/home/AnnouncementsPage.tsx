"use client";

// Full announcements list, plus an admin-only create form. Read is admin +
// staff (RLS: "announcements — staff read"); write is admin-only (RLS:
// "announcements — admin all") — the form itself is also gated on
// account.role === "admin" so staff never sees a control they'd be rejected
// for using, but RLS is the real boundary either way.

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSession } from "@/lib/session";
import { fetchAnnouncements, createAnnouncement, type Announcement } from "@/lib/supabase/home";
import HomeShell, { HomePanel } from "@/components/home/HomeShell";
import { formatDate } from "@/lib/format";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; announcements: Announcement[] };

export default function AnnouncementsPage() {
  const account = useSession((s) => s.account);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  function showToast(msg: string) {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  function load() {
    let cancelled = false;
    setState({ status: "loading" });
    fetchAnnouncements()
      .then((announcements) => {
        if (!cancelled) setState({ status: "ready", announcements });
      })
      .catch((e) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: e instanceof Error ? e.message : "Something went wrong loading announcements.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }

  useEffect(() => load(), []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!account || posting || !title.trim() || !body.trim()) return;
    setPosting(true);
    try {
      await createAnnouncement(title.trim(), body.trim(), account.id);
      setTitle("");
      setBody("");
      load();
    } catch (err) {
      showToast(err instanceof Error ? `Couldn't post: ${err.message}` : "Couldn't post the announcement.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <HomeShell eyebrow="AGV Home" title="Announcements">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-start">
        {account?.role === "admin" && (
          <HomePanel title="Post an announcement">
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="rounded-lg border border-ash/20 bg-void/40 px-3 py-2 text-sm text-bone placeholder:text-ash focus:border-signal focus:outline-none"
              />
              <textarea
                required
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What's happening?"
                className="rounded-lg border border-ash/20 bg-void/40 px-3 py-2 text-sm text-bone placeholder:text-ash focus:border-signal focus:outline-none"
              />
              <button
                type="submit"
                disabled={posting}
                className="self-start rounded-full bg-signal px-5 py-2 text-sm font-semibold text-void transition hover:brightness-110 disabled:opacity-50"
              >
                {posting ? "Posting…" : "Post announcement"}
              </button>
            </form>
          </HomePanel>
        )}

        <HomePanel title="All announcements">
          {state.status === "loading" ? (
            <p className="text-sm text-ash">Loading…</p>
          ) : state.status === "error" ? (
            <p className="text-sm text-ash">{state.message}</p>
          ) : state.announcements.length === 0 ? (
            <p className="text-sm text-ash">No announcements yet.</p>
          ) : (
            <ul className="flex flex-col gap-5">
              {state.announcements.map((a) => (
                <li key={a.id} className="border-b border-ash/20 pb-5 last:border-b-0 last:pb-0">
                  <p className="font-display text-base font-bold text-bone">{a.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ash">{a.body}</p>
                  <p className="mt-2 text-label uppercase tracking-[0.1em] text-ash">
                    {a.createdByName} · {formatDate(a.createdAt.slice(0, 10))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </HomePanel>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {toast && (
          <div
            role="alert"
            className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-ash/20 bg-pine px-5 py-2.5 shadow-[var(--shadow-pop)]"
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-signal" />
            <span className="text-xs text-bone">{toast}</span>
          </div>
        )}
      </div>
    </HomeShell>
  );
}
