import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Logo, btnPrimary, btnSecondary } from "@/components/ui/kit";
import { getCurrentUser } from "@/server/auth/current";

export const dynamic = "force-dynamic";

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: "mic", title: "Voice-first stock updates", text: "Say “Rice 5 bags vachindi” or “రెండు bags rice add cheyyi”. No forms, no typing-heavy screens." },
  { icon: "globe", title: "English, Hindi, Telugu — mixed", text: "Understands the way shopkeepers really speak, with trade units like bags, bottles, kg and packets." },
  { icon: "shield", title: "Confirm before anything changes", text: "Stockbol shows what it understood first. Unclear commands are never guessed — and every change can be undone." },
  { icon: "trend", title: "Low-stock alerts that explain why", text: "See what needs reordering and the plain reason behind it, based on your own stock and sales." },
];

const STEPS = [
  { n: "1", title: "Speak or type", text: "Tell Stockbol what came in or went out." },
  { n: "2", title: "Check & confirm", text: "Review the understood action and tap Confirm." },
  { n: "3", title: "Stock updates", text: "Your dashboard, history and alerts update instantly." },
];

export default async function LandingPage() {
  const me = await getCurrentUser();
  return (
    <div className="bg-canvas">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" aria-label="Stockbol home"><Logo /></Link>
        <nav className="flex items-center gap-2">
          {me ? (
            <Link href="/dashboard" className={btnPrimary}>Go to dashboard</Link>
          ) : (
            <>
              <Link href="/signin" className="hidden min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-ink hover:bg-surface sm:inline-flex">Sign in</Link>
              <Link href="/signup" className={btnPrimary}>Get started</Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-8 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <Icon name="sparkle" className="size-4" /> AI voice inventory copilot
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Manage your shop&apos;s stock by <span className="bg-gradient-to-r from-primary to-teal-700 bg-clip-text text-transparent">just talking</span>.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-muted">
            Notebooks and memory cause stock-outs and waste. Stockbol lets small retailers add, remove and check inventory with their voice — in the language they already speak.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={me ? "/dashboard" : "/signup"} className={`${btnPrimary} min-h-12 px-6 text-base`}>
              {me ? "Open dashboard" : "Get started — it's free"} <Icon name="arrow" className="size-4" />
            </Link>
            {!me && <Link href="/signin" className={`${btnSecondary} min-h-12 px-6 text-base`}>Sign in</Link>}
          </div>
          <p className="mt-4 text-sm text-ink-muted">Want a look first? Use <strong>Demo login</strong> on the sign-in page — no sign-up needed.</p>
        </div>

        {/* Illustration of the confirm-before-change flow (sample content, not live data) */}
        <div className="relative" aria-hidden>
          <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary/15 to-teal-300/10 blur-2xl" />
          <div className="relative space-y-3 rounded-3xl border border-line bg-surface p-5 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Example</p>
            <div className="flex items-center gap-3 rounded-2xl bg-canvas p-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-ink"><Icon name="mic" /></span>
              <p className="font-medium">“Rice five bags vachindi”</p>
            </div>
            <div className="rounded-2xl border-2 border-primary p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Here&apos;s what I understood</p>
              <p className="mt-1 text-2xl font-bold">Add 5 bags of Rice</p>
              <p className="mt-2 rounded-xl bg-canvas p-2.5 text-sm">Stock <strong>20 bags</strong> → <strong className="text-ok">25 bags</strong></p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm font-semibold">
                <span className="rounded-xl border border-line py-2">Cancel</span>
                <span className="rounded-xl bg-primary py-2 text-primary-ink">Confirm</span>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-attention-bg px-4 py-3 text-sm text-attention">
              <span className="font-semibold">▼ Oil is below your threshold of 10 bottles</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon name={f.icon} /></span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-ink-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-center text-3xl font-bold tracking-tight">How it works</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-card border border-line bg-surface p-6">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-ink">{s.n}</span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-ink-muted">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 rounded-3xl bg-gradient-to-br from-primary to-teal-900 p-8 text-center text-primary-ink sm:p-12">
          <h2 className="text-3xl font-bold tracking-tight">Ready to stop guessing your stock?</h2>
          <p className="mx-auto mt-2 max-w-lg text-white/80">Create a store in under a minute, or explore the demo store right away.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href={me ? "/dashboard" : "/signup"} className="inline-flex min-h-12 items-center rounded-xl bg-white px-6 font-semibold text-primary hover:bg-canvas">
              {me ? "Open dashboard" : "Get started"}
            </Link>
            {!me && <Link href="/signin" className="inline-flex min-h-12 items-center rounded-xl border border-white/40 px-6 font-semibold hover:bg-white/10">Sign in</Link>}
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-8 text-center text-sm text-ink-muted">
        Stockbol · Voice-based inventory management for small businesses · Hackathon prototype
      </footer>
    </div>
  );
}
