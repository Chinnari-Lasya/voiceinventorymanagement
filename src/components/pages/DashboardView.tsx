"use client";

import Link from "next/link";
import { useState } from "react";
import { formatWhen, post, useApi } from "@/client/api";
import { useMe } from "@/client/session";
import { Icon } from "@/components/ui/Icon";
import { Card, CardHeader, EmptyState, ErrorNote, PageHeader, Skeleton, SourceBadge, StatCard, StatusPill, btnPrimary, btnSecondary } from "@/components/ui/kit";
import { VoiceModal } from "@/components/voice/VoiceModal";
import type { StateView } from "@/shared/demo";

export function DashboardView() {
  const me = useMe();
  const { data, error, reload } = useApi<StateView>("/api/demo/state");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [undoMsg, setUndoMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const products = data?.products ?? [];
  const low = products.filter((p) => p.low);
  const totalStock = Number(products.reduce((s, p) => s + p.qty, 0).toFixed(2));
  const firstName = me.displayName.split(" ")[0];

  const undo = async () => {
    setBusy(true);
    const r = await post<{ message: string }>("/api/demo/undo");
    setBusy(false);
    setUndoMsg(r.ok ? r.data.message : r.error.message);
    reload();
  };

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle={`Here's how ${me.shopName} looks right now.`}
        actions={
          <>
            <button type="button" onClick={() => setVoiceOpen(true)} className={btnPrimary}>
              <Icon name="mic" className="size-4" /> Voice update
            </button>
            <Link href="/products/new" className={btnSecondary}>
              <Icon name="plus" className="size-4" /> Add product
            </Link>
          </>
        }
      />

      {error && <ErrorNote>{error}</ErrorNote>}
      {undoMsg && (
        <p className="mb-4 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm" role="status">
          ↩ {undoMsg}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total products" value={data ? products.length : "–"} hint="Active in your catalog" icon="box" />
        <StatCard label="Total stock" value={data ? totalStock : "–"} hint="Units across all products" icon="layers" />
        <StatCard label="Low-stock items" value={data ? low.length : "–"} hint={low.length ? "Need attention" : "All stocked up"} icon="alert" tone={low.length ? "warn" : "default"} />
        <StatCard label="Recent changes" value={data ? data.recent.length : "–"} hint="In your latest activity" icon="clock" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Current stock"
              subtitle="Live from your ledger"
              action={<Link href="/inventory" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">View all <Icon name="arrow" className="size-4" /></Link>}
            />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {!data && [0, 1, 2, 3].map((k) => <Skeleton key={k} className="h-28" />)}
              {products.map((p) => {
                const cap = p.thresholdQty ? p.thresholdQty * 2 : Math.max(p.qty, 1);
                const pct = Math.min(100, Math.round((p.qty / cap) * 100));
                return (
                  <Link key={p.id} href={`/products/${p.id}/edit`} className={`rounded-xl border p-4 transition hover:shadow-md ${p.low ? "border-attention/50 bg-attention-bg/40" : "border-line"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-xs text-ink-muted">{p.category}</p>
                      </div>
                      {p.low ? <StatusPill tone={p.qty === 0 ? "out" : "low"}>▼ {p.qty === 0 ? "Out" : "Low"}</StatusPill> : <StatusPill tone="ok">✓ OK</StatusPill>}
                    </div>
                    <p className="mt-3 text-3xl font-bold leading-none">
                      {p.qty} <span className="text-base font-medium text-ink-muted">{p.unit}</span>
                    </p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line" role="presentation">
                      <div className={`h-full rounded-full ${p.low ? "bg-attention" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                    </div>
                    {p.thresholdText && <p className="mt-1.5 text-xs text-ink-muted">Alert below {p.thresholdText}</p>}
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Recent transactions"
              action={
                <div className="flex items-center gap-2">
                  {data?.undoTarget && (
                    <button type="button" onClick={() => void undo()} disabled={busy} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium hover:bg-canvas">
                      <Icon name="undo" className="size-4" /> Undo {data.undoTarget.label}
                    </button>
                  )}
                  <Link href="/transactions" className="text-sm font-semibold text-primary hover:underline">See all</Link>
                </div>
              }
            />
            {data && data.recent.length === 0 ? (
              <EmptyState icon="list" title="No changes yet" text="Use the voice update to add or remove stock and it will show up here." action={<button type="button" onClick={() => setVoiceOpen(true)} className={btnPrimary}>Try a voice update</button>} />
            ) : (
              <ul className="divide-y divide-line">
                {(data?.recent ?? []).map((t) => (
                  <li key={t.id} className={`flex items-center justify-between gap-3 px-5 py-3 ${t.reverted ? "opacity-50" : ""}`}>
                    <div className="min-w-0">
                      <p className={`font-semibold ${t.reverted ? "line-through" : ""}`}>
                        <span className={t.kind === "add" ? "text-ok" : t.kind === "remove" ? "text-attention" : "text-ink-muted"}>{t.deltaText}</span> {t.productName}
                      </p>
                      <p className="text-xs text-ink-muted">now {t.stockAfterText}{t.reverted ? " · undone" : ""}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <SourceBadge label={t.sourceLabel} />
                      <time className="text-xs text-ink-muted" dateTime={t.createdAt}>{formatWhen(t.createdAt)}</time>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Low-stock alerts" subtitle={low.length ? `${low.length} need attention` : "Nothing needs attention"} />
            {low.length === 0 && data ? (
              <EmptyState icon="check" title="All stocked up" text="You'll see products here when they drop below their alert level." />
            ) : (
              <ul className="divide-y divide-line">
                {low.map((p) => (
                  <li key={p.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{p.name}</p>
                      <StatusPill tone={p.qty === 0 ? "out" : "low"}>▼ {p.stockText}</StatusPill>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">{p.name} is below your threshold of {p.thresholdText}.</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-line p-4">
              <Link href="/insights" className={`${btnSecondary} w-full`}>See reorder suggestions</Link>
            </div>
          </Card>

          <Card className="overflow-hidden bg-gradient-to-br from-primary to-teal-900 p-5 text-primary-ink">
            <span className="flex size-10 items-center justify-center rounded-xl bg-white/15"><Icon name="mic" /></span>
            <h3 className="mt-3 text-lg font-bold">Update stock by voice</h3>
            <p className="mt-1 text-sm text-white/80">Try “Add 5 bags of rice” or “रेडी… चावल 3 बोरी आया”. You&apos;ll always confirm first.</p>
            <button type="button" onClick={() => setVoiceOpen(true)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-primary hover:bg-canvas">
              <Icon name="mic" className="size-4" /> Start voice update
            </button>
          </Card>
        </div>
      </div>

      {voiceOpen && <VoiceModal onClose={() => setVoiceOpen(false)} onActivity={reload} />}
    </>
  );
}
