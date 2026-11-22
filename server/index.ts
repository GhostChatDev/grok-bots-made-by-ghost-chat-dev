// Ghost Pump Desk server: one PumpPortal feed, the paper/live clerk, and the saved journal.
// Keys live only here (environment variables). The browser never sees them.
import http from "node:http";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_SETTINGS, LIMITS, SKILLS, applyFill, clampSize, decide, fromPumpPortal, reviewNote, rng, round,
  type Decision, type Fill, type Position, type Settings, type Token,
} from "../src/rules";

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.resolve(process.cwd(), "dist");
const DATA = path.resolve(process.cwd(), process.env.DATA_DIR || "data");
const FILE = path.join(DATA, "state.json");
const KEY = process.env.PUMPPORTAL_API_KEY || ""; // never logged, never sent to the browser
const LIVE_ALLOWED = process.env.LIVE_TRADING === "enabled" && KEY.length > 0;
const FEED_ON = process.env.PUMPPORTAL_FEED !== "off";

type Note = ReturnType<typeof reviewNote>;
interface Saved { settings: Settings; positions: Position[]; fills: Fill[]; notes: Note[]; decisions: Decision[] }
let saved: Saved = { settings: { ...DEFAULT_SETTINGS }, positions: [], fills: [], notes: [], decisions: [] };
const tokens = new Map<string, Token>();
let feed = { status: "connecting" as "connecting" | "live" | "down" | "off", lastAt: 0, error: "" };
let seq = Date.now();
const nextId = () => (seq++).toString(36);

async function load() {
  try {
    const s = JSON.parse(await readFile(FILE, "utf8")) as Partial<Saved>;
    saved = { ...saved, ...s, settings: { ...DEFAULT_SETTINGS, ...s.settings, skills: { ...DEFAULT_SETTINGS.skills, ...s.settings?.skills } } };
    if (!LIVE_ALLOWED) saved.settings.mode = "paper";
  } catch { /* first start: defaults */ }
}
let saving: Promise<void> = Promise.resolve();
function save() {
  saving = saving.then(async () => {
    await mkdir(DATA, { recursive: true });
    await writeFile(FILE + ".tmp", JSON.stringify(saved));
    await writeFile(FILE, JSON.stringify(saved));
  }).catch((e) => console.error("save failed:", (e as Error).message));
  return saving;
}

// ---- PumpPortal feed (one connection, all subscriptions on it) ----
function connect() {
  if (!FEED_ON || typeof WebSocket === "undefined") { feed.status = "off"; return; }
  const url = "wss://pumpportal.fun/api/data" + (KEY ? `?api-key=${encodeURIComponent(KEY)}` : "");
  let ws: WebSocket;
  try { ws = new WebSocket(url); } catch (e) { feed = { ...feed, status: "down", error: (e as Error).message }; setTimeout(connect, 15000); return; }
  ws.onopen = () => {
    feed = { ...feed, status: "live", error: "" };
    ws.send(JSON.stringify({ method: "subscribeNewToken" }));
  };
  ws.onmessage = (ev) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(String(ev.data)); } catch { return; }
    const mint = typeof msg.mint === "string" ? msg.mint : "";
    const t = fromPumpPortal(msg, tokens.get(mint), Date.now());
    if (!t) return;
    feed.lastAt = Date.now();
    const isNew = !tokens.has(mint);
    tokens.set(mint, t);
    // Trade streams per token are metered: subscribe only with a key, and only for a few tokens.
    if (isNew && KEY) ws.send(JSON.stringify({ method: "subscribeTokenTrade", keys: [mint] }));
    trim();
  };
  ws.onerror = () => { feed.error = "connection error"; };
  ws.onclose = () => { feed.status = "down"; setTimeout(connect, 15000); };
}
function trim() {
  const now = Date.now();
  for (const [m, t] of tokens) {
    const held = saved.positions.some((p) => p.mint === m);
    if (!held && now - t.createdAt > LIMITS.maxTokenAgeMs) tokens.delete(m);
  }
  const live = [...tokens.values()].filter((t) => t.source === "pumpportal").sort((a, b) => b.at - a.at);
  for (const t of live.slice(40)) if (!saved.positions.some((p) => p.mint === t.mint)) tokens.delete(t.mint);
}

