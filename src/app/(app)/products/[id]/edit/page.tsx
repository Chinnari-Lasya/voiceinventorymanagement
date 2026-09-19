import type { Metadata } from "next";
import { EditProductView } from "@/components/pages/ProductForm";

export const metadata: Metadata = { title: "Edit product · Stockbol" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditProductView id={id} />;
}
