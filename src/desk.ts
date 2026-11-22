// Ghost Desk rules: pure functions, no network, no model, no order path.
export type Side = "BUY" | "SELL";
export type Source = "simulated" | "coinbase";

export interface Book {
  price: number;
  bid: number;
  ask: number;
  time: string;
  source: Source;
}

export interface Fill {
  id: string;
  side: Side;
  price: number;
  qty: number;
  at: string;
  pnl: number;
}

export interface Note {
  id: string;
  text: string;
  at: string;
  status: "accepted" | "rejected";
  reason: string;
}

export const RULES = {
  symbol: "BTC-USD",
  qty: 0.01,
  maxFillsPerDay: 3,
  cooldownMs: 15 * 60 * 1000,
  dailyLossCap: 100,
  maxAgeMs: 30_000,
  maxSpread: 0.002,
  fast: 5,
  slow: 20,
  band: 0.0005,
} as const;

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Small seeded generator (mulberry32): same numbers on every load. */
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

/** Simulated BTC-USD closes, steps + 1 values. Clearly labelled as simulated in the UI. */
export function simulatedPrices(seed: number, steps: number): number[] {
  const r = rng(seed);
  const out: number[] = [];
  let p = 96_400;
  for (let i = 0; i <= steps; i++) {
    const shock = (r() - 0.5) * 0.006 + Math.sin(i / 9) * 0.0016;
    p = round2(p * (1 + shock));
    out.push(p);
  }
  return out;
}

export function simulatedBook(price: number, now: number): Book {
  const half = Math.max(0.5, round2(price * 0.00004));
  return { price, bid: round2(price - half), ask: round2(price + half), time: new Date(now).toISOString(), source: "simulated" };
}

/** Coinbase public ticker JSON -> Book. Throws on anything missing or malformed. */
export function parseTicker(data: unknown): Book {
  const d = data as Record<string, unknown> | null;
  const price = Number(d?.price);
  const bid = Number(d?.bid);
  const ask = Number(d?.ask);
  const time = typeof d?.time === "string" ? d.time : "";
  if (!(price > 0) || !(bid > 0) || !(ask > 0) || !time || Number.isNaN(Date.parse(time))) {
    throw new Error("The ticker answer was missing a price, bid, ask or time");
  }
  return { price, bid, ask, time, source: "coinbase" };
}

export interface Health {
  ok: boolean;
  reason: string;
}

export function health(book: Book | null, now: number): Health {
  if (!book) return { ok: false, reason: "No price yet" };
  if (!(book.price > 0) || !(book.bid > 0) || !(book.ask > 0)) return { ok: false, reason: "Missing price" };
  if (book.bid >= book.ask) return { ok: false, reason: "Book crossed: bid is not below ask" };
  const age = now - Date.parse(book.time);
  if (!Number.isFinite(age)) return { ok: false, reason: "Feed time unreadable" };
  if (age < -5000) return { ok: false, reason: "Feed time is in the future" };
  if (age > RULES.maxAgeMs) return { ok: false, reason: `Feed stale (${Math.round(age / 1000)}s old)` };
  const mid = (book.bid + book.ask) / 2;
  if ((book.ask - book.bid) / mid > RULES.maxSpread) return { ok: false, reason: "Spread too wide" };
  return { ok: true, reason: "Feed fresh" };
}

export function sma(xs: number[], n: number): number {
  const s = xs.slice(-n);
  return s.reduce((a, b) => a + b, 0) / s.length;
}

export interface Signal {
  action: Side | "WATCH";
  reason: string;
  fast: number | null;
  slow: number | null;
}

export function signal(history: number[]): Signal {
  if (history.length < RULES.slow) {
    return { action: "WATCH", reason: `Need ${RULES.slow} prices, have ${history.length}`, fast: null, slow: null };
  }
  const fast = sma(history, RULES.fast);
  const slow = sma(history, RULES.slow);
  if (fast > slow * (1 + RULES.band)) return { action: "BUY", reason: "Fast average is above slow", fast, slow };
  if (fast < slow * (1 - RULES.band)) return { action: "SELL", reason: "Fast average is below slow", fast, slow };
  return { action: "WATCH", reason: "Averages are too close: no edge", fast, slow };
}

export function position(fills: Fill[]): { qty: number; entry: number | null } {
  let qty = 0;
  let entry: number | null = null;
  for (const f of fills) {
    if (f.side === "BUY") { qty = f.qty; entry = f.price; }
    else { qty = 0; entry = null; }
  }
  return { qty, entry };
}

const utcDay = (t: number | string) => new Date(t).toISOString().slice(0, 10);

export function todayStats(fills: Fill[], now: number) {
  const today = fills.filter((f) => utcDay(f.at) === utcDay(now));
  return { count: today.length, realized: round2(today.reduce((a, f) => a + f.pnl, 0)) };
}

export function cooldownLeft(fills: Fill[], now: number): number {
  const last = fills[fills.length - 1];
  if (!last) return 0;
  return Math.max(0, Date.parse(last.at) + RULES.cooldownMs - now);
}

export interface GateInput {
  book: Book | null;
  history: number[];
  fills: Fill[];
  now: number;
}

/** Every reason the paper fill is blocked. Empty list = allowed. */
export function gate(side: Side, input: GateInput): string[] {
  const reasons: string[] = [];
  const h = health(input.book, input.now);
  if (!h.ok) reasons.push(`HOLD only: ${h.reason}`);
  const sig = signal(input.history);
  if (sig.action !== side) reasons.push(`Rules say ${sig.action}, not ${side}`);
  const pos = position(input.fills);
  if (side === "BUY" && pos.qty > 0) reasons.push("Already holding one unit");
  if (side === "SELL" && pos.qty === 0) reasons.push("Nothing to close: the desk is flat");
  const day = todayStats(input.fills, input.now);
  if (day.count >= RULES.maxFillsPerDay) reasons.push(`Daily limit reached (${day.count}/${RULES.maxFillsPerDay})`);
  if (day.realized <= -RULES.dailyLossCap) reasons.push("Daily loss cap hit: the desk is locked until tomorrow (UTC)");
  const cool = cooldownLeft(input.fills, input.now);
  if (cool > 0) reasons.push(`Cooldown: ${Math.ceil(cool / 60000)} min left`);
  return reasons;
}

export const confirmPhrase = (side: Side) => `YES ${side} ${RULES.symbol}`;

export function makeFill(side: Side, book: Book, fills: Fill[], now: number, id: string): Fill {
  const price = side === "BUY" ? book.ask : book.bid;
  const pos = position(fills);
  const pnl = side === "SELL" && pos.entry !== null ? round2((price - pos.entry) * pos.qty) : 0;
  return { id, side, price, qty: RULES.qty, at: new Date(now).toISOString(), pnl };
}

const SETS_TRADE = /\b(buy|sell|short|long)\b|\$\s?\d|\b\d+(\.\d+)?\s?(btc|units?)\b|\bprice\s*(=|:|to)\b/i;

/** Read-only reviewer: may reject a note, never edits the ledger. */
export function review(text: string, now: number, id: string): Note {
  const t = text.trim();
  const base = { id, text: t, at: new Date(now).toISOString() };
  if (t.length > 280) return { ...base, status: "rejected", reason: "Longer than 280 characters" };
  if (SETS_TRADE.test(t)) return { ...base, status: "rejected", reason: "A note can't set the side, size or price" };
  return { ...base, status: "accepted", reason: "