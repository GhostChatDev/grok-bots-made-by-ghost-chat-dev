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
