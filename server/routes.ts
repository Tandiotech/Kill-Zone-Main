import type { Express } from "express";
import { createServer, type Server } from "http";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { MonthlyData } from "@shared/schema";
import {
  fetchAndComputeLiveScore,
  getCachedLiveScore,
  getHourlySentimentSnapshots,
  getLatestHourlyPrices,
  getScoreLog,
  startAutoRefresh,
  type LiveScoreData,
} from "./live-data.js";
import {
  issueDirectLoginIfAllowed,
  requireAllowedUser,
  sendMagicLinkIfAllowed,
  validateBearerAndAllowlist,
} from "./auth.js";
import { enrichComponentsWithFactorDetails } from "./factor-narrative.js";

// Resolve data directory - works both in dev (tsx) and prod (esbuild bundle)
function getDataDir(): string {
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const dataDir = path.join(currentDir, "data");
    if (fs.existsSync(dataDir)) return dataDir;
  } catch {}
  try {
    const dataDir = path.join(__dirname, "data");
    if (fs.existsSync(dataDir)) return dataDir;
  } catch {}
  const dataDir2 = path.join(process.cwd(), "server", "data");
  if (fs.existsSync(dataDir2)) return dataDir2;
  const dataDir3 = path.join(process.cwd(), "dist", "data");
  if (fs.existsSync(dataDir3)) return dataDir3;
  throw new Error("Cannot find data directory");
}

// Parse CSV helper
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = (values[i] || "").trim();
    });
    return obj;
  });
}

function loadBacktestData(): MonthlyData[] {
  const csvPath = path.join(getDataDir(), "backtest_results.csv");
  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);

  return rows.map((row) => ({
    date: row.date,
    goldClose: parseFloat(row.gold_close) || 0,
    goldReturn: parseFloat(row.gold_return) || 0,
    ryScore: parseFloat(row.ry_score) || 0,
    usdScore: parseFloat(row.usd_score) || 0,
    gprScore: parseFloat(row.gpr_score) || 0,
    cbScore: parseFloat(row.cb_score) || 0,
    riskoffScore: parseFloat(row.riskoff_score) || 0,
    inflationScore: parseFloat(row.inflation_score) || 0,
    momentumScore: parseFloat(row.momentum_score) || 0,
    goldSafeHavenScore: parseFloat(row.gold_safe_haven_score) || 0,
    scoreBucket: row.score_bucket || "",
    realYield: parseFloat(row.real_yield) || 0,
    vix: parseFloat(row.vix) || 0,
    breakeven: parseFloat(row.breakeven) || 0,
    hySpread: parseFloat(row.hy_spread) || 0,
    usdBroad: parseFloat(row.usd_broad) || 0,
    gpr: parseFloat(row.gpr) || 0,
  }));
}

function getRegimeLabel(score: number): string {
  if (score >= 75) return "Strong Safe Haven — Gold Bullish Bias";
  if (score >= 65) return "Elevated — Lean Long Gold";
  if (score >= 50) return "Neutral — No Clear Directional Signal";
  if (score >= 35) return "Weak — Lean Short / Reduce Gold Exposure";
  return "Risk-Off for Gold — Gold Bearish Bias";
}

let cachedData: MonthlyData[] | null = null;

function getData(): MonthlyData[] {
  if (!cachedData) {
    cachedData = loadBacktestData();
  }
  return cachedData;
}

type NarrativeBias = "Bullish" | "Bearish" | "Neutral";
type ImpactLevel = "High impact" | "Medium impact" | "Low impact";

type MarketNarrativeSlide = {
  id: "gold" | "yields" | "dollar" | "risk";
  title: string;
  metrics: { label: string; value: string }[];
  text: string;
  updatedLabel: string;
  bias: NarrativeBias;
  impact: ImpactLevel;
  tags: string[];
  imageUrl?: string;
  imageAlt?: string;
  freshness?: {
    market: string;
    news: string;
  };
  headlines?: {
    title: string;
    source: string;
    age: string;
    url?: string;
    imageUrl?: string;
  }[];
};

type NewsHeadline = {
  title: string;
  source: string;
  publishedAt: string;
  url?: string;
  imageUrl?: string;
};

type NarrativeCache = {
  payload: {
    updatedAt: string;
    changed: boolean;
    slides: MarketNarrativeSlide[];
  } | null;
  lastHeadlineSignature: string | null;
  lastMarketSnapshot: {
    gold: number;
    usdBroad: number;
    realYield: number;
    score: number;
  } | null;
  lastGeneratedTextBySlide: Record<string, string>;
};

const MARKET_MOVE_THRESHOLD_PCT = 0.3;
const MARKET_STALE_MS = 2 * 60 * 1000;
const NEWS_QUERY =
  '(gold OR inflation OR "federal reserve" OR "interest rates" OR geopolitics) AND (gold OR XAU)';
const NEWS_DOMAINS = [
  "reuters.com",
  "bloomberg.com",
  "cnbc.com",
  "marketwatch.com",
  "ft.com",
  "wsj.com",
  "kitco.com",
  "investing.com",
].join(",");
const narrativeCache: NarrativeCache = {
  payload: null,
  lastHeadlineSignature: null,
  lastMarketSnapshot: null,
  lastGeneratedTextBySlide: {},
};

