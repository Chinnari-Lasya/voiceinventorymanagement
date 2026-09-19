import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

// Shared look-and-feel primitives (tokens live in globals.css).

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-ink shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";
export const btnSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink transition hover:border-primary/50 hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-muted transition hover:bg-canvas hover:text-ink disabled:opacity-50";
export const inputCls =
  "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink outline-none transition placeholder:text-ink-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:bg-canvas disabled:text-ink-muted";
export const labelCls = "mb-1.5 block text-sm font-medium text-ink";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-card border border-line bg-surface shadow-sm ${className}`}>{children}</section>;
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: "ok" | "low" | "out" | "info"; children: ReactNode }) {
  const cls = {
    ok: "bg-ok-bg text-ok",
    low: "bg-attention-bg text-attention",
    out: "bg-danger-bg text-danger",
    info: "bg-canvas text-ink-muted",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

export function StatCard({ label, value, hint, icon, tone = "default" }: { label: string; value: ReactNode; hint?: string; icon: IconName; tone?: "default" | "warn" }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        <span className={`flex size-9 items-center justify-center rounded-lg ${tone === "warn" ? "bg-attention-bg text-attention" : "bg-primary/10 text-primary"}`}>
          <Icon name={icon} className="size-5" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold leading-none tracking-tight">{value}</p>
      {hint && <p className="mt-2 text-xs text-ink-muted">{hint}</p>}
    </Card>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon name={icon} className="size-6" />
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
      {children}
    </p>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-line/60 ${className}`} />;
}

export function SourceBadge({ label }: { label: string }) {
  const icon: IconName = label === "Voice" ? "mic" : label === "Typed" ? "keyboard" : label === "Undo" ? "undo" : label === "Seed" ? "layers" : "hand";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-0.5 text-xs font-medium text-ink-muted">
      <Icon name={icon} className="size-3.5" />
      {label}
    </span>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-teal-800 text-primary-ink shadow-sm">
        <Icon name="mic" className="size-5" />
      </span>
      <span className="text-xl font-bold tracking-tight">Stockbol</span>
    </span>
  );
}
