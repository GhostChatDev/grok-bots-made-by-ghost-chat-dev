// Demo desk: runs the same rules in the browser when there is no server (GitHub Pages).
// Every token here is simulated and labelled so. Live trading is never possible in the demo.
import {
  DEFAULT_SETTINGS, LIMITS, SKILLS, applyFill, clampSize, decide, reviewNote, rng, round,
  type Decision, type Fill, type Position, type Settings, type Token,
} from "./rules";
import type { DeskState, Note } from "./desk";

const KEY = "ghost-pump-desk-demo-v1";
const NAMES = ["Ghost Pup", "Sari Coin", "Pares Cat", "Moto Mods", "Ice Grind", "Level Up", "Magic Bean", "Bull Run"];

interface Saved { settings: Settings; positions: Position[]; fills: Fill[]; notes: Note[]; seq: number }

function loadSaved(): Saved {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || "null") as Saved | null;
    if (j && j.settings && Array.isArray(j.fills)) return { ...j, settings: { ...j.settings, mode: "paper" } };
  } catch { /* corrupt storage: start fresh */ }
  return { settings: { ...DEFAULT_SETTINGS, skills: { ...DEFAULT_SETTINGS.skills } }, positions: [], fills: [], notes: [], seq: 1 };
}

let saved = loadSaved();
let tokens: Token[] = [];
let decisions: Decision[] = [];
const rand = rng(2026);
let lastTick = 0;

const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* storage full */ } };

function newToken(i: number, now: number): Token {
  const name = NAMES[i % NAMES.length];
  const price = 2e-8 * (1 + rand() * 4);
  return {
    mint: `demo${i}${Math.floor(rand() * 1e6).toString(36)}`, symbol: name.replace(/\s/g, "").slice(0, 6).toUpperCase(), name,
    priceSol: price, mcapSol: round(price * 1e9, 2), liquiditySol: round(4 + rand() * 30, 3), buys: 0, sells: 0, volumeSol: 0,
    createdAt: now - Math.floor(rand() * 20 * 60_000), at: now, source: "simulated", history: [price],
  };
}

function step(now: number) {
  if (!tokens.length) tokens = Array.from({ length: 6 }, (_, i) => newToken(i, now));
  tokens = tokens.map((t) => {
    const drift = (rand() - 0.47) * 0.08;
    const price = Math.max(1e-10, t.priceSol * (1 + drift));
    const buy = drift > 0;
    return {
      ...t, priceSol: price, mcapSol: round(price * 1e9, 2), liquiditySol: round(Math.max(1, t.liquiditySol * (1 + drift / 2)), 3),
      buys: t.buys + (buy ? 2 : 1), sells: t.sells + (buy ? 1 : 2), volumeSol: round(t.volumeSol + rand() * 2, 4),
      at: now, history: [...t.history, price].slice(-30),
    };
  });
  // Old tokens leave the watchlist; a fresh one takes their place (unless a position is open on it).
  tokens = tokens.map((t, i) =>
    now - t.createdAt > LIMITS.maxTokenAgeMs && !saved.positions.some((p) => p.mint === t.mint) ? newToken(saved.seq + i, now) : t);
  if (!saved.settings.auto) return;
  for (const t of tokens) {
    const d = decide(t, saved.positions, saved.fills, saved.settings, now);
    decisions = [d, ...decisions].slice(0, 40);
    const r = applyFill(d, t, saved.positions, saved.settings, `d${saved.seq++}`, now);
    if (r) { saved.positions = r.positions; saved.fills = [...saved.fills, r.fill].slice(-200); persist(); }
  }
}

function state(): DeskState {
  const now = Date.now();
  if (now - lastTick > 1500) { step(now); lastTick = now; }
  return {
    tokens, settings: saved.settings, positions: saved.positions, fills: saved.fills, notes: saved.notes, decisions,
    feed: { status: "off", lastAt: now, error: "Demo: simulated tokens in your browser (no server)" },
    liveAllowed: false, hasKey: false, skills: SKILLS, limits: { ...LIMITS }, now,
  };
}

export const demo = {
  state: async () => state(),
  settings: async (patch: Partial<Settings> & { confirm?: string }) => {
    if (patch.mode === "live") throw new Error("Live trading needs the server with its own key. The demo only paper-trades.");
    const s = saved.settings;
    saved.settings = {
      ...s,
      auto: patch.auto ?? s.auto,
      sizeSol: patch.sizeSol !== undefined ? clampSize(patch.sizeSol) : s.sizeSol,
      skills: { ...s.skills, ...(patch.skills ?? {}) },
      mode: "paper",
    };
    persist();
    return state();
  },
  note: async (text: string) => {
    const note = reviewNote(text, `n${saved.seq++}`, Date.now()) as Note;
    if (note.status === "accepted") { saved.notes = [note, ...saved.notes].slice(0, 100); persist(); }
    return { note, state: state() };
  },
  close: async (mint: string) => {
    const t = tokens.find((x) => x.mint === mint);
    const pos = saved.positions.find((p) => p.mint === mint);
    if (!t || !pos) throw new Error("No open position on that token");
    const d: Decision = { mint, symbol: t.symbol, action: "SELL", reason: "Closed by you", votes: [], at: Date.now() };
    const r = applyFill(d, { ...t, at: Date.now() }, saved.positions, saved.settings, `d${saved.seq++}`, Date.now());
    if (r) { saved.positions = r.positions; saved.fills = [...saved.fills, r.fill].slice(-200); persist(); }
    return state();
  },
};
