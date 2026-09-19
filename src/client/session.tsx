"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { MeView } from "@/shared/demo";

const Ctx = createContext<MeView | null>(null);

export function SessionProvider({ me, children }: { me: MeView; children: ReactNode }) {
  return <Ctx.Provider value={me}>{children}</Ctx.Provider>;
}

export function useMe(): MeView {
  const me = useContext(Ctx);
  if (!me) throw new Error("useMe must be used inside <SessionProvider>");
  return me;
}
