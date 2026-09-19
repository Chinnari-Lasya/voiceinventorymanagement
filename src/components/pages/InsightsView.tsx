"use client";

import Link from "next/link";
import { useApi } from "@/client/api";
import { Icon } from "@/components/ui/Icon";
import { Card, CardHeader, EmptyState, ErrorNote, PageHeader, Skeleton, StatCard, StatusPill, btnPrimary } from "@/components/ui/kit";
import type { InsightItem } from "@/shared/demo";

export function InsightsView() {
  const { data, error } = useApi<{ items: InsightItem[]; lowCount: number }>("/api/demo/insights");
  const attention = data?.items.filter((i) => i.status !== "ok") ?? [];
  const healthy = data?.items.filter((i) => i.status === "ok") ?? [];
  const suggestions = attention.filter((i) => i.suggestion);

  return (
    <>
      <PageHeader title="Insights" subtitle="What needs attention and what to reorder — simple rules over your own stock, always explained." />
      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Need attention" value={data ? attention.length : "–"} hint="Below their alert level" icon="alert" tone={attention.length ? "warn" : "default"} />
        <StatCard label="Reorder suggestions" value={data ? suggestions.length : "–"} hint="Ready to order" icon="box" />
        <StatCard label="Healthy" value={data ? healthy.length : "–"} hint="Comfortably stocked" icon="check" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Low-stock products</h2>
          {!data && !error && [0, 1].map((k) => <Skeleton key={k} className="h-40" />)}
          {data && attention.length === 0 && (
            <Card><EmptyState icon="check" title="Everything is stocked up" text="When a product drops below its alert level, it appears here with a reorder suggestion and the reason." /></Card>
          )}
          {attention.map((i) => (
            <Card key={i.productId} className={`p-5 ${i.status === "out" ? "border-danger/40" : "border-attention/40"}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold">{i.name}</h3>
                  <p className="mt-0.5 text-ink">{i.headline}</p>
                </div>
                <StatusPill tone={i.status === "out" ? "out" : "low"}>▼ {i.stockText} left</StatusPill>
              </div>

              {i.suggestion && (
                <div className="mt-4 flex items-start gap-3 rounded-xl bg-primary/10 p-3.5 text-primary">
                  <Icon name="sparkle" className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide">Reorder suggestion</p>
                    <p className="font-semibold text-ink">{i.suggestion}</p>
                  </div>
                </div>
              )}

              <details className="group mt-3">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-semibold text-primary hover:underline">
                  <Icon name="info" className="size-4" /> Why?
                </summary>
                <ul className="mt-2 space-y-1.5 rounded-xl bg-canvas p-3.5 text-sm text-ink">
                  {i.why.map((w) => <li key={w} className="flex gap-2"><span aria-hidden className="text-ink-muted">•</span>{w}</li>)}
                </ul>
              </details>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Reorder list" subtitle="Rule-based, no AI guesswork" />
            {suggestions.length === 0 ? (
              <p className="p-5 text-sm text-ink-muted">Nothing to reorder right now.</p>
            ) : (
              <ul className="divide-y divide-line">
                {suggestions.map((i) => <li key={i.productId} className="px-5 py-3 text-sm"><span className="font-semibold">{i.name}</span><br /><span className="text-ink-muted">{i.suggestion}</span></li>)}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Healthy stock" />
            {healthy.length === 0 ? (
              <p className="p-5 text-sm text-ink-muted">No products above their alert level yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {healthy.map((i) => (
                  <li key={i.productId} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="font-medium">{i.name}</span>
                    <StatusPill tone="ok">✓ {i.stockText}</StatusPill>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Link href="/voice" className={`${btnPrimary} w-full`}><Icon name="mic" className="size-4" /> Restock by voice</Link>
        </div>
      </div>
    </>
  );
}