// ---- Simulated feed: runs only while the live feed is quiet, always labelled "simulated" ----
const rand = rng(42);
const NAMES = ["GHOST", "MAGIC", "ZOE", "PARES", "BULL", "NIKA", "MOTO", "LUNA"];
function simulate(now: number) {
  const liveFresh = feed.status === "live" && now - feed.lastAt < 30_000;
  const sims = [...tokens.values()].filter((t) => t.source === "simulated");
  if (liveFresh) { for (const t of sims) if (!saved.positions.some((p) => p.mint === t.mint)) tokens.delete(t.mint); return; }
  if (sims.length < 6) {
    const i = Math.floor(rand() * NAMES.length);
    const mint = "SIM" + nextId().toUpperCase();
    const p = 0.00000003 * (1 + rand());
    tokens.set(mint, { mint, symbol: NAMES[i], name: `${NAMES[i]} (simulated)`, priceSol: p, mcapSol: round(p * 1e9, 2),
      liquiditySol: round(4 + rand() * 20, 2), buys: 0, sells: 0, volumeSol: 0, createdAt: now, at: now, source: "simulated", history: [p] });
  }
  for (const t of sims) {
    const buy = rand() < 0.55;
    const p = t.priceSol * (1 + (rand() - 0.47) * 0.08);
    tokens.set(t.mint, { ...t, priceSol: p, mcapSol: round(p * 1e9, 2), buys: t.buys + (buy ? 1 : 0), sells: t.sells + (buy ? 0 : 1),
      liquiditySol: round(t.liquiditySol + (buy ? 0.3 : -0.2), 3), volumeSol: round(t.volumeSol + rand() * 0.5, 4), at: now,
      history: [...t.history, p].slice(-30) });
  }
}

