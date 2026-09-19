import type { Metadata } from "next";
import { InsightsView } from "@/components/pages/InsightsView";

export const metadata: Metadata = { title: "Insights · Stockbol" };

export default function InsightsPage() {
  return <InsightsView />;
}
