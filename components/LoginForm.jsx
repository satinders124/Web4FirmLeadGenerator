"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "../lib/supabase-browser";
import { Icon } from "./Icons";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  async function submit(event) {
    event.preventDefault();
    if (!configured) {
      setStatus("Supabase Auth is not configured yet. Add the public Supabase URL and anon key in Vercel.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      router.refresh();
      router.replace(searchParams.get("next") || "/");
    } catch (loginError) {
      setStatus(loginError.message || "Unable to sign in.");
      setLoading(false);
    }
  }

  return <main className="login-page"><section className="login-panel"><div className="login-brand"><span><Icon name="spark" size={25} /></span><div><strong>Web4Firm</strong><small>Lead intelligence workspace</small></div></div><p className="login-eyebrow">Secure team access</p><h1>Sign in to your<br /><em>lead workspace.</em></h1><p className="login-copy">Use your individual Web4Firm account. Lead, proposal and outreach information is protected behind this sign-in.</p><form onSubmit={submit}><label>Work email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@web4firm.com" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Your password" required /></label><button type="submit" disabled={loading}><Icon name="spark" size={17} /> {loading ? "Signing in…" : "Sign in securely"}</button>{status && <p className="login-status"><Icon name="info" size={15} /> {status}</p>}</form><p className="login-note"><Icon name="shield" size={14} /> Individual accounts are safer than one shared password.</p></section></main>;
}
