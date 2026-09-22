/**
 * Live Data Fetcher for Gold Safe Haven Score
 * Pulls real-time data from FRED API, Yahoo Finance, and GPR Index
 * Computes the 7-component scoring model on the fly
 */

import * as fs from "fs";
import * as path from "path";

// ─── FRED API (public, no key needed for CSV format) ─────────────
const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";
const FRED_API_KEY = "DEMO_KEY"; // Public demo key — works for low-volume

interface FredObs {
  date: string;
  value: number;
}

async function fetchFredSeries(
  seriesId: string,
  lookbackMonths: number = 24
): Promise<FredObs[]> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - lookbackMonths);
  const startStr = startDate.toISOString().split("T")[0];

  // Use FRED's public CSV endpoint (no key required)
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&cosd=${startStr}`;

  const resp = await fetch(url, {
    headers: { "User-Agent": "AstroFX-Gold-Intelligence/1.0" },
  });

  if (!resp.ok) {
    console.warn(`FRED fetch failed for ${seriesId}: ${resp.status}`);
    return [];
  }

  const text = await resp.text();
  const lines = text.trim().split("\n").slice(1); // skip header

  return lines
    .map((line) => {
      const [date, val] = line.split(",");
      const value = parseFloat(val);
      return { date: date.trim(), value };
    })
    .filter((obs) => !isNaN(obs.value));
}

// ─── Yahoo Finance Gold Price ────────────────────────────────────
interface GoldPrice {
  date: string;
  close: number;
}

interface GoldFetchResult {
  dailyPrices: GoldPrice[];
  hourlyPrices: GoldPrice[];
  fifteenMinPrices: GoldPrice[];
  spotPrice: number;
  futuresPrice: number;
  spotSource: string;
}

/** Fetch XAU/USD spot price from gold-api.com (primary, no auth, true spot)
 *  with Yahoo Finance GC=F daily data as fallback for historical SMA calculation. */
async function fetchGoldPrice(): Promise<GoldFetchResult> {
  const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";

  // 1. Primary: gold-api.com for true XAU/USD spot (no auth, real-time)
  let spotPrice: number | null = null;
  let spotSource = "";
  try {
    const resp = await fetch("https://api.gold-api.com/price/XAU", {
      headers: { "User-Agent": ua },
    });
    if (resp.ok) {
      const json = (await resp.json()) as any;
      if (json.price && json.price > 0) {
        spotPrice = json.price;
        spotSource = "gold-api.com";
      }
    }
  } catch (err) {
    console.warn("[Gold] gold-api.com fetch failed:", err);
  }

  // 2. Fallback: Yahoo Finance GC=F for daily history + fallback spot
  const now = Math.floor(Date.now() / 1000);
  const sixMonthsAgo = now - 180 * 24 * 3600;
  const sevenDaysAgo = now - 7 * 24 * 3600;
  const fiveDaysAgo = now - 5 * 24 * 3600;
  let dailyPrices: GoldPrice[] = [];
  let hourlyPrices: GoldPrice[] = [];
  let fifteenMinPrices: GoldPrice[] = [];
  let yahooSpot: number | null = null;

  try {
    const dailyUrl = `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=${sixMonthsAgo}&period2=${now}&interval=1d`;
    const resp = await fetch(dailyUrl, { headers: { "User-Agent": ua } });
    if (resp.ok) {
      const json = (await resp.json()) as any;
      const result = json.chart?.result?.[0];
      if (result) {
        yahooSpot = result.meta?.regularMarketPrice || null;
        const timestamps: number[] = result.timestamp || [];
        const closes: number[] = result.indicators?.quote?.[0]?.close || [];
        dailyPrices = timestamps.map((ts, i) => ({
          date: new Date(ts * 1000).toISOString().split("T")[0],
          close: closes[i] || 0,
        })).filter((p) => p.close > 0);
      }
    }
  } catch (err) {
    console.warn("[Gold] Yahoo daily fetch failed:", err);
  }

  // 2b. Short-term hourly history for reactive momentum (6h/24h)
  try {
    const hourlyUrl = `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=${sevenDaysAgo}&period2=${now}&interval=1h`;
    const resp = await fetch(hourlyUrl, { headers: { "User-Agent": ua } });
    if (resp.ok) {
      const json = (await resp.json()) as any;
      const result = json.chart?.result?.[0];
      if (result) {
        const timestamps: number[] = result.timestamp || [];
        const closes: number[] = result.indicators?.quote?.[0]?.close || [];
        hourlyPrices = timestamps
          .map((ts, i) => ({
            date: new Date(ts * 1000).toISOString(),
            close: closes[i] || 0,
          }))
          .filter((p) => p.close > 0);
      }
    }
  } catch (err) {
    console.warn("[Gold] Yahoo hourly fetch failed:", err);
  }

  // 2c. Fast intraday history (15m) for trader mode
  try {
    const fastUrl = `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=${fiveDaysAgo}&period2=${now}&interval=15m`;
    const resp = await fetch(fastUrl, { headers: { "User-Agent": ua } });
    if (resp.ok) {
      const json = (await resp.json()) as any;
      const result = json.chart?.result?.[0];
      if (result) {
        const timestamps: number[] = result.timestamp || [];
        const closes: number[] = result.indicators?.quote?.[0]?.close || [];
        fifteenMinPrices = timestamps
          .map((ts, i) => ({
            date: new Date(ts * 1000).toISOString(),
            close: closes[i] || 0,
          }))
          .filter((p) => p.close > 0);
      }
    }
  } catch (err) {
    console.warn("[Gold] Yahoo 15m fetch failed:", err);
  }

  // 3. Spot for display/basis; tape close for continuous daily series (GC=F only).
  // Never write spot into dailyPrices — that pollutes momentum vs futures history.
  const tapeClose =
    yahooSpot || fifteenMinPrices.at(-1)?.close || dailyPrices.at(-1)?.close || 0;
  const displaySpot = spotPrice || tapeClose;
  const source = spotPrice ? spotSource : yahooSpot ? "Yahoo GC=F" : "historical";

  // 4. Update/append today's GC=F tape close
  if (tapeClose > 0) {
    const today = new Date().toISOString().split("T")[0];
    const lastEntry = dailyPrices.at(-1);
    if (lastEntry && lastEntry.date === today) {
      lastEntry.close = tapeClose;
    } else {
      dailyPrices.push({ date: today, close: tapeClose });
    }
  }

  const basis = yahooSpot && spotPrice ? yahooSpot - spotPrice : 0;
  console.log(
    `[Gold] XAU/USD: $${displaySpot.toFixed(2)} via ${source}${yahooSpot ? ` (GC=F: $${yahooSpot.toFixed(2)}, basis: $${basis.toFixed(2)})` : ""} | ${dailyPrices.length} daily points`
  );

  return {
    dailyPrices,
    hourlyPrices,
    fifteenMinPrices,
    spotPrice: displaySpot,
    futuresPrice: yahooSpot || tapeClose,
    spotSource: spotPrice ? spotSource : "Yahoo GC=F",
  };
}

// ─── GPR Index ───────────────────────────────────────────────────
async function fetchGPRIndex(): Promise<{ date: string; gpr: number }[]> {
  // Binary XLS file from Caldara-Iacoviello GPR dataset
  const url =
    "https://www.matteoiacoviello.com/gpr_files/data_gpr_export.xls";

  try {
    // Dynamic import of xlsx — handles both ESM and CJS
    let XLSX: any;
    try {
      XLSX = await import("xlsx");
      if (XLSX.default) XLSX = XLSX.default;
    } catch {
      XLSX = require("xlsx");
    }

    const resp = await fetch(url, {
      headers: { "User-Agent": "AstroFX-Gold-Intelligence/1.0" },
    });

    if (!resp.ok) {
      console.warn(`GPR fetch failed: ${resp.status}`);
      return [];
    }

    // Read binary XLS into buffer
    const arrayBuf = await resp.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    // Parse with xlsx library
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Find GPR column index from header row
    const headers: string[] = rawData[0]?.map((h: any) => String(h).trim()) ?? [];
    const gprColIdx = headers.indexOf("GPR");
    if (gprColIdx < 0) {
      console.warn("GPR column not found in XLS headers:", headers.slice(0, 10));
      return [];
    }

    // Parse rows: col 0 = Excel serial date, col gprColIdx = GPR value
    const rows: { date: string; gpr: number }[] = [];
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length <= gprColIdx) continue;

      const excelSerial = row[0];
      const gprVal = parseFloat(row[gprColIdx]);
      if (isNaN(gprVal) || typeof excelSerial !== "number") continue;

      // Convert Excel serial date to ISO string
      const jsDate = new Date((excelSerial - 25569) * 86400 * 1000);
      const dateStr = jsDate.toISOString().split("T")[0];
      rows.push({ date: dateStr, gpr: Math.round(gprVal * 100) / 100 });
    }

    console.log(
      `[GPR] Parsed ${rows.length} rows, latest: ${rows.at(-1)?.date} GPR=${rows.at(-1)?.gpr}`
    );

    // Return last 24 months for lookback
    return rows.slice(-24);
  } catch (err) {
    console.warn("GPR fetch error:", err);
    return [];
  }
}

// ─── Scoring Functions ───────────────────────────────────────────

/** Rolling percentile rank over array of numbers */
function percentileRank(values: number[], currentValue: number): number {
  const sorted = values.filter((v) => !isNaN(v)).sort((a, b) => a - b);
  if (sorted.length < 3) return 50;
  let count = 0;
  for (const v of sorted) {
    if (v < currentValue) count++;
    else if (v === currentValue) count += 0.5;
  }
  return (count / sorted.length) * 100;
}

/** Remap GPR value to 0-100 score */
function remapGPR(val: number): number {
  if (isNaN(val)) return 50;
  if (val < 80) return 20;
  if (val < 150) return 20 + ((val - 80) / 70) * 60;
  if (val < 250) return 80 + ((val - 150) / 100) * 20;
  return 100;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ─── Types ───────────────────────────────────────────────────────
export interface BasisData {
  spot: number;         // XAU/USD spot from gold-api.com
  futures: number;      // GC=F front-month futures from Yahoo
  basis: number;        // futures - spot (premium)
  basisPct: number;     // basis as % of spot
  contangoWarning: boolean; // true if basis > $50
  spotSource: string;   // e.g. "gold-api.com"
  futuresSource: string; // e.g. "Yahoo GC=F"
}

export interface LiveScoreData {
  // Raw values
  realYield: number;
  vix: number;
  breakeven: number;
  hySpread: number;
  usdBroad: number;
  gpr: number;
  goldClose: number;

  // Spot-Futures Basis
  basisData: BasisData;

  // Component scores (0-100)
  ryScore: number;
  usdScore: number;
  gprScore: number;
  cbScore: number;
  riskoffScore: number;
  inflationScore: number;
  momentumScore: number;

  // Composite
  goldSafeHavenScore: number;
  intradayDominance: {
    fast: {
      components: {
        name: string;
        score: number;
        weight: number;
        contribution: number;
      }[];
      window: "15m/1h";
      lastSampleAt: string;
    };
    h2: {
      components: {
        name: string;
        score: number;
        weight: number;
        contribution: number;
      }[];
      window: "2h";
      lastSampleAt: string;
    };
    h4: {
      components: {
        name: string;
        score: number;
        weight: number;
        contribution: number;
      }[];
      window: "4h";
      lastSampleAt: string;
    };
  };

  // Metadata
  lastFetched: string; // ISO timestamp
  nextRefresh: string; // ISO timestamp
  dataStatus: "live" | "stale" | "error";
  sources: {
    fred: boolean;
    yahoo: boolean;
    gpr: boolean;
  };

  /** Short-horizon market deltas for /api/score factor copy (Battlefield narratives). */
  factorContext?: {
    roc15mPct: number;
    roc1hPct: number;
    roc4hPct: number;
    roc6hPct: number;
    roc8hPct: number;
    roc24hPct: number;
    usdMomPct: number;
    /** Prior DTWEXBGS observation (previous FRED print vs latest). */
    usdIndexPrior: number;
    /** Daily change in 10Y real yield (same units as latestRYChange in scoring). */
    realYieldDailyChange: number;
    /** Prior DFII10 real yield (previous observation). */
    realYieldPrior: number;
    /** Prior T10YIE breakeven (previous observation). */
    breakevenPrior: number;
    vixPrev: number;
    hyPrev: number;
  };
}

// ─── Score Log ───────────────────────────────────────────────────
export interface ScoreLogEntry {
  timestamp: string; // ISO
  score: number;
  signal: string; // STRONG BUY, BUY, HOLD, REDUCE, SELL, STRONG SELL
  goldClose: number;
  vix: number;
  gpr: number;
  delta: number; // change from previous reading
  basis?: number; // spot-futures basis
  contangoWarning?: boolean;
  components: {
    ry: number;
    usd: number;
    gpr: number;
    cb: number;
    riskoff: number;
    inflation: number;
    momentum: number;
  };
}

export interface HourlySentimentSnapshot {
  timestamp: string; // ISO capture timestamp
  londonDate: string; // YYYY-MM-DD in Europe/London
  londonHour: string; // HH:00 in Europe/London
  londonHourKey: string; // YYYY-MM-DD HH:00
  bullishPct: number;
  bearishPct: number;
  macroScore: number;
  intradayScore: number | null;
}

function getSignalLabel(score: number): string {
  if (score >= 75) return "STRONG BUY";
  if (score >= 65) return "BUY";
  if (score >= 50) return "HOLD";
  if (score >= 35) return "REDUCE";
  if (score >= 20) return "SELL";
  return "STRONG SELL";
}

const MAX_LOG_ENTRIES = 500; // ~10 days of 30-min readings
let scoreLog: ScoreLogEntry[] = [];
const MAX_HOURLY_SNAPSHOTS = 24 * 14; // retain 14 days of hourly snapshots
let hourlySentimentSnapshots: HourlySentimentSnapshot[] = [];

// Persistence: save/load from JSON file next to the data dir
function getLogFilePath(): string {
  // Try several locations
  for (const base of [
    path.join(process.cwd(), "server", "data"),
    path.join(process.cwd(), "dist", "data"),
  ]) {
    if (fs.existsSync(base)) return path.join(base, "score_log.json");
  }
  return path.join(process.cwd(), "score_log.json");
}

function getHourlySnapshotFilePath(): string {
  for (const base of [
    path.join(process.cwd(), "server", "data"),
    path.join(process.cwd(), "dist", "data"),
  ]) {
    if (fs.existsSync(base)) return path.join(base, "hourly_sentiment.json");
  }
  return path.join(process.cwd(), "hourly_sentiment.json");
}

function loadScoreLog(): void {
  try {
    const filePath = getLogFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      scoreLog = JSON.parse(raw);
      console.log(`[Score Log] Loaded ${scoreLog.length} entries from disk`);
    }
  } catch (err) {
    console.warn("[Score Log] Failed to load from disk:", err);
  }
}

function loadHourlySentimentSnapshots(): void {
  try {
    const filePath = getHourlySnapshotFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw) as any[];
      hourlySentimentSnapshots = parsed.map((row) => ({
        timestamp: row.timestamp,
        londonDate: row.londonDate,
        londonHour: row.londonHour,
        londonHourKey: row.londonHourKey,
        bullishPct: row.bullishPct,
        bearishPct: row.bearishPct,
        macroScore: Number.isFinite(row.macroScore) ? row.macroScore : (Number.isFinite(row.score) ? row.score : 50),
        intradayScore: row.intradayScore ?? null,
      }));
      console.log(
        `[Hourly Sentiment] Loaded ${hourlySentimentSnapshots.length} snapshots from disk`,
      );
    }
  } catch (err) {
    console.warn("[Hourly Sentiment] Failed to load from disk:", err);
  }
}

function saveScoreLog(): void {
  try {
    const filePath = getLogFilePath();
    fs.writeFileSync(filePath, JSON.stringify(scoreLog), "utf-8");
  } catch (err) {
    console.warn("[Score Log] Failed to save to disk:", err);
  }
}

function saveHourlySentimentSnapshots(): void {
  try {
    const filePath = getHourlySnapshotFilePath();
    fs.writeFileSync(filePath, JSON.stringify(hourlySentimentSnapshots), "utf-8");
  } catch (err) {
    console.warn("[Hourly Sentiment] Failed to save to disk:", err);
  }
}

function getLondonDateHourKey(date: Date): { londonDate: string; londonHour: string; londonHourKey: string } {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const londonDate = `${year}-${month}-${day}`;
  const londonHour = `${hour}:00`;
  return {
    londonDate,
    londonHour,
    londonHourKey: `${londonDate} ${londonHour}`,
  };
}

function computeBullBearFromComponents(data: LiveScoreData): { bullishPct: number; bearishPct: number } {
  return computeBullBearFromComponentSet(
    [
      { score: data.ryScore, weight: 0.25 },
      { score: data.usdScore, weight: 0.2 },
      { score: data.gprScore, weight: 0.13 },
      { score: data.cbScore, weight: 0.05 },
      { score: data.riskoffScore, weight: 0.15 },
      { score: data.inflationScore, weight: 0.1 },
      { score: data.momentumScore, weight: 0.12 },
    ],
    data.goldSafeHavenScore,
  );
}

function computeBullBearFromComponentSet(
  components: Array<{ score: number; weight: number }>,
  fallbackScore: number,
): { bullishPct: number; bearishPct: number } {
  let bullSum = 0;
  let bearSum = 0;
  for (const c of components) {
    const centered = (c.score - 50) / 50;
    const deadZone = 0.06;
    const adjusted = Math.abs(centered) < deadZone ? 0 : centered;
    const signed = Math.max(-c.weight * 0.85, Math.min(c.weight * 0.85, adjusted * c.weight));
    if (signed > 0) bullSum += signed;
    if (signed < 0) bearSum += Math.abs(signed);
  }

  const total = bullSum + bearSum;
  if (total <= 0) {
    const bullishPct = Math.round(fallbackScore * 10) / 10;
    return { bullishPct, bearishPct: Math.round((100 - bullishPct) * 10) / 10 };
  }

  const bullishPct = Math.round((bullSum / total) * 1000) / 10;
  return { bullishPct, bearishPct: Math.round((100 - bullishPct) * 10) / 10 };
}

function backfillRecentHourlySnapshotsFromScoreLog(hoursLookback: number = 48): void {
  if (!scoreLog.length) return;
  const cutoffMs = Date.now() - hoursLookback * 60 * 60 * 1000;

  // Keep earliest reading in each London hour to approximate "start-of-hour" state.
  const earliestPerHour = new Map<string, ScoreLogEntry>();
  for (const entry of scoreLog) {
    const ts = new Date(entry.timestamp).getTime();
    if (!Number.isFinite(ts) || ts < cutoffMs) continue;
    const { londonHourKey } = getLondonDateHourKey(new Date(ts));
    const existing = earliestPerHour.get(londonHourKey);
    if (!existing || new Date(entry.timestamp).getTime() < new Date(existing.timestamp).getTime()) {
      earliestPerHour.set(londonHourKey, entry);
    }
  }

  let inserted = 0;
  for (const entry of Array.from(earliestPerHour.values())) {
    const dt = new Date(entry.timestamp);
    const { londonDate, londonHour, londonHourKey } = getLondonDateHourKey(dt);
    if (hourlySentimentSnapshots.some((s) => s.londonHourKey === londonHourKey)) continue;
    const { bullishPct, bearishPct } = computeBullBearFromComponentSet(
      [
        { score: entry.components.ry, weight: 0.25 },
        { score: entry.components.usd, weight: 0.2 },
        { score: entry.components.gpr, weight: 0.13 },
        { score: entry.components.cb, weight: 0.05 },
        { score: entry.components.riskoff, weight: 0.15 },
        { score: entry.components.inflation, weight: 0.1 },
        { score: entry.components.momentum, weight: 0.12 },
      ],
      entry.score,
    );
    hourlySentimentSnapshots.push({
      timestamp: entry.timestamp,
      londonDate,
      londonHour,
      londonHourKey,
      bullishPct,
      bearishPct,
      macroScore: entry.score,
      intradayScore: null,
    });
    inserted++;
  }

  if (inserted > 0) {
    hourlySentimentSnapshots.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    if (hourlySentimentSnapshots.length > MAX_HOURLY_SNAPSHOTS) {
      hourlySentimentSnapshots = hourlySentimentSnapshots.slice(-MAX_HOURLY_SNAPSHOTS);
    }
    saveHourlySentimentSnapshots();
    console.log(`[Hourly Sentiment] Backfilled ${inserted} hourly snapshots from recent score log`);
  }
}

function appendHourlySentimentSnapshot(data: LiveScoreData): void {
  const now = new Date();
  const { londonDate, londonHour, londonHourKey } = getLondonDateHourKey(now);
  if (hourlySentimentSnapshots.some((s) => s.londonHourKey === londonHourKey)) return;

  const { bullishPct, bearishPct } = computeBullBearFromComponents(data);
  const intradayScore =
    data.intradayDominance.fast.components.length > 0
      ? data.intradayDominance.fast.components.reduce((sum, c) => sum + c.contribution, 0)
      : null;
  hourlySentimentSnapshots.push({
    timestamp: now.toISOString(),
    londonDate,
    londonHour,
    londonHourKey,
    bullishPct,
    bearishPct,
    macroScore: data.goldSafeHavenScore,
    intradayScore: intradayScore != null ? Math.round(intradayScore * 10) / 10 : null,
  });

  hourlySentimentSnapshots.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (hourlySentimentSnapshots.length > MAX_HOURLY_SNAPSHOTS) {
    hourlySentimentSnapshots = hourlySentimentSnapshots.slice(-MAX_HOURLY_SNAPSHOTS);
  }
  saveHourlySentimentSnapshots();
}

function appendToScoreLog(data: LiveScoreData): void {
  const prevScore = scoreLog.length > 0 ? scoreLog[scoreLog.length - 1].score : data.goldSafeHavenScore;
  const delta = Math.round((data.goldSafeHavenScore - prevScore) * 10) / 10;

  const entry: ScoreLogEntry = {
    timestamp: data.lastFetched,
    score: data.goldSafeHavenScore,
    signal: getSignalLabel(data.goldSafeHavenScore),
    goldClose: Math.round(data.goldClose * 100) / 100,
    vix: data.vix,
    gpr: data.gpr,
    delta,
    basis: data.basisData.basis,
    contangoWarning: data.basisData.contangoWarning,
    components: {
      ry: data.ryScore,
      usd: data.usdScore,
      gpr: data.gprScore,
      cb: data.cbScore,
      riskoff: data.riskoffScore,
      inflation: data.inflationScore,
      momentum: data.momentumScore,
    },
  };

  scoreLog.push(entry);

  // Trim to max
  if (scoreLog.length > MAX_LOG_ENTRIES) {
    scoreLog = scoreLog.slice(-MAX_LOG_ENTRIES);
  }

  saveScoreLog();
  console.log(
    `[Score Log] #${scoreLog.length} | Score: ${entry.score} (${entry.delta >= 0 ? "+" : ""}${entry.delta}) | Signal: ${entry.signal}`
  );
}

