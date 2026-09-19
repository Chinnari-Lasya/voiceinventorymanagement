"use client";

import { formatWhen, useApi } from "@/client/api";
import { Icon } from "@/components/ui/Icon";
import { Card, CardHeader, EmptyState, PageHeader, SourceBadge, StatusPill } from "@/components/ui/kit";
import { VoiceConsole } from "@/components/voice/VoiceConsole";
import type { VoiceEventView } from "@/shared/demo";

const HOW: { lang: string; lines: string[] }[] = [
  { lang: "English", lines: ["Add 5 bags of rice", "Remove 2 bags of rice", "Sugar 3 kg sold"] },
  { lang: "हिन्दी", lines: ["चावल तीन बोरी आया", "chawal 2 bori becha"] },
  { lang: "తెలుగు", lines: ["రెండు bags rice add cheyyi", "Oil 4 bottles vachindi", "బియ్యం 5 బస్తాలు వచ్చాయి"] },
];

const STATUS: Record<string, { label: string; tone: "ok" | "low" | "info" }> = {
  applied: { label: "Applied", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "info" },
  pending_confirm: { label: "Not confirmed", tone: "info" },
  needs_clarification: { label: "Needed help", tone: "low" },
};

export function VoiceView() {
  const events = useApi<VoiceEventView[]>("/api/demo/voice-events");

  return (
    <>
      <PageHeader title="Voice Assistant" subtitle="Speak or type a stock command. You always see what was understood, and confirm, before anything changes." />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <VoiceConsole large onActivity={events.reload} />

        <div className="space-y-6">
          <Card>
            <CardHeader title="How to say it" subtitle="Any mix of these works" />
            <div className="space-y-4 p-5">
              {HOW.map((h) => (
                <div key={h.lang}>
                  <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted"><Icon name="globe" className="size-4" /> {h.lang}</p>
                  <ul className="space-y-1">
                    {h.lines.map((l) => <li key={l} className="rounded-lg bg-canvas px-3 py-1.5 text-sm">“{l}”</li>)}
                  </ul>
                </div>
              ))}
              <p className="text-xs text-ink-muted">Say the product, a number, and a unit (bags, kg, bottles…) plus <strong>add</strong> or <strong>remove</strong>. If it&apos;s unclear, Stockbol asks instead of guessing.</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent voice commands" subtitle="Everything you said or typed here" />
            {events.data && events.data.length === 0 ? (
              <EmptyState icon="mic" title="No commands yet" text="Your spoken and typed commands will be listed here." />
            ) : (
              <ul className="divide-y divide-line">
                {(events.data ?? []).map((e) => {
                  const s = STATUS[e.status] ?? { label: e.status, tone: "info" as const };
                  return (
                    <li key={e.id} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">“{e.transcript}”</p>
                        <StatusPill tone={s.tone}>{s.label}</StatusPill>
                      </div>
                      <p className="mt-1 text-sm text-ink-muted">{e.summary ?? e.error ?? ""}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <SourceBadge label={e.engine === "typed" ? "Typed" : "Voice"} />
                        <time className="text-xs text-ink-muted" dateTime={e.createdAt}>{formatWhen(e.createdAt)}</time>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
