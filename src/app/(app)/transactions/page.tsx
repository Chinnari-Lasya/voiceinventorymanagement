import type { Metadata } from "next";
import { TransactionsView } from "@/components/pages/TransactionsView";

export const metadata: Metadata = { title: "Transactions · Stockbol" };

export default function TransactionsPage() {
  return <TransactionsView />;
}
