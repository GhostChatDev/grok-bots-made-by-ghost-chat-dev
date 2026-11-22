## What the post actually is

[@0xcloudvex](https://x.com/0xcloudvex/status/2124211755140129171), posted 21 Nov 2026, 18:42 UTC. About 8,357 views, 12 replies, 6 reposts, 80 likes, 202 bookmarks when I read it [7]. The claim is “19 free GitHub repos turn a stock Grok Bot into a maxed-out one,” grouped as Brain, Skills, Team, Jobs, Safety. It quotes his own 26 Oct 2026 article.

The “30 runnable apps” claim is stale. The cookbook README now lists **25** TypeScript apps, and says they are for learning, not production [13]. The “8,000+ bots” number is a catalog of share pages, not 8,000 reviewed trading systems. On 19 Nov 2026 that catalog itself said **0 verified / 7,968 listed** [2].

## The 19, checked

Stars are GitHub counts on 22 Nov 2026.

| # | Repo | Stars | What it really is | Use for our bot |
|---|---|---:|---|---|
| 01 | [xai-org/grok-build](https://github.com/xai-org/grok-build) | 27,824 | Official Rust coding CLI/TUI. Apache-2.0. Last push 29 Sep 2026. External PRs not accepted. | Coding tool only. Not a broker. |
| 02 | [xai-org/grok-prompts](https://github.com/xai-org/grok-prompts) | 4,612 | Official Grok 3/4 and safety prompts. **AGPL-3.0.** Last push 17 Nov 2025. | Read for style. Do not copy into our repo. AGPL can infect the whole app. |
| 03 | [xai-org/xai-cookbook](https://github.com/xai-org/xai-cookbook) | 653 | 25 learning apps, not 30. Includes X sentiment, human-approval refunds, prompt-injection defenses. License marked “Other.” Last push 26 Oct 2026. | Copy the pattern: research, then a human gate. |
| 04 | [xai-org/xai-sdk-python](https://github.com/xai-org/xai-sdk-python) | 622 | Official SDK, `pip install xai-sdk`, Python 3.10+. Apache-2.0. README model id `grok-4.6`. | Brain for research notes only. Key stays in `.env`. |
| 05 | [jaskirat1616/grok-skills](https://github.com/jaskirat1616/grok-skills) | 25 | 195 `SKILL.md` folders. MIT. Last push 30 Aug 2026. | Borrow the folder shape. Do not load 195 skills. |
| 06 | [bostonaholic/grokbot-skills](https://github.com/bostonaholic/grokbot-skills) | 4 | Smaller skill pack, one folder per skill. No license file. Last push 18 Nov 2026. | Same idea, smaller. No license means do not copy code in. |
| 07 | [SigiBaes/grok-bot-starter-pack](https://github.com/SigiBaes/grok-bot-starter-pack) | 2 | Four one-job personas. Draft only, never auto-send. MIT. | This is the team shape we should copy. |
| 08 | [majiayu000/awesome-grok-bot](https://github.com/majiayu000/awesome-grok-bot) | 199 | Searchable catalog. CC0. Its own snapshot: 0 verified / 7,968 listed [2]. | Index, not a dependency. |
| 09 | [lroolle/awesome-grokbot-templates](https://github.com/lroolle/awesome-grokbot-templates) | 18 | Share links grouped by job. License “Other.” Last push 4 Sep 2026. | Browse. Do not vendor. |
| 10 | [poteto/noodle](https://github.com/poteto/noodle) | 707 | Lauren Tan’s skill orchestrator, Go. MIT. Last push 19 Mar 2026. | Idea only: route by skill, don’t run every agent. |
| 11 | [xai-org/grok-build-plugin-cc](https://github.com/xai-org/grok-build-plugin-cc) | 281 | Claude Code plugin that calls `grok` for review. Default is read-only. Apache-2.0. | Second pair of eyes. Not a trading engine. |
| 12 | [Grryp-LLC/money-watchdog](https://github.com/Grryp-LLC/money-watchdog) | 0 | Read-only inbox scanner plus a ledger. No invented numbers. 0 stars. | Best pattern in the list: ledger, quiet days, no money movement. |
| 13 | [LarryLemonBot/scam-shield](https://github.com/LarryLemonBot/scam-shield) | 0 | Contest bot: scam / legit / unsure. No license. | Keep an unsure bucket. Do not treat a model label as proof. |
| 14 | [CosVoice/cosvoice-mcp](https://github.com/CosVoice/cosvoice-mcp) | 0 | Phone and email MCP. MIT. Points at cosvoice.com. | Do not connect a phone bot to a trading account. |
| 15 | [Hrubak/grok-bot-home-assistant-mcp](https://github.com/Hrubak/grok-bot-home-assistant-mcp) | 0 | Setup notes for Home Assistant. 6 KB. No license. | Skip. |
| 16 | [anthonygenovese/star-watch](https://github.com/anthonygenovese/star-watch) | 0 | Sky briefing twice a day. The post cut the owner name; full login is `anthonygenovese`. 4 KB, no license. | Copy the schedule idea only: morning and evening, say nothing if nothing changed. |
| 17 | [Kargatharaakash/grok-bot-usage](https://github.com/Kargatharaakash/grok-bot-usage) | 2 | Weekly Grok usage, one command. MIT. | Cap API spend. Not exchange spend. |
| 18 | [Yang-bright/resetradar](https://github.com/Yang-bright/resetradar) | 0 | Tracks usage resets for Codex, Claude Code, Grok Bot. No license. | Skip for trading. |
| 19 | [0xNyk/agent-security](https://github.com/0xNyk/agent-security) | 7 | Local bash gates: secrets, incoming code, prompt injection, destructive `gh`. MIT. Author says CLEAN is not safe. | Run this before we publish the repo. |

## What we take, and what we leave

Take:

- One job per agent, from the starter pack [53].
- A ledger that only records numbers it was given, from Money Watchdog [52].
- A human yes before any side effect, from the cookbook’s refund example [13] and the starter pack’s “never send” rule [53].
- Skills as folders, loaded only when that job runs [14] [15].
- A second reviewer that is read-only by default [54].
- Secret and injection scans before the repo goes public [46].

Leave:

- Home Assistant, phone calls, sky briefings, usage-reset trackers.
- The 195-skill dump. Loading all of them makes the bot worse, not maxed.
- AGPL prompt files. Read them. Do not commit them.
- Any repo with no license, if we would copy its code.
- Any catalog bot that claims it trades. The catalog is unverified [2].

## The bot we should build

Name: **Ghost Desk**. Paper only.

It watches public prices, writes a journal, and asks you before anything is even logged as a paper fill. It cannot place, sign, or send an order.

Four jobs, not five bots on one computer:

1. **Scout** reads public prices and writes `journal/ticks.jsonl`.
2. **Rules** checks a fixed playbook. No LLM in the order path.
3. **Clerk** writes the paper fill only after you type YES, and only if the confirm phrase matches.
4. **Reviewer** is read-only. It can reject a note. It cannot edit the ledger.

Default market is BTC-USD from the Coinbase public ticker. No key. No account. Spot crypto, not stocks, because a public price feed needs no signup. Stocks can wait until you pick a data vendor.

Hard rules, same spirit as your own “remove impatience and greed”:

- One symbol.
- One unit per paper fill.
- Max 3 paper fills per UTC day.
- 15-minute cooldown.
- Daily loss cap of 2 units, then the desk locks.
- If the feed is stale, missing, or the book disagrees with itself, the only legal action is HOLD.
- The model may write the note. The model may not set the price, the size, or the side.

I did not create a GitHub repo. Ghost Researcher can research and hand you files. Ghost Code, with your GitHub already connected as GhostChatDev, is the place that can commit them.

## What you should check

- Open the HTML preview and press the buttons. Refresh. The journal is only in that browser tab.
- The Python file is the one to put in a repo. I could not run it here: this sandbox has no network, so I could not hit the live ticker.
- Do not paste an exchange key into either file. There is nowhere for one on purpose.
- `grok-prompts` is AGPL. Leave it out.
- If you want this as `GhostChatDev/ghost-desk`, open Ghost Code, pick that repo in the + menu, and tell Ghost Agent to add these two files on a `ghost-code/` branch. Do not merge to main until you have run `desk.py` once against the live ticker yourself.

```html index.html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ghost Desk</title>
<style>
  :root {
    --paper: #f4f0e6;
    --ink: #1c1915;
    --accent: #9a3b2f;
    --line: #d9d1c3;
    --card: #fffdf8;
    --ok: #2f6f4e;
    --radius: 12px;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font: 14px/1.45 Georgia, "Iowan Old Style", serif;
  }
  main { max-width: 420px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 32px; line-height: 1.1; margin: 8px 0; font-weight: 700; }
  h2 { font-size: 20px; margin: 0 0 8px; }
  p { margin: 0 0 8px; }
  .tag {
    display: inline-block;
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    padding: 4px 8px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font: 14px/1.2 ui-sans-serif, system-ui, sans-serif;
  }
  .card {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 16px;
    margin: 16px 0;
  }
  .price { font-size: 32px; margin: 8px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; margin: 8px 0; }
  button {
    font: 14px/1 ui-sans-serif, system-ui, sans-serif;
    border-radius: var(--radius);
    border: 1px solid var(--ink);
    background: var(--card);
    color: var(--ink);
    padding: 12px 16px;
    min-height: 44px;
    cursor: pointer;
  }
  button:hover:not(:disabled) { background: var(--ink); color: var(--paper); }
  button:active:not(:disabled) { transform: translateY(1px); }
  button:disabled { opacity: 0.45; cursor: not-allowed; }
  button.yes { background: var(--accent); color: white; border-color: var(--accent); }
  label { display: block; margin: 8px 0; }
  input {
    width: 100%;
    margin-top: 8px;
    padding: 12px;
    border-radius: var(--radius);
    border: 1px solid var(--ink);
    font: 14px/1.2 ui-sans-serif, system-ui, sans-serif;
    background: white;
    color: var(--ink);
  }
  .hold { color: var(--accent); font-weight: 700; }
  .ok { color: var(--ok); font-weight: 700; }
  ul { padding-left: 16px; margin: 8px 0; }
  .fine { font: 14px/1.4 ui-sans-serif, system-ui, sans-serif; color: #4a453d; }
  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; animation: none !important; }
  }
</style>
</head>
<body>
<main>
  <div class="tag">Paper only</div>
  <h1>Ghost Desk</h1>
  <p>One symbol. Public price. You type the words before a paper fill exists.</p>

  <section class="card" id="screen">
    <h2>Loading</h2>
    <p>Asking Coinbase for the public BTC-USD ticker.</p>
  </section>
</main>
<script>
const state = {
  status: "loading",
  price: null,
  bid: null,
  ask: null,
  time: null,
  side: null,
  phrase: "",
  journal: [],
  message: "",
  locked: false
};

const MAX_FILLS = 3;
const COOLDOWN_MS = 15 * 60 * 1000;
const LOSS_CAP = 2;

function fillsToday() {
  const day = new Date().toISOString().slice(0, 10);
  return state.journal.filter(j => j.day === day && j.kind === "fill");
}
function lastFillTime() {
  const fills = state.journal.filter(j => j.kind === "fill");
  return fills.length ? fills[fills.length - 1].at : 0;
}
function lockedByLoss() {
  const day = new Date().toISOString().slice(0, 10);
  const loss = state.journal
    .filter(j => j.day === day && j.kind === "fill" && j.pnl < 0)
    .reduce((s, j) => s + j.pnl, 0);
  return loss <= -LOSS_CAP;
}
function gate() {
  if (state.status !== "ready") return "HOLD. No fresh price.";
  if (lockedByLoss()) return "HOLD. Daily paper loss cap hit.";
  if (fillsToday().length >= MAX_FILLS) return "HOLD. 3 paper fills already today.";
  if (Date.now() - lastFillTime() < COOLDOWN_MS) return "HOLD. 15 minute cooldown.";
  if (state.bid >= state.ask) return "HOLD. Book disagrees with itself.";
  return "OPEN";
}

async function load() {
  state.status = "loading";
  render();
  try {
    const res = await fetch("https://api.exchange.coinbase.com/products/BTC-USD/ticker");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const price = Number(data.price);
    const bid = Number(data.bid);
    const ask = Number(data.ask);
    if (!Number.isFinite(price) || !Number.isFinite(bid) || !Number.isFinite(ask)) {
      throw new Error("Ticker missing a number");
    }
    state.price = price;
    state.bid = bid;
    state.ask = ask;
    state.time = data.time || new Date().toISOString();
    state.status = "ready";
    state.message = "";
  } catch (err) {
    state.status = "error";
    state.message = "Price feed failed. No paper fill is possible. " + err.message;
  }
  render();
}

function propose(side) {
  state.side = side;
  state.phrase = "";
  state.message = "";
  render();
}

function confirmFill() {
  const expected = state.side + " BTC-USD 1";
  if (gate() !== "OPEN") {
    state.message = gate();
    render();
    return;
  }
  if (state.phrase.trim() !== expected) {
    state.message = "Type exactly: " + expected;
    render();
    return;
  }
  const open = [...state.journal].reverse().find(j => j.kind === "fill" && !j.closed);
  let pnl = 0;
  if (open && open.side !== state.side) {
    const signed = state.side === "SELL" ? state.price - open.price : open.price - state.price;
    pnl = Math.round((signed / open.price) * 10000) / 10000;
    open.closed = true;
  }
  state.journal.push({
    kind: "fill",
    day: new Date().toISOString().slice(0, 10),
    at: Date.now(),
    side: state.side,
    price: state.price,
    size: 1,
    pnl,
    closed: false,
    feedTime: state.time
  });
  state.side = null;
  state.phrase = "";
  state.message = "Paper fill logged. Nothing was sent to an exchange.";
  render();
}

function render() {
  const root = document.getElementById("screen");
  if (state.status === "loading") {
    root.innerHTML = "<h2>Loading</h2><p>Asking Coinbase for the public BTC-USD ticker.</p>";
    return;
  }
  if (state.status === "error") {
    root.innerHTML = "<h2>Error</h2><p class='hold'>" + escapeHtml(state.message) +
      "</p><button id='retry'>Try again</button>";
    document.getElementById("retry").onclick = load;
    return;
  }
  const g = gate();
  const open = g === "OPEN";
  const fills = fillsToday();
  root.innerHTML = `
    <div class="row"><h2>BTC-USD</h2><span class="${open ? "ok" : "hold"}">${escapeHtml(g)}</span></div>
    <div class="price">$${fmt(state.price)}</div>
    <div class="row fine"><span>Bid ${fmt(state.bid)}</span><span>Ask ${fmt(state.ask)}</span></div>
    <p class="fine">Feed time ${escapeHtml(state.time)}. Paper fills today: ${fills.length} / ${MAX_FILLS}.</p>
    <div class="row">
      <button id="buy" ${open ? "" : "disabled"}>Paper buy</button>
      <button id="sell" ${open ? "" : "disabled"}>Paper sell</button>
      <button id="refresh">Refresh</button>
    </div>
    ${state.side ? `
      <label>Type <b>${escapeHtml(state.side)} BTC-USD 1</b> to log it.
        <input id="phrase" autocomplete="off" value="${escapeHtml(state.phrase)}">
      </label>
      <div class="row">
        <button class="yes" id="confirm">Log paper fill</button>
        <button id="cancel">Cancel</button>
      </div>` : ""}
    <p class="${state.message.startsWith("Paper") ? "ok" : "hold"}">${escapeHtml(state.message)}</p>
    <h2>Journal</h2>
    ${state.journal.length ? "<ul>" + state.journal.map(j =>
      `<li>${escapeHtml(j.side)} 1 @ $${fmt(j.price)} · paper pnl ${j.pnl}</li>`).join("") + "</ul>"
      : "<p>Empty. No paper fill yet. That is a valid day.</p>"}
    <p class="fine">This page cannot place an order. Refresh starts the journal over. That is on purpose.</p>
  `;
  document.getElementById("refresh").onclick = load;
  const buy = document.getElementById("buy");
  const sell = document.getElementById("sell");
  if (buy) buy.onclick = () => propose("BUY");
  if (sell) sell.onclick = () => propose("SELL");
  const phrase = document.getElementById("phrase");
  if (phrase) phrase.oninput = e => { state.phrase = e.target.value; };
  const confirm = document.getElementById("confirm");
  if (confirm) confirm.onclick = confirmFill;
  const cancel = document.getElementById("cancel");
  if (cancel) cancel.onclick = () => { state.side = null; state.message = ""; render(); };
}
function fmt(n) { return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
load();
</script>
</body>
</html>
```

```python desk.py
#!/usr/bin/env python3
"""Ghost Desk — paper watch only.

Reads the public Coinbase BTC-USD ticker.
Writes a journal line.
Never places, signs, or sends an order.
There is no API key field on purpose.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

PRODUCT = "BTC-USD"
TICKER_URL = f"https://api.exchange.coinbase.com/products/{PRODUCT}/ticker"
JOURNAL = Path("journal/ticks.jsonl")
MAX_AGE_SECONDS = 30


def fetch_ticker() -> dict:
    req = urllib.request.Request(TICKER_URL, headers={"User-Agent": "ghost-desk/0.1"})
    with urllib.request.urlopen(req, timeout=10) as res:
        if res.status != 200:
            raise RuntimeError(f"ticker HTTP {res.status}")
        data = json.loads(res.read().decode("utf-8"))
    price = float(data["price"])
    bid = float(data["bid"])
    ask = float(data["ask"])
    feed_time = datetime.fromisoformat(data["time"].replace("Z", "+00:00"))
    age = (datetime.now(timezone.utc) - feed_time).total_seconds()
    if age > MAX_AGE_SECONDS or bid >= ask or price <= 0:
        raise RuntimeError("stale or broken book")
    return {"price": price, "bid": bid, "ask": ask, "time": data["time"]}


def decide(book: dict) -> str:
    # Rules own the action. A model may comment later. It may not set this.
    mid = (book["bid"] + book["ask"]) / 2
    spread = (book["ask"] - book["bid"]) / mid
    if spread > 0.002:
        return "HOLD"
    return "WATCH"


def main() -> int:
    try:
        book = fetch_ticker()
    except Exception as exc:
        print(f"HOLD. Feed failed: {exc}")
        return 1
    action = decide(book)
    line = {
        "logged_at": datetime.now(timezone.utc).isoformat(),
        "product": PRODUCT,
        "action": action,
        "price": book["price"],
        "bid": book["bid"],
        "ask": book["ask"],
        "feed_time": book["time"],
        "order_sent": False,
    }
    JOURNAL.parent.mkdir(parents=True, exist_ok=True)
    with JOURNAL.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(line) + "\n")
    print(f"{action} {PRODUCT} @ {book['price']}  journal={JOURNAL}")
    print("No order sent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```