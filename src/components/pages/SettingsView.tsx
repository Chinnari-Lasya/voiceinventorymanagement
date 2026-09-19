"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { api, post } from "@/client/api";
import { useMe } from "@/client/session";
import { Icon } from "@/components/ui/Icon";
import { Card, ErrorNote, PageHeader, btnPrimary, btnSecondary, inputCls, labelCls } from "@/components/ui/kit";
import type { MeView, Preferences } from "@/shared/demo";

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-ink-muted">{hint}</p>
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-primary" : "bg-line"}`}>
        <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

function Section({ icon, title, subtitle, children }: { icon: "store" | "user" | "globe" | "bell"; title: string; subtitle: string; children: ReactNode }) {
  return (
    <Card>
      <div className="flex items-start gap-3 border-b border-line px-5 py-4">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon name={icon} /></span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-ink-muted">{subtitle}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

export function SettingsView() {
  const me = useMe();
  const router = useRouter();
  const [storeName, setStoreName] = useState(me.shopName);
  const [ownerName, setOwnerName] = useState(me.displayName);
  const [prefs, setPrefs] = useState<Preferences>(me.preferences);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const r = await api<MeView>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ storeName, ownerName, language: prefs.language, voiceLang: prefs.voiceLang, notifications: prefs.notifications }),
    });
    setBusy(false);
    if (r.ok) {
      setSaved(true);
      router.refresh();
    } else setError(r.error.message);
  };

  const logout = async () => {
    await post("/api/auth/logout");
    router.push("/signin");
    router.refresh();
  };

  const setNotif = (k: keyof Preferences["notifications"], v: boolean) => setPrefs((p) => ({ ...p, notifications: { ...p.notifications, [k]: v } }));

  return (
    <>
      <PageHeader title="Settings" subtitle="Your store, your profile and how Stockbol talks to you." />
      <form onSubmit={save} className="max-w-3xl space-y-6">
        <Section icon="store" title="Store profile" subtitle="Shown in the header.">
          <label htmlFor="store" className={labelCls}>Store name</label>
          <input id="store" className={inputCls} value={storeName} onChange={(e) => setStoreName(e.target.value)} required minLength={2} />
        </Section>

        <Section icon="user" title="User profile" subtitle="The owner account.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="owner" className={labelCls}>Owner name</label>
              <input id="owner" className={inputCls} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required minLength={2} />
            </div>
            <div>
              <label htmlFor="login" className={labelCls}>Sign-in phone / email</label>
              <input id="login" className={inputCls} value={me.username} disabled readOnly />
            </div>
          </div>
        </Section>

        <Section icon="globe" title="Language" subtitle="Interface and voice recognition.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="lang" className={labelCls}>App language</label>
              <select id="lang" className={inputCls} value={prefs.language} onChange={(e) => setPrefs({ ...prefs, language: e.target.value as Preferences["language"] })}>
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="te">తెలుగు (Telugu)</option>
              </select>
              <p className="mt-1 text-xs text-ink-muted">Saved for later — screen translation is coming. Voice already understands all three.</p>
            </div>
            <div>
              <label htmlFor="vlang" className={labelCls}>Voice language</label>
              <select id="vlang" className={inputCls} value={prefs.voiceLang} onChange={(e) => setPrefs({ ...prefs, voiceLang: e.target.value as Preferences["voiceLang"] })}>
                <option value="en-IN">English (India)</option>
                <option value="hi-IN">हिन्दी (Hindi)</option>
                <option value="te-IN">తెలుగు (Telugu)</option>
              </select>
              <p className="mt-1 text-xs text-ink-muted">The microphone listens for this language by default.</p>
            </div>
          </div>
        </Section>

        <Section icon="bell" title="Notifications" subtitle="Preferences are saved; alerts appear inside the app in this prototype.">
          <div className="divide-y divide-line">
            <Switch checked={prefs.notifications.lowStock} onChange={(v) => setNotif("lowStock", v)} label="Low-stock alerts" hint="Highlight products that drop below their alert level." />
            <Switch checked={prefs.notifications.dailySummary} onChange={(v) => setNotif("dailySummary", v)} label="Daily summary" hint="A short end-of-day recap of what changed." />
            <Switch checked={prefs.notifications.voiceTips} onChange={(v) => setNotif("voiceTips", v)} label="Voice tips" hint="Show example commands to help you get started." />
          </div>
        </Section>

        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className={btnPrimary}>{busy ? "Saving…" : "Save changes"}</button>
          {saved && <span className="text-sm font-medium text-ok" role="status">✓ Saved</span>}
          <button type="button" onClick={() => void logout()} className={`${btnSecondary} ml-auto text-danger`}>
            <Icon name="logout" className="size-4" /> Log out
          </button>
        </div>
      </form>
    </>
  );
}
