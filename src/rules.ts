// Ghost Pump Desk rules: pure functions. No network, no keys, no model.
// Scout -> Skills -> Risk gate -> Clerk. A skill can vote; only the gate lets a fill happen.
export type Side = "BUY" | "SELL";
export type FeedSource = "pumpportal" | "simulated";
export type Mode = "paper" | "live";
export type SkillId = "discovery" | "liquidity" | "momentum" | "flow" | "exit";
export type Vote = "BUY" | "SELL" | "HOLD" | "BLOCK";

export interface Token {
  mint: string;
  symbol: string;
  name: string;
  priceSol: number; // SOL per token, from the bonding curve (vSol / vTokens)
  mcapSol: number;
  liquiditySol: number;
  buys: number;
  sells: number;
  volumeSol: number;
  createdAt: number;
  at: number; // time of the last update
  source: FeedSource;
  history: number[]; // recent prices, oldest first
}

export interface Position {
  mint: string;
  symbol: string;
  qty: number;
  entry: number;
  sizeSol: number;
  openedAt: number;
  mode: Mode;
}

export interface Fill {
  id: string;
  mint: string;
  symbol: string;
  side: Side;
  priceSol: number;
  qty: number;
  sizeSol: number;
  pnlSol: number;
  at: number;
  mode: Mode;
  reason: string;
  signature?: string;
}

export interface Settings {
  auto: boolean;
  mode: Mode;
  sizeSol: number;
  skills: Record<SkillId, boolean>;
}

export interface SkillResult {
  id: SkillId;
  vote: Vote;
  reason: string;
}

export interface Decision {
  mint: string;
  symbol: string;
  action: Side | "HOLD";
  reason: string;
  votes: SkillResult[];
  at: number;
}

export const LIMITS = {
  maxSizeSol: 0.05,
  maxOpen: 3,
  maxFillsPerDay: 20,
  dailyLossCapSol: 0.1,
  maxAgeMs: 15_000,
  cooldownMs: 60_000,
  takeProfit: 0.3,
  stopLoss: -0.15,
  maxHoldMs: 10 * 60_000,
  minLiquiditySol: 5,
  maxTokenAgeMs: 60 * 60_000,
  slippage: 0.01,
} as const;

export const SKILLS: { id: SkillId; title: string; text: string }[] = [
  { id: "discovery", title: "Discovery", text: "Only tokens under 60 minutes old with at least 3 price updates." },
  { id: "liquidity", title: "Liquidity", text: "Blocks a buy when the bonding curve holds under 5 SOL." },
  { id: "momentum", title: "Momentum", text: "Buy vote when price is 3% over its recent average, sell vote at 3% under." },
  { id: "flow", title: "Order flow", text: "Buy vote when 60% of trades are buys, sell vote under 40%." },
  { id: "exit", title: "Exit", text: "Sells at +30%, at -15%, or after 10 minutes held." },
];

export const DEFAULT_SETTINGS: Settings = {
  auto: true,
  mode: "paper",
  sizeSol: 0.02,
  skills: { discovery: true, liquidity: true, momentum: true, flow: true, exit: true },
};

export const round = (n: number, d = 6) => Math.round(n * 10 ** d) / 10 ** d;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

export function runSkills(t: Token, pos: Position | undefined, now: number): SkillResult[] {
  const out: SkillResult[] = [];
  const age = now - t.createdAt;
  out.push(
    age > LIMITS.maxTokenAgeMs
      ? { id: "discovery", vote: "BLOCK", reason: "Older than 60 minutes" }
      : t.history.length < 3
        ? { id: "discovery", vote: "BLOCK", reason: "Fewer than 3 price updates" }
        : { id: "discovery", vote: "HOLD", reason: "Fresh token" },
  );
  out.push(
    t.liquiditySol < LIMITS.minLiquiditySol
      ? { id: "liquidity", vote: "BLOCK", reason: `Only ${round(t.liquiditySol, 2)} SOL in the curve` }
      : { id: "liquidity", vote: "HOLD", reason: `${round(t.liquiditySol, 2)} SOL in the curve` },
  );
  const prev = t.history.slice(0, -1);
  const avg = mean(prev.length ? prev : t.history);
  const move = avg > 0 ? t.priceSol / avg - 1 : 0;
  out.push({
    id: "momentum",
    vote: move >= 0.03 ? "BUY" : move <= -0.03 ? "SELL" : "HOLD",
    reason: `${round(move * 100, 1)}% vs recent average`,
  });
  const trades = t.buys + t.sells;
  const share = trades ? t.buys / trades : 0.5;
  out.push({
    id: "flow",
    vote: trades < 5 ? "HOLD" : share >= 0.6 ? "BUY" : share < 0.4 ? "SELL" : "HOLD",
    reason: trades < 5 ? "Fewer than 5 trades" : `${Math.round(share * 100)}% buys of ${trades}`,
  });
  if (pos) {
    const ret = t.priceSol / pos.entry - 1;
    const held = now - pos.openedAt;
    const vote: Vote = ret >= LIMITS.takeProfit || ret <= LIMITS.stopLoss || held >= LIMITS.maxHoldMs ? "SELL" : "HOLD";
    out.push({ id: "exit", vote, reason: `${round(ret * 100, 1)}% after ${Math.round(held / 1000)}s` });
  } else out.push({ id: "exit", vote: "HOLD", reason: "No position" });
  return out;
}

export function dayStats(fills: Fill[], now: number) {
  const day = new Date(now).toISOString().slice(0, 10);
  const today = fills.filter((f) => new Date(f.at).toISOString().slice(0, 10) === day);
  return { count: today.length, pnlSol: round(today.reduce((a, f) => a + f.pnlSol, 0)) };
}

