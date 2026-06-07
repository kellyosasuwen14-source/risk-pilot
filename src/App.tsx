import { useState, useCallback, useEffect } from "react";

const MARKETS = [
  { name: "Boom 1000 Index",  minLot: 0.20 },
  { name: "Crash 1000 Index", minLot: 0.20 },
  { name: "Boom 900 Index",   minLot: 0.20 },
  { name: "Crash 900 Index",  minLot: 0.20 },
  { name: "Boom 600 Index",   minLot: 0.20 },
  { name: "Crash 600 Index",  minLot: 0.20 },
  { name: "Boom 500 Index",   minLot: 0.20 },
  { name: "Crash 500 Index",  minLot: 0.20 },
  { name: "Boom 300 Index",   minLot: 1.00 },
  { name: "Crash 300 Index",  minLot: 0.50 },
  { name: "Boom 150 Index",   minLot: 0.50 },
  { name: "Crash 150 Index",  minLot: 0.50 },
  { name: "Boom 50 Index",    minLot: 0.10 },
  { name: "Crash 50 Index",   minLot: 0.10 },
];

type Result = {
  cashAtRisk: number;
  pointDistance: number;
  lotSize: number;
  isMinLotOverride: boolean;
  minLot: number;
  rr: number | null;
  tpDistance: number | null;
} | null;

type JournalEntry = {
  id: string;
  timestamp: number;
  market: string;
  balance: number;
  riskPct: number;
  entryPrice: number;
  slPrice: number;
  tpPrice: number | null;
  cashAtRisk: number;
  pointDistance: number;
  lotSize: number;
  isMinLotOverride: boolean;
  rr: number | null;
};

const JOURNAL_KEY = "riskpilot_journal";
const MAX_RISK_KEY = "riskpilot_maxrisk";

function loadMaxRisk(): string {
  return localStorage.getItem(MAX_RISK_KEY) ?? "5";
}

