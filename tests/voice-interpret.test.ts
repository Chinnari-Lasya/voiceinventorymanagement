import { describe, expect, it } from "vitest";
import { interpret, type InterpretResult } from "@/server/voice/interpret";
import type { CatalogProduct } from "@/server/domain/inventory";

const catalog: CatalogProduct[] = [
  {
    id: "rice",
    name: "Rice",
    category: "Grains",
    baseUnit: "piece",
    displayUnit: "bag",
    stockBase: 20,
    thresholdBase: 10,
    aliases: ["chawal"],
  },
];

function success(text: string) {
  const result = interpret(text, catalog);
  expect(result.ok).toBe(true);
  return (result as Extract<InterpretResult, { ok: true }>).interpretation;
}

describe("natural voice input", () => {
  it.each(["5 bags of rice came in", "I bought five bags of chawal", "rice stock arrived: 2 bags"])('understands "%s" as stock received', (text) => {
    expect(success(text)).toMatchObject({ op: "add", quantity: expect.any(Number), unit: "bag" });
  });

  it.each(["I sold 2 bags of rice", "3 bags of rice went out", "gave away one bag rice"])('understands "%s" as stock leaving', (text) => {
    expect(success(text)).toMatchObject({ op: "remove", quantity: expect.any(Number), unit: "bag" });
  });

  it("does not guess when input does not say whether stock changed", () => {
    const result = interpret("hello, can you help me?", catalog);
    expect(result).toMatchObject({ ok: false, code: "op_unclear" });
    expect(result.ok === false && result.message).toContain("Nothing was changed");
  });
});