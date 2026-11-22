// A self-contained desk for the static (GitHub Pages) build: the same rules, run in the
// browser with a seeded simulated feed. Labelled simulated everywhere; no keys, no network.
import {
  DEFAULT_SETTINGS,
  LIMITS,
  applyFill,
  clampSize,
  decide,
  reviewNote,
  rng,
  round,
  type Decision,
  type Fill,
  type Position,
  type Settings,
  type Token,
} from "./rules";
import type { DeskState, Note } from "./desk";

const SYMBOLS = ["GHOST", "MOON", "PEPE", "CAT", "SOLB", "FROG", "DOGE", "APE", "BONK", "RUGX", "CHAD", "WOJAK"];
const SUFFIX = ["", "2", "420", "69", "x", "coin"];

function makeToken(i: number, now: number, rand: () => number): Token {
  const base = SYMBOLS[i % SYMBOLS.length];
  const symbol = ((base + SUFFIX[Math.floor(rand() * SUFFIX.length)]) as string).slice(0, 10);
  const price = round(1e-6 + rand() * 4e-5, 12);
  const curve = round(6 + rand() * 60, 3);
  const mcap = round(curve * 30, 3);
  const hist: number[] = [];
  for (let k = 0; k < 6; k++) hist.push(round(price * (0.94 + rand() * 0.12), 12));
  return {
    mint: `sim${i}-${Math.floor(rand() * 1e6)}`,
    symbol,
    name: `${symbol} (simulated)`,
    priceSol: price,
    mcapSol: mcap,
    liquiditySol: curve,
    buys: Math.floor(rand() * 40),
    sells: Math.floor(rand() * 25),
    volumeSol: round(rand() * 12, 3),
    createdAt: now - Math.floor(rand() * 40) * 60_000,
    at: now,
    source: "simulated",
    history: hist,
  };
}

export interface LocalDesk {
  bump: () => DeskState;
  patch: (p: Partial<Settings>) => DeskState;
  note: (text: string) => { note: Note; state: DeskState };
  close: (mint: string) => DeskState;
  reset: () => void;
}

