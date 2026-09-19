import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { getCurrentUser } from "@/server/auth/current";

export const metadata: Metadata = { title: "Sign in · Stockbol" };
export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <AuthShell>
      <AuthForm mode="signin" />
    </AuthShell>
  );
}
