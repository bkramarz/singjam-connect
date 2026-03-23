"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function AuthPanel() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signedUp, setSignedUp] = useState(false);

  async function signInWithPassword() {
    setBusy(true);
    setStatus(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setBusy(false);

    if (error) {
      setStatus(error.message);
    } else {
      router.push("/repertoire");
    }
  }

  async function signUp() {
    if (password !== confirmPassword) {
      setStatus("Passwords do not match.");
      return;
    }
    setBusy(true);
    setStatus(null);

    const { error } = await supabase.auth.signUp({ email, password });

    setBusy(false);

    if (error) {
      setStatus(error.message);
    } else {
      setSignedUp(true);
    }
  }

  async function sendResetEmail() {
    if (!email) return;
    setBusy(true);
    setStatus(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });
    setBusy(false);
    if (error) {
      setStatus(error.message);
    } else {
      setStatus(`Password reset link sent to ${email}.`);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setStatus(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus(error.message);
      setBusy(false);
    }
  }

  if (mode === "forgot") {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-semibold text-slate-900">Reset your password</h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter your email and we'll send you a reset link.{" "}
          <button onClick={() => { setMode("signin"); setStatus(null); }} className="text-amber-600 hover:underline">
            Back to sign in
          </button>
        </p>
        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
            />
          </div>
          <button
            onClick={sendResetEmail}
            disabled={!email || busy}
            className="w-full rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {busy ? "Sending…" : "Send reset link"}
          </button>
          {status && (
            <div className={`rounded-lg px-4 py-3 text-sm ring-1 ${status.includes("sent") ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-red-50 text-red-600 ring-red-100"}`}>
              {status}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (signedUp) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-semibold text-slate-900">Check your email</h2>
        <p className="mt-2 text-sm text-slate-500">
          We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then come back to sign in.
        </p>
        <button
          onClick={() => { setMode("signin"); setSignedUp(false); }}
          className="mt-4 text-sm text-amber-600 hover:underline"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-xl font-semibold text-slate-900">
        {mode === "signin" ? "Welcome back" : "Create an account"}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        {mode === "signin" ? (
          <>No account? <button onClick={() => { setMode("signup"); setStatus(null); }} className="text-amber-600 hover:underline">Create one</button></>
        ) : (
          <>Already have an account? <button onClick={() => { setMode("signin"); setStatus(null); }} className="text-amber-600 hover:underline">Sign in</button></>
        )}
      </p>

      <div className="mt-6 space-y-4">
        <button
          onClick={signInWithGoogle}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {busy ? "Redirecting..." : "Continue with Google"}
        </button>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          or
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Email</label>
          <input
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">Password</label>
            {mode === "signin" && (
              <button
                type="button"
                onClick={() => { setMode("forgot"); setStatus(null); }}
                className="text-xs text-amber-600 hover:underline"
              >
                Forgot password?
              </button>
            )}
          </div>
          <input
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="••••••••"
          />
        </div>

        {mode === "signup" && (
          <div>
            <label className="text-sm font-medium text-slate-700">Confirm password</label>
            <input
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
            />
          </div>
        )}

        <button
          onClick={mode === "signin" ? signInWithPassword : signUp}
          disabled={!email || !password || (mode === "signup" && !confirmPassword) || busy}
          className="w-full rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50 transition-colors"
        >
          {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
        </button>

        {status && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
