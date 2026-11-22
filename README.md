# Ghost Pump Desk

A Pump.fun trading desk in Vite + React + TypeScript: a live token watchlist, five skills that vote on each token, a hard risk gate, paper trading by default, and a journal that keeps everything you see and do.

**This is a tool, not financial advice.** Memecoins can go to zero. Run it in paper mode first.

## Run it

```bash
npm install
npm start          # http://localhost:3000 (paper mode, simulated feed until PumpPortal answers)
npm run dev        # Vite dev server with hot reload, server on port 3000
npm run build      # type-check + production build
npm test           # 13 Vitest tests for the rules engine
```

Node 22 or newer.

## Screens

- **Desk** — token watchlist with price, market cap and liquidity, a price chart for the selected token, and the risk panel (open positions, trades today, loss today against the caps).
- **Activity** — open positions you can close, the fill log, and the journal. Notes are saved and survive a restart.
- **Controls** — the five skills and their thresholds, the trade size, and the paper/live switch.

## Skills

Discovery, Liquidity, Momentum, Order flow and Exit each vote on a token. A buy needs at least two votes **and** the risk gate: 0.05 SOL maximum per trade, 3 open positions, 20 trades a day, a 0.1 SOL daily loss cap, and a 60-second cooldown per token. Exits: +30%, -15%, or 10 minutes.

## Put it online (paper mode first)

The app has its own server (it holds the PumpPortal connection and saves your state), so it needs a host that runs Node servers. GitHub Pages can't run it. Example with Render:

1. Go to render.com, then **New → Web Service**, and pick this repository.
2. **Runtime:** Node. **Build command:** `npm ci && npm run build`. **Start command:** `npm start`.
3. **Environment:** add `NODE_VERSION` = `22`. Leave `LIVE_TRADING` and `PUMPPORTAL_API_KEY` **unset**: the desk runs in paper mode only.
4. Deploy, then open the address Render gives you. The server listens on the `PORT` that Render sets.
5. To keep your notes and fills between deploys, add a persistent disk mounted at `/opt/render/project/src/data`. Without one, a free instance starts empty after a restart.

Run it in paper mode for at least a week. Check that the daily loss cap and the trade limit stop trades the way you expect before you think about live mode.

## Live trading (off by default)

The server never sends live orders unless both environment variables are set **and** you type `LIVE` in Controls:

```bash
LIVE_TRADING=enabled PUMPPORTAL_API_KEY=YOUR_KEY npm start
```

The key stays on the server and is never sent to the browser. Simulated prices are never traded for real. The endpoints are PumpPortal's (`wss://pumpportal.fun/api/data`, `POST https://pumpportal.fun/api/trade`); check its docs for current fees and limits.

State (settings, positions, fills, notes) is saved to `data/state.json`.

## Checks

`.github/workflows/web.yml` builds and tests on every push. `.github/workflows/ghost-screenshots.yml` opens the app in a real browser at desktop, tablet and phone size, presses the buttons and checks that added data survives a refresh.

---
<img src="https://ghostchat.tech/icons/ghost-code-dev.png" width="20" height="20" alt="" align="top"> Built by [Ghost Code Dev](https://ghostchat.tech)