function loadJournal(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveJournal(entries: JournalEntry[]) {
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
}

function compute(
  balance: string,
  marketIndex: number,
  riskPct: string,
  entryPrice: string,
  slPrice: string,
  tpPrice: string
): Result {
  const bal = parseFloat(balance);
  const risk = parseFloat(riskPct);
  const entry = parseFloat(entryPrice);
  const sl = parseFloat(slPrice);
  const tp = parseFloat(tpPrice);

  if (
    isNaN(bal) || bal <= 0 ||
    isNaN(risk) || risk <= 0 ||
    isNaN(entry) || entry <= 0 ||
    isNaN(sl) || sl <= 0 ||
    entry === sl
  ) return null;

  const market = MARKETS[marketIndex];
  const cashAtRisk = (bal * risk) / 100;
  const pointDistance = Math.abs(entry - sl);
  let lotSize = cashAtRisk / pointDistance;
  const isMinLotOverride = lotSize < market.minLot;
  if (isMinLotOverride) lotSize = market.minLot;

  const hasTp = !isNaN(tp) && tp > 0 && tp !== entry;
  const tpDistance = hasTp ? Math.abs(tp - entry) : null;
  const rr = hasTp ? Math.abs(tp - entry) / pointDistance : null;

  return { cashAtRisk, pointDistance, lotSize, isMinLotOverride, minLot: market.minLot, rr, tpDistance };
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function App() {
  const [balance, setBalance] = useState("");
  const [marketIndex, setMarketIndex] = useState(0);
  const [riskPct, setRiskPct] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const [tpPrice, setTpPrice] = useState("");
  const [journal, setJournal] = useState<JournalEntry[]>(loadJournal);
  const [logged, setLogged] = useState(false);
  const [maxRisk, setMaxRisk] = useState<string>(loadMaxRisk);

  const result = compute(balance, marketIndex, riskPct, entryPrice, slPrice, tpPrice);
  const selectedMarket = MARKETS[marketIndex];

  const fmt = useCallback((n: number, dp = 2) => n.toFixed(dp), []);

  useEffect(() => {
    saveJournal(journal);
  }, [journal]);

  useEffect(() => {
    localStorage.setItem(MAX_RISK_KEY, maxRisk);
  }, [maxRisk]);

  function logTrade() {
    if (!result) return;
    const entry: JournalEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      market: selectedMarket.name,
      balance: parseFloat(balance),
      riskPct: parseFloat(riskPct),
      entryPrice: parseFloat(entryPrice),
      slPrice: parseFloat(slPrice),
      tpPrice: tpPrice ? parseFloat(tpPrice) : null,
      cashAtRisk: result.cashAtRisk,
      pointDistance: result.pointDistance,
      lotSize: result.lotSize,
      isMinLotOverride: result.isMinLotOverride,
      rr: result.rr,
    };
    setJournal(prev => [entry, ...prev]);
    setLogged(true);
    setTimeout(() => setLogged(false), 1800);
  }

  function deleteEntry(id: string) {
    setJournal(prev => prev.filter(e => e.id !== id));
  }

  function clearAll() {
    setJournal([]);
  }

  function resetForm() {
    setBalance("");
    setRiskPct("");
    setEntryPrice("");
    setSlPrice("");
    setTpPrice("");
    setMarketIndex(0);
  }

  function exportCSV() {
    if (journal.length === 0) return;
    const headers = ["Timestamp", "Market", "Balance ($)", "Risk (%)", "Entry Price", "SL Price", "TP Price", "Cash at Risk ($)", "Point Distance", "Lot Size", "Min Lot Override", "R:R"];
    const rows = journal.map(e => [
      new Date(e.timestamp).toLocaleString(),
      e.market,
      e.balance.toFixed(2),
      e.riskPct.toFixed(2),
      e.entryPrice.toFixed(5),
      e.slPrice.toFixed(5),
      e.tpPrice != null ? e.tpPrice.toFixed(5) : "",
      e.cashAtRisk.toFixed(2),
      e.pointDistance.toFixed(5),
      e.lotSize.toFixed(2),
      e.isMinLotOverride ? "YES" : "NO",
      e.rr != null ? e.rr.toFixed(2) : "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `risk-pilot-journal-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ background: "hsl(222 25% 8%)" }}
    >
      {/* Header */}
      <header className="px-5 pt-12 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 mb-1">
            <h1
              className="text-3xl font-black tracking-tight"
              style={{ color: "#f1f5f9", letterSpacing: "-0.03em" }}
            >
              RISK PILOT
            </h1>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                background: "hsl(160 60% 45% / 0.15)",
                color: "#10d98a",
                border: "1px solid hsl(160 60% 45% / 0.3)",
                letterSpacing: "0.05em",
              }}
            >
              v1.0
            </span>
          </div>
          <button
            onClick={resetForm}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-150 active:scale-95"
            style={{
              background: "hsl(220 22% 14%)",
              border: "1px solid hsl(220 15% 20%)",
              color: "hsl(215 15% 48%)",
              marginBottom: "4px",
            }}
          >
            Reset
          </button>
        </div>
        <p
          className="text-sm font-medium tracking-widest uppercase"
          style={{ color: "hsl(215 15% 50%)", letterSpacing: "0.15em" }}
        >
          Boom &amp; Crash Position Sizer
        </p>
      </header>

      <main className="flex-1 px-5 pb-12 flex flex-col gap-4">

        {/* Account Balance */}
        <div>
          <label className="label-text">Account Balance</label>
          <div className="relative">
            <span
              className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold select-none"
              style={{ color: "hsl(215 15% 50%)" }}
            >
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              className="input-field pl-8"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Market Select */}
        <div>
          <label className="label-text">Select Market</label>
          <select
            className="select-field"
            value={marketIndex}
            onChange={e => setMarketIndex(Number(e.target.value))}
          >
            {MARKETS.map((m, i) => (
              <option key={i} value={i}>
                {m.name} — Min Lot: {m.minLot.toFixed(2)}
              </option>
            ))}
          </select>
        </div>

        {/* Risk % */}
        <div>
          <label className="label-text">Risk Per Trade</label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              placeholder="1.00"
              value={riskPct}
              onChange={e => setRiskPct(e.target.value)}
              className="input-field pr-8"
              autoComplete="off"
            />
            <span
              className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold select-none"
              style={{ color: "hsl(215 15% 50%)" }}
            >
              %
            </span>
          </div>
        </div>

        {/* Entry Price */}
        <div>
          <label className="label-text">Market Entry Price</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00000"
            value={entryPrice}
            onChange={e => setEntryPrice(e.target.value)}
            className="input-field"
            autoComplete="off"
          />
        </div>

        {/* Stop Loss Price */}
        <div>
          <label className="label-text">Invalidation / Stop Loss Price</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00000"
            value={slPrice}
            onChange={e => setSlPrice(e.target.value)}
            className="input-field"
            autoComplete="off"
          />
        </div>

        {/* Take Profit Price */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="label-text" style={{ marginBottom: 0 }}>Take Profit Price</label>
            <span
              className="text-xs font-semibold px-1.5 py-0.5 rounded"
              style={{ background: "hsl(215 15% 16%)", color: "hsl(215 15% 45%)" }}
            >
              optional
            </span>
          </div>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00000"
            value={tpPrice}
            onChange={e => setTpPrice(e.target.value)}
            className="input-field"
            autoComplete="off"
          />
        </div>

        <hr className="divider" style={{ marginTop: "8px", marginBottom: "0px" }} />

        {/* Results Card */}
        <div
          className="rounded-2xl p-6 flex flex-col gap-5"
          style={{
            background: result?.isMinLotOverride
              ? "linear-gradient(135deg, hsl(38 95% 10% / 0.8), hsl(220 22% 11%))"
              : "linear-gradient(135deg, hsl(160 60% 8% / 0.8), hsl(220 22% 11%))",
            border: result?.isMinLotOverride
              ? "1px solid hsl(38 95% 40% / 0.3)"
              : "1px solid hsl(160 60% 35% / 0.25)",
            transition: "all 0.3s ease",
          }}
        >
          {/* Lot Size */}
          <div className="text-center pb-2">
            <span className="label-text" style={{ textAlign: "center" }}>
              Recommended Lot Size
            </span>
            <div
              className={`font-black tracking-tight mt-1 transition-all duration-300 ${
                result
                  ? result.isMinLotOverride ? "amber-value" : "emerald-value"
                  : ""
              }`}
              style={{
                fontSize: "clamp(3rem, 14vw, 4.5rem)",
                color: result ? undefined : "hsl(215 15% 28%)",
              }}
            >
              {result ? fmt(result.lotSize, 2) : "—"}
            </div>
            {result && (
              <span
                className="text-sm font-semibold tracking-widest uppercase mt-1 block"
                style={{ color: result.isMinLotOverride ? "#f59e0b" : "#10d98a", opacity: 0.7 }}
              >
                lots
              </span>
            )}
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-xl p-4 flex flex-col"
              style={{ background: "hsl(220 25% 8% / 0.6)", border: "1px solid hsl(220 15% 16%)" }}
            >
              <span className="label-text" style={{ marginBottom: "6px" }}>Cash at Risk</span>
              <span className="text-xl font-bold" style={{ color: result ? "#f1f5f9" : "hsl(215 15% 28%)" }}>
                {result ? `$${fmt(result.cashAtRisk, 2)}` : "$—"}
              </span>
            </div>
            <div
              className="rounded-xl p-4 flex flex-col"
              style={{ background: "hsl(220 25% 8% / 0.6)", border: "1px solid hsl(220 15% 16%)" }}
            >
              <span className="label-text" style={{ marginBottom: "6px" }}>Point Distance</span>
              <span className="text-xl font-bold" style={{ color: result ? "#f1f5f9" : "hsl(215 15% 28%)" }}>
                {result ? `${fmt(result.pointDistance, 5)} pts` : "— pts"}
              </span>
            </div>
          </div>

          {/* Pip Value Estimator */}
          {result && (
            <div
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{
                background: "hsl(220 25% 8% / 0.6)",
                border: "1px solid hsl(220 15% 16%)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="label-text" style={{ marginBottom: 0 }}>Pip Value Estimator</span>
                <span className="text-xs font-semibold" style={{ color: "hsl(215 15% 38%)" }}>
                  Contract size = 1
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "hsl(215 15% 40%)", fontSize: "10px" }}>
                    Per Point
                  </span>
                  <span className="text-base font-black" style={{ color: "#10d98a" }}>
                    ${fmt(result.lotSize, 4)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "hsl(215 15% 40%)", fontSize: "10px" }}>
                    Max Loss
                  </span>
                  <span className="text-base font-black" style={{ color: "#f87171" }}>
                    ${fmt(result.lotSize * result.pointDistance, 2)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "hsl(215 15% 40%)", fontSize: "10px" }}>
                    Max Profit
                  </span>
                  <span
                    className="text-base font-black"
                    style={{ color: result.tpDistance != null ? "#10d98a" : "hsl(215 15% 30%)" }}
                  >
                    {result.tpDistance != null
                      ? `$${fmt(result.lotSize * result.tpDistance, 2)}`
                      : "—"}
                  </span>
                </div>
              </div>
              <p className="text-xs" style={{ color: "hsl(215 15% 34%)" }}>
                Each 1 pt move = <span style={{ color: "#f1f5f9", fontWeight: 700 }}>${fmt(result.lotSize, 4)}</span> &nbsp;·&nbsp; Add a TP price to see Max Profit
              </p>
            </div>
          )}

          {/* R:R ratio — only when TP is provided */}
          {result?.rr != null && (
            <div
              className="rounded-xl p-4 flex items-center justify-between"
              style={{
                background: result.rr >= 2
                  ? "hsl(160 60% 8% / 0.7)"
                  : result.rr >= 1
                  ? "hsl(45 80% 8% / 0.7)"
                  : "hsl(0 60% 8% / 0.7)",
                border: result.rr >= 2
                  ? "1px solid hsl(160 60% 35% / 0.3)"
                  : result.rr >= 1
                  ? "1px solid hsl(45 80% 35% / 0.3)"
                  : "1px solid hsl(0 60% 35% / 0.3)",
              }}
            >
              <div className="flex flex-col gap-0.5">
                <span className="label-text" style={{ marginBottom: 0 }}>Reward : Risk Ratio</span>
                <span className="text-xs" style={{ color: "hsl(215 15% 40%)" }}>
                  TP distance: {fmt(result.tpDistance!, 5)} pts
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span
                  className="text-3xl font-black"
                  style={{
                    color: result.rr >= 2 ? "#10d98a" : result.rr >= 1 ? "#f59e0b" : "#f87171",
                  }}
                >
                  {fmt(result.rr, 2)}
                </span>
                <span className="text-sm font-bold" style={{ color: "hsl(215 15% 45%)" }}>R</span>
              </div>
            </div>
          )}

          {/* Warning */}
          {result?.isMinLotOverride && (
            <div
              className="rounded-xl px-4 py-3 flex items-start gap-3"
              style={{ background: "hsl(38 95% 40% / 0.12)", border: "1px solid hsl(38 95% 40% / 0.35)" }}
            >
              <span className="text-base mt-0.5 shrink-0">⚠️</span>
              <p className="text-sm font-medium leading-snug" style={{ color: "#f59e0b" }}>
                Risk configuration below broker limits. Enforcing Minimum Lot of{" "}
                <strong>{fmt(result.minLot, 2)}</strong> for {selectedMarket.name}.
              </p>
            </div>
          )}

          {/* Empty state */}
          {!result && (
            <p className="text-center text-sm" style={{ color: "hsl(215 15% 35%)" }}>
              Fill in all fields above to calculate your position size.
            </p>
          )}

          {/* Log Trade Button */}
          {result && (
            <button
              onClick={logTrade}
              className="w-full rounded-xl py-3.5 text-sm font-bold tracking-widest uppercase transition-all duration-200 active:scale-95"
              style={{
                background: logged
                  ? "hsl(160 60% 35% / 0.25)"
                  : "hsl(160 60% 45% / 0.15)",
                border: logged
                  ? "1px solid hsl(160 60% 45% / 0.6)"
                  : "1px solid hsl(160 60% 45% / 0.3)",
                color: logged ? "#10d98a" : "#10d98a",
                letterSpacing: "0.1em",
              }}
            >
              {logged ? "✓ Logged" : "+ Log This Trade"}
            </button>
          )}
        </div>

        {/* ─── Daily Risk Summary ─── */}
        {(() => {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayEntries = journal.filter(e => e.timestamp >= todayStart.getTime());
          const totalCashToday = todayEntries.reduce((sum, e) => sum + e.cashAtRisk, 0);
          const totalPctToday = todayEntries.length > 0
            ? todayEntries.reduce((sum, e) => sum + e.riskPct, 0)
            : 0;
          const hasToday = todayEntries.length > 0;
          const maxRiskVal = parseFloat(maxRisk);
          const isBreached = hasToday && !isNaN(maxRiskVal) && maxRiskVal > 0 && totalPctToday > maxRiskVal;

          return (
            <div
              className="rounded-2xl p-5 flex flex-col gap-4 mt-2"
              style={{
                background: isBreached
                  ? "linear-gradient(135deg, hsl(0 70% 10% / 0.9), hsl(220 22% 11%))"
                  : "hsl(220 22% 11%)",
                border: isBreached
                  ? "1px solid hsl(0 70% 45% / 0.4)"
                  : "1px solid hsl(220 15% 17%)",
                transition: "all 0.3s ease",
              }}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2
                    className="text-sm font-black tracking-widest uppercase"
                    style={{ color: isBreached ? "#f87171" : "#f1f5f9", letterSpacing: "0.12em" }}
                  >
                    Today's Risk Summary
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "hsl(215 15% 40%)" }}>
                    {hasToday
                      ? `${todayEntries.length} trade${todayEntries.length > 1 ? "s" : ""} logged today`
                      : "No trades logged today"}
                  </p>
                </div>
                {/* Max daily risk input */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "hsl(215 15% 40%)" }}>
                    Max Risk %
                  </span>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={maxRisk}
                      onChange={e => setMaxRisk(e.target.value)}
                      className="rounded-lg px-3 py-1.5 text-right text-sm font-bold outline-none transition-all duration-200"
                      style={{
                        width: "72px",
                        background: "hsl(220 25% 8% / 0.8)",
                        border: isBreached
                          ? "1px solid hsl(0 70% 45% / 0.5)"
                          : "1px solid hsl(220 15% 22%)",
                        color: isBreached ? "#f87171" : "#f1f5f9",
                        fontSize: "14px",
                      }}
                      autoComplete="off"
                    />
                    <span
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold pointer-events-none"
                      style={{ color: "hsl(215 15% 45%)" }}
                    >
                      %
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2">
                <div
                  className="rounded-xl p-3.5 flex flex-col"
                  style={{ background: "hsl(220 25% 8% / 0.7)", border: "1px solid hsl(220 15% 16%)" }}
                >
                  <span className="text-xs mb-1.5" style={{ color: "hsl(215 15% 42%)", letterSpacing: "0.06em" }}>
                    TRADES
                  </span>
                  <span className="text-2xl font-black" style={{ color: hasToday ? "#f1f5f9" : "hsl(215 15% 28%)" }}>
                    {todayEntries.length}
                  </span>
                </div>
                <div
                  className="rounded-xl p-3.5 flex flex-col"
                  style={{ background: "hsl(220 25% 8% / 0.7)", border: "1px solid hsl(220 15% 16%)" }}
                >
                  <span className="text-xs mb-1.5" style={{ color: "hsl(215 15% 42%)", letterSpacing: "0.06em" }}>
                    TOTAL RISK $
                  </span>
                  <span
                    className="text-2xl font-black"
                    style={{ color: isBreached ? "#f87171" : hasToday ? "#10d98a" : "hsl(215 15% 28%)" }}
                  >
                    {hasToday ? `$${totalCashToday.toFixed(2)}` : "$—"}
                  </span>
                </div>
                <div
                  className="rounded-xl p-3.5 flex flex-col"
                  style={{ background: "hsl(220 25% 8% / 0.7)", border: "1px solid hsl(220 15% 16%)" }}
                >
                  <span className="text-xs mb-1.5" style={{ color: "hsl(215 15% 42%)", letterSpacing: "0.06em" }}>
                    TOTAL RISK %
                  </span>
                  <span
                    className="text-2xl font-black"
                    style={{ color: isBreached ? "#f87171" : hasToday ? "#10d98a" : "hsl(215 15% 28%)" }}
                  >
                    {hasToday ? `${totalPctToday.toFixed(1)}%` : "—"}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              {hasToday && !isNaN(maxRiskVal) && maxRiskVal > 0 && (
                <div>
                  <div
                    className="w-full rounded-full overflow-hidden"
                    style={{ height: "5px", background: "hsl(220 25% 14%)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min((totalPctToday / maxRiskVal) * 100, 100)}%`,
                        background: isBreached
                          ? "linear-gradient(90deg, #f87171, #ef4444)"
                          : "linear-gradient(90deg, #10d98a, #059669)",
                      }}
                    />
                  </div>
                  <p className="text-xs mt-1.5 text-right" style={{ color: "hsl(215 15% 38%)" }}>
                    {Math.min((totalPctToday / maxRiskVal) * 100, 100).toFixed(0)}% of daily limit used
                  </p>
                </div>
              )}

              {/* Breach warning */}
              {isBreached && (
                <div
                  className="rounded-xl px-4 py-3 flex items-start gap-3"
                  style={{
                    background: "hsl(0 70% 40% / 0.12)",
                    border: "1px solid hsl(0 70% 45% / 0.35)",
                  }}
                >
                  <span className="text-base mt-0.5 shrink-0">🚨</span>
                  <p className="text-sm font-medium leading-snug" style={{ color: "#f87171" }}>
                    Daily risk limit exceeded. You have risked{" "}
                    <strong>{totalPctToday.toFixed(1)}%</strong> against your{" "}
                    <strong>{maxRiskVal.toFixed(1)}%</strong> daily max. Consider stopping for the day.
                  </p>
                </div>
              )}
            </div>
          );
        })()}

        {/* ─── Trade Journal ─── */}
        <div className="flex flex-col gap-3 mt-1">
          <div className="flex items-center justify-between">
            <div>
              <h2
                className="text-sm font-black tracking-widest uppercase"
                style={{ color: "#f1f5f9", letterSpacing: "0.12em" }}
              >
                Trade Journal
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "hsl(215 15% 40%)" }}>
                {journal.length === 0
                  ? "No entries yet"
                  : `${journal.length} entr${journal.length === 1 ? "y" : "ies"} saved locally`}
              </p>
            </div>
            {journal.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={exportCSV}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-150 active:scale-95"
                  style={{
                    background: "hsl(160 60% 45% / 0.1)",
                    border: "1px solid hsl(160 60% 45% / 0.25)",
                    color: "#10d98a",
                  }}
                >
                  Export CSV
                </button>
                <button
                  onClick={clearAll}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-150 active:scale-95"
                  style={{
                    background: "hsl(0 70% 40% / 0.12)",
                    border: "1px solid hsl(0 70% 40% / 0.25)",
                    color: "hsl(0 70% 65%)",
                  }}
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {journal.length === 0 && (
            <div
              className="rounded-xl px-4 py-6 text-center"
              style={{
                background: "hsl(220 22% 11%)",
                border: "1px dashed hsl(220 15% 20%)",
              }}
            >
              <p className="text-sm" style={{ color: "hsl(215 15% 35%)" }}>
                Tap <span style={{ color: "#10d98a" }}>+ Log This Trade</span> after calculating to save an entry.
              </p>
            </div>
          )}

          {journal.map(entry => (
            <div
              key={entry.id}
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{
                background: "hsl(220 22% 11%)",
                border: entry.isMinLotOverride
                  ? "1px solid hsl(38 95% 40% / 0.2)"
                  : "1px solid hsl(220 15% 17%)",
              }}
            >
              {/* Row 1: market + timestamp + delete */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span
                    className="text-sm font-bold truncate"
                    style={{ color: "#f1f5f9" }}
                  >
                    {entry.market}
                  </span>
                  <span className="text-xs" style={{ color: "hsl(215 15% 40%)" }}>
                    {formatTime(entry.timestamp)}
                  </span>
                </div>
                <button
                  onClick={() => deleteEntry(entry.id)}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150 active:scale-90 mt-0.5"
                  style={{
                    background: "hsl(0 70% 40% / 0.1)",
                    color: "hsl(0 70% 60%)",
                    border: "1px solid hsl(0 70% 40% / 0.2)",
                    fontSize: "14px",
                  }}
                  aria-label="Delete entry"
                >
                  ×
                </button>
              </div>

              {/* Row 2: stats */}
              <div className="grid grid-cols-3 gap-2">
                <div
                  className="rounded-lg p-2.5 flex flex-col"
                  style={{ background: "hsl(220 25% 8% / 0.7)" }}
                >
                  <span className="text-xs mb-1" style={{ color: "hsl(215 15% 42%)", letterSpacing: "0.06em" }}>
                    LOT SIZE
                  </span>
                  <span
                    className="text-base font-black"
                    style={{ color: entry.isMinLotOverride ? "#f59e0b" : "#10d98a" }}
                  >
                    {entry.lotSize.toFixed(2)}
                  </span>
                </div>
                <div
                  className="rounded-lg p-2.5 flex flex-col"
                  style={{ background: "hsl(220 25% 8% / 0.7)" }}
                >
                  <span className="text-xs mb-1" style={{ color: "hsl(215 15% 42%)", letterSpacing: "0.06em" }}>
                    RISK $
                  </span>
                  <span className="text-base font-bold" style={{ color: "#f1f5f9" }}>
                    ${entry.cashAtRisk.toFixed(2)}
                  </span>
                </div>
                <div
                  className="rounded-lg p-2.5 flex flex-col"
                  style={{ background: "hsl(220 25% 8% / 0.7)" }}
                >
                  <span className="text-xs mb-1" style={{ color: "hsl(215 15% 42%)", letterSpacing: "0.06em" }}>
                    RISK %
                  </span>
                  <span className="text-base font-bold" style={{ color: "#f1f5f9" }}>
                    {entry.riskPct.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Row 3: entry / sl / tp / rr */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: "hsl(215 15% 42%)" }}>
                <span>Entry <span style={{ color: "#f1f5f9" }}>{entry.entryPrice.toFixed(5)}</span></span>
                <span style={{ color: "hsl(215 15% 28%)" }}>→</span>
                <span>SL <span style={{ color: "#f1f5f9" }}>{entry.slPrice.toFixed(5)}</span></span>
                {entry.tpPrice != null && (
                  <>
                    <span style={{ color: "hsl(215 15% 28%)" }}>→</span>
                    <span>TP <span style={{ color: "#f1f5f9" }}>{entry.tpPrice.toFixed(5)}</span></span>
                  </>
                )}
                <span style={{ color: "hsl(215 15% 28%)" }}>·</span>
                <span>{entry.pointDistance.toFixed(5)} pts</span>
                {entry.rr != null && (
                  <>
                    <span style={{ color: "hsl(215 15% 28%)" }}>·</span>
                    <span
                      style={{
                        color: entry.rr >= 2 ? "#10d98a" : entry.rr >= 1 ? "#f59e0b" : "#f87171",
                        fontWeight: 700,
                      }}
                    >
                      {entry.rr.toFixed(2)}R
                    </span>
                  </>
                )}
                {entry.isMinLotOverride && (
                  <>
                    <span style={{ color: "hsl(215 15% 28%)" }}>·</span>
                    <span style={{ color: "#f59e0b" }}>Min enforced</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-4 pb-6 flex flex-col gap-1.5">
          <p className="text-xs" style={{ color: "hsl(215 15% 30%)" }}>
            Deriv contract size is 1 across all Boom &amp; Crash pairs.
            <br />
            Always trade within your risk tolerance.
          </p>
          <p className="text-xs font-semibold" style={{ color: "hsl(215 15% 24%)" }}>
            © CountryFX Inc. 2026
          </p>
        </div>
      </main>
    </div>
  );
}