function pctChange(current: number, previous: number): number {
  if (!Number.isFinite(previous) || previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function biasFromAlignment(goldPct: number, usdPct: number, yieldPct: number): NarrativeBias {
  const bullishSignals = Number(goldPct > 0) + Number(usdPct < 0) + Number(yieldPct < 0);
  const bearishSignals = Number(goldPct < 0) + Number(usdPct > 0) + Number(yieldPct > 0);
  if (bullishSignals >= 2) return "Bullish";
  if (bearishSignals >= 2) return "Bearish";
  return "Neutral";
}

function fmtPct(v: number, digits = 2): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

function minsAgoLabel(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  return mins < 1 ? "Updated just now" : `Updated ${mins} min ago`;
}

function ageLabel(iso: string): string {
  const ms = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h`;
}

function londonDateKey(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function londonDayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12, 0, 0));
  return utcDate.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Europe/London",
  });
}

function londonHourNow(date: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return Number.isFinite(hour) ? hour : 0;
}

function londonDateHourFromIso(iso: string): { londonDate: string; londonHour: string } {
  const d = new Date(iso);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  return { londonDate: `${year}-${month}-${day}`, londonHour: `${hour}:00` };
}

function dominanceBullBearFromLogComponents(components: {
  ry: number;
  usd: number;
  gpr: number;
  cb: number;
  riskoff: number;
  inflation: number;
  momentum: number;
}): { bullishPct: number; bearishPct: number } {
  const rows = [
    { score: components.ry, weight: 0.25 },
    { score: components.usd, weight: 0.2 },
    { score: components.gpr, weight: 0.13 },
    { score: components.cb, weight: 0.05 },
    { score: components.riskoff, weight: 0.15 },
    { score: components.inflation, weight: 0.1 },
    { score: components.momentum, weight: 0.12 },
  ];

  let bullSum = 0;
  let bearSum = 0;
  for (const c of rows) {
    const centered = (c.score - 50) / 50;
    const deadZone = 0.06;
    const adjusted = Math.abs(centered) < deadZone ? 0 : centered;
    const signed = Math.max(-c.weight * 0.85, Math.min(c.weight * 0.85, adjusted * c.weight));
    if (signed > 0) bullSum += signed;
    if (signed < 0) bearSum += Math.abs(signed);
  }

  const total = bullSum + bearSum;
  if (total <= 0) return { bullishPct: 50, bearishPct: 50 };
  const bullishPct = Math.round((bullSum / total) * 1000) / 10;
  return { bullishPct, bearishPct: Math.round((100 - bullishPct) * 10) / 10 };
}

function fallbackNewsImage(source: string): string {
  const s = source.toLowerCase();
  if (s.includes("reuters")) {
    return "https://images.unsplash.com/photo-1612550761236-e813928f7271?auto=format&fit=crop&w=800&q=80";
  }
  if (s.includes("bloomberg")) {
    return "https://images.unsplash.com/photo-1642790551116-18e150f248e3?auto=format&fit=crop&w=800&q=80";
  }
  if (s.includes("cnbc") || s.includes("marketwatch")) {
    return "https://images.unsplash.com/photo-1640340434855-6084b1f4901c?auto=format&fit=crop&w=800&q=80";
  }
  if (s.includes("kitco")) {
    return "https://images.unsplash.com/photo-1610375461369-d613b5648f37?auto=format&fit=crop&w=800&q=80";
  }
  return "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80";
}

async function fetchMarketNews(): Promise<NewsHeadline[]> {
  const apiKey = process.env.NEWS_API_KEY;
  const out: NewsHeadline[] = [];

  if (apiKey) {
    const url = new URL("https://newsapi.org/v2/everything");
    url.searchParams.set("q", NEWS_QUERY);
    url.searchParams.set("language", "en");
    url.searchParams.set("sortBy", "publishedAt");
    url.searchParams.set("pageSize", "16");
    url.searchParams.set("domains", NEWS_DOMAINS);
    url.searchParams.set("apiKey", apiKey);

    try {
      const resp = await fetch(url.toString(), {
        headers: { "User-Agent": "Gold-Intel/1.0" },
      });
      if (!resp.ok) {
        console.warn(`[Narratives] NewsAPI fetch failed: ${resp.status}`);
      } else {
        const json = (await resp.json()) as {
          articles?: {
            title?: string;
            source?: { name?: string };
            publishedAt?: string;
            url?: string;
            urlToImage?: string;
          }[];
        };
        out.push(
          ...(json.articles ?? [])
            .map((a) => ({
              title: String(a.title ?? "").trim(),
              source: String(a.source?.name ?? "NewsAPI").trim(),
              publishedAt: String(a.publishedAt ?? "").trim(),
              url: a.url,
              imageUrl: a.urlToImage || undefined,
            }))
            .filter((a) => a.title.length > 12 && a.publishedAt.length > 0),
        );
      }
    } catch (err) {
      console.warn("[Narratives] NewsAPI fetch error:", err);
    }
  }

  // No-key live fallback feed (Google News RSS)
  try {
    const rssUrl =
      "https://news.google.com/rss/search?q=gold%20price%20OR%20XAUUSD%20OR%20%22gold%20rises%22%20OR%20%22gold%20falls%22%20OR%20bullion&hl=en-US&gl=US&ceid=US:en";
    const resp = await fetch(rssUrl, {
      headers: { "User-Agent": "Gold-Intel/1.0" },
    });
    if (resp.ok) {
      const xml = await resp.text();
      const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
      for (const item of itemMatches.slice(0, 10)) {
        const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ??
          item.match(/<title>(.*?)<\/title>/)?.[1] ??
          "")
          .replace(/&amp;/g, "&")
          .trim();
        const source = (item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] ?? "Google News").trim();
        const publishedAt = (item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? "").trim();
        const link = (item.match(/<link>(.*?)<\/link>/)?.[1] ?? "").trim();
        if (title.length > 12 && publishedAt.length > 0) {
          out.push({
            title,
            source,
            publishedAt: new Date(publishedAt).toISOString(),
            url: link || undefined,
            imageUrl: fallbackNewsImage(source),
          });
        }
      }
    } else {
      console.warn(`[Narratives] Google RSS fetch failed: ${resp.status}`);
    }
  } catch (err) {
    console.warn("[Narratives] Google RSS fetch error:", err);
  }

  // Deduplicate by normalized title; keep newest first
  const seen = new Set<string>();
  return out
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .filter((h) => {
      const key = h.title.toLowerCase().replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function reuseIfUnchanged(slideId: string, candidate: string): string {
  const prior = narrativeCache.lastGeneratedTextBySlide[slideId];
  if (prior && prior === candidate) return prior;
  narrativeCache.lastGeneratedTextBySlide[slideId] = candidate;
  return candidate;
}

function buildMarketNarrativeSlides(
  live: LiveScoreData,
  score: number,
  news: NewsHeadline[]
): MarketNarrativeSlide[] {
  const prev = narrativeCache.lastMarketSnapshot;
  const goldPct = prev ? pctChange(live.goldClose, prev.gold) : 0;
  const usdPct = prev ? pctChange(live.usdBroad, prev.usdBroad) : 0;
  const yieldPct = prev ? pctChange(live.realYield, prev.realYield) : 0;
  const alignmentBias = biasFromAlignment(goldPct, usdPct, yieldPct);
  const scoreBias: NarrativeBias = score >= 65 ? "Bullish" : score <= 35 ? "Bearish" : "Neutral";
  const updatedLabel = minsAgoLabel(live.lastFetched);
  const topHeadline = news[0];
  const classifyHeadline = (title: string): "gold" | "yields" | "dollar" | "risk" => {
    const t = title.toLowerCase();
    if (/(yield|treasury|10y|bond|real rate)/.test(t)) return "yields";
    if (/(dollar|dxy|usd|fx)/.test(t)) return "dollar";
    if (/(war|geopolitic|risk|safe haven|inflation|fed|rate|oil|energy)/.test(t)) return "risk";
    return "gold";
  };
  const groupedHeadlines: Record<"gold" | "yields" | "dollar" | "risk", NewsHeadline[]> = {
    gold: [],
    yields: [],
    dollar: [],
    risk: [],
  };
  for (const h of news) groupedHeadlines[classifyHeadline(h.title)].push(h);

  const impactLevel = (n: number): ImpactLevel =>
    n >= 2.4 ? "High impact" : n >= 1.2 ? "Medium impact" : "Low impact";

  const freshness = {
    market: ageLabel(live.lastFetched),
    news: topHeadline?.publishedAt ? ageLabel(topHeadline.publishedAt) : "n/a",
  };
  const mapHeadlines = (items: NewsHeadline[]) =>
    (items.length ? items : news).slice(0, 5).map((h) => ({
      title: h.title,
      source: h.source,
      age: ageLabel(h.publishedAt),
      url: h.url,
      imageUrl: h.imageUrl || fallbackNewsImage(h.source),
    }));
  const imageById: Record<MarketNarrativeSlide["id"], { url: string; alt: string }> = {
    gold: {
      url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80",
      alt: "Gold market chart",
    },
    yields: {
      url: "https://images.unsplash.com/photo-1642543348745-3d4fd8b7f09f?auto=format&fit=crop&w=1200&q=80",
      alt: "Treasury yields and rates monitor",
    },
    dollar: {
      url: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&q=80",
      alt: "US dollar and FX movement",
    },
    risk: {
      url: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80",
      alt: "Geopolitical and macro risk headlines",
    },
  };

  const goldDriverScore = Math.abs(goldPct) * 2.4 + Math.abs(score - 50) / 16;
  const yieldsDriverScore = Math.abs(yieldPct) * 2.8 + Math.abs(live.ryScore - 50) / 18;
  const dollarDriverScore = Math.abs(usdPct) * 2.6 + Math.abs(live.usdScore - 50) / 18;
  const riskDriverScore =
    Math.abs(live.riskoffScore - 50) / 10 +
    Math.abs(live.gprScore - 50) / 22 +
    Math.abs(live.inflationScore - 50) / 25 +
    (groupedHeadlines.risk.length > 0 ? 0.8 : 0);

  const candidates: (MarketNarrativeSlide & { scoreWeight: number })[] = [
    {
      id: "gold",
      title:
        goldPct > 0.2
          ? "BREAKING: Gold catches fresh upside flow"
          : goldPct < -0.2
            ? "BREAKING: Gold slips as pressure rebuilds"
            : "LIVE: Gold holds in a balanced tape",
      metrics: [
        { label: "Gold", value: `$${live.goldClose.toFixed(1)}` },
        { label: "Move", value: fmtPct(goldPct) },
        { label: "Score", value: score.toFixed(1) },
      ],
      text: reuseIfUnchanged(
        "gold",
        goldPct > 0.2
          ? "Gold is attracting short-term bids as macro pressure eases. Price is responding to a cleaner backdrop and buyers are defending dips for now."
          : goldPct < -0.2
            ? "Gold is under pressure in the latest pass as macro headwinds reassert. Until rates or dollar momentum cools, upside attempts remain vulnerable."
            : "Gold is range-bound with no clean trend impulse yet. Flow remains tactical, with traders waiting for a stronger rates-dollar signal."
      ),
      updatedLabel,
      bias: scoreBias,
      impact: impactLevel(goldDriverScore),
      tags: [scoreBias === "Bullish" ? "Bullish for gold" : scoreBias === "Bearish" ? "Bearish for gold" : "Neutral", impactLevel(goldDriverScore)],
      imageUrl: imageById.gold.url,
      imageAlt: imageById.gold.alt,
      freshness,
      headlines: mapHeadlines(groupedHeadlines.gold),
      scoreWeight: goldDriverScore,
    },
    {
      id: "yields",
      title:
        yieldPct > 0.18
          ? "YIELDS WATCH: Rising rates pressure gold"
          : yieldPct < -0.18
            ? "YIELDS WATCH: Softer rates support gold"
            : "YIELDS WATCH: Rates stable, pressure mixed",
      metrics: [
        { label: "US10Y Real", value: `${live.realYield.toFixed(2)}%` },
        { label: "Change", value: fmtPct(yieldPct) },
        { label: "RY Score", value: live.ryScore.toFixed(1) },
      ],
      text: reuseIfUnchanged(
        "yields",
        yieldPct > 0.18
          ? "Treasury yields are moving higher again, increasing carry pressure on non-yielding gold. This keeps upside constrained unless rates fade."
          : yieldPct < -0.18
            ? "Yields are cooling, which reduces opportunity-cost drag on gold. That shift is giving bulls more room to hold structure."
            : "Yields are not providing a decisive directional signal this round. Gold reaction is likely to stay flow-driven until rates break trend."
      ),
      updatedLabel,
      bias: yieldPct < 0 ? "Bullish" : yieldPct > 0 ? "Bearish" : "Neutral",
      impact: impactLevel(yieldsDriverScore),
      tags: [yieldPct < 0 ? "Bullish for gold" : yieldPct > 0 ? "Bearish for gold" : "Neutral", impactLevel(yieldsDriverScore)],
      imageUrl: imageById.yields.url,
      imageAlt: imageById.yields.alt,
      freshness,
      headlines: mapHeadlines(groupedHeadlines.yields),
      scoreWeight: yieldsDriverScore,
    },
    {
      id: "dollar",
      title:
        usdPct > 0.18
          ? "DOLLAR TRACKER: USD strength caps gold"
          : usdPct < -0.18
            ? "DOLLAR TRACKER: USD softens, gold supported"
            : "DOLLAR TRACKER: FX flow is balanced",
      metrics: [
        { label: "USD Broad", value: live.usdBroad.toFixed(2) },
        { label: "Change", value: fmtPct(usdPct) },
        { label: "USD Score", value: live.usdScore.toFixed(1) },
      ],
      text: reuseIfUnchanged(
        "dollar",
        usdPct > 0.18
          ? "The dollar is firming and tightening financial conditions for gold. Unless USD momentum rolls over, rallies may continue to fade."
          : usdPct < -0.18
            ? "The dollar is easing, removing a key headwind for gold. That gives spot a cleaner runway if yields do not reprice higher."
            : "Dollar direction is indecisive and not forcing gold yet. Traders should treat this as a neutral FX backdrop until a break emerges."
      ),
      updatedLabel,
      bias: usdPct < 0 ? "Bullish" : usdPct > 0 ? "Bearish" : "Neutral",
      impact: impactLevel(dollarDriverScore),
      tags: [usdPct < 0 ? "Bullish for gold" : usdPct > 0 ? "Bearish for gold" : "Neutral", impactLevel(dollarDriverScore)],
      imageUrl: imageById.dollar.url,
      imageAlt: imageById.dollar.alt,
      freshness,
      headlines: mapHeadlines(groupedHeadlines.dollar),
      scoreWeight: dollarDriverScore,
    },
    {
      id: "risk",
      title:
        live.riskoffScore >= 60
          ? "SAFE-HAVEN FLOW: Risk tone supports gold"
          : live.riskoffScore <= 40
            ? "MACRO ALERT: Risk-on tone fades gold demand"
            : "MACRO ALERT: Risk sentiment mixed",
      metrics: [
        { label: "Risk-Off", value: live.riskoffScore.toFixed(1) },
        { label: "GPR", value: live.gpr.toFixed(0) },
        { label: "Inflation", value: live.breakeven.toFixed(2) + "%" },
      ],
      text: reuseIfUnchanged(
        "risk",
        live.riskoffScore >= 60
          ? "Defensive demand is rebuilding as macro and geopolitical uncertainty stay elevated. That backdrop is supportive for gold on pullbacks."
          : live.riskoffScore <= 40
            ? "Risk appetite is improving and safe-haven demand is softer. Without a new risk catalyst, gold is less likely to attract defensive inflows."
            : "Risk sentiment is mixed and not giving a dominant signal. Gold remains sensitive to incoming inflation, Fed, and geopolitical headlines."
      ),
      updatedLabel,
      bias: alignmentBias,
      impact: impactLevel(riskDriverScore),
      tags: [alignmentBias === "Bullish" ? "Bullish for gold" : alignmentBias === "Bearish" ? "Bearish for gold" : "Neutral", impactLevel(riskDriverScore)],
      imageUrl: imageById.risk.url,
      imageAlt: imageById.risk.alt,
      freshness,
      headlines: mapHeadlines(groupedHeadlines.risk),
      scoreWeight: riskDriverScore,
    },
  ];

  return candidates
    .sort((a, b) => b.scoreWeight - a.scoreWeight)
    .map(({ scoreWeight: _scoreWeight, ...slide }) => slide);
}

/** Convert live score into the MonthlyData shape for frontend compatibility */
function liveToMonthly(live: LiveScoreData): MonthlyData {
  return {
    date: new Date().toISOString().split("T")[0],
    goldClose: live.goldClose,
    goldReturn: 0,
    ryScore: live.ryScore,
    usdScore: live.usdScore,
    gprScore: live.gprScore,
    cbScore: live.cbScore,
    riskoffScore: live.riskoffScore,
    inflationScore: live.inflationScore,
    momentumScore: live.momentumScore,
    goldSafeHavenScore: live.goldSafeHavenScore,
    scoreBucket: "",
    realYield: live.realYield,
    vix: live.vix,
    breakeven: live.breakeven,
    hySpread: live.hySpread,
    usdBroad: live.usdBroad,
    gpr: live.gpr,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Start live data auto-refresh on server boot
  startAutoRefresh();

  /** Public — for load balancers (e.g. Render health checks). Must stay before the /api auth gate. */
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.post("/api/auth/send-magic-link", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const result = await sendMagicLinkIfAllowed(email);
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }
    return res.json({
      message: "Check your email to access the platform.",
    });
  });

  app.post("/api/auth/login", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const result = await issueDirectLoginIfAllowed(email);
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }
    return res.json({
      token: result.token,
      user: { email: result.email },
      message: "Access granted.",
    });
  });

  app.get("/api/auth/session", async (req, res) => {
    const r = await validateBearerAndAllowlist(req.headers.authorization);
    if (!r.ok) {
      return res.status(r.status).json({
        message:
          r.status === 403
            ? "Access restricted. Contact support to request access."
            : "Unauthorized",
      });
    }
    return res.json({ user: { email: r.email } });
  });

  app.use((req, res, next) => {
    if (!req.path.startsWith("/api")) return next();
    if (req.path === "/api/auth/send-magic-link" && req.method === "POST") return next();
    if (req.path === "/api/auth/login" && req.method === "POST") return next();
    if (req.path === "/api/auth/session" && req.method === "GET") return next();
    return requireAllowedUser(req, res, next);
  });

  app.get("/api/score", async (_req, res) => {
    try {
      // Try live data first
      let live = getCachedLiveScore();
      if (!live) {
        // First request — fetch synchronously
        live = await fetchAndComputeLiveScore();
      }

      const current = liveToMonthly(live);

      const componentsRaw = [
        { name: "Real Yield Direction", score: current.ryScore, weight: 0.25, contribution: current.ryScore * 0.25 },
        { name: "USD Trend", score: current.usdScore, weight: 0.20, contribution: current.usdScore * 0.20 },
        { name: "GPR Index", score: current.gprScore, weight: 0.13, contribution: current.gprScore * 0.13 },
        { name: "Central Bank Demand", score: current.cbScore, weight: 0.05, contribution: current.cbScore * 0.05 },
        { name: "Risk-Off Score", score: current.riskoffScore, weight: 0.15, contribution: current.riskoffScore * 0.15 },
        { name: "Inflation Expectations", score: current.inflationScore, weight: 0.10, contribution: current.inflationScore * 0.10 },
        { name: "Momentum", score: current.momentumScore, weight: 0.12, contribution: current.momentumScore * 0.12 },
      ];
      const components = enrichComponentsWithFactorDetails(componentsRaw, { live });
      const dominanceModes = {
        macro: { components },
        intraday: {
          components: enrichComponentsWithFactorDetails(live.intradayDominance.fast.components, { live }),
          window: live.intradayDominance.fast.window,
          lastSampleAt: live.intradayDominance.fast.lastSampleAt,
        },
        intraday2h: {
          components: enrichComponentsWithFactorDetails(live.intradayDominance.h2.components, { live }),
          window: live.intradayDominance.h2.window,
          lastSampleAt: live.intradayDominance.h2.lastSampleAt,
        },
        intraday4h: {
          components: enrichComponentsWithFactorDetails(live.intradayDominance.h4.components, { live }),
          window: live.intradayDominance.h4.window,
          lastSampleAt: live.intradayDominance.h4.lastSampleAt,
        },
      };

      res.json({
        current,
        components,
        dominanceModes,
        compositeScore: live.goldSafeHavenScore,
        regime: getRegimeLabel(live.goldSafeHavenScore),
        lastUpdated: current.date,
        lastFetched: live.lastFetched,
        nextRefresh: live.nextRefresh,
        dataStatus: live.dataStatus,
        sources: live.sources,
        basisData: live.basisData,
      });
    } catch (err) {
      console.error("Error in /api/score:", err);
      // Fallback to CSV data
      try {
        const data = getData();
        const current = data[data.length - 1];
        const componentsRaw = [
          { name: "Real Yield Direction", score: current.ryScore, weight: 0.25, contribution: current.ryScore * 0.25 },
          { name: "USD Trend", score: current.usdScore, weight: 0.20, contribution: current.usdScore * 0.20 },
          { name: "GPR Index", score: current.gprScore, weight: 0.13, contribution: current.gprScore * 0.13 },
          { name: "Central Bank Demand", score: current.cbScore, weight: 0.05, contribution: current.cbScore * 0.05 },
          { name: "Risk-Off Score", score: current.riskoffScore, weight: 0.15, contribution: current.riskoffScore * 0.15 },
          { name: "Inflation Expectations", score: current.inflationScore, weight: 0.10, contribution: current.inflationScore * 0.10 },
          { name: "Momentum", score: current.momentumScore, weight: 0.12, contribution: current.momentumScore * 0.12 },
        ];
        const components = enrichComponentsWithFactorDetails(componentsRaw, { monthly: current });
        const dominanceModes = {
          macro: { components },
          // Historical fallback: keep every window on the same macro bias —
          // do not invent divergent timing from monthly CSV rows.
          intraday: {
            components,
            window: "15m/1h" as const,
            lastSampleAt: new Date().toISOString(),
          },
          intraday2h: {
            components,
            window: "2h" as const,
            lastSampleAt: new Date().toISOString(),
          },
          intraday4h: {
            components,
            window: "4h" as const,
            lastSampleAt: new Date().toISOString(),
          },
        };
        res.json({
          current,
          components,
          dominanceModes,
          compositeScore: current.goldSafeHavenScore,
          regime: getRegimeLabel(current.goldSafeHavenScore),
          lastUpdated: current.date,
          dataStatus: "historical" as const,
        });
      } catch (e2) {
        res.status(500).json({ error: "Failed to compute score" });
      }
    }
  });

  app.get("/api/history", (_req, res) => {
    try {
      const data = getData();
      res.json({ data });
    } catch (err) {
      console.error("Error in /api/history:", err);
      res.status(500).json({ error: "Failed to load history" });
    }
  });

  // Live status endpoint for polling
  app.get("/api/status", (_req, res) => {
    const live = getCachedLiveScore();
    if (live) {
      res.json({
        dataStatus: live.dataStatus,
        lastFetched: live.lastFetched,
        nextRefresh: live.nextRefresh,
        sources: live.sources,
        score: live.goldSafeHavenScore,
      });
    } else {
      res.json({ dataStatus: "loading", lastFetched: null, nextRefresh: null });
    }
  });

  app.get("/api/hourly-sentiment", (req, res) => {
    try {
      const daysParam = Number(req.query.days);
      const days = Number.isFinite(daysParam)
        ? Math.max(1, Math.min(14, Math.floor(daysParam)))
        : 2;

      const todayLondon = londonDateKey(new Date());
      const yesterdayLondon = londonDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
      const dates: string[] = [];
      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - i);
        dates.push(londonDateKey(d));
      }
      const allowedDateSet = new Set(dates);

      const grouped = new Map<
        string,
        {
          timestamp: string;
          londonHour: string;
          bullishPct: number;
          bearishPct: number;
          macroScore: number;
          intradayScore: number | null;
        }[]
      >();

      for (const snapshot of getHourlySentimentSnapshots()) {
        if (!allowedDateSet.has(snapshot.londonDate)) continue;
        const rows = grouped.get(snapshot.londonDate) ?? [];
        rows.push({
          timestamp: snapshot.timestamp,
          londonHour: snapshot.londonHour,
          bullishPct: snapshot.bullishPct,
          bearishPct: snapshot.bearishPct,
          macroScore: snapshot.macroScore,
          intradayScore: snapshot.intradayScore ?? null,
        });
        grouped.set(snapshot.londonDate, rows);
      }

      // Fallback source for missing hourly snapshots: earliest score-log reading
      // within each London hour bucket.
      const scoreLogGrouped = new Map<
        string,
        {
          timestamp: string;
          londonHour: string;
          bullishPct: number;
          bearishPct: number;
          macroScore: number;
          intradayScore: number | null;
        }[]
      >();
      for (const entry of getScoreLog()) {
        const { londonDate, londonHour } = londonDateHourFromIso(entry.timestamp);
        if (!allowedDateSet.has(londonDate)) continue;
        const rows = scoreLogGrouped.get(londonDate) ?? [];
        const existing = rows.find((r) => r.londonHour === londonHour);
        const bb = dominanceBullBearFromLogComponents(entry.components);
        if (!existing) {
          rows.push({
            timestamp: entry.timestamp,
            londonHour,
            bullishPct: bb.bullishPct,
            bearishPct: bb.bearishPct,
            macroScore: entry.score,
            intradayScore: null,
          });
        } else if (new Date(entry.timestamp).getTime() < new Date(existing.timestamp).getTime()) {
          existing.timestamp = entry.timestamp;
          existing.bullishPct = bb.bullishPct;
          existing.bearishPct = bb.bearishPct;
          existing.macroScore = entry.score;
          existing.intradayScore = null;
        }
        scoreLogGrouped.set(londonDate, rows);
      }

      const currentLondonHour = londonHourNow();
      const sessionStartHour = 6;
      const sessionEndHour = 18;

      const daysOut = dates
        .map((date) => {
          const mergedRows = [...(grouped.get(date) ?? []), ...(scoreLogGrouped.get(date) ?? [])]
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          const byHour = new Map<string, (typeof mergedRows)[number]>();
          for (const row of mergedRows) {
            if (!byHour.has(row.londonHour)) byHour.set(row.londonHour, row);
          }
          const orderedByHour = Array.from(byHour.entries())
            .map(([, row]) => ({ ...row }))
            .sort((a, b) => a.londonHour.localeCompare(b.londonHour));

          const dayEndHour =
            date === todayLondon
              ? Math.max(sessionStartHour, Math.min(currentLondonHour, sessionEndHour))
              : sessionEndHour;
          const pointCount = Math.max(1, dayEndHour - sessionStartHour + 1);
          const points = Array.from({ length: pointCount }, (_, i) => {
            const hour = i + sessionStartHour;
            const time = `${String(hour).padStart(2, "0")}:00`;
            const exact = byHour.get(time);
            const prior = [...orderedByHour]
              .reverse()
              .find((p) => p.londonHour < time);
            const next = orderedByHour.find((p) => p.londonHour > time);
            const p = exact ?? prior ?? next ?? null;
            return {
              time,
              bullishPct: p?.bullishPct ?? null,
              bearishPct: p?.bearishPct ?? null,
              macroScore: p?.macroScore ?? null,
              intradayScore: p?.intradayScore ?? null,
              capturedAt: p?.timestamp ?? null,
            };
          });

          return {
            date,
            label:
              date === todayLondon
                ? "Today"
                : date === yesterdayLondon
                  ? "Yesterday"
                  : londonDayLabel(date),
            points,
          };
        });

      res.json({
        timezone: "Europe/London",
        generatedAt: new Date().toISOString(),
        days: daysOut,
      });
    } catch (err) {
      console.error("Error in /api/hourly-sentiment:", err);
      res.status(500).json({ error: "Failed to load hourly sentiment history" });
    }
  });

  // Score log — rolling 30-min readings with pip tracking
  // XAUUSD: 1 pip = $0.10 (standard forex convention)
  const PIP_SIZE = 0.10;
  const TP_PIPS = 300;   // Take profit target
  const SL_PIPS = 150;   // Stop loss limit

  app.get("/api/score-log", (_req, res) => {
    try {
      const log = getScoreLog();

      // --- Compute zone durations ---
      let currentZoneStart = log.length > 0 ? log[0].timestamp : null;
      let currentSignal = log.length > 0 ? log[0].signal : null;
      for (let i = 1; i < log.length; i++) {
        if (log[i].signal !== currentSignal) {
          currentZoneStart = log[i].timestamp;
          currentSignal = log[i].signal;
        }
      }

      // --- Compute pip performance per signal zone ---
      // Tracks MFE (max favourable excursion) and MAE (max adverse excursion)
      // MFE = peak profit reached during the zone (best it got)
      // MAE = peak drawdown during the zone (worst it went against you)
      interface ZoneResult {
        signal: string;
        entryTime: string;
        exitTime: string;
        entryPrice: number;
        exitPrice: number;
        tpPrice: number;     // take-profit price level
        slPrice: number;     // stop-loss price level
        highPrice: number;   // highest gold price during this zone
        lowPrice: number;    // lowest gold price during this zone
        pips: number;        // exit P&L in pips
        mfePips: number;     // max favourable excursion in pips (peak profit)
        maePips: number;     // max adverse excursion in pips (peak drawdown, always negative or 0)
        tpProgress: number;  // % progress toward TP (0-100+)
        slProgress: number;  // % progress toward SL (0-100+)
        outcome: "TP_HIT" | "SL_HIT" | "SIGNAL_EXIT" | "OPEN" | "FLAT"; // how the zone ended
        duration: number;    // ms
        isActive: boolean;   // true if this is the current open zone
        readings: number;    // number of data points in this zone
      }
      const zones: ZoneResult[] = [];
      let zoneEntryIdx = 0;

      for (let i = 1; i <= log.length; i++) {
        const isEnd = i === log.length;
        const signalChanged = !isEnd && log[i].signal !== log[zoneEntryIdx].signal;

        if (signalChanged || isEnd) {
          const exitIdx = isEnd ? log.length - 1 : i - 1;
          const sig = log[zoneEntryIdx].signal;
          const entryPrice = log[zoneEntryIdx].goldClose;
          const exitPrice = log[exitIdx].goldClose;

          // Find high and low prices across all readings in this zone
          let highPrice = entryPrice;
          let lowPrice = entryPrice;
          for (let j = zoneEntryIdx; j <= exitIdx; j++) {
            highPrice = Math.max(highPrice, log[j].goldClose);
            lowPrice = Math.min(lowPrice, log[j].goldClose);
          }

          const isLong = sig === "STRONG BUY" || sig === "BUY";
          const isShort = sig === "SELL" || sig === "STRONG SELL";

          // P&L pips (exit - entry, direction-adjusted)
          const priceDiff = exitPrice - entryPrice;
          const rawPips = isLong ? priceDiff / PIP_SIZE
                        : isShort ? -priceDiff / PIP_SIZE
                        : 0;

          // MFE: best the trade got (peak unrealised profit)
          // For longs: highest price - entry. For shorts: entry - lowest price.
          const mfePrice = isLong ? (highPrice - entryPrice) / PIP_SIZE
                         : isShort ? (entryPrice - lowPrice) / PIP_SIZE
                         : 0;

          // MAE: worst the trade went against you (peak unrealised loss)
          // For longs: lowest price - entry (negative). For shorts: entry - highest price (negative).
          const maePrice = isLong ? (lowPrice - entryPrice) / PIP_SIZE
                         : isShort ? (entryPrice - highPrice) / PIP_SIZE
                         : 0;

          // TP/SL price levels
          const tpPrice = isLong ? entryPrice + TP_PIPS * PIP_SIZE
                        : isShort ? entryPrice - TP_PIPS * PIP_SIZE
                        : 0;
          const slPrice = isLong ? entryPrice - SL_PIPS * PIP_SIZE
                        : isShort ? entryPrice + SL_PIPS * PIP_SIZE
                        : 0;

          // Progress toward TP/SL
          const mfePipsRounded = Math.round(mfePrice * 10) / 10;
          const maePipsRounded = Math.round(Math.min(maePrice, 0) * 10) / 10;
          const tpProgress = TP_PIPS > 0 ? Math.round((mfePipsRounded / TP_PIPS) * 100) : 0;
          const slProgress = SL_PIPS > 0 ? Math.round((Math.abs(maePipsRounded) / SL_PIPS) * 100) : 0;

          // Determine outcome
          let outcome: "TP_HIT" | "SL_HIT" | "SIGNAL_EXIT" | "OPEN" | "FLAT" = "FLAT";
          if (!isLong && !isShort) {
            outcome = "FLAT";
          } else if (isEnd) {
            outcome = "OPEN";
          } else if (mfePipsRounded >= TP_PIPS) {
            outcome = "TP_HIT";
          } else if (Math.abs(maePipsRounded) >= SL_PIPS) {
            outcome = "SL_HIT";
          } else {
            outcome = "SIGNAL_EXIT";
          }

          zones.push({
            signal: sig,
            entryTime: log[zoneEntryIdx].timestamp,
            exitTime: log[exitIdx].timestamp,
            entryPrice: Math.round(entryPrice * 100) / 100,
            exitPrice: Math.round(exitPrice * 100) / 100,
            tpPrice: Math.round(tpPrice * 100) / 100,
            slPrice: Math.round(slPrice * 100) / 100,
            highPrice: Math.round(highPrice * 100) / 100,
            lowPrice: Math.round(lowPrice * 100) / 100,
            pips: Math.round(rawPips * 10) / 10,
            mfePips: mfePipsRounded,
            maePips: maePipsRounded,
            tpProgress,
            slProgress,
            outcome,
            duration: new Date(log[exitIdx].timestamp).getTime() - new Date(log[zoneEntryIdx].timestamp).getTime(),
            isActive: isEnd,
            readings: exitIdx - zoneEntryIdx + 1,
          });

          if (!isEnd) zoneEntryIdx = i;
        }
      }

      // Aggregate pip stats
      const totalPips = Math.round(zones.reduce((s, z) => s + z.pips, 0) * 10) / 10;
      const winningZones = zones.filter(z => z.pips > 0);
      const losingZones = zones.filter(z => z.pips < 0);
      const activeZones = zones.filter(z => z.signal !== "HOLD" && z.signal !== "REDUCE");
      const winRate = activeZones.length > 0
        ? Math.round((winningZones.filter(z => z.signal !== "HOLD" && z.signal !== "REDUCE").length / activeZones.length) * 100)
        : 0;

      // Per-entry pip change from previous reading
      const entriesWithPips = log.map((entry, i) => {
        if (i === 0) return { ...entry, pricePips: 0, cumulativePips: 0 };
        const prev = log[i - 1];
        const priceDiff = entry.goldClose - prev.goldClose;
        const isLong = entry.signal === "STRONG BUY" || entry.signal === "BUY";
        const isShort = entry.signal === "SELL" || entry.signal === "STRONG SELL";
        const pip = isLong ? priceDiff / PIP_SIZE
                  : isShort ? -priceDiff / PIP_SIZE
                  : 0;
        const roundedPip = Math.round(pip * 10) / 10;
        // Cumulative from start
        const prevCum = i > 0 ? (log as any)[i - 1]._cum || 0 : 0;
        const cum = prevCum + roundedPip;
        (entry as any)._cum = cum;
        return { ...entry, pricePips: roundedPip, cumulativePips: Math.round(cum * 10) / 10 };
      });

      // --- Outcome breakdown with avg pips per category ---
      const closedZones = zones.filter(z => !z.isActive && z.signal !== "HOLD" && z.signal !== "REDUCE");
      const tpZones = zones.filter(z => z.outcome === "TP_HIT");
      const slZones = zones.filter(z => z.outcome === "SL_HIT");
      const sigExitZones = zones.filter(z => z.outcome === "SIGNAL_EXIT");
      const openZones = zones.filter(z => z.outcome === "OPEN" && z.signal !== "HOLD" && z.signal !== "REDUCE");

      const avg = (arr: typeof zones) => arr.length > 0
        ? Math.round((arr.reduce((s, z) => s + z.pips, 0) / arr.length) * 10) / 10
        : 0;
      const sum = (arr: typeof zones) => Math.round(arr.reduce((s, z) => s + z.pips, 0) * 10) / 10;
      const avgDur = (arr: typeof zones) => arr.length > 0
        ? Math.round(arr.reduce((s, z) => s + z.duration, 0) / arr.length)
        : 0;
      const avgMfe = (arr: typeof zones) => arr.length > 0
        ? Math.round((arr.reduce((s, z) => s + z.mfePips, 0) / arr.length) * 10) / 10
        : 0;
      const avgMae = (arr: typeof zones) => arr.length > 0
        ? Math.round((arr.reduce((s, z) => s + z.maePips, 0) / arr.length) * 10) / 10
        : 0;

      const outcomeBreakdown = {
        tpHit: { count: tpZones.length, avgPips: avg(tpZones), totalPips: sum(tpZones), avgDuration: avgDur(tpZones), avgMfe: avgMfe(tpZones), avgMae: avgMae(tpZones) },
        slHit: { count: slZones.length, avgPips: avg(slZones), totalPips: sum(slZones), avgDuration: avgDur(slZones), avgMfe: avgMfe(slZones), avgMae: avgMae(slZones) },
        signalExit: { count: sigExitZones.length, avgPips: avg(sigExitZones), totalPips: sum(sigExitZones), avgDuration: avgDur(sigExitZones), avgMfe: avgMfe(sigExitZones), avgMae: avgMae(sigExitZones) },
        open: { count: openZones.length, avgPips: avg(openZones), totalPips: sum(openZones), avgDuration: avgDur(openZones), avgMfe: avgMfe(openZones), avgMae: avgMae(openZones) },
      };

      // --- Signal-level breakdown (STRONG BUY vs BUY vs SELL vs STRONG SELL) ---
      const buildSignalStat = (sig: string) => {
        const filtered = zones.filter(z => z.signal === sig);
        const closed = filtered.filter(z => !z.isActive);
        const wins = closed.filter(z => z.pips > 0);
        const wr = closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0;
        const tp = filtered.filter(z => z.outcome === "TP_HIT").length;
        const sl = filtered.filter(z => z.outcome === "SL_HIT").length;
        const se = filtered.filter(z => z.outcome === "SIGNAL_EXIT").length;
        const op = filtered.filter(z => z.outcome === "OPEN").length;
        return {
          signal: sig,
          count: filtered.length,
          winRate: wr,
          avgPips: avg(filtered),
          totalPips: sum(filtered),
          avgMfe: avgMfe(filtered),
          avgMae: avgMae(filtered),
          avgDuration: avgDur(filtered),
          tpHits: tp,
          slHits: sl,
          signalExits: se,
          openTrades: op,
        };
      };

      const signalBreakdown = [
        buildSignalStat("STRONG BUY"),
        buildSignalStat("BUY"),
        buildSignalStat("SELL"),
        buildSignalStat("STRONG SELL"),
      ].filter(s => s.count > 0);

      // Expectancy = (win% * avg win) + (loss% * avg loss)
      const totalClosed = closedZones.length;
      const closedWins = closedZones.filter(z => z.pips > 0);
      const closedLosses = closedZones.filter(z => z.pips < 0);
      const winPct = totalClosed > 0 ? closedWins.length / totalClosed : 0;
      const lossPct = totalClosed > 0 ? closedLosses.length / totalClosed : 0;
      const avgWin = avg(closedWins);
      const avgLoss = avg(closedLosses);
      const expectancy = totalClosed > 0
        ? Math.round((winPct * avgWin + lossPct * avgLoss) * 10) / 10
        : 0;
      const profitFactor = Math.abs(sum(closedLosses)) > 0
        ? Math.round((sum(closedWins) / Math.abs(sum(closedLosses))) * 100) / 100
        : sum(closedWins) > 0 ? Infinity : 0;

      res.json({
        entries: entriesWithPips,
        zones,
        config: { tpPips: TP_PIPS, slPips: SL_PIPS, pipSize: PIP_SIZE, riskReward: `1:${TP_PIPS / SL_PIPS}` },
        outcomeBreakdown,
        signalBreakdown,
        summary: {
          totalReadings: log.length,
          currentSignal,
          inZoneSince: currentZoneStart,
          highScore: log.length > 0 ? Math.max(...log.map(e => e.score)) : null,
          lowScore: log.length > 0 ? Math.min(...log.map(e => e.score)) : null,
          avgScore: log.length > 0
            ? Math.round((log.reduce((s, e) => s + e.score, 0) / log.length) * 10) / 10
            : null,
          totalPips,
          winRate,
          winningZones: winningZones.length,
          losingZones: losingZones.length,
          totalZones: zones.length,
          tpHits: tpZones.length,
          slHits: slZones.length,
          signalExits: sigExitZones.length,
          expectancy,
          profitFactor,
          avgWin,
          avgLoss,
        },
      });
    } catch (err) {
      console.error("Error in /api/score-log:", err);
      res.status(500).json({ error: "Failed to load score log" });
    }
  });

  // ─── /api/signal — Telegram-ready trading signal ──────────────
  app.get("/api/signal", async (_req, res) => {
    try {
      let live = getCachedLiveScore();
      if (!live) live = await fetchAndComputeLiveScore();

      const score = live.goldSafeHavenScore;
      const basis = live.basisData;
      // Prefer live XAU spot for the headline price (what traders see as XAU/USD).
      // Futures stay available on basis for contango context.
      const gold =
        basis.spot > 0 ? basis.spot : live.goldClose > 0 ? live.goldClose : basis.futures;

      // --- Directional Bias ---
      type Bias = "BULLISH" | "BEARISH" | "NEUTRAL";
      const bias: Bias = score >= 65 ? "BULLISH" : score <= 35 ? "BEARISH" : "NEUTRAL";

      // --- Trade Zone ---
      const tradeZone = score >= 75 ? "STRONG BUY REGION" :
                         score >= 65 ? "BUY REGION" :
                         score >= 50 ? "NEUTRAL ZONE" :
                         score >= 35 ? "CAUTION ZONE" :
                         score >= 20 ? "SELL REGION" : "STRONG SELL REGION";

      // --- 5 Key Reasons (data-driven) ---
      interface Reason {
        factor: string;
        score: number; // 0-100 component score
        status: string;
        impact: "bullish" | "bearish" | "neutral";
        detail: string;
        updatedAgo: string;
      }

      const minsAgo = Math.floor((Date.now() - new Date(live.lastFetched).getTime()) / 60000);
      const updatedAgo = minsAgo < 1 ? "just now" : `${minsAgo}m ago`;

      const reasons: Reason[] = [
        {
          factor: "USD Strength",
          score: Math.round(live.usdScore),
          status: live.usdScore <= 30 ? "Dollar Strong" : live.usdScore >= 70 ? "Dollar Weak" : "Dollar Mixed",
          impact: live.usdScore >= 60 ? "bullish" : live.usdScore <= 40 ? "bearish" : "neutral",
          detail: live.usdScore <= 30
            ? `DXY at ${live.usdBroad.toFixed(1)} — strong dollar pressuring gold`
            : live.usdScore >= 70
            ? `DXY at ${live.usdBroad.toFixed(1)} — dollar weakness supporting gold rally`
            : `DXY at ${live.usdBroad.toFixed(1)} — mixed signals, no clear directional pressure`,
          updatedAgo,
        },
        {
          factor: "Bond Yields",
          score: Math.round(live.ryScore),
          status: live.ryScore >= 65 ? "Yields Falling" : live.ryScore <= 35 ? "Yields Rising" : "Yields Stable",
          impact: live.ryScore >= 60 ? "bullish" : live.ryScore <= 40 ? "bearish" : "neutral",
          detail: live.ryScore >= 65
            ? `Real yield at ${live.realYield.toFixed(2)}% and falling — reduces gold's opportunity cost`
            : live.ryScore <= 35
            ? `Real yield at ${live.realYield.toFixed(2)}% and rising — gold faces headwinds`
            : `Real yield at ${live.realYield.toFixed(2)}% — stable, no strong signal`,
          updatedAgo,
        },
        {
          factor: "Risk Sentiment",
          score: Math.round(live.riskoffScore),
          status: live.riskoffScore >= 65 ? "Risk-Off" : live.riskoffScore <= 35 ? "Risk-On" : "Mixed",
          impact: live.riskoffScore >= 60 ? "bullish" : live.riskoffScore <= 40 ? "bearish" : "neutral",
          detail: live.riskoffScore >= 65
            ? `VIX at ${live.vix.toFixed(1)} — elevated fear driving safe-haven flows into gold`
            : live.riskoffScore <= 35
            ? `VIX at ${live.vix.toFixed(1)} — calm markets, less safe-haven demand`
            : `VIX at ${live.vix.toFixed(1)} — moderate, market awaiting catalyst`,
          updatedAgo,
        },
        {
          factor: "Geopolitical Tension",
          score: Math.round(live.gprScore),
          status: live.gprScore >= 80 ? "Extreme" : live.gprScore >= 50 ? "Elevated" : "Low",
          impact: live.gprScore >= 60 ? "bullish" : live.gprScore <= 30 ? "bearish" : "neutral",
          detail: live.gprScore >= 80
            ? `GPR Index at ${live.gpr.toFixed(0)} — extreme geopolitical risk, max safe-haven bid`
            : live.gprScore >= 50
            ? `GPR Index at ${live.gpr.toFixed(0)} — elevated tensions supporting gold premium`
            : `GPR Index at ${live.gpr.toFixed(0)} — calm geopolitical environment`,
          updatedAgo,
        },
        {
          factor: "Inflation & Momentum",
          score: Math.round((live.inflationScore + live.momentumScore) / 2),
          status: live.inflationScore >= 65 && live.momentumScore >= 65 ? "Both Bullish" :
                  live.inflationScore >= 65 ? "Inflation Rising" :
                  live.momentumScore >= 65 ? "Trend Intact" : "Weakening",
          impact: (live.inflationScore >= 60 || live.momentumScore >= 60) ? "bullish" :
                  (live.inflationScore <= 40 && live.momentumScore <= 40) ? "bearish" : "neutral",
          detail: live.inflationScore >= 65 && live.momentumScore >= 65
            ? `Breakevens at ${live.breakeven.toFixed(2)}% rising + gold above 3m SMA — full alignment`
            : live.inflationScore >= 65
            ? `Breakevens at ${live.breakeven.toFixed(2)}% rising — inflation hedge demand`
            : live.momentumScore >= 65
            ? `Gold above 3-month moving average — trend support intact`
            : `Momentum weakening — breakevens at ${live.breakeven.toFixed(2)}%, watch for reversal`,
          updatedAgo,
        },
      ];

      // --- Key Levels ---
      // Simple support/resistance from recent price action
      const PIP = 0.10;
      const tpLevel = Math.round((gold + 300 * PIP) * 100) / 100;
      const slLevel = Math.round((gold - 150 * PIP) * 100) / 100;
      const pivotHigh = Math.round((gold + 50 * PIP) * 100) / 100;
      const pivotLow = Math.round((gold - 50 * PIP) * 100) / 100;

      // --- What Needs to Happen Next ---
      let continuation = "";
      if (bias === "BULLISH") {
        continuation = `For continuation, gold needs to hold above $${pivotLow.toFixed(0)} and break $${pivotHigh.toFixed(0)}. Watch for USD weakness to accelerate the move. Risk: a VIX collapse below 18 would remove the safe-haven bid.`;
      } else if (bias === "BEARISH") {
        continuation = `For further downside, watch for a break below $${pivotLow.toFixed(0)}. USD strength above ${(live.usdBroad + 1).toFixed(0)} would confirm. Risk: any geopolitical escalation could reverse the move sharply.`;
      } else {
        continuation = `No clear edge — wait for score to break above 65 (bullish) or below 35 (bearish). Key pivot: $${gold.toFixed(0)}. Patience here protects capital.`;
      }

      // --- Telegram-ready text ---
      const bullishCount = reasons.filter(r => r.impact === "bullish").length;
      const bearishCount = reasons.filter(r => r.impact === "bearish").length;

      const emoji = bias === "BULLISH" ? "🟢" : bias === "BEARISH" ? "🔴" : "🟡";
      const arrow = bias === "BULLISH" ? "⬆️" : bias === "BEARISH" ? "⬇️" : "➡️";

      const telegramText = [
        `${emoji} KILLZONE GOLD SIGNAL ${emoji}`,
        ``,
        `${arrow} ${tradeZone}`,
        `💰 XAUUSD: $${gold.toFixed(2)}`,
        `🎯 Score: ${score.toFixed(1)}/100 — ${bias}`,
        ``,
        `🔑 5 KEY DRIVERS:`,
        ...reasons.map((r, i) => {
          const icon = r.impact === "bullish" ? "✅" : r.impact === "bearish" ? "❌" : "⚪";
          return `${i + 1}. ${icon} ${r.factor}: ${r.status}`;
        }),
        ``,
        `📊 ${bullishCount}/5 bullish · ${bearishCount}/5 bearish`,
        ``,
        bias !== "NEUTRAL" ? `🎯 TP: $${tpLevel.toFixed(0)} (+300 pips)` : "",
        bias !== "NEUTRAL" ? `🛡️ SL: $${slLevel.toFixed(0)} (-150 pips)` : "",
        bias !== "NEUTRAL" ? `🔄 R:R 1:2` : "",
        ``,
        `🔮 NEXT:`,
        continuation,
        ``,
        `⏱ Updated: ${updatedAgo}`,
        `🔗 KILLZONE Gold Intelligence`,
      ].filter(Boolean).join("\n");

      res.json({
        gold: Math.round(gold * 100) / 100,
        score: Math.round(score * 10) / 10,
        bias,
        tradeZone,
        reasons,
        keyLevels: {
          tp: tpLevel,
          sl: slLevel,
          pivotHigh,
          pivotLow,
        },
        continuation,
        basis: {
          spot: basis.spot,
          futures: basis.futures,
          premium: basis.basis,
          warning: basis.contangoWarning,
        },
        meta: {
          lastFetched: live.lastFetched,
          updatedAgo,
          dataStatus: live.dataStatus,
          bullishCount,
          bearishCount,
          neutralCount: 5 - bullishCount - bearishCount,
        },
        telegramText,
      });
    } catch (err) {
      console.error("Error in /api/signal:", err);
      res.status(500).json({ error: "Failed to generate signal" });
    }
  });

  app.get("/api/price-hourly", async (_req, res) => {
    try {
      let live = getCachedLiveScore();
      if (!live) live = await fetchAndComputeLiveScore();

      const candles = getLatestHourlyPrices().map((p) => ({
        time: Math.floor(new Date(p.date).getTime() / 1000),
        close: p.close,
      }));
      res.json({ candles, lastFetched: live.lastFetched });
    } catch (err) {
      console.error("Error in /api/price-hourly:", err);
      res.status(500).json({ error: "Failed to load hourly prices" });
    }
  });

  app.get("/api/market-narratives", async (_req, res) => {
    try {
      let live = getCachedLiveScore();
      const stale = !live || Date.now() - new Date(live.lastFetched).getTime() > MARKET_STALE_MS;
      if (stale) live = await fetchAndComputeLiveScore();
      if (!live) {
        return res.status(503).json({ error: "Live market data unavailable" });
      }
      const score = live.goldSafeHavenScore;
      const news = await fetchMarketNews();
      const headlineSignature = news.slice(0, 3).map((h) => h.title).join("|");

      const prev = narrativeCache.lastMarketSnapshot;
      const marketMoveExceeded = !!prev && (
        Math.abs(pctChange(live.goldClose, prev.gold)) >= MARKET_MOVE_THRESHOLD_PCT ||
        Math.abs(pctChange(live.usdBroad, prev.usdBroad)) >= MARKET_MOVE_THRESHOLD_PCT ||
        Math.abs(pctChange(live.realYield, prev.realYield)) >= MARKET_MOVE_THRESHOLD_PCT
      );
      const hasNewHeadline = narrativeCache.lastHeadlineSignature !== headlineSignature;
      const shouldRegenerate = !narrativeCache.payload || hasNewHeadline || marketMoveExceeded;

      if (!shouldRegenerate && narrativeCache.payload) {
        return res.json({ ...narrativeCache.payload, changed: false });
      }

      const slides = buildMarketNarrativeSlides(live, score, news);
      const payload = {
        updatedAt: new Date().toISOString(),
        changed: true,
        slides,
      };

      narrativeCache.payload = payload;
      narrativeCache.lastHeadlineSignature = headlineSignature;
      narrativeCache.lastMarketSnapshot = {
        gold: live.goldClose,
        usdBroad: live.usdBroad,
        realYield: live.realYield,
        score: live.goldSafeHavenScore,
      };

      return res.json(payload);
    } catch (err) {
      console.error("Error in /api/market-narratives:", err);
      if (narrativeCache.payload) {
        return res.json({ ...narrativeCache.payload, changed: false });
      }
      return res.status(500).json({ error: "Failed to build market narratives" });
    }
  });

  // Manual refresh trigger
  app.post("/api/refresh", async (_req, res) => {
    try {
      const live = await fetchAndComputeLiveScore();
      res.json({
        dataStatus: live.dataStatus,
        lastFetched: live.lastFetched,
        score: live.goldSafeHavenScore,
      });
    } catch (err) {
      res.status(500).json({ error: "Refresh failed" });
    }
  });

  // Chart data with signal zones for TradingView Lightweight Charts
  app.get("/api/chart-data", async (_req, res) => {
    try {
      const data = getData(); // backtest history data
      let live = getCachedLiveScore();
      if (!live) live = await fetchAndComputeLiveScore();

      // Build candlestick-like OHLC from monthly data (use close as approximation)
      const candles = data.map((d: any) => ({
        time: d.date,
        open: d.goldClose * (1 - Math.random() * 0.01),
        high: d.goldClose * (1 + Math.random() * 0.015),
        low: d.goldClose * (1 - Math.random() * 0.015),
        close: d.goldClose,
      }));

      // Build zone markers from score data
      const markers = data.map((d: any) => {
        const score = d.goldSafeHavenScore;
        if (score >= 75) return { time: d.date, position: "belowBar" as const, color: "#4ade80", shape: "arrowUp" as const, text: "STRONG BUY", size: 2 };
        if (score >= 65) return { time: d.date, position: "belowBar" as const, color: "#5fad46", shape: "arrowUp" as const, text: "BUY", size: 1 };
        if (score <= 20) return { time: d.date, position: "aboveBar" as const, color: "#ef4444", shape: "arrowDown" as const, text: "STRONG SELL", size: 2 };
        if (score <= 35) return { time: d.date, position: "aboveBar" as const, color: "#d15a5a", shape: "arrowDown" as const, text: "SELL", size: 1 };
        return null;
      }).filter(Boolean);

      // Score overlay line
      const scoreLine = data.map((d: any) => ({
        time: d.date,
        value: d.goldSafeHavenScore,
      }));

      // Buy/sell zone bands
      const buyZones: { start: string; end: string; score: number }[] = [];
      const sellZones: { start: string; end: string; score: number }[] = [];
      let currentZone: { type: string; start: string; score: number } | null = null;

      data.forEach((d: any, i: number) => {
        const score = d.goldSafeHavenScore;
        const isBuy = score >= 65;
        const isSell = score <= 35;
        const type = isBuy ? "buy" : isSell ? "sell" : "neutral";

        if (currentZone && currentZone.type !== type) {
          const prevDate = data[i - 1]?.date || d.date;
          if (currentZone.type === "buy") buyZones.push({ start: currentZone.start, end: prevDate, score: currentZone.score });
          if (currentZone.type === "sell") sellZones.push({ start: currentZone.start, end: prevDate, score: currentZone.score });
          currentZone = type !== "neutral" ? { type, start: d.date, score } : null;
        } else if (!currentZone && type !== "neutral") {
          currentZone = { type, start: d.date, score };
        }
        if (currentZone) currentZone.score = score;
      });
      // Close any open zone (explicit type — TS does not narrow `currentZone` across forEach)
      const closingZone = currentZone as {
        type: string;
        start: string;
        score: number;
      } | null;
      if (closingZone) {
        const lastDate = data[data.length - 1].date;
        if (closingZone.type === "buy")
          buyZones.push({ start: closingZone.start, end: lastDate, score: closingZone.score });
        if (closingZone.type === "sell")
          sellZones.push({ start: closingZone.start, end: lastDate, score: closingZone.score });
      }

      // Current live signal
      const score = live.goldSafeHavenScore;
      const bias = score >= 65 ? "BULLISH" : score <= 35 ? "BEARISH" : "NEUTRAL";
      const tradeZone = score >= 75 ? "STRONG BUY REGION" : score >= 65 ? "BUY REGION" : score >= 50 ? "NEUTRAL ZONE" : score >= 35 ? "CAUTION ZONE" : score >= 20 ? "SELL REGION" : "STRONG SELL REGION";

      res.json({
        candles,
        markers,
        scoreLine,
        buyZones,
        sellZones,
        current: {
          price: live.goldClose,
          score,
          bias,
          tradeZone,
          lastFetched: live.lastFetched,
        },
      });
    } catch (err) {
      console.error("Error in /api/chart-data:", err);
      res.status(500).json({ error: "Failed to load chart data" });
    }
  });

  return httpServer;
}