/** The risk gate: the only place a fill can be allowed. */
export function decide(
  t: Token,
  positions: Position[],
  fills: Fill[],
  settings: Settings,
  now: number,
): Decision {
  const pos = positions.find((p) => p.mint === t.mint);
  const votes = runSkills(t, pos, now).filter((v) => settings.skills[v.id]);
  const base = { mint: t.mint, symbol: t.symbol, votes, at: now };
  const hold = (reason: string): Decision => ({ ...base, action: "HOLD", reason });
  if (now - t.at > LIMITS.maxAgeMs) return hold("Price is stale");
  if (pos) {
    const exit = votes.find((v) => v.id === "exit" && v.vote === "SELL");
    const sells = votes.filter((v) => v.vote === "SELL").length;
    if (exit) return { ...base, action: "SELL", reason: `Exit: ${exit.reason}` };
    if (sells >= 2) return { ...base, action: "SELL", reason: "Two skills vote sell" };
    return hold("Holding position");
  }
  const block = votes.find((v) => v.vote === "BLOCK");
  if (block) return hold(`${block.id}: ${block.reason}`);
  const stats = dayStats(fills, now);
  if (stats.pnlSol <= -LIMITS.dailyLossCapSol) return hold("Daily loss cap reached");
  if (stats.count >= LIMITS.maxFillsPerDay) return hold("Daily fill limit reached");
  if (positions.length >= LIMITS.maxOpen) return hold("Max open positions");
  const last = fills.filter((f) => f.mint === t.mint).at(-1);
  if (last && now - last.at < LIMITS.cooldownMs) return hold("Cooldown on this token");
  const buys = votes.filter((v) => v.vote === "BUY").length;
  if (buys >= 2) return { ...base, action: "BUY", reason: "Two skills vote buy" };
  return hold(buys ? "Only one buy vote" : "No buy signal");
}

export const clampSize = (s: number) => round(Math.min(LIMITS.maxSizeSol, Math.max(0.001, Number(s) || 0)), 4);

/** Paper fill at the curve price with slippage against us. */
export function applyFill(
  d: Decision,
  t: Token,
  positions: Position[],
  settings: Settings,
  id: string,
  now: number,
): { fill: Fill; positions: Position[] } | null {
  if (d.action === "HOLD") return null;
  const mode = settings.mode;
  if (d.action === "BUY") {
    const price = t.priceSol * (1 + LIMITS.slippage);
    const sizeSol = clampSize(settings.sizeSol);
    const qty = round(sizeSol / price, 2);
    const pos: Position = { mint: t.mint, symbol: t.symbol, qty, entry: price, sizeSol, openedAt: now, mode };
    const fill: Fill = { id, mint: t.mint, symbol: t.symbol, side: "BUY", priceSol: price, qty, sizeSol, pnlSol: 0, at: now, mode, reason: d.reason };
    return { fill, positions: [...positions, pos] };
  }
  const pos = positions.find((p) => p.mint === t.mint);
  if (!pos) return null;
  const price = t.priceSol * (1 - LIMITS.slippage);
  const value = round(pos.qty * price);
  const fill: Fill = {
    id, mint: t.mint, symbol: t.symbol, side: "SELL", priceSol: price, qty: pos.qty,
    sizeSol: value, pnlSol: round(value - pos.sizeSol), at: now, mode: pos.mode, reason: d.reason,
  };
  return { fill, positions: positions.filter((p) => p.mint !== t.mint) };
}

const SETS_TRADE = /\b(buy|sell|ape|dump)\b|\b\d+(\.\d+)?\s?sol\b|\bsize\s*(=|:|to)\b/i;

/** Read-only reviewer: a note can explain, never order. */
export function reviewNote(text: string, id: string, now: number) {
  const t = text.trim().slice(0, 500);
  const base = { id, text: t, at: now };
  if (!t) return { ...base, status: "rejected" as const, reason: "Empty note" };
  if (t.length > 280) return { ...base, status: "rejected" as const, reason: "Longer than 280 characters" };
  if (SETS_TRADE.test(t)) return { ...base, status: "rejected" as const, reason: "A note can't place or size a trade" };
  return { ...base, status: "accepted" as const, reason: "Saved to the journal" };
}

/** Seeded generator (mulberry32) for the simulated feed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turn a PumpPortal create/buy/sell message into a token update. */
export function fromPumpPortal(msg: Record<string, unknown>, prev: Token | undefined, now: number): Token | null {
  const mint = typeof msg.mint === "string" ? msg.mint : null;
  const vSol = Number(msg.vSolInBondingCurve);
  const vTok = Number(msg.vTokensInBondingCurve);
  if (!mint || !(vSol > 0) || !(vTok > 0)) return null;
  const price = vSol / vTok;
  const tx = String(msg.txType ?? "");
  const sol = Number(msg.solAmount) || 0;
  const base: Token = prev ?? {
    mint, symbol: String(msg.symbol ?? mint.slice(0, 4)).slice(0, 12), name: String(msg.name ?? "").slice(0, 40),
    priceSol: price, mcapSol: 0, liquiditySol: 0, buys: 0, sells: 0, volumeSol: 0, createdAt: now, at: now,
    source: "pumpportal", history: [],
  };
  return {
    ...base,
    priceSol: price,
    mcapSol: Number(msg.marketCapSol) || base.mcapSol,
    liquiditySol: round(vSol, 3),
    buys: base.buys + (tx === "buy" ? 1 : 0),
    sells: base.sells + (tx === "sell" ? 1 : 0),
    volumeSol: round(base.volumeSol + sol, 4),
    at: now,
    history: [...base.history, price].slice(-30),
  };
}
