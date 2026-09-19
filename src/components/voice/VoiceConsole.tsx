"use client";

import { useCallback, useRef, useState } from "react";
import { post } from "@/client/api";
import { useMe } from "@/client/session";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/kit";
import type { InterpretationView } from "@/shared/demo";

type InterpretData =
  | { ok: true; interpretation: InterpretationView; eventId: string }
  | { ok: false; code: string; message: string; eventId: string };

interface SRResultEvent {
  results: { length: number; [i: number]: { [j: number]: { transcript: string }; isFinal: boolean } };
}
interface SR {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onresult: ((e: SRResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SRCtor = new () => SR;

const LANGS = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिन्दी" },
  { code: "te-IN", label: "తెలుగు" },
] as const;

const EXAMPLES = ["Add 5 bags of rice", "Remove 2 bags of rice", "rice 5 add", "రెండు bags rice add cheyyi", "Sugar 3 kg sold", "Oil 4 bottles vachindi"];

function speechCtor(): SRCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Permission/device failures from getUserMedia — tells "blocked" apart from "no microphone" and "busy". */
function describeMediaError(err: unknown): string {
  const name = err instanceof Error ? err.name : "Error";
  const tail = ` (${name}${err instanceof Error && err.message ? `: ${err.message}` : ""})`;
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone permission is blocked. Click the 🔒 icon in the address bar, allow Microphone, and try again — or type your command." + tail;
    case "NotFoundError":
    case "OverconstrainedError":
      return "No microphone was found. Plug one in or enable it (Windows Settings → Privacy → Microphone), or type your command." + tail;
    case "NotReadableError":
    case "AbortError":
      return "The microphone is busy or unavailable — another app may be using it. Close it and try again, or type your command." + tail;
    default:
      return "Couldn't access the microphone." + tail;
  }
}

/** SpeechRecognition error codes → plain language plus the raw code, so the real cause is never hidden. */
function describeSpeechError(code: string, langCode: string): string {
  const tail = ` (error: ${code})`;
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "The browser blocked speech recognition. Allow the microphone for this site (🔒 in the address bar). Some browser settings or policies also block the speech service. Or type your command." + tail;
    case "audio-capture":
      return "No working microphone was detected. Check that one is connected and selected as the input device, or type your command." + tail;
    case "network":
      return "Speech recognition couldn't reach the browser's speech service. Chrome and Edge send your voice to an online service, so this needs internet that isn't blocked (a VPN, firewall or privacy extension can cause this). Check your connection and try again — or type your command." + tail;
    case "no-speech":
      return "I didn't hear anything. Tap the mic and speak, or type your command." + tail;
    case "language-not-supported":
      return `This browser can't recognise ${langCode}. Try English, or type your command.` + tail;
    default:
      return "Speech recognition failed." + tail;
  }
}

interface Props {
  /** Bigger mic + roomier layout (Voice Assistant page). */
  large?: boolean;
  /** Called after anything that should refresh surrounding data (interpret / confirm / cancel / undo). */
  onActivity?: () => void;
}

