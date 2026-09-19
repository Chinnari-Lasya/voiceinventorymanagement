"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api, useApi } from "@/client/api";
import { Icon } from "@/components/ui/Icon";
import { Card, EmptyState, ErrorNote, PageHeader, Skeleton, StatusPill, btnPrimary, inputCls } from "@/components/ui/kit";
import type { StateView } from "@/shared/demo";

export function InventoryView() {
  const { data, error, reload } = useApi<StateView>("/api/demo/state");
  const [q, setQ] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.products ?? []).filter((p) => (!onlyLow || p.low) && (!needle || p.name.toLowerCase().includes(needle) || p.category.toLowerCase().includes(needle)));
  }, [data, q, onlyLow]);

  const archive = async (id: string, name: string) => {
    if (!window.confirm(`Archive “${name}”? It will be hidden from your inventory and voice commands. Its history is kept.`)) return;
    const r = await api(`/api/products/${id}`, { method: "DELETE" });
    setMsg(r.ok ? `“${name}” was archived.` : r.error.message);
    reload();
  };

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Every product, its stock and alert status."
        actions={
          <Link href="/products/new" className={btnPrimary}>
            <Icon name="plus" className="size-4" /> Add product
          </Link>
        }
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      {msg && <p className="mb-4 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm" role="status">{msg}</p>}

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products or categories" aria-label="Search products" className={`${inputCls} pl-10`} />
          </div>
          <div className="inline-flex rounded-full border border-line bg-canvas p-1" role="group" aria-label="Filter">
            {[
              { label: "All", val: false },
              { label: "Low stock", val: true },
            ].map((f) => (
              <button key={f.label} type="button" onClick={() => setOnlyLow(f.val)} aria-pressed={onlyLow === f.val} className={`min-h-9 rounded-full px-4 text-sm font-medium ${onlyLow === f.val ? "bg-primary text-primary-ink" : "text-ink-muted"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {!data && !error ? (
          <div className="space-y-3 p-4">{[0, 1, 2, 3].map((k) => <Skeleton key={k} className="h-12" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon="box" title={q || onlyLow ? "No matching products" : "No products yet"} text={q || onlyLow ? "Try a different search or filter." : "Add your first product to get started."} action={!q && !onlyLow ? <Link href="/products/new" className={btnPrimary}>Add product</Link> : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-3 py-3 font-semibold">Category</th>
                  <th className="px-3 py-3 text-right font-semibold">Stock</th>
                  <th className="px-3 py-3 font-semibold">Unit</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-canvas/50">
                    <td className="px-5 py-3.5 font-semibold">{p.name}</td>
                    <td className="px-3 py-3.5 text-ink-muted">{p.category}</td>
                    <td className="px-3 py-3.5 text-right text-base font-bold">{p.qty}</td>
                    <td className="px-3 py-3.5 text-ink-muted">{p.unit}</td>
                    <td className="px-3 py-3.5">
                      {p.low ? <StatusPill tone={p.qty === 0 ? "out" : "low"}>▼ {p.qty === 0 ? "Out of stock" : "Low stock"}</StatusPill> : <StatusPill tone="ok">✓ In stock</StatusPill>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        <Link href={`/products/${p.id}/edit`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-muted hover:bg-canvas hover:text-ink" aria-label={`Edit ${p.name}`}>
                          <Icon name="edit" className="size-4" /> Edit
                        </Link>
                        <button type="button" onClick={() => void archive(p.id, p.name)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-muted hover:bg-danger-bg hover:text-danger" aria-label={`Archive ${p.name}`}>
                          <Icon name="archive" className="size-4" /> Archive
                        </button>
                      </div>
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
