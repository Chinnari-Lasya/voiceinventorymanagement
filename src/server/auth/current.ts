import { cookies } from "next/headers";
import { demoDb } from "@/server/demo/db";
import type { MeView } from "@/shared/demo";
import { SESSION_COOKIE, userFromToken } from "./session";

/** For server components/layouts: the signed-in user from the session cookie, or null. */
export async function getCurrentUser(): Promise<MeView | null> {
  const jar = await cookies();
  return userFromToken(demoDb(), jar.get(SESSION_COOKIE)?.value ?? null);
}