export function VoiceConsole({ large = false, onActivity }: Props) {
  const me = useMe();
  const [text, setText] = useState("");
  const [heard, setHeard] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ i: InterpretationView; via: "mic" | "typed"; said: string; eventId: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; canUndo: boolean; tone: "ok" | "info" } | null>(null);
  const [listening, setListening] = useState(false);
  const [micStarting, setMicStarting] = useState(false);
  const [lang, setLang] = useState<string>(me.preferences.voiceLang);
  const recRef = useRef<SR | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, canUndo: boolean, tone: "ok" | "info" = "ok") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, canUndo, tone });
    toastTimer.current = setTimeout(() => setToast(null), 9000);
  };

  const understand = useCallback(
    async (input: string, via: "mic" | "typed") => {
      const said = input.trim();
      if (!said) return;
      setBusy(true);
      setProblem(null);
      setPending(null);
      setToast(null);
      const r = await post<InterpretData>("/api/demo/interpret", { text: said, via });
      setBusy(false);
      if (!r.ok) return setProblem(r.error.message);
      if (r.data.ok) setPending({ i: r.data.interpretation, via, said, eventId: r.data.eventId });
      else setProblem(r.data.message);
      onActivity?.();
    },
    [onActivity],
  );

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    const { i, via, eventId } = pending;
    const r = await post<{ message: string; productId: string }>("/api/demo/confirm", {
      productId: i.productId,
      op: i.op,
      quantity: i.quantity,
      unit: i.unit,
      via,
      eventId,
    });
    setBusy(false);
    setPending(null);
    if (r.ok) {
      setText("");
      setHeard("");
      showToast(r.data.message, true);
    } else setProblem(r.error.message);
    onActivity?.();
  };

  const cancel = () => {
    if (pending) void post("/api/demo/cancel", { eventId: pending.eventId }).then(() => onActivity?.());
    setPending(null);
  };

  const undo = async () => {
    setBusy(true);
    const r = await post<{ message: string }>("/api/demo/undo");
    setBusy(false);
    if (r.ok) showToast(r.data.message, false, "info");
    else showToast(r.error.message, false, "info");
    onActivity?.();
  };

  const toggleMic = async () => {
    if (listening) return recRef.current?.stop();
    if (micStarting) return;
    setProblem(null);

    const Ctor = speechCtor();
    if (!Ctor) {
      return setProblem(
        "This browser doesn't support speech recognition (the Web Speech API). Use Chrome or Edge on desktop or Android — or type your command.",
      );
    }
    if (!window.isSecureContext) {
      return setProblem(
        `The microphone only works on https:// or http://localhost — this page is ${window.location.origin}. Open it via localhost, or type your command.`,
      );
    }

    // Ask for microphone permission up front, so "blocked" and "no microphone" are reported as such
    // instead of being lumped in with speech-service errors.
    if (navigator.mediaDevices?.getUserMedia) {
      setMicStarting(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch (err) {
        setMicStarting(false);
        return setProblem(describeMediaError(err));
      }
      setMicStarting(false);
    }

    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = "";
    let errored = false;
    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      let t = "";
      for (let k = 0; k < e.results.length; k++) t += e.results[k][0].transcript;
      finalText = t;
      setText(t); // recognised speech goes into the same command box the user types in
      setHeard(t);
    };
    rec.onerror = (e) => {
      errored = true;
      setListening(false);
      if (e.error !== "aborted") setProblem(describeSpeechError(e.error, lang));
    };
    rec.onend = () => {
      setListening(false);
      if (errored) return;
      // Same pipeline as a typed command.
      if (finalText.trim()) void understand(finalText, "mic");
      else setProblem("I didn't catch anything. Tap the mic and try again, or type your command.");
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch (err) {
      setListening(false);
      setProblem(`Couldn't start speech recognition: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const langLabel = LANGS.find((l) => l.code === lang)?.label;
  const micSize = large ? "size-24" : "size-16";

  return (
    <div className="space-y-4">
      <Card className={large ? "p-6 sm:p-8" : "p-5"}>
        <div className="flex flex-col items-center text-center">
          <button
            type="button"
            onClick={() => void toggleMic()}
            aria-label={listening ? "Stop listening" : "Speak a command"}
            aria-busy={micStarting}
            title={listening ? "Tap to stop" : "Speak a command"}
            className={`relative flex ${micSize} items-center justify-center rounded-full text-primary-ink shadow-lg transition ${
              listening ? "bg-danger shadow-danger/30" : micStarting ? "animate-pulse bg-primary/70" : "bg-gradient-to-br from-primary to-teal-800 shadow-primary/30 hover:scale-105"
            }`}
          >
            {listening && <span className="absolute inset-0 animate-ping rounded-full bg-danger/40" />}
            <Icon name="mic" className={large ? "relative size-10" : "relative size-7"} />
          </button>
          <p className="mt-4 text-lg font-semibold" role="status" aria-live="polite">
            {listening ? "Listening… speak now" : micStarting ? "Allow the microphone to start…" : "Tap the mic and speak"}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {listening ? `${langLabel} · tap the mic again to stop` : "Say what came in or went out, in English, Hindi or Telugu."}
          </p>

          <div className="mt-4 inline-flex rounded-full border border-line bg-canvas p-1" role="group" aria-label="Speech language">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLang(l.code)}
                aria-pressed={lang === l.code}
                className={`min-h-9 rounded-full px-4 text-sm font-medium transition ${lang === l.code ? "bg-primary text-primary-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {(listening || heard) && (
          <div className="mt-5 rounded-xl border border-line bg-canvas p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{listening ? "Hearing you…" : "I heard"}</p>
            <p className={`mt-1 min-h-8 font-semibold ${large ? "text-2xl" : "text-xl"}`}>{heard || "…"}</p>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void understand(text, "typed");
          }}
          className="mt-5 flex flex-col gap-2 sm:flex-row"
        >
          <div className="relative flex-1">
            <Icon name="keyboard" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={listening ? "Listening…" : "Or type a command, e.g. Add 5 bags of rice"}
              aria-label="Stock command"
              className="min-h-12 w-full rounded-xl border border-line bg-surface pl-11 pr-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
          </div>
          <button type="submit" disabled={busy || !text.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white disabled:opacity-40">
            {busy && !pending ? "Understanding…" : "Understand"}
          </button>
        </form>

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">Try saying</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setText(ex);
                  setHeard("");
                  void understand(ex, "typed");
                }}
                className="rounded-full border border-line bg-canvas px-3 py-1.5 text-sm text-ink-muted transition hover:border-primary hover:text-ink"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex gap-3 rounded-card border border-attention/30 bg-attention-bg p-3 text-sm text-attention" role="note">
        <Icon name="info" className="mt-0.5 size-5 shrink-0" />
        <p>
          <strong>Basic Mode:</strong> typed commands always work — even if the microphone or AI is unavailable. Commands are understood with built-in rules,
          so nothing here needs an internet AI service.
        </p>
      </div>

      {problem && (
        <div className="rounded-card border border-danger/30 bg-danger-bg p-4" role="alert">
          <p className="font-semibold text-danger">I need a bit more help</p>
          <p className="mt-1 text-sm text-ink">{problem}</p>
          <p className="mt-1 text-xs text-ink-muted">Nothing was changed.</p>
        </div>
      )}

      {pending && (
        <section className="rounded-card border-2 border-primary bg-surface p-5 shadow-lg shadow-primary/10" aria-live="polite">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Here&apos;s what I understood</p>
          <p className="mt-1 text-2xl font-bold leading-tight">{pending.i.summary}</p>
          <p className="mt-2 text-sm text-ink-muted">
            You said: <span className="text-ink">“{pending.said}”</span>
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-canvas p-3 text-base">
            <span className="text-ink-muted">Stock</span>
            <strong>{pending.i.stockBeforeText}</strong>
            <span aria-hidden>→</span>
            <strong className={pending.i.op === "add" ? "text-ok" : "text-attention"}>{pending.i.stockAfterText}</strong>
          </div>
          {pending.i.unitAssumed && <p className="mt-2 text-sm text-attention">No unit heard — using {pending.i.productName}&apos;s usual unit.</p>}
          {pending.i.willBeLow && <p className="mt-2 text-sm font-medium text-attention">⚠ This will leave {pending.i.productName} low on stock.</p>}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" onClick={cancel} disabled={busy} className="min-h-12 rounded-xl border border-line bg-surface font-medium">
              Cancel
            </button>
            <button type="button" onClick={() => void confirm()} disabled={busy} className="min-h-12 rounded-xl bg-primary font-semibold text-primary-ink hover:brightness-110 disabled:opacity-60">
              {busy ? "Saving…" : "Confirm"}
            </button>
          </div>
        </section>
      )}

      {toast && (
        <div className={`flex items-center justify-between gap-3 rounded-card border p-3 ${toast.tone === "ok" ? "border-ok/30 bg-ok-bg text-ok" : "border-line bg-surface text-ink"}`} role="status">
          <p className="font-medium">
            {toast.tone === "ok" ? "✓ " : "↩ "}
            {toast.message}
          </p>
          {toast.canUndo && (
            <button type="button" onClick={() => void undo()} disabled={busy} className="min-h-10 shrink-0 rounded-lg border border-ok/40 bg-surface px-3 text-sm font-semibold">
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
