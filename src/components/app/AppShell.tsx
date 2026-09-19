"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { post } from "@/client/api";
import { useMe } from "@/client/session";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/kit";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/inventory", label: "Inventory", icon: "box" },
  { href: "/products/new", label: "Add Product", icon: "plus" },
  { href: "/transactions", label: "Transactions", icon: "list" },
  { href: "/voice", label: "Voice Assistant", icon: "mic" },
  { href: "/insights", label: "Insights", icon: "trend" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

function activeHref(pathname: string): string {
  if (pathname.startsWith("/products/") && pathname !== "/products/new") return "/inventory"; // edit page
  return NAV.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`))?.href ?? "";
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const active = activeHref(pathname);
  return (
    <nav className="flex flex-col gap-1 px-3" aria-label="Main">
      {NAV.map((n) => {
        const on = n.href === active;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
              on ? "bg-primary text-primary-ink shadow-sm" : "text-ink-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            <Icon name={n.icon} />
            {n.label}
            {n.href === "/voice" && !on && <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">AI</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Close the mobile drawer whenever the route changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  const title = NAV.find((n) => n.href === activeHref(pathname))?.label ?? "Stockbol";

  const logout = async () => {
    await post("/api/auth/logout");
    router.push("/signin");
    router.refresh();
  };

  const userCard = (
    <div className="border-t border-line p-3">
      <div className="flex items-center gap-3 rounded-xl p-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{initials(me.displayName)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{me.displayName}</p>
          <p className="truncate text-xs text-ink-muted">{me.shopName}</p>
        </div>
        <button type="button" onClick={() => void logout()} aria-label="Sign out" title="Sign out" className="rounded-lg p-2 text-ink-muted hover:bg-canvas hover:text-danger">
          <Icon name="logout" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-60">
      {/* Desktop sidebar (240px) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
        <div className="px-5 py-5">
          <Link href="/dashboard" aria-label="Stockbol home">
            <Logo />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <NavList pathname={pathname} />
        </div>
        {userCard}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-surface shadow-xl">
            <div className="flex items-center justify-between px-5 py-4">
              <Logo />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-2 text-ink-muted hover:bg-canvas">
                <Icon name="x" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              <NavList pathname={pathname} onNavigate={() => setOpen(false)} />
            </div>
            {userCard}
          </div>
        </div>
      )}

      {/* Top header */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur lg:px-8">
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-ink hover:bg-canvas lg:hidden">
          <Icon name="menu" />
        </button>
        <h1 className="text-lg font-semibold lg:text-xl">{title}</h1>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-line bg-canvas px-3 py-1.5 text-sm text-ink-muted sm:inline-flex">
            <Icon name="store" className="size-4" />
            {me.shopName}
          </span>
          <Link href="/voice" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-ink shadow-sm hover:brightness-110 sm:px-4">
            <Icon name="mic" className="size-4" />
            <span className="hidden sm:inline">Voice update</span>
          </Link>
          <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary" title={me.displayName}>
            {initials(me.displayName)}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