// ---- Live clerk: PumpPortal Lightning trade API, server key only ----
async function sendLive(d: Decision): Promise<{ ok: boolean; signature?: string; error?: string }> {
  if (!LIVE_ALLOWED) return { ok: false, error: "Live trading is not enabled on the server" };
  const body = d.action === "BUY"
    ? { action: "buy", mint: d.mint, amount: clampSize(saved.settings.sizeSol), denominatedInSol: "true", slippage: LIMITS.slippage * 100, priorityFee: 0.00001, pool: "auto" }
    : { action: "sell", mint: d.mint, amount: "100%", denominatedInSol: "false", slippage: LIMITS.slippage * 100, priorityFee: 0.00001, pool: "auto" };
  try {
    const r = await fetch(`https://pumpportal.fun/api/trade?api-key=${encodeURIComponent(KEY)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
    const j = (await r.json().catch(() => ({}))) as { signature?: string; errors?: unknown };
    if (!r.ok || !j.signature) return { ok: false, error: `Trade API refused (${r.status})` };
    return { ok: true, signature: j.signature };
  } catch { return { ok: false, error: "Trade API did not answer" }; }
}

let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    const now = Date.now();
    simulate(now);
    if (!saved.settings.auto) return;
    let changed = false;
    for (const t of tokens.values()) {
      const d = decide(t, saved.positions, saved.fills, saved.settings, now);
      if (d.action === "HOLD") continue;
      const isLive = saved.settings.mode === "live" && t.source === "pumpportal";
      if (saved.settings.mode === "live" && !isLive) continue; // never trade simulated prices as live
      let signature: string | undefined;
      if (isLive) {
        const r = await sendLive(d);
        if (!r.ok) { saved.decisions = [{ ...d, action: "HOLD" as const, reason: r.error ?? "refused" }, ...saved.decisions].slice(0, 50); changed = true; continue; }
        signature = r.signature;
      }
      const res = applyFill(d, t, saved.positions, saved.settings, nextId(), now);
      if (!res) continue;
      saved.positions = res.positions;
      saved.fills = [...saved.fills, { ...res.fill, signature }].slice(-500);
      saved.decisions = [d, ...saved.decisions].slice(0, 50);
      changed = true;
    }
    if (changed) await save();
  } finally { busy = false; }
}

// ---- HTTP ----
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon" };
const send = (res: http.ServerResponse, code: number, body: unknown) => {
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
};
async function body(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  let s = "";
  for await (const c of req) { s += c; if (s.length > 10_000) throw new Error("too big"); }
  try { const j = JSON.parse(s || "{}"); return j && typeof j === "object" ? j : {}; } catch { return {}; }
}
function state() {
  const list = [...tokens.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
  return { tokens: list, ...saved, feed, liveAllowed: LIVE_ALLOWED, hasKey: KEY.length > 0, skills: SKILLS, limits: LIMITS, now: Date.now() };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://x");
  try {
    if (url.pathname === "/api/state" && req.method === "GET") return send(res, 200, state());
    if (url.pathname === "/api/settings" && req.method === "POST") {
      const b = await body(req);
      const s = { ...saved.settings };
      if (typeof b.auto === "boolean") s.auto = b.auto;
      if (b.mode === "paper") s.mode = "paper";
      if (b.mode === "live") {
        if (!LIVE_ALLOWED) return send(res, 403, { error: "Live trading is off on this server (set LIVE_TRADING=enabled and PUMPPORTAL_API_KEY)" });
        if (b.confirm !== "LIVE") return send(res, 400, { error: "Type LIVE to confirm real-money trading" });
        s.mode = "live";
      }
      if (b.sizeSol !== undefined) s.sizeSol = clampSize(Number(b.sizeSol));
      if (b.skills && typeof b.skills === "object") for (const k of Object.keys(s.skills) as (keyof Settings["skills"])[]) {
        const v = (b.skills as Record<string, unknown>)[k];
        if (typeof v === "boolean") s.skills[k] = v;
      }
      saved.settings = s;
      await save();
      return send(res, 200, state());
    }
    if (url.pathname === "/api/notes" && req.method === "POST") {
      const b = await body(req);
      const n = reviewNote(String(b.text ?? ""), nextId(), Date.now());
      if (n.status === "accepted") { saved.notes = [n, ...saved.notes].slice(0, 200); await save(); }
      return send(res, n.status === "accepted" ? 200 : 422, { note: n, state: state() });
    }
    if (url.pathname === "/api/close" && req.method === "POST") {
      const b = await body(req);
      const t = tokens.get(String(b.mint));
      const pos = saved.positions.find((p) => p.mint === b.mint);
      if (!t || !pos) return send(res, 404, { error: "No open position for that token" });
      const d: Decision = { mint: t.mint, symbol: t.symbol, action: "SELL", reason: "Closed by hand", votes: [], at: Date.now() };
      let signature: string | undefined;
      if (pos.mode === "live") { const r = await sendLive(d); if (!r.ok) return send(res, 502, { error: r.error }); signature = r.signature; }
      const r = applyFill(d, t, saved.positions, { ...saved.settings, mode: pos.mode }, nextId(), Date.now());
      if (r) { saved.positions = r.positions; saved.fills = [...saved.fills, { ...r.fill, signature }].slice(-500); await save(); }
      return send(res, 200, state());
    }
    if (url.pathname.startsWith("/api/")) return send(res, 404, { error: "Not found" });
    let file = path.join(ROOT, url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) file = path.join(ROOT, "index.html");
    const ok = await stat(file).then((s) => s.isFile()).catch(() => false);
    if (!ok) file = path.join(ROOT, "index.html");
    const data = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch (e) {
    console.error("request failed:", (e as Error).message);
    send(res, 500, { error: "Server error" });
  }
});

await load();
connect();
setInterval(() => { tick().catch((e) => console.error("tick failed:", (e as Error).message)); }, 2000);
server.listen(PORT, () => console.log(`Ghost Pump Desk on http://localhost:${PORT} (live trading ${LIVE_ALLOWED ? "ENABLED" : "off"})`));
