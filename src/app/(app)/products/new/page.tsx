import type { Metadata } from "next";
import { NewProductView } from "@/components/pages/ProductForm";

export const metadata: Metadata = { title: "Add product · Stockbol" };

export default function NewProductPage() {
  return <NewProductView />;
}
