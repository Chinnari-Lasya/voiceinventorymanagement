import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SessionProvider } from "@/client/session";
import { AppShell } from "@/components/app/AppShell";
import { getCurrentUser } from "@/server/auth/current";

export const dynamic = "force-dynamic";

/** Everything under (app) requires a signed-in user; otherwise redirect to sign in. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect("/signin");
  return (
    <SessionProvider me={me}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
