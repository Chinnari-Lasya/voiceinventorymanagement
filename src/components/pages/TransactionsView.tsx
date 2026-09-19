"use client";

import { useMemo, useState } from "react";
import { formatWhen, post, useApi } from "@/client/api";
import { Icon } from "@/components/ui/Icon";
import { Card, EmptyState, ErrorNote, PageHeader, Skeleton, SourceBadge, StatusPill } from "@/components/ui/kit";
import type { TxnView } from "@/shared/demo";

const FILTERS = ["All", "Voice", "Typed", "Manual", "Undo"] as const;

export function TransactionsView() {
  const { data, error, reload } = useApi<TxnView[]>("/api/demo/transactions");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => (data ?? []).filter((t) => filter === "All" || t.sourceLabel === filter), [data, filter]);
  const target = data?.find((t) => t.canUndo);

  const undo = async () => {
    setBusy(true);
    const r = await post<{ message: string }>("/api/demo/undo");
    setBusy(false);
    setMsg(r.ok ? r.data.message : r.error.message);
    reload();
  };

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Every stock change, newest first. Nothing is ever edited — undo adds a reversing entry."
        actions={
          <button type="button" onClick={() => void undo()} disabled={busy || !target} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:bg-canvas disabled:opacity-50">
            <Icon name="undo" className="size-4" /> {target ? `Undo ${target.deltaText} ${target.productName}` : "Nothing to undo"}
          </button>
        }
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      {msg && <p className="mb-4 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm" role="status">↩ {msg}</p>}

      <Card>
        <div className="flex flex-wrap gap-2 border-b border-line p-4">
          {FILTERS.map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f} className={`min-h-9 rounded-full border px-4 text-sm font-medium ${filter === f ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink-muted"}`}>
              {f}
            </button>
          ))}
        </div>
        {!data && !error ? (
          <div className="space-y-3 p-4">{[0, 1, 2, 3, 4].map((k) => <Skeleton key={k} className="h-12" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon="list" title="No transactions" text={filter === "All" ? "Changes you make will appear here." : `No ${filter.toLowerCase()} transactions yet.`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-3 py-3 font-semibold">Change</th>
                  <th className="px-3 py-3 font-semibold">Stock after</th>
                  <th className="px-3 py-3 font-semibold">Source</th>
                  <th className="px-3 py-3 font-semibold">When</th>
                  <th className="px-5 py-3 text-right font-semibold">Undo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((t) => (
                  <tr key={t.id} className={t.reverted ? "opacity-55" : "hover:bg-canvas/50"}>
                    <td className="px-5 py-3.5 font-semibold">
                      <span className={t.reverted ? "line-through" : ""}>{t.productName}</span>
                      {t.type === "opening" && <span className="ml-2 text-xs font-normal text-ink-muted">opening stock</span>}
                    </td>
                    <td className={`px-3 py-3.5 text-base font-bold ${t.kind === "add" ? "text-ok" : t.kind === "remove" ? "text-attention" : "text-ink-muted"}`}>{t.deltaText}</td>
                    <td className="px-3 py-3.5 text-ink-muted">{t.stockAfterText}</td>
                    <td className="px-3 py-3.5"><SourceBadge label={t.sourceLabel} /></td>
                    <td className="px-3 py-3.5 text-ink-muted"><time dateTime={t.createdAt}>{formatWhen(t.createdAt)}</time></td>
                    <td className="px-5 py-3.5 text-right">
                      {t.canUndo ? (
                        <button type="button" onClick={() => void undo()} disabled={busy} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium hover:bg-canvas">
                          <Icon name="undo" className="size-4" /> Undo
                        </button>
                      ) : t.reverted ? (
                        <StatusPill tone="info">Undone</StatusPill>
                      ) : (
                        <span className="text-ink-muted/50">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
