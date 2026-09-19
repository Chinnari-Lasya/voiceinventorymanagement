"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { post } from "@/client/api";
import { Icon } from "@/components/ui/Icon";
import { ErrorNote, Logo, btnPrimary, btnSecondary, inputCls, labelCls } from "@/components/ui/kit";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const signup = mode === "signup";
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const done = () => {
    router.push("/dashboard");
    router.refresh();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = signup
      ? await post("/api/auth/signup", { storeName, ownerName, contact, password, remember })
      : await post("/api/auth/login", { contact, password, remember });
    if (r.ok) return done();
    setBusy(false);
    setError(r.error.message);
  };

  const demo = async () => {
    setBusy(true);
    setError(null);
    const r = await post("/api/auth/demo");
    if (r.ok) return done();
    setBusy(false);
    setError(r.error.message);
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <Link href="/" className="mb-8 inline-block lg:hidden" aria-label="Stockbol home">
        <Logo />
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">{signup ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-2 text-ink-muted">
        {signup ? "Set up your store in under a minute. No typing-heavy forms later — just talk." : "Sign in to manage your stock by voice."}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        {signup && (
          <>
            <div>
              <label htmlFor="storeName" className={labelCls}>Store / business name</label>
              <input id="storeName" className={inputCls} value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Lakshmi Kirana Store" autoComplete="organization" required />
            </div>
            <div>
              <label htmlFor="ownerName" className={labelCls}>Owner name</label>
              <input id="ownerName" className={inputCls} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Lakshmi Devi" autoComplete="name" required />
            </div>
          </>
        )}
        <div>
          <label htmlFor="contact" className={labelCls}>Phone or email</label>
          <input id="contact" className={inputCls} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="98765 43210 or you@example.com" autoComplete="username" required />
        </div>
        <div>
          <label htmlFor="password" className={labelCls}>{signup ? "Password or PIN" : "Password / PIN"}</label>
          <div className="relative">
            <input
              id="password"
              type={showPw ? "text" : "password"}
              className={`${inputCls} pr-16`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={signup ? "At least 4 characters" : "Your password or PIN"}
              autoComplete={signup ? "new-password" : "current-password"}
              required
            />
            <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-canvas">
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {!signup && (
          <div className="flex items-center justify-between text-sm">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-primary" />
              Remember me
            </label>
            <button
              type="button"
              onClick={() => setNote("Password reset isn't available in this prototype. Use “Demo login”, or create a new account.")}
              className="font-medium text-primary hover:underline"
            >
              Forgot password?
            </button>
          </div>
        )}

        {note && <p className="rounded-xl bg-canvas px-3 py-2 text-sm text-ink-muted">{note}</p>}
        {error && <ErrorNote>{error}</ErrorNote>}

        <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
          {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-ink-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>

      <button type="button" onClick={() => void demo()} disabled={busy} className={`${btnSecondary} w-full`}>
        <Icon name="sparkle" className="size-4 text-primary" />
        {signup ? "Use the demo account" : "Demo login"}
      </button>
      <p className="mt-2 text-center text-xs text-ink-muted">Opens a ready-made store with Rice, Sugar, Oil and Dal.</p>

      <p className="mt-8 text-center text-sm text-ink-muted">
        {signup ? "Already have an account? " : "New to Stockbol? "}
        <Link href={signup ? "/signin" : "/signup"} className="font-semibold text-primary hover:underline">
          {signup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