export function getScoreLog(): ScoreLogEntry[] {
  return scoreLog;
}

export function getHourlySentimentSnapshots(): HourlySentimentSnapshot[] {
  return hourlySentimentSnapshots;
}

// ─── Cache ───────────────────────────────────────────────────────
let cachedLiveScore: LiveScoreData | null = null;
let fetchInProgress = false;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function getCachedLiveScore(): LiveScoreData | null {
  return cachedLiveScore;
}

// Last 7 days of hourly GC=F closes from the most recent successful fetch.
let latestHourlyPrices: GoldPrice[] = [];

export function getLatestHourlyPrices(): GoldPrice[] {
  return latestHourlyPrices;
}

export function isFetchInProgress(): boolean {
  return fetchInProgress;
}

// ─── Main Fetch & Compute ────────────────────────────────────────
export async function fetchAndComputeLiveScore(): Promise<LiveScoreData> {
  if (fetchInProgress && cachedLiveScore) return cachedLiveScore;
  fetchInProgress = true;

  const sources = { fred: false, yahoo: false, gpr: false };

  try {
    // Parallel fetch all data sources
    const [realYieldData, vixData, breakevenData, hyData, usdData, gprData, goldResult] =
      await Promise.all([
        fetchFredSeries("DFII10", 18),
        fetchFredSeries("VIXCLS", 18),
        fetchFredSeries("T10YIE", 18),
        fetchFredSeries("BAMLH0A0HYM2", 18),
        fetchFredSeries("DTWEXBGS", 18),
        fetchGPRIndex(),
        fetchGoldPrice(),
      ]);

    // Destructure gold result
    const goldData = goldResult.dailyPrices;
    const goldHourly = goldResult.hourlyPrices;
    if (goldHourly.length > 0) latestHourlyPrices = goldHourly;
    const goldSpot = goldResult.spotPrice;
    const goldFutures = goldResult.futuresPrice;
    const goldSpotSource = goldResult.spotSource;
    const goldFast = goldResult.fifteenMinPrices;

    // Mark which sources succeeded
    if (realYieldData.length > 0) sources.fred = true;
    if (goldData.length > 0) sources.yahoo = true;
    if (gprData.length > 0) sources.gpr = true;

    // Build basis data
    const basis = Math.round((goldFutures - goldSpot) * 100) / 100;
    const basisPct = goldSpot > 0 ? Math.round((basis / goldSpot) * 10000) / 100 : 0;
    const basisData: BasisData = {
      spot: Math.round(goldSpot * 100) / 100,
      futures: Math.round(goldFutures * 100) / 100,
      basis,
      basisPct,
      contangoWarning: basis > 50,
      spotSource: goldSpotSource,
      futuresSource: "Yahoo GC=F",
    };

    if (basisData.contangoWarning) {
      console.warn(`[Basis] ⚠️ CONTANGO WARNING: $${basis.toFixed(2)} (${basisPct.toFixed(2)}%) — futures premium above $50`);
    }

    // Extract latest values
    const latestRY = realYieldData.at(-1)?.value ?? 1.8;
    const latestVIX = vixData.at(-1)?.value ?? 20;
    const latestBE = breakevenData.at(-1)?.value ?? 2.3;
    const latestHY = hyData.at(-1)?.value ?? 3.5;
    const latestUSD = usdData.at(-1)?.value ?? 110;
    const latestGPR = gprData.at(-1)?.gpr ?? 100;
    const latestGold = goldData.at(-1)?.close ?? 2500;

    // Get lookback arrays for percentile calculations
    const ryValues = realYieldData.map((d) => d.value);
    const vixValues = vixData.map((d) => d.value);
    const beValues = breakevenData.map((d) => d.value);
    const hyValues = hyData.map((d) => d.value);
    const usdValues = usdData.map((d) => d.value);
    const goldCloses = goldData.map((d) => d.close);

    // Component 1: Real Yield Direction (falling = bullish for gold)
    // Compute month-over-month changes
    const ryChanges = ryValues.slice(1).map((v, i) => v - ryValues[i]);
    const latestRYChange = ryChanges.at(-1) ?? 0;
    const ryScore = 100 - percentileRank(ryChanges, latestRYChange);

    // Component 2: USD Trend (weakening = bullish for gold)
    const usdRocs = usdValues.slice(1).map((v, i) =>
      ((v - usdValues[i]) / usdValues[i]) * 100
    );
    const latestUSDRoc = usdRocs.at(-1) ?? 0;
    const usdScore = 100 - percentileRank(usdRocs, latestUSDRoc);

    // Component 3: GPR Index
    const gprScore = remapGPR(latestGPR);

    // Component 4: Central Bank Demand (structural — 2022+ is high demand regime)
    const cbScore = 70; // Post-2022 structural bid

    // Component 5: Risk-Off Score (VIX + HY spread)
    const vixPct = percentileRank(vixValues, latestVIX);
    const hyPct = percentileRank(hyValues, latestHY);
    const riskoffScore = 0.5 * vixPct + 0.5 * hyPct;

    // Component 6: Inflation Expectations (rising breakevens = bullish)
    const beChanges = beValues.slice(1).map((v, i) => v - beValues[i]);
    const latestBEChange = beChanges.at(-1) ?? 0;
    const inflationScore = percentileRank(beChanges, latestBEChange);

    // Component 7: Momentum (trend + short-term impulse)
    // - Trend leg keeps structural context (3-month SMA)
    // - Impulse leg adds 6h/24h responsiveness to sharp moves
    const smaWindow = Math.min(63, goldCloses.length);
    const smaSlice = goldCloses.slice(-smaWindow);
    const sma3 = smaSlice.reduce((a, b) => a + b, 0) / Math.max(smaSlice.length, 1);
    const trendScore = latestGold > sma3 ? 70 : 30;

    const dailyReturns = goldCloses
      .slice(1)
      .map((v, i) => ((v - goldCloses[i]) / Math.max(goldCloses[i], 1)) * 100);
    const latestDailyReturn = dailyReturns.at(-1) ?? 0;
    const dailyImpulseScore = percentileRank(dailyReturns, latestDailyReturn);

    const currentTs = Date.now();
    // Intraday/short-horizon ROCs must stay on one continuous series (Yahoo GC=F).
    // Mixing gold-api.com spot "now" with futures lookbacks invents false bearish ROCs
    // whenever futures trade at a premium to spot (common in contango).
    const latestFutures =
      goldFast.at(-1)?.close ??
      goldHourly.at(-1)?.close ??
      goldFutures ??
      latestGold;
    const closestPriceAtOrBefore = (hoursBack: number): number | null => {
      const target = currentTs - hoursBack * 3600 * 1000;
      for (let i = goldHourly.length - 1; i >= 0; i--) {
        const ts = new Date(goldHourly[i].date).getTime();
        if (ts <= target) return goldHourly[i].close;
      }
      return null;
    };

    const px6h = closestPriceAtOrBefore(6);
    const px24h = closestPriceAtOrBefore(24);
    const roc6h = px6h ? ((latestFutures - px6h) / px6h) * 100 : 0;
    const roc24h = px24h ? ((latestFutures - px24h) / px24h) * 100 : latestDailyReturn;

    // Scale 6h/24h moves into a bounded 0-100 score.
    // Positive move => more supportive, negative move => less supportive.
    const shortTermImpulseScore = clamp(50 + roc24h * 20 + roc6h * 10, 0, 100);
    const momentumScore =
      0.35 * trendScore + 0.25 * dailyImpulseScore + 0.4 * shortTermImpulseScore;

    // Intraday trader mode (fast 15m/1h reactivity)
    const closestIntradayAtOrBefore = (series: GoldPrice[], minutesBack: number): number | null => {
      const target = Date.now() - minutesBack * 60 * 1000;
      for (let i = series.length - 1; i >= 0; i--) {
        const ts = new Date(series[i].date).getTime();
        if (ts <= target) return series[i].close;
      }
      return null;
    };

    const px15m = closestIntradayAtOrBefore(goldFast, 15);
    const px1h = closestIntradayAtOrBefore(goldFast, 60) ?? closestPriceAtOrBefore(1);
    const px4h = closestIntradayAtOrBefore(goldFast, 240) ?? closestPriceAtOrBefore(4);
    const px8h = closestPriceAtOrBefore(8);

    const roc15m = px15m ? ((latestFutures - px15m) / px15m) * 100 : 0;
    const roc1h = px1h ? ((latestFutures - px1h) / px1h) * 100 : 0;
    const roc4h = px4h ? ((latestFutures - px4h) / px4h) * 100 : 0;
    const roc8h = px8h ? ((latestFutures - px8h) / px8h) * 100 : 0;
    // Prefer directional move over pure acceleration so a sharp bounce isn't
    // cancelled by still-negative longer-window structure mid-rally.
    const accel = roc1h - roc4h;

    // Softer coeffs than raw tape — 15m alone shouldn't whip the bar red/green.
    const xauImpulseScore = clamp(50 + roc15m * 45 + roc1h * 50, 0, 100);
    const xauAccelerationScore = clamp(50 + accel * 25 + roc4h * 30, 0, 100);
    const usdPulseScore = clamp(50 - latestUSDRoc * 45, 0, 100);
    const yieldPulseScore = clamp(50 - latestRYChange * 30, 0, 100);
    const riskPulseScore = clamp(
      0.6 * clamp(50 + (latestVIX - (vixData.at(-2)?.value ?? latestVIX)) * 7, 0, 100) +
        0.4 * clamp(50 + (latestHY - (hyData.at(-2)?.value ?? latestHY)) * 20, 0, 100),
      0,
      100,
    );

    // Compress toward 50 so modest moves stay near neutral instead of 0/100.
    const amplifyIntraday = (s: number) => clamp(50 + (s - 50) * 0.85, 0, 100);

    type IntradayComponent = {
      name: string;
      score: number;
      weight: number;
      contribution: number;
    };

    const finalizeIntraday = (
      rows: { name: string; score: number; weight: number }[],
    ): IntradayComponent[] =>
      rows.map((c) => {
        const score = Math.round(amplifyIntraday(c.score) * 10) / 10;
        return {
          ...c,
          score,
          contribution: score * c.weight,
        };
      });

    /** Blend with prior cache so bars need sustained pressure to flip colour. */
    const smoothIntraday = (
      next: IntradayComponent[],
      prev: IntradayComponent[] | undefined,
      alpha = 0.38,
    ): IntradayComponent[] => {
      if (!prev?.length) return next;
      const prevByName = new Map(prev.map((c) => [c.name, c.score]));
      return next.map((c) => {
        const old = prevByName.get(c.name);
        if (old == null || !Number.isFinite(old)) return c;
        const blended = old * (1 - alpha) + c.score * alpha;
        const score = Math.round(blended * 10) / 10;
        return { ...c, score, contribution: score * c.weight };
      });
    };

    const prevIntra = cachedLiveScore?.intradayDominance;

    // Price still dominates, but 1h/structure outweigh noisy 15m ticks.
    const intradayFastComponents = smoothIntraday(
      finalizeIntraday([
        { name: "XAU 15m/1h Impulse", score: xauImpulseScore, weight: 0.48 },
        { name: "XAU Acceleration (1h vs 4h)", score: xauAccelerationScore, weight: 0.30 },
        { name: "USD Pulse", score: usdPulseScore, weight: 0.09 },
        { name: "Real Yield Pulse", score: yieldPulseScore, weight: 0.07 },
        { name: "Risk Pulse", score: riskPulseScore, weight: 0.06 },
      ]),
      prevIntra?.fast.components,
      0.35,
    );

    const h2ImpulseScore = clamp(50 + roc1h * 45 + roc4h * 35, 0, 100);
    const h2StructureScore = clamp(50 + (roc1h - roc8h) * 18 + roc1h * 16, 0, 100);
    const intraday2hComponents = smoothIntraday(
      finalizeIntraday([
        { name: "XAU 2h Impulse", score: h2ImpulseScore, weight: 0.50 },
        { name: "XAU 2h Structure", score: h2StructureScore, weight: 0.28 },
        { name: "USD 2h Pulse", score: usdPulseScore, weight: 0.09 },
        { name: "Yield 2h Pulse", score: yieldPulseScore, weight: 0.07 },
        { name: "Risk 2h Pulse", score: riskPulseScore, weight: 0.06 },
      ]),
      prevIntra?.h2.components,
      0.32,
    );

    const h4ImpulseScore = clamp(50 + roc4h * 40 + roc8h * 28, 0, 100);
    const h4StructureScore = clamp(50 + (roc4h - roc24h) * 12 + roc4h * 14, 0, 100);
    const intraday4hComponents = smoothIntraday(
      finalizeIntraday([
        { name: "XAU 4h Impulse", score: h4ImpulseScore, weight: 0.48 },
        { name: "XAU 4h Structure", score: h4StructureScore, weight: 0.30 },
        { name: "USD 4h Pulse", score: usdPulseScore, weight: 0.09 },
        { name: "Yield 4h Pulse", score: yieldPulseScore, weight: 0.07 },
        { name: "Risk 4h Pulse", score: riskPulseScore, weight: 0.06 },
      ]),
      prevIntra?.h4.components,
      0.28,
    );

    // Composite Score (tuned: slightly higher weight on momentum responsiveness)
    const goldSafeHavenScore =
      0.25 * ryScore +
      0.2 * usdScore +
      0.13 * gprScore +
      0.05 * cbScore +
      0.15 * riskoffScore +
      0.1 * inflationScore +
      0.12 * momentumScore;

    const now = new Date();
    const nextRefresh = new Date(now.getTime() + REFRESH_INTERVAL_MS);

    cachedLiveScore = {
      realYield: latestRY,
      vix: latestVIX,
      breakeven: latestBE,
      hySpread: latestHY,
      usdBroad: latestUSD,
      gpr: latestGPR,
      // Display / signal price = XAU spot. Tape ROCs already use GC=F via latestFutures.
      goldClose: Math.round((goldSpot || latestGold) * 100) / 100,
      basisData,
      ryScore: Math.round(ryScore * 10) / 10,
      usdScore: Math.round(usdScore * 10) / 10,
      gprScore: Math.round(gprScore * 10) / 10,
      cbScore,
      riskoffScore: Math.round(riskoffScore * 10) / 10,
      inflationScore: Math.round(inflationScore * 10) / 10,
      momentumScore: Math.round(momentumScore * 10) / 10,
      goldSafeHavenScore: Math.round(goldSafeHavenScore * 10) / 10,
      factorContext: {
        roc15mPct: Math.round(roc15m * 100) / 100,
        roc1hPct: Math.round(roc1h * 100) / 100,
        roc4hPct: Math.round(roc4h * 100) / 100,
        roc6hPct: Math.round(roc6h * 100) / 100,
        roc8hPct: Math.round(roc8h * 100) / 100,
        roc24hPct: Math.round(roc24h * 100) / 100,
        usdMomPct: Math.round(latestUSDRoc * 100) / 100,
        usdIndexPrior:
          usdValues.length >= 2 ? usdValues[usdValues.length - 2]! : latestUSD,
        realYieldDailyChange: Math.round(latestRYChange * 1000) / 1000,
        realYieldPrior: realYieldData.at(-2)?.value ?? latestRY,
        breakevenPrior: breakevenData.at(-2)?.value ?? latestBE,
        vixPrev: vixData.at(-2)?.value ?? latestVIX,
        hyPrev: hyData.at(-2)?.value ?? latestHY,
      },
      intradayDominance: {
        fast: {
          components: intradayFastComponents,
          window: "15m/1h",
          lastSampleAt: new Date().toISOString(),
        },
        h2: {
          components: intraday2hComponents,
          window: "2h",
          lastSampleAt: new Date().toISOString(),
        },
        h4: {
          components: intraday4hComponents,
          window: "4h",
          lastSampleAt: new Date().toISOString(),
        },
      },
      lastFetched: now.toISOString(),
      nextRefresh: nextRefresh.toISOString(),
      dataStatus: sources.fred && sources.yahoo ? "live" : "stale",
      sources,
    };

    console.log(
      `[Live Data] Score: ${cachedLiveScore.goldSafeHavenScore} | Gold: $${latestGold} | VIX: ${latestVIX} | Sources: FRED=${sources.fred} Yahoo=${sources.yahoo} GPR=${sources.gpr}`
    );

    // Append to score log
    appendToScoreLog(cachedLiveScore);
    appendHourlySentimentSnapshot(cachedLiveScore);

    return cachedLiveScore;
  } catch (err) {
    console.error("[Live Data] Fetch error:", err);

    if (cachedLiveScore) {
      cachedLiveScore.dataStatus = "stale";
      return cachedLiveScore;
    }

    // Return fallback
    const now = new Date();
    return {
      realYield: 0, vix: 0, breakeven: 0, hySpread: 0, usdBroad: 0, gpr: 0, goldClose: 0,
      basisData: { spot: 0, futures: 0, basis: 0, basisPct: 0, contangoWarning: false, spotSource: "N/A", futuresSource: "N/A" },
      ryScore: 50, usdScore: 50, gprScore: 50, cbScore: 50,
      riskoffScore: 50, inflationScore: 50, momentumScore: 50,
      goldSafeHavenScore: 50,
      intradayDominance: {
        fast: { components: [], window: "15m/1h", lastSampleAt: now.toISOString() },
        h2: { components: [], window: "2h", lastSampleAt: now.toISOString() },
        h4: { components: [], window: "4h", lastSampleAt: now.toISOString() },
      },
      lastFetched: now.toISOString(),
      nextRefresh: new Date(now.getTime() + REFRESH_INTERVAL_MS).toISOString(),
      dataStatus: "error",
      sources,
    };
  } finally {
    fetchInProgress = false;
  }
}

