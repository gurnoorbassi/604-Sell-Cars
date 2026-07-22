import { useState } from "react";
import { Car, LogIn, UserPlus } from "lucide-react";
import { supabase } from "./lib/supabase";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const authenticate = async (mode) => {
    setBusy(true);
    setMessage("");
    const credentials = { email: email.trim().toLowerCase(), password };
    const { error } = mode === "signup"
      ? await supabase.auth.signUp({
        ...credentials,
        options: { emailRedirectTo: window.location.origin },
      })
      : await supabase.auth.signInWithPassword(credentials);
    setBusy(false);
    if (error) setMessage(error.message);
    else if (mode === "signup") setMessage("Check your email to confirm the account, then sign in.");
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 grid place-items-center p-5">
      <section className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-red-600"><Car className="h-6 w-6" /></div>
          <div><h1 className="font-extrabold tracking-tight">604SELLSCARS</h1><p className="text-xs text-neutral-500">Team inventory access</p></div>
        </div>
        <label className="text-xs font-medium text-neutral-400">Email</label>
        <input className="inp mb-4" type="email" autoComplete="email" value={email}
          onChange={(event) => setEmail(event.target.value)} placeholder="you@dealership.com" />
        <label className="text-xs font-medium text-neutral-400">Password</label>
        <input className="inp" type="password" autoComplete="current-password" value={password}
          onChange={(event) => setPassword(event.target.value)} placeholder="Your password" />
        {message && <p className="mt-3 rounded-lg bg-neutral-800 px-3 py-2 text-xs text-amber-200">{message}</p>}
        <button disabled={busy || !email || password.length < 6} onClick={() => authenticate("signin")}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-bold hover:bg-red-500 disabled:opacity-40">
          <LogIn className="h-4 w-4" /> {busy ? "Working…" : "Sign in"}
        </button>
        <button disabled={busy || !email || password.length < 6} onClick={() => authenticate("signup")}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-neutral-800 disabled:opacity-40">
          <UserPlus className="h-4 w-4" /> Create approved account
        </button>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-neutral-500">Only pre-approved team emails can access inventory after signing in.</p>
      </section>
    </main>
  );
}
