import type { Metadata } from "next";
import { SettingsView } from "@/components/pages/SettingsView";

export const metadata: Metadata = { title: "Settings · Stockbol" };

export default function SettingsPage() {
  return <SettingsView />;
}
