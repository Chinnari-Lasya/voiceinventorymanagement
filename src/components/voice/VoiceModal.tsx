"use client";

import { useEffect } from "react";
import { Icon } from "@/components/ui/Icon";
import { VoiceConsole } from "./VoiceConsole";

/** Quick voice update from anywhere (used by the dashboard). Same console/pipeline as the Voice Assistant page. */
export function VoiceModal({ onClose, onActivity }: { onClose: () => void; onActivity: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Voice update">
      <button type="button" aria-label="Close" className="fixed inset-0 bg-black/45" onClick={onClose} />
      <div className="relative my-4 w-full max-w-2xl rounded-2xl bg-canvas p-4 shadow-2xl sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Voice update</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-ink-muted hover:bg-surface">
            <Icon name="x" />
          </button>
        </div>
        <VoiceConsole onActivity={onActivity} />
      </div>
    </div>
  );
}
