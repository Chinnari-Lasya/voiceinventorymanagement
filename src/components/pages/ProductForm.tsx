"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, post, useApi } from "@/client/api";
import { Card, EmptyState, ErrorNote, PageHeader, Skeleton, btnPrimary, btnSecondary, inputCls, labelCls } from "@/components/ui/kit";
import type { ProductView, StateView } from "@/shared/demo";

const UNITS = ["bag", "kg", "g", "bottle", "packet", "piece", "litre", "ml"];
const CATEGORIES = ["Grains", "Pulses", "Staples", "Cooking", "Snacks", "Beverages", "Household", "Other"];

function Form({ product }: { product?: ProductView }) {
  const router = useRouter();
  const editing = Boolean(product);
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category === "General" ? "" : (product?.category ?? ""));
  const [unit, setUnit] = useState(product?.displayUnit ?? "bag");
  const [stock, setStock] = useState("");
  const [threshold, setThreshold] = useState(product?.thresholdQty != null ? String(product.thresholdQty) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const thr = threshold.trim() === "" ? null : Number(threshold);
    if (thr !== null && !Number.isFinite(thr)) return setError("Low-stock level must be a number.");
    if (!name.trim()) return setError("Enter a product name.");

    setBusy(true);
    let r;
    if (editing && product) {
      r = await api(`/api/products/${product.id}`, { method: "PATCH", body: JSON.stringify({ name, category, threshold: thr }) });
    } else {
      const qty = stock.trim() === "" ? 0 : Number(stock);
      if (!Number.isFinite(qty)) {
        setBusy(false);
        return setError("Initial stock must be a number.");
      }
      r = await post("/api/products", { name, category, unit, initialStock: qty, threshold: thr });
    }
    if (r.ok) {
      router.push("/inventory");
      router.refresh();
      return;
    }
    setBusy(false);
    setError(r.error.message);
  };

  return (
    <>
      <PageHeader title={editing ? `Edit ${product?.name}` : "Add product"} subtitle={editing ? "Update the name, category or alert level." : "Add an item to your inventory. You can update its stock by voice afterwards."} />
      <Card className="max-w-2xl p-6">
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="pname" className={labelCls}>Product name</label>
            <input id="pname" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Toor Dal" required />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="pcat" className={labelCls}>Category</label>
              <input id="pcat" list="categories" className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Pulses" />
              <datalist id="categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <label htmlFor="punit" className={labelCls}>Unit</label>
              <select id="punit" className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)} disabled={editing}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              {editing && <p className="mt-1 text-xs text-ink-muted">The unit is fixed once a product has history.</p>}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="pstock" className={labelCls}>{editing ? "Current stock" : "Initial stock"}</label>
              <input id="pstock" type="number" min="0" step="any" inputMode="decimal" className={inputCls} value={editing ? String(product?.qty ?? "") : stock} onChange={(e) => setStock(e.target.value)} placeholder="0" disabled={editing} />
              {editing && <p className="mt-1 text-xs text-ink-muted">Change stock with a voice update.</p>}
            </div>
            <div>
              <label htmlFor="pthr" className={labelCls}>Low-stock threshold ({unit})</label>
              <input id="pthr" type="number" min="0" step="any" inputMode="decimal" className={inputCls} value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="e.g. 10" />
              <p className="mt-1 text-xs text-ink-muted">You&apos;ll be alerted when stock drops below this.</p>
            </div>
          </div>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex flex-wrap gap-3 pt-1">
            <button type="submit" disabled={busy} className={btnPrimary}>{busy ? "Saving…" : editing ? "Save changes" : "Save product"}</button>
            <Link href="/inventory" className={btnSecondary}>Cancel</Link>
          </div>
        </form>
      </Card>
    </>
  );
}

export function NewProductView() {
  return <Form />;
}

export function EditProductView({ id }: { id: string }) {
  const { data, error } = useApi<StateView>("/api/demo/state");
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Skeleton className="h-96 max-w-2xl" />;
  const product = data.products.find((p) => p.id === id);
  if (!product) {
    return (
      <Card>
        <EmptyState icon="box" title="Product not found" text="It may have been archived." action={<Link href="/inventory" className={btnPrimary}>Back to inventory</Link>} />
      </Card>
    );
  }
  return <Form product={product} />;
}
