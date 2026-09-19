import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { getCurrentUser } from "@/server/auth/current";

export const metadata: Metadata = { title: "Create account · Stockbol" };
export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <AuthShell>
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
