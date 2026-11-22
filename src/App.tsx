import { useCallback, useEffect, useMemo, useState } from "react";
import { decide, dayStats, type SkillId } from "./rules";
import { api, isDemo, fmtAgo, fmtPct, fmtPrice, fmtSol, fmtTime, openPnl, sparkPoints, type DeskState } from "./desk";

export default function App() {
  const [s, setS] = useState<DeskState | null>(null);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"desk" | "activity" | "controls">("desk");

  const load = useCallback(() => api.state().then((x) => { setS(x); setErr(""); }).catch((e: Error) => setErr(e.message)), []);
  useEffect(() => {
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, 2000);
    return () => clearInterval(id);
  }, [load]);

  const run = async (f: () => Promise<DeskState>, ok = "") => {
    setBusy(true);
    try { setS(await f()); setMsg(ok); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  const token = useMemo(() => s?.tokens.find((t) => t.mint === sel) ?? s?.tokens[0], [s, sel]);
  const decision = useMemo(() => (s && token ? decide(token, s.positions, s.fills, s.settings, s.now) : null), [s, token]);

  if (!s) return <main className="center">{err ? <div className="card error" role="alert"><h1>Can't reach the desk server</h1><p>{err}</p><button onClick={load}>Try again</button></div> : <p className="muted" aria-live="polite">Loading the desk…</p>}</main>;

  const stats = dayStats(s.fills, s.now);
  const simulated = s.tokens.some((t) => t.source === "simulated");
  const toggleSkill = (id: SkillId) => run(() => api.settings({ skills: { ...s.settings.skills, [id]: !s.settings.skills[id] } }));

  return (
    <div className="shell">
      <header className="top">
        <div><h1>Ghost Pump Desk</h1><p className="muted">Pump.fun scout · skills vote · risk gate decides</p></div>
        <div className="badges">
          <span className={`badge ${s.feed.status === "live" ? "ok" : "warn"}`}>Connection: {s.feed.status}</span>
          <span className={`badge ${s.settings.mode === "live" ? "danger" : ""}`}>{s.settings.mode === "live" ? "LIVE money" : "Paper"}</span>
        </div>
      </header>
      <nav className="tabs" aria-label="Screens">
        {(["desk", "activity", "controls"] as const).map((k) => (
          <button key={k} className={tab === k ? "active" : ""} aria-current={tab === k ? "page" : undefined} onClick={() => setTab(k)}>
            {k === "desk" ? "Desk" : k === "activity" ? "Activity" : "Controls"}
          </button>
        ))}
      </nav>
      {err && <p className="banner error" role="alert">Connection lost: {err}. Showing the last data.</p>}
      {isDemo()
        ? <p className="banner warn">Demo mode: no server here, so simulated tokens run in your browser and only paper-trade. Your trades and notes are saved on this device.</p>
        : simulated && <p className="banner warn">Simulated prices: the live PumpPortal feed is quiet, so made-up tokens are shown. They are never traded live.</p>}

      {tab === "desk" && <section className="stats" aria-label="Today">
        <div className="card stat"><span className="muted">P&L today</span><b className={stats.pnlSol >= 0 ? "up" : "down"}>{fmtSol(stats.pnlSol)}</b></div>
        <div className="card stat"><span className="muted">Fills today</span><b>{stats.count} / {s.limits.maxFillsPerDay}</b></div>
        <div className="card stat"><span className="muted">Open</span><b>{s.positions.length} / {s.limits.maxOpen}</b></div>
        <div className="card stat"><span className="muted">Loss cap</span><b>{fmtSol(s.limits.dailyLossCapSol, 2)}</b></div>
      </section>}

      <div className="grid">
        {tab === "desk" && <section className="card" aria-label="Tokens">
          <h2>Tokens</h2>
          <p className="muted small">Tap a token to load its chart and verdict.</p>
          {s.tokens.length === 0 ? <p className="muted">Waiting for new tokens…</p> : (
            <ul className="list">
              {s.tokens.map((t) => (
                <li key={t.mint}>
                  <button className={`row ${token?.mint === t.mint ? "active" : ""}`} aria-pressed={token?.mint === t.mint} aria-label={`${t.symbol}${t.source === "simulated" ? " (simulated)" : ""}, ${t.liquiditySol.toFixed(1)} SOL in curve`} onClick={() => setSel(t.mint)}>
                    <span><b>{t.symbol}</b> {t.source === "simulated" && <small className="tag">sim</small>}<br /><small className="muted">{fmtAgo(t.createdAt, s.now)}</small></span>
                    <svg width="64" height="24" aria-hidden="true"><polyline points={sparkPoints(t.history, 64, 24)} /></svg>
                    <span className="num">{t.liquiditySol.toFixed(1)} SOL<br /><small className="muted">in curve</small></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>}

        {tab === "desk" && <section className="card" aria-label="Token detail">
          {!token || !decision ? <p className="muted">Pick a token.</p> : (<>
            <h2>{token.symbol} <small className="muted">{token.name}</small></h2>
            {token.history.length < 2 ? <p className="chart empty muted">Price line appears after 2 updates.</p>
              : <svg className="chart" viewBox="0 0 300 100" preserveAspectRatio="none" role="img" aria-label={`${token.symbol} recent price`}><polyline points={sparkPoints(token.history, 300, 100)} /></svg>}
            <dl className="kv">
              <dt>Price</dt><dd className="num">{fmtPrice(token.priceSol)} SOL</dd>
              <dt>Buys / sells</dt><dd className="num">{token.buys} / {token.sells}</dd>
              <dt>Volume</dt><dd className="num">{fmtSol(token.volumeSol, 2)}</dd>
              <dt>Updated</dt><dd>{fmtAgo(token.at, s.now)}</dd>
            </dl>
            <p className={`verdict ${decision.action.toLowerCase()}`}><b>{decision.action}</b> — {decision.reason}</p>
            <ul className="votes">{decision.votes.map((v) => <li key={v.id}><span className={`tag ${v.vote.toLowerCase()}`}>{v.vote}</span> {v.id}: {v.reason}</li>)}</ul>
          </>)}
        </section>}

        {tab === "desk" && <section className="card" aria-label="Risk gate">
          <h2>Risk gate</h2>
          <dl className="kv">
            <dt>Mode</dt><dd>{s.settings.mode === "live" ? "Live" : "Paper"}</dd>
            <dt>Auto-trading</dt><dd>{s.settings.auto ? "On" : "Paused"}</dd>
            <dt>Size per trade</dt><dd className="num">{fmtSol(s.settings.sizeSol, 3)}</dd>
            <dt>Skills on</dt><dd className="num">{Object.values(s.settings.skills).filter(Boolean).length} / {s.skills.length}</dd>
          </dl>
          <p className="muted">A buy needs two buy votes and no block. Loss cap and open-position limit stop new buys.</p>
          <button onClick={() => setTab("controls")}>Open controls</button>
        </section>}

        {tab === "activity" && <section className="card wide" aria-label="Journal">
          <h2>Journal</h2>
          <form onSubmit={(e) => { e.preventDefault(); setBusy(true); api.note(note).then((r) => { setS(r.state); setNote(""); setMsg("Note saved"); }).catch((x: Error) => setMsg(x.message)).finally(() => setBusy(false)); }}>
            <label htmlFor="note">Note (explains, never orders a trade)</label>
            <div className="inline"><input id="note" type="text" value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} placeholder="Why the desk held today…" /><button disabled={busy}>Add note</button></div>
          </form>
          {msg && <p className="muted" aria-live="polite">{msg}</p>}
          {s.notes.length === 0 ? <p className="muted">No notes yet.</p> : <ul className="log">{s.notes.slice(0, 8).map((n) => <li key={n.id}><small className="muted">{fmtTime(n.at)}</small> {n.text}</li>)}</ul>}
        </section>}

        {tab === "controls" && <section className="card wide" aria-label="Controls">
          <h2>Controls</h2>
          {msg && <p className="muted" role="status" aria-live="polite">{msg}</p>}
          <button className={s.settings.auto ? "" : "primary"} disabled={busy} onClick={() => run(() => api.settings({ auto: !s.settings.auto }))}>{s.settings.auto ? "Pause auto-trading" : "Resume auto-trading"}</button>
          <label htmlFor="size">Size per trade (max {s.limits.maxSizeSol} SOL)</label>
          <input id="size" type="number" step="0.005" min="0.001" max={s.limits.maxSizeSol} defaultValue={s.settings.sizeSol} onBlur={(e) => run(() => api.settings({ sizeSol: Number(e.target.value) }), "Size saved")} />
          <fieldset><legend>Skills</legend>
            {s.skills.map((k) => <label key={k.id} className="check"><input type="checkbox" checked={s.settings.skills[k.id]} onChange={() => toggleSkill(k.id)} /> <span><b>{k.title}</b><br /><small className="muted">{k.text}</small></span></label>)}
          </fieldset>
          <h3>Live trading</h3>
          {!s.liveAllowed ? <p className="muted">Off on this server. It needs LIVE_TRADING=enabled and PUMPPORTAL_API_KEY set on the server.</p>
            : s.settings.mode === "live" ? <button className="danger" onClick={() => run(() => api.settings({ mode: "paper" }), "Back to paper")}>Back to paper</button>
            : <div className="inline"><input aria-label="Type LIVE to confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type LIVE" /><button className="danger" disabled={confirm !== "LIVE"} onClick={() => run(() => api.settings({ mode: "live", confirm }), "Live trading on")}>Go live</button></div>}
        </section>}

        {tab === "activity" && <section className="card wide" aria-label="Positions and fills">
          <h2>Positions</h2>
          {s.positions.length === 0 ? <p className="muted">No open positions.</p> : <ul className="log">{s.positions.map((p) => {
            const t = s.tokens.find((x) => x.mint === p.mint); const pnl = openPnl(p, t);
            return <li key={p.mint} className="inline"><span><b>{p.symbol}</b> {fmtSol(p.sizeSol, 3)} · <span className={pnl >= 0 ? "up" : "down"}>{fmtSol(pnl)} ({fmtPct(pnl / p.sizeSol)})</span></span><button disabled={busy} onClick={() => run(() => api.close(p.mint), `${p.symbol} closed`)}>Close {p.symbol}</button></li>;
          })}</ul>}
          <h2>Recent fills</h2>
          {s.fills.length === 0 ? <p className="muted">No fills yet. The gate needs two buy votes and no blocks.</p> : (
            <div className="scroll"><table><thead><tr><th>Time</th><th>Token</th><th>Side</th><th>Size</th><th>P&L</th><th>Reason</th></tr></thead>
              <tbody>{s.fills.slice(-12).reverse().map((f) => <tr key={f.id}><td>{fmtTime(f.at)}</td><td>{f.symbol}</td><td>{f.side}</td><td className="num">{fmtSol(f.sizeSol, 3)}</td><td className={`num ${f.pnlSol >= 0 ? "up" : "down"}`}>{fmtSol(f.pnlSol)}</td><td>{f.reason}</td></tr>)}</tbody></table></div>
          )}
        </section>}
      </div>
      <footer className="muted">Not financial advice. Memecoins can go to zero; paper-trade first.</footer>
    </div>
  );
}
