// Browser side of the desk: API types, calls and formatting. No keys here.
import type { Decision, Fill, Position, Settings, SkillId, Token } from "./rules";

export interface Note { id: string; text: string; at: number; status: "accepted" | "rejected"; reason: string }
export interface Feed { status: "connecting" | "live" | "down" | "off"; lastAt: number; error: string }
export interface DeskState {
  tokens: Token[];
  settings: Settings;
  positions: Position[];
  fills: Fill[];
  notes: Note[];
  decisions: Decision[];
  feed: Feed;
  liveAllowed: boolean;
  hasKey: boolean;
  skills: { id: SkillId; title: string; text: string }[];
  limits: Record<string, number>;
  now: number;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

export const api = {
  state: () => call<DeskState>("/api/state"),
  settings: (patch: Partial<Settings> & { confirm?: string }) =>
    call<DeskState>("/api/settings", { method: "POST", body: JSON.stringify(patch) }),
  note: async (text: string) => {
    const r = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    const j = (await r.json().catch(() => ({}))) as { note?: Note; state?: DeskState; error?: string };
    if (!j.note || !j.state) throw new Error(j.error || `Request failed (${r.status})`);
    return { note: j.note, state: j.state };
  },
  close: (mint: string) => call<DeskState>("/api/close", { method: "POST", body: JSON.stringify({ mint }) }),
};

/** Tiny SOL prices are shown in scientific form so they stay readable. */
export function fmtPrice(p: number): string {
  if (!Number.isFinite(p) || p === 0) return "0";
  return p < 0.001 ? p.toExponential(3) : p.toFixed(6);
}
export const fmtSol = (n: number, d = 4) => `${n >= 0 ? "" : "−"}${Math.abs(n).toFixed(d)} SOL`;
export const fmtPct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n * 100).toFixed(1)}%`;
export function fmtAgo(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
export const fmtTime = (at: number) => new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Points for an SVG line of recent prices, scaled to w x h. */
export function sparkPoints(xs: number[], w: number, h: number): string {
  if (xs.length < 2) return "";
  const lo = Math.min(...xs), hi = Math.max(...xs);
  const span = hi - lo || hi || 1;
  return xs.map((x, i) => `${round1((i / (xs.length - 1)) * w)},${round1(h - ((x - lo) / span) * h)}`).join(" ");
}
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Open profit of a position at the token's current price. */
export function openPnl(p: Position, t: Token | undefined): number {
  if (!t) return 0;
  return p.qty * t.priceSol - p.sizeSol;
}
