import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/kit";

const POINTS: { icon: IconName; title: string; text: string }[] = [
  { icon: "mic", title: "Just say it", text: "“Rice 5 bags vachindi” — in English, Hindi, Telugu or a mix." },
  { icon: "shield", title: "Nothing changes until you confirm", text: "See what was understood first. Undo any time." },
  { icon: "trend", title: "Know what to reorder", text: "Low-stock alerts that explain why." },
];

/** Split-screen layout for sign in / sign up: brand panel on desktop, form on the right. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-teal-800 to-teal-950 p-12 text-primary-ink lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-teal-300/10 blur-3xl" />
        <Link href="/" className="relative inline-flex items-center gap-2.5" aria-label="Stockbol home">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/15"><Icon name="mic" className="size-5" /></span>
          <span className="text-xl font-bold tracking-tight">Stockbol</span>
        </Link>
        <div className="relative mt-auto">
          <h2 className="max-w-md text-4xl font-bold leading-tight tracking-tight">Inventory that listens.</h2>
          <p className="mt-3 max-w-md text-lg text-white/80">A voice-first stock copilot for small shops — built for how shopkeepers actually talk.</p>
          <ul className="mt-10 space-y-5">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15"><Icon name={p.icon} /></span>
                <div>
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-sm text-white/75">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="flex items-center justify-center px-5 py-10 sm:px-10">{children}</main>
    </div>
  );
}

export { Logo };
