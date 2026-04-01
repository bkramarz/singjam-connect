"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

type UserResult = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export default function JamInvitePanel({ jamId }: { jamId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [emailInput, setEmailInput] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) setResults(await res.json());
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [query]);

  async function inviteUser(userId: string) {
    setInviting(userId);
    setFeedback(null);
    const res = await fetch(`/api/jam/${jamId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteeUserId: userId }),
    });
    const body = await res.json();
    if (res.ok) {
      setSent((prev) => new Set([...prev, userId]));
      setFeedback({ id: userId, msg: "Invite sent!", ok: true });
    } else {
      setFeedback({ id: userId, msg: body.error ?? "Failed to send invite", ok: false });
    }
    setInviting(null);
  }

  async function inviteEmail() {
    const email = emailInput.trim();
    if (!email) return;
    setEmailBusy(true);
    setFeedback(null);
    const res = await fetch(`/api/jam/${jamId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteeEmail: email }),
    });
    const body = await res.json();
    if (res.ok && body.existingMemberId) {
      // Email belongs to an existing member — invite by user ID
      await inviteUser(body.existingMemberId);
      setEmailInput("");
    } else if (res.ok) {
      setFeedback({ id: "email", msg: `Invite sent to ${email}`, ok: true });
      setEmailInput("");
    } else {
      setFeedback({ id: "email", msg: body.error ?? "Failed to send invite", ok: false });
    }
    setEmailBusy(false);
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
      <h2 className="text-base font-semibold">Invite people</h2>

      {/* Member search */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Search by name or username</label>
        <input
          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          placeholder="e.g. Sarah, @sarahsings"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {searching && <p className="mt-1.5 text-xs text-zinc-400">Searching…</p>}
        {results.length > 0 && (
          <ul className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200 overflow-hidden">
            {results.map((u) => {
              const name = u.display_name ?? u.username ?? "Unknown";
              const initial = name[0].toUpperCase();
              const isSent = sent.has(u.id);
              return (
                <li key={u.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-zinc-200">
                    {u.avatar_url ? (
                      <Image src={u.avatar_url} alt={name} fill className="object-cover" unoptimized />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs font-medium text-zinc-500">
                        {initial}
                      </span>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{name}</p>
                    {u.username && <p className="text-xs text-zinc-400">@{u.username}</p>}
                  </div>
                  <button
                    onClick={() => inviteUser(u.id)}
                    disabled={isSent || inviting === u.id}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      isSent
                        ? "bg-green-100 text-green-700 cursor-default"
                        : "bg-amber-500 text-white hover:bg-amber-400 disabled:opacity-50"
                    }`}
                  >
                    {isSent ? "Sent" : inviting === u.id ? "Sending…" : "Invite"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {feedback && feedback.id !== "email" && (
          <p className={`mt-1.5 text-xs ${feedback.ok ? "text-green-600" : "text-red-600"}`}>
            {feedback.msg}
          </p>
        )}
      </div>

      {/* Email invite */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Invite by email</label>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            type="email"
            placeholder="friend@example.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") inviteEmail(); }}
          />
          <button
            onClick={inviteEmail}
            disabled={emailBusy || !emailInput.trim()}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            {emailBusy ? "Sending…" : "Send"}
          </button>
        </div>
        {feedback && feedback.id === "email" && (
          <p className={`mt-1.5 text-xs ${feedback.ok ? "text-green-600" : "text-red-600"}`}>
            {feedback.msg}
          </p>
        )}
      </div>
    </div>
  );
}
