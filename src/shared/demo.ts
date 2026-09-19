// DTOs shared by the API and the UI (types + small constants only; no server imports).

export interface ProductView {
  id: string;
  name: string;
  category: string;
  qty: number; // in the display unit
  unit: string; // display unit label, e.g. "bags", "kg"
  displayUnit: string; // canonical display unit, e.g. "bag", "kg"
  stockText: string; // "20 bags"
  low: boolean;
  thresholdText: string; // "10 bags" ("" when no alert level is set)
  thresholdQty: number | null; // in the display unit
}

export interface TxnView {
  id: string;
  productName: string;
  type: string; // purchase | sale | adjustment | opening | reversal
  deltaText: string; // "+5 bags" / "-2 bags"
  stockAfterText: string;
  kind: "add" | "remove" | "undo";
  source: string; // db source: voice | manual | seed | undo
  sourceLabel: "Voice" | "Typed" | "Manual" | "Undo" | "Seed";
  createdAt: string;
  reverted: boolean;
  canUndo: boolean;
}

export interface StateView {
  shopName: string;
  products: ProductView[];
  recent: TxnView[];
  undoTarget: { id: string; label: string } | null;
}

export type Op = "add" | "remove";

export interface InterpretationView {
  productId: string;
  productName: string;
  op: Op;
  quantity: number;
  unit: string; // canonical unit, e.g. "bag"
  unitAssumed: boolean;
  summary: string; // "Add 5 bags of Rice"
  stockBeforeText: string;
  stockAfterText: string;
  willBeLow: boolean;
}

export interface VoiceEventView {
  id: string;
  transcript: string;
  engine: "web_speech" | "typed" | "server";
  status: string; // pending_confirm | needs_clarification | applied | cancelled | ...
  summary: string | null; // interpreted action, when understood
  error: string | null; // why it needed help, when refused
  createdAt: string;
}

export interface InsightItem {
  productId: string;
  name: string;
  status: "out" | "low" | "ok";
  stockText: string;
  thresholdText: string;
  headline: string; // "Oil is below your threshold of 10 bottles."
  why: string[]; // the deterministic reasoning, line by line
  suggestion: string | null; // "Order about 12 bottles to bring Oil back to 20 bottles."
}

export interface Preferences {
  language: "en" | "hi" | "te";
  voiceLang: "en-IN" | "hi-IN" | "te-IN";
  notifications: { lowStock: boolean; dailySummary: boolean; voiceTips: boolean };
}

export const DEFAULT_PREFERENCES: Preferences = {
  language: "en",
  voiceLang: "en-IN",
  notifications: { lowStock: true, dailySummary: false, voiceTips: true },
};

export interface MeView {
  id: string;
  username: string; // email or phone used to sign in
  displayName: string;
  shopName: string;
  preferences: Preferences;
}
