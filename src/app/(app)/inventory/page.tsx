import type { Metadata } from "next";
import { InventoryView } from "@/components/pages/InventoryView";

export const metadata: Metadata = { title: "Inventory · Stockbol" };

export default function InventoryPage() {
  return <InventoryView />;
}