export function createLocalDesk(href = ""): LocalDesk {
  const now0 = Date.now();
  const rand = rng(Math.floor(now0 / 60_000) % 1_000_000);
  let counter = 0;
  let state: DeskState = {
    tokens: Array.from({ length: 8 }, (_, i) => makeToken(i, now0, rand)).sort((a, b) => b.liquiditySol - a.liquiditySol),
    settings: { ...DEFAULT_SETTINGS, skills: { ...DEFAULT_SETTINGS.skills } },
    positions: [] as Position[],
    fills: [] as Fill[],
    notes: [] as Note[],
    decisions: [] as Decision[],
    feed: { status: "off", lastAt: now0, error: "Static build: simulated feed" },
    liveAllowed: false,
    hasKey: false,
    skills: [],
    limits: { ...LIMITS } as unknown as Record<string, number>,
    now: now0,
  };
  void href;
  return { bump, patch, note, close, reset };

  function sync(): DeskState {
    state.now = Date.now();
    state.skills = state.skills.length ? state.skills : [];
    return state;
  }

  function stepPrices(now: number): void {
    for (const t of state.tokens) {
      const drift = (rand() - 0.46) * 0.05;
      t.priceSol = Math.max(round(t.priceSol * (1 + drift), 12), 1e-12);
      t.liquiditySol = round(Math.max(0.5, t.liquiditySol + (rand() - 0.5) * 1.2), 3);
      t.mcapSol = round(t.mcapSol * (1 + drift), 3);
      t.volumeSol = round(t.volumeSol + rand() * 0.8, 3);
      t.history = [...t.history, t.priceSol].slice(-40);
      const trades = Math.floor(rand() * 4);
      t.buys += Math.floor(trades * (0.4 + rand() * 0.5));
      t.sells += Math.floor(trades * (0.3 + rand() * 0.4));
      t.at = now;
      t.source = "simulated";
    }
  }
}
  function persist(): void {
    try {
      localStorage.setItem(
        "ghost-pump-desk",
        JSON.stringify({ settings: state.settings, positions: state.positions, fills: state.fills, notes: state.notes, decisions: state.decisions.slice(0, 40) }),
      );
    } catch {
      /* private mode: the desk still runs, it just forgets on reload */
    }
  }

  function restore(): void {
    try {
      const raw = localStorage.getItem("ghost-pump-desk");
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<DeskState>;
      if (saved.settings) state.settings = { ...state.settings, ...saved.settings, skills: { ...state.settings.skills, ...(saved.settings.skills || {}) } };
      if (Array.isArray(saved.positions)) state.positions = saved.positions;
      if (Array.isArray(saved.fills)) state.fills = saved.fills;
      if (Array.isArray(saved.notes)) state.notes = saved.notes;
      if (Array.isArray(saved.decisions)) state.decisions = saved.decisions;
    } catch {
      /* a corrupt save starts the desk fresh */
    }
  }
  restore();

  /** One tick: move the simulated prices, then let the same rules decide and fill in paper. */
  function bump(): DeskState {
    const now = Date.now();
    stepPrices(now);
    const next: Token[] = [];
    for (const t of state.tokens) {
      const d = decide(t, state.positions, state.fills, state.settings, now);
      if (state.settings.auto && d.action !== "HOLD") {
        const res = applyFill(state.positions, state.fills, t, d.action, clampSize(state.settings.sizeSol), "paper", now, d.reason);
        state.positions = res.positions;
        state.fills = res.fills;
        if (res.fill) state.decisions = [{ ...d, reason: `${d.reason} → ${d.action} ${res.fill.sizeSol} SOL (paper)` }, ...state.decisions].slice(0, 40);
        else state.decisions = [{ ...d, reason: `${d.reason} (no fill: ${res.reason ?? "blocked"})` }, ...state.decisions].slice(0, 40);
      } else {
        state.decisions = [{ ...d, reason: `${d.reason} (${state.settings.auto ? "hold" : "auto off"})` }, ...state.decisions].slice(0, 40);
      }
      // Keep tokens fresh-looking: retire one once its history gets long, as a real feed would.
      if (t.history.length > 30) next.push(makeToken(Math.floor(rand() * 1_000_000) % SYMBOLS.length, now, rand));
      else next.push(t);
    }
    state.tokens = next.sort((a, b) => b.liquiditySol - a.liquiditySol);
    state.feed = { status: "off", lastAt: now, error: "Static build: simulated feed (no key in the browser)" };
    persist();
    return sync();
  }

  function patch(p: Partial<Settings>): DeskState {
    state.settings = { ...state.settings, ...p, skills: { ...state.settings.skills, ...(p.skills || {}) }, mode: "paper" };
    persist();
    return sync();
  }

  function note(text: string): { note: Note; state: DeskState } {
    const r = reviewNote(text, `n${Date.now()}`, Date.now());
    state.notes = [r, ...state.notes].slice(0, 40);
    persist();
    return { note: r, state: sync() };
  }

  function close(mint: string): DeskState {
    const pos = state.positions.find((p) => p.mint === mint);
    const token = state.tokens.find((t) => t.mint === mint);
    if (pos && token) {
      const res = applyFill(state.positions, state.fills, { ...token, priceSol: token.priceSol }, "SELL", token.priceSol * pos.qty, pos.mode, Date.now(), "Closed by hand");
      state.positions = res.positions;
      state.fills = res.fills;
    }
    persist();
    return sync();
  }

  function reset(): void {
    state = {
      ...state,
      positions: [],
      fills: [],
      notes: [],
      decisions: [],
      settings: { ...DEFAULT_SETTINGS, skills: { ...DEFAULT_SETTINGS.skills } },
    };
    persist();
  }
}
