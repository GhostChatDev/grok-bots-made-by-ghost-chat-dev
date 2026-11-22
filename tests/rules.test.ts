import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS, LIMITS, applyFill, clampSize, decide, fromPumpPortal, reviewNote,
  type Fill, type Position, type Token,
} from "../src/rules";

const NOW = Date.UTC(2026, 10, 22, 12, 0, 0);

function token(over: Partial<Token> = {}): Token {
  return {
    mint: "MintA", symbol: "ALEX", name: "Alex Coin", priceSol: 1.1e-7, mcapSol: 30, liquiditySol: 12,
    buys: 8, sells: 2, volumeSol: 3, createdAt: NOW - 5 * 60_000, at: NOW, source: "pumpportal",
    history: [1e-7, 1e-7, 1e-7, 1.1e-7], ...over,
  };
}
const fill = (over: Partial<Fill> = {}): Fill => ({
  id: "f", mint: "Other", symbol: "X", side: "SELL", priceSol: 1, qty: 1, sizeSol: 0.02, pnlSol: 0,
  at: NOW - 1000, mode: "paper", reason: "", ...over,
});

describe("risk gate", () => {
  it("buys when two skills vote buy and nothing blocks", () => {
    expect(decide(token(), [], [], DEFAULT_SETTINGS, NOW).action).toBe("BUY");
  });
  it("holds on a stale price", () => {
    expect(decide(token({ at: NOW - LIMITS.maxAgeMs - 1 }), [], [], DEFAULT_SETTINGS, NOW).reason).toBe("Price is stale");
  });
  it("blocks thin liquidity", () => {
    expect(decide(token({ liquiditySol: 1 }), [], [], DEFAULT_SETTINGS, NOW).action).toBe("HOLD");
  });
  it("stops at the daily loss cap", () => {
    const d = decide(token(), [], [fill({ pnlSol: -LIMITS.dailyLossCapSol })], DEFAULT_SETTINGS, NOW);
    expect(d.reason).toBe("Daily loss cap reached");
  });
  it("stops at the daily fill limit", () => {
    const fills = Array.from({ length: LIMITS.maxFillsPerDay }, (_, i) => fill({ id: String(i) }));
    expect(decide(token(), [], fills, DEFAULT_SETTINGS, NOW).reason).toBe("Daily fill limit reached");
  });
  it("respects the cooldown on the same token", () => {
    expect(decide(token(), [], [fill({ mint: "MintA" })], DEFAULT_SETTINGS, NOW).reason).toBe("Cooldown on this token");
  });
  it("needs two votes: one disabled skill means no buy", () => {
    const s = { ...DEFAULT_SETTINGS, skills: { ...DEFAULT_SETTINGS.skills, flow: false } };
    expect(decide(token(), [], [], s, NOW).action).toBe("HOLD");
  });
  it("sells at the stop loss", () => {
    const pos: Position = { mint: "MintA", symbol: "ALEX", qty: 1, entry: 2e-7, sizeSol: 0.02, openedAt: NOW - 1000, mode: "paper" };
    expect(decide(token(), [pos], [], DEFAULT_SETTINGS, NOW).action).toBe("SELL");
  });
});

describe("clerk", () => {
  it("caps the size at the max", () => {
    expect(clampSize(5)).toBe(LIMITS.maxSizeSol);
    expect(clampSize(Number.NaN)).toBe(0.001);
  });
  it("a sell keeps the position's own mode (paper is never booked as live)", () => {
    const t = token();
    const pos: Position = { mint: "MintA", symbol: "ALEX", qty: 100, entry: 1e-7, sizeSol: 0.00001, openedAt: NOW, mode: "paper" };
    const d = { mint: "MintA", symbol: "ALEX", action: "SELL" as const, reason: "test", votes: [], at: NOW };
    const r = applyFill(d, t, [pos], { ...DEFAULT_SETTINGS, mode: "live" }, "id1", NOW);
    expect(r?.fill.mode).toBe("paper");
    expect(r?.positions).toHaveLength(0);
  });
});

describe("feed and notes", () => {
  it("reads a PumpPortal trade message", () => {
    const t = fromPumpPortal({ mint: "M", symbol: "ZED", txType: "buy", vSolInBondingCurve: 30, vTokensInBondingCurve: 1e9, solAmount: 0.5 }, undefined, NOW);
    expect(t?.priceSol).toBeCloseTo(3e-8);
    expect(t?.buys).toBe(1);
  });
  it("ignores a message without curve numbers", () => {
    expect(fromPumpPortal({ mint: "M" }, undefined, NOW)).toBeNull();
  });
  it("a note can explain but never order a trade", () => {
    expect(reviewNote("buy 2 sol now", "n", NOW).status).toBe("rejected");
    expect(reviewNote("Quiet market today", "n", NOW).status).toBe("accepted");
  });
});