// ─── Auto-refresh timer ──────────────────────────────────────────
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let hourlyBoundaryTimer: ReturnType<typeof setTimeout> | null = null;
let hourlyRefreshTimer: ReturnType<typeof setInterval> | null = null;

export function startAutoRefresh(): void {
  // Load persisted log from disk
  loadScoreLog();
  loadHourlySentimentSnapshots();
  backfillRecentHourlySnapshotsFromScoreLog(48);

  // Initial fetch
  fetchAndComputeLiveScore().catch(console.error);

  // Refresh every hour
  refreshTimer = setInterval(() => {
    fetchAndComputeLiveScore().catch(console.error);
  }, REFRESH_INTERVAL_MS);

  // Also trigger exactly on hourly boundaries for fixed hourly snapshots.
  const msUntilNextHour = () => {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    return nextHour.getTime() - now.getTime();
  };

  hourlyBoundaryTimer = setTimeout(() => {
    fetchAndComputeLiveScore().catch(console.error);
    hourlyRefreshTimer = setInterval(() => {
      fetchAndComputeLiveScore().catch(console.error);
    }, 60 * 60 * 1000);
  }, msUntilNextHour());

  console.log(`[Live Data] Auto-refresh started (every ${REFRESH_INTERVAL_MS / 60000} min)`);
}

export function stopAutoRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (hourlyBoundaryTimer) {
    clearTimeout(hourlyBoundaryTimer);
    hourlyBoundaryTimer = null;
  }
  if (hourlyRefreshTimer) {
    clearInterval(hourlyRefreshTimer);
    hourlyRefreshTimer = null;
  }
}
