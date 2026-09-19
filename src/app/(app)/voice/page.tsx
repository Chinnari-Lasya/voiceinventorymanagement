import type { Metadata } from "next";
import { VoiceView } from "@/components/pages/VoiceView";

export const metadata: Metadata = { title: "Voice Assistant · Stockbol" };

export default function VoicePage() {
  return <VoiceView />;
}
