import { useState } from "react";
import { Car, KeyRound, LogIn, UserPlus } from "lucide-react";
import { supabase } from "./lib/supabase";

const PRODUCTION_APP_URL = "https://dealership-inventory-board.netlify.app";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const authenticate = async (mode) => {
    setBusy(true);
    setMessage("");
    const credentials = { email: email.trim().toLowerCase(), password };
    const { data, error } = mode === "signup"
      ? await supabase.auth.signUp({
        ...credentials,
        options: {
          emailRedirectTo: import.meta.env.PROD ? PRODUCTION_APP_URL : window.location.origin,
        },
      })
      : await supabase.auth.signInWithPassword(credentials);
    setBusy(false);
    if (error) setMessage(error.message);
    else if (mode === "signup") setMessage("Account created. The inventory owner must approve your BDC access before you can view vehicles.");
  };

  const requestPasswordReset = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setMessage("Enter your email first.");
      return;
    }
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: import.meta.env.PROD ? PRODUCTION_APP_URL : window.location.origin,
    });
    setBusy(false);
    setMessage(error ? error.message : "Password reset email sent. Open the link in that email to choose a new password.");
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 grid place-items-center p-5">
      <section className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-red-600"><Car className="h-6 w-6" /></div>
          <div><h1 className="font-extrabold tracking-tight">604SELLSCARS</h1><p className="text-xs text-neutral-500">Team inventory access</p></div>
        </div>
        <label htmlFor="auth-email" className="text-xs font-medium text-neutral-400">Email</label>
        <input id="auth-email" className="inp mb-4" type="email" autoComplete="email" value={email}
          onChange={(event) => setEmail(event.target.value)} placeholder="you@dealership.com" />
        <label htmlFor="auth-password" className="text-xs font-medium text-neutral-400">Password</label>
        <input id="auth-password" className="inp" type="password" autoComplete="current-password" value={password}
          onChange={(event) => setPassword(event.target.value)} placeholder="Your password" />
        {message && <p className="mt-3 rounded-lg bg-neutral-800 px-3 py-2 text-xs text-amber-200">{message}</p>}
        <button disabled={busy || !email || password.length < 6} onClick={() => authenticate("signin")}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-bold hover:bg-red-500 disabled:opacity-40">
          <LogIn className="h-4 w-4" /> {busy ? "Working…" : "Sign in"}
        </button>
        <button disabled={busy || !email || password.length < 6} onClick={() => authenticate("signup")}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-neutral-800 disabled:opacity-40">
          <UserPlus className="h-4 w-4" /> Request BDC access
        </button>
        <button disabled={busy} onClick={requestPasswordReset}
          className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-200 disabled:opacity-40">
          <KeyRound className="h-3.5 w-3.5" /> Forgot password?
        </button>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-neutral-500">Anyone with the link can request an account. New accounts cannot see inventory until the owner approves them.</p>
      </section>
    </main>
  );
}

export function PasswordUpdateScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const updatePassword = async () => {
    if (password.length < 8) {
      setMessage("Use at least 8 characters.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setMessage("Password updated.");
      onDone();
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 grid place-items-center p-5">
      <section className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
        <h1 className="text-lg font-bold">Choose a new password</h1>
        <p className="mt-1 text-xs text-neutral-500">Use at least 8 characters and avoid reused passwords.</p>
        <label htmlFor="new-password" className="mt-5 block text-xs font-medium text-neutral-400">New password</label>
        <input id="new-password" className="inp" type="password" autoComplete="new-password"
          value={password} onChange={(event) => setPassword(event.target.value)} />
        {message && <p className="mt-3 text-xs text-amber-200">{message}</p>}
        <button disabled={busy || password.length < 8} onClick={updatePassword}
          className="mt-5 w-full rounded-lg bg-red-600 py-2.5 text-sm font-bold hover:bg-red-500 disabled:opacity-40">
          {busy ? "Updating…" : "Update password"}
        </button>
      </section>
    </main>
  );
}
