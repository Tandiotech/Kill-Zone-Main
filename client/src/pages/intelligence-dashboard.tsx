import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { IntelligenceDashboard } from "@/components/killzone-v2/IntelligenceDashboard";
import { LogoutButton } from "@/components/auth/LogoutButton";
import type { MarketNarrativeSlide } from "@/components/killzone-v2/widgets/LiveMarketNarrativeCarousel";
import type { SignalData } from "@/components/killzone-v2/signal-types";
import { buildDominanceModels } from "@/components/killzone-v2/dominance-models";
import { scoreLabel } from "@/components/killzone-v2/score-utils";
import bakedSignal from "@/data/signal-data.json";
import { apiRequest } from "@/lib/queryClient";
import { REACTIVE_REFRESH_MS } from "@/lib/refresh";
import { formatGmtPlus1Time, GMT_PLUS_ONE_LABEL } from "@/lib/timezone";
import { RefreshCw } from "lucide-react";

type ScoreApi = {
  regime: string;
  compositeScore?: number;
  lastFetched?: string;
  nextRefresh?: string | null;
  components?: {
    name: string;
    score: number;
    weight: number;
    contribution: number;
    factorDetail?: string;
    factorSnapshot?: { label: string; value: string }[];
  }[];
  dominanceModes?: {
    macro: {
      components: {
        name: string;
        score: number;
        weight: number;
        contribution: number;
        factorDetail?: string;
        factorSnapshot?: { label: string; value: string }[];
      }[];
    };
    intraday: {
      components: {
        name: string;
        score: number;
        weight: number;
        contribution: number;
        factorDetail?: string;
        factorSnapshot?: { label: string; value: string }[];
      }[];
      window: "15m/1h";
      lastSampleAt: string;
    };
    intraday2h?: {
      components: {
        name: string;
        score: number;
        weight: number;
        contribution: number;
        factorDetail?: string;
        factorSnapshot?: { label: string; value: string }[];
      }[];
      window: "2h";
      lastSampleAt: string;
    };
    intraday4h?: {
      components: {
        name: string;
        score: number;
        weight: number;
        contribution: number;
        factorDetail?: string;
        factorSnapshot?: { label: string; value: string }[];
      }[];
      window: "4h";
      lastSampleAt: string;
    };
  };
  current?: {
    realYield?: number;
    vix?: number;
    usdBroad?: number;
    gpr?: number;
    goldClose?: number;
    goldSafeHavenScore?: number;
  };
  basisData?: {
    spot?: number;
    futures?: number;
    basis?: number;
    basisPct?: number;
    contangoWarning?: boolean;
    spotSource?: string;
    futuresSource?: string;
  };
  sources?: {
    fred?: boolean;
    yahoo?: boolean;
    gpr?: boolean;
  };
};

type DominanceComponent = {
  name: string;
  score: number;
  weight: number;
  contribution: number;
  factorDetail?: string;
  factorSnapshot?: { label: string; value: string }[];
};

type ScoreLogApi = {
  entries: {
    timestamp: string;
    score: number;
    goldClose: number;
    delta: number;
  }[];
};

type MarketNarrativesApi = {
  updatedAt: string;
  changed: boolean;
  slides: MarketNarrativeSlide[];
};

function safeFixed(v: unknown, d = 2): string {
  if (v != null && typeof v === "number" && !Number.isNaN(v)) return v.toFixed(d);
  return "—";
}

function regimeChipFromString(regime: string): string {
  const r = regime.trim();
  if (r.length <= 24) return r.toUpperCase();
  const words = r.split(/\s+/).slice(0, 3).join(" ");
  return words.toUpperCase();
}

function buildFallbackNarrativeSlides(
  signal: SignalData,
  scoreApi?: ScoreApi
): MarketNarrativeSlide[] {
  const reasons = signal.reasons ?? [];
  const bullish = reasons.filter((r) => r.impact === "bullish").length;
  const bearish = reasons.filter((r) => r.impact === "bearish").length;
  const neutral = reasons.filter((r) => r.impact === "neutral").length;
  const topBull = reasons.find((r) => r.impact === "bullish");
  const topBear = reasons.find((r) => r.impact === "bearish");
  const bias: "Bullish" | "Bearish" | "Neutral" =
    signal.score >= 65 ? "Bullish" : signal.score <= 35 ? "Bearish" : "Neutral";

  const macroText =
    bias === "Bullish"
      ? "Gold is holding with a constructive macro tilt as defensive flows remain active. Dollar and yield pressure are not dominant enough to break the bid."
      : bias === "Bearish"
      ? "Gold is facing macro headwinds as opportunity-cost pressure remains elevated. Without softer yields or dollar relief, upside is likely to stay capped."
      : "Macro inputs are mixed and conviction is moderate. Gold remains sensitive to the next directional move in rates and broad dollar trend.";

  return [
    {
      id: "gold",
      title: "BREAKING: Gold price flow update",
      metrics: [
        { label: "Gold", value: `$${safeFixed(signal.gold)}` },
        { label: "Real Yield", value: scoreApi?.current?.realYield != null ? `${scoreApi.current.realYield.toFixed(2)}%` : "—" },
      ],
      text: macroText,
      updatedLabel: `Updated ${signal.meta.updatedAgo}`,
      bias,
      impact: "Medium impact",
      tags: [bias === "Bullish" ? "Bullish for gold" : bias === "Bearish" ? "Bearish for gold" : "Neutral"],
      imageUrl:
        "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80",
      imageAlt: "Macro market chart screen",
      freshness: { market: signal.meta.updatedAgo, news: "n/a" },
    },
    {
      id: "yields",
      title: "YIELDS WATCH: Live rates pulse",
      metrics: [
        { label: "Drivers", value: `${bullish} bull / ${bearish} bear` },
        { label: "Neutral", value: String(neutral) },
      ],
      text: topBull
        ? `Headline-style flow still leans toward ${topBull.factor.toLowerCase()}. Keep watching for confirmation from rates and dollar reaction before extending risk.`
        : "No single headline catalyst is dominating right now. Market reaction remains more data-driven than event-driven in this cycle.",
      updatedLabel: `Updated ${signal.meta.updatedAgo}`,
      bias,
      impact: "Medium impact",
      tags: [bias === "Bullish" ? "Bullish for gold" : bias === "Bearish" ? "Bearish for gold" : "Neutral"],
      imageUrl:
        "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80",
      imageAlt: "Financial news desk and headlines",
      freshness: { market: signal.meta.updatedAgo, news: "n/a" },
    },
    {
      id: "dollar",
      title: "DOLLAR TRACKER: FX pressure check",
      metrics: [
        { label: "Score", value: signal.score.toFixed(1) },
        { label: "Trade Zone", value: signal.tradeZone },
      ],
      text: topBear
        ? `Positioning reflects pressure from ${topBear.factor.toLowerCase()} while support remains selective. The current score suggests tactical rather than trend conviction.`
        : "Positioning remains balanced without a dominant opposing force. Score structure favors selective setups over aggressive directional positioning.",
      updatedLabel: `Updated ${signal.meta.updatedAgo}`,
      bias,
      impact: "Medium impact",
      tags: [bias === "Bullish" ? "Bullish for gold" : bias === "Bearish" ? "Bearish for gold" : "Neutral"],
      imageUrl:
        "https://images.unsplash.com/photo-1642790551116-18e150f248e3?auto=format&fit=crop&w=1200&q=80",
      imageAlt: "Technical trading chart analysis",
      freshness: { market: signal.meta.updatedAgo, news: "n/a" },
    },
    {
      id: "risk",
      title: "MACRO ALERT: Risk and event flow",
      metrics: [
        { label: "Bias", value: bias },
        { label: "Next", value: signal.tradeZone },
      ],
      text: signal.continuation,
      updatedLabel: `Updated ${signal.meta.updatedAgo}`,
      bias,
      impact: "Medium impact",
      tags: [bias === "Bullish" ? "Bullish for gold" : bias === "Bearish" ? "Bearish for gold" : "Neutral"],
      imageUrl:
        "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80",
      imageAlt: "Strategic planning and market outlook",
      freshness: { market: signal.meta.updatedAgo, news: "n/a" },
    },
  ];
}

export default function IntelligenceDashboardPage() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: liveSignal } = useQuery<SignalData>({
    queryKey: ["/api/signal"],
    refetchInterval: REACTIVE_REFRESH_MS,
    staleTime: 60 * 1000,
    retry: false,
  });

  const { data: scoreApi } = useQuery<ScoreApi>({
    queryKey: ["/api/score"],
    refetchInterval: REACTIVE_REFRESH_MS,
    staleTime: 60 * 1000,
    retry: false,
  });

  const { data: scoreLogApi } = useQuery<ScoreLogApi>({
    queryKey: ["/api/score-log"],
    refetchInterval: REACTIVE_REFRESH_MS,
    staleTime: 60 * 1000,
    retry: false,
  });
  const { data: narrativeApi } = useQuery<MarketNarrativesApi>({
    queryKey: ["/api/market-narratives"],
    refetchInterval: 90 * 1000,
    staleTime: 60 * 1000,
    retry: false,
  });

  const rawSignal: SignalData = (liveSignal ?? (bakedSignal as SignalData)) as SignalData;

  const signal: SignalData = useMemo(() => {
    const spot = scoreApi?.basisData?.spot;
    const score = scoreApi?.compositeScore ?? rawSignal.score;
    const bias: SignalData["bias"] =
      score >= 65 ? "BULLISH" : score <= 35 ? "BEARISH" : "NEUTRAL";
    const gold =
      typeof spot === "number" && spot > 0
        ? spot
        : typeof scoreApi?.current?.goldClose === "number" && scoreApi.current.goldClose > 0
          ? scoreApi.current.goldClose
          : rawSignal.gold;
    return {
      ...rawSignal,
      gold,
      score,
      bias,
      basis: {
        ...rawSignal.basis,
        spot: typeof spot === "number" && spot > 0 ? spot : rawSignal.basis?.spot,
        futures:
          typeof scoreApi?.basisData?.futures === "number" && scoreApi.basisData.futures > 0
            ? scoreApi.basisData.futures
            : rawSignal.basis?.futures,
      },
      meta: {
        ...rawSignal.meta,
        lastFetched: scoreApi?.lastFetched ?? rawSignal.meta.lastFetched,
      },
    };
  }, [rawSignal, scoreApi]);

  const dominanceModesForUI = useMemo(() => {
    const macroFromApi = scoreApi?.dominanceModes?.macro?.components;
    const intradayFromApi = scoreApi?.dominanceModes?.intraday?.components;
    const base = macroFromApi?.length ? macroFromApi : (scoreApi?.components ?? []);

    const macroComponents: DominanceComponent[] = base.map((c) => ({
      name: c.name,
      score: c.score,
      weight: c.weight,
      contribution: c.contribution ?? c.score * c.weight,
      factorDetail: c.factorDetail,
      factorSnapshot: c.factorSnapshot,
    }));

    // If tape windows are missing, reuse macro as-is so bias stays consistent.
    // Never amplify/rescore macro into fake "intraday" divergence.
    const cloneMacroAsWindow = (label: string): DominanceComponent[] =>
      macroComponents.map((c) => ({
        name: `${c.name} (${label})`,
        score: c.score,
        weight: c.weight,
        contribution: c.contribution ?? c.score * c.weight,
        factorDetail: c.factorDetail,
        factorSnapshot: c.factorSnapshot,
      }));

    const intradayComponents: DominanceComponent[] = intradayFromApi?.length
      ? intradayFromApi.map((c) => ({
          name: c.name,
          score: c.score,
          weight: c.weight,
          contribution: c.contribution ?? c.score * c.weight,
          factorDetail: c.factorDetail,
          factorSnapshot: c.factorSnapshot,
        }))
      : cloneMacroAsWindow("Intraday");

    const intraday2hComponents: DominanceComponent[] =
      scoreApi?.dominanceModes?.intraday2h?.components?.length
        ? scoreApi.dominanceModes.intraday2h.components
        : cloneMacroAsWindow("2H");

    const intraday4hComponents: DominanceComponent[] =
      scoreApi?.dominanceModes?.intraday4h?.components?.length
        ? scoreApi.dominanceModes.intraday4h.components
        : cloneMacroAsWindow("4H");

    return {
      macro: { components: macroComponents },
      intraday: {
        components: intradayComponents,
        window: scoreApi?.dominanceModes?.intraday?.window ?? ("15m/1h" as const),
        lastSampleAt:
          scoreApi?.dominanceModes?.intraday?.lastSampleAt ??
          scoreApi?.lastFetched ??
          new Date().toISOString(),
      },
      intraday2h: {
        components: intraday2hComponents,
        window: scoreApi?.dominanceModes?.intraday2h?.window ?? ("2h" as const),
        lastSampleAt:
          scoreApi?.dominanceModes?.intraday2h?.lastSampleAt ??
          scoreApi?.lastFetched ??
          new Date().toISOString(),
      },
      intraday4h: {
        components: intraday4hComponents,
        window: scoreApi?.dominanceModes?.intraday4h?.window ?? ("4h" as const),
        lastSampleAt:
          scoreApi?.dominanceModes?.intraday4h?.lastSampleAt ??
          scoreApi?.lastFetched ??
          new Date().toISOString(),
      },
    };
  }, [scoreApi]);

  const regimeLabel = scoreApi?.regime ?? "Neutral — macro context loading";

  const regimeMetrics = useMemo(() => {
    const c = scoreApi?.current;
    const curveComponent = scoreApi?.components?.find((comp) =>
      /10y|2y|curve|spread/i.test(comp.name),
    );
    const curveSnap = curveComponent?.factorSnapshot?.[0]?.value;
    return [
      {
        label: "Real Yield",
        value: c?.realYield != null ? `${c.realYield.toFixed(2)}%` : "—",
        sub: "live macro feed",
      },
      {
        label: "USD Broad",
        value: c?.usdBroad != null ? c.usdBroad.toFixed(1) : "—",
        sub: "dollar pressure",
      },
      {
        label: "VIX",
        value: c?.vix != null ? c.vix.toFixed(1) : "—",
        sub: "risk proxy",
      },
      {
        label: "10Y / 2Y",
        value: curveSnap ?? "—",
        sub: curveComponent ? "curve signal" : "awaiting feed",
      },
    ];
  }, [scoreApi]);

  const scoreDelta = useMemo(() => {
    const entries = scoreLogApi?.entries;
    if (!entries || entries.length < 2) return null;
    const cur = entries[entries.length - 1]?.score;
    const prev = entries[entries.length - 2]?.score;
    if (typeof cur !== "number" || typeof prev !== "number") return null;
    return cur - prev;
  }, [scoreLogApi]);

  const narrativeSlides = useMemo(() => {
    const liveSlides = narrativeApi?.slides?.slice(0, 4);
    if (liveSlides && liveSlides.length > 0) return liveSlides;
    return buildFallbackNarrativeSlides(signal, scoreApi);
  }, [narrativeApi?.slides, signal, scoreApi]);

  const positioning = useMemo(() => {
    const sc = scoreApi?.compositeScore ?? signal.score;
    const modelsLocal = buildDominanceModels(sc, dominanceModesForUI);
    const macroBull = modelsLocal.macro.bullPct >= modelsLocal.macro.bearPct;
    const intraBull = modelsLocal.intraday.bullPct >= modelsLocal.intraday.bearPct;
    const aligned = macroBull === intraBull;

    const title =
      sc >= 65
        ? "Lean long on structure — but size for volatility."
        : sc >= 50
          ? "Stand aside — wait for structure."
          : "Defensive framing — respect the headwinds.";

    let body: ReactNode;
    if (sc >= 65) {
      body = (
        <>
          The score sits above 65 — macro is{" "}
          <span style={{ color: "var(--bull)" }}>constructive for gold</span>
          {aligned
            ? ", and intraday timing agrees."
            : ", though short-term timing is still catching up."}{" "}
          Define invalidation before adding exposure; geopolitical headlines can gap price.
        </>
      );
    } else if (sc >= 50) {
      if (aligned && macroBull) {
        body = (
          <>
            <b style={{ color: "var(--text-1)", fontWeight: 500 }}>Neutral does not mean inactive.</b>{" "}
            Macro and timing both lean constructive — wait for a cleaner trigger before sizing up.
          </>
        );
      } else if (aligned && !macroBull) {
        body = (
          <>
            <b style={{ color: "var(--text-1)", fontWeight: 500 }}>Neutral does not mean inactive.</b>{" "}
            Macro and timing both lean defensive — favor patience over chasing.
          </>
        );
      } else if (macroBull && !intraBull) {
        body = (
          <>
            <b style={{ color: "var(--text-1)", fontWeight: 500 }}>Neutral does not mean inactive.</b>{" "}
            Opposing pressure dominates intraday flow. Macro remains constructive, but timing is not
            confirmed.
          </>
        );
      } else {
        body = (
          <>
            <b style={{ color: "var(--text-1)", fontWeight: 500 }}>Neutral does not mean inactive.</b>{" "}
            Short-term tape is firmer than the macro backdrop — treat bounce strength as unconfirmed.
          </>
        );
      }
    } else {
      body = (
        <>
          The score is below 50 — treat rallies as{" "}
          <span style={{ color: "var(--bear)" }}>fragile</span> until yields or the dollar turn.
        </>
      );
    }
    return { title, body };
  }, [signal.score, scoreApi?.compositeScore, dominanceModesForUI]);

  const invalidationRows = useMemo(() => {
    const c = scoreApi?.current;
    const rows: {
      trigger: ReactNode;
      exp: string;
      status: "near" | "armed" | "remote";
      statusLbl: string;
    }[] = [
      {
        trigger: (
          <>
            Real yields rise above <span className="num">2.00%</span> from current{" "}
            <span className="num">{c?.realYield != null ? `${c.realYield.toFixed(2)}%` : "—"}</span>
          </>
        ),
        exp: "Higher real yields increase carry pressure on non-yielding gold and weaken safe-haven score.",
        status: c?.realYield != null && c.realYield >= 1.9 ? "near" : "armed",
        statusLbl: c?.realYield != null && c.realYield >= 1.9 ? "NEAR" : "ARMED",
      },
      {
        trigger: (
          <>
            USD broad index pushes above <span className="num">108.50</span> from{" "}
            <span className="num">{c?.usdBroad != null ? c.usdBroad.toFixed(2) : "—"}</span>
          </>
        ),
        exp: "Dollar strength typically tightens financial conditions and caps upside in gold.",
        status: c?.usdBroad != null && c.usdBroad >= 107.8 ? "near" : "armed",
        statusLbl: c?.usdBroad != null && c.usdBroad >= 107.8 ? "NEAR" : "ARMED",
      },
      {
        trigger: (
          <>
            VIX drops under <span className="num">16</span> from{" "}
            <span className="num">{c?.vix != null ? c.vix.toFixed(1) : "—"}</span>
          </>
        ),
        exp: "If fear premium fades, safe-haven demand for gold can compress quickly.",
        status: c?.vix != null && c.vix <= 17 ? "near" : "remote",
        statusLbl: c?.vix != null && c.vix <= 17 ? "NEAR" : "REMOTE",
      },
    ];
    return rows;
  }, [scoreApi]);

  const sessionStats = useMemo(() => {
    const entries = scoreLogApi?.entries;
    if (!entries || entries.length < 3) return undefined;
    const windows = [
      { name: "Asia", start: 0, end: 8 },
      { name: "London", start: 7, end: 15 },
      { name: "New York", start: 13, end: 21 },
    ];
    const out: Record<string, string> = {};
    for (const w of windows) {
      const moves: number[] = [];
      for (let i = 1; i < entries.length; i++) {
        const prev = entries[i - 1];
        const cur = entries[i];
        const h = new Date(cur.timestamp).getUTCHours();
        if (h >= w.start && h < w.end && prev.goldClose > 0) {
          moves.push(Math.abs(((cur.goldClose - prev.goldClose) / prev.goldClose) * 100));
        }
      }
      const avg = moves.length
        ? moves.reduce((s, v) => s + v, 0) / moves.length
        : 0;
      out[w.name] = `Avg range · ${avg.toFixed(2)}%`;
    }
    return out;
  }, [scoreLogApi]);

  const liveGoldPrice = useMemo(() => {
    const spot = scoreApi?.basisData?.spot ?? signal.basis?.spot;
    const close = scoreApi?.current?.goldClose;
    const signalGold = signal.gold;
    // Prefer live XAU spot — futures can sit $50–70 above and look wrong vs trader charts.
    if (typeof spot === "number" && spot > 0) return spot;
    if (typeof close === "number" && close > 0) return close;
    if (typeof signalGold === "number" && signalGold > 0) return signalGold;
    return null;
  }, [scoreApi, signal.basis?.spot, signal.gold]);

  const liveScore = scoreApi?.compositeScore ?? signal.score;
  const liveBias =
    liveScore >= 65 ? "BULLISH" : liveScore <= 35 ? "BEARISH" : "NEUTRAL";

  const topbar = useMemo(() => {
    const priceDisplay =
      liveGoldPrice != null ? `$${safeFixed(liveGoldPrice)}` : `$${safeFixed(signal.gold)}`;
    const fetchedAt = scoreApi?.lastFetched ?? signal.meta.lastFetched;
    const liveLine = `LIVE · ${formatGmtPlus1Time(fetchedAt, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })} ${GMT_PLUS_ONE_LABEL}`;
    const entries = scoreLogApi?.entries;
    let chgDisplay = "—";
    let chgClass: "bull" | "bear" = "bear";
    if (entries && entries.length >= 2) {
      const prev = entries[entries.length - 2].goldClose;
      const cur =
        liveGoldPrice != null && liveGoldPrice > 0
          ? liveGoldPrice
          : entries[entries.length - 1].goldClose;
      if (prev > 0) {
        const pct = ((cur - prev) / prev) * 100;
        chgDisplay = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
        chgClass = pct >= 0 ? "bull" : "bear";
      }
    }
    return {
      priceDisplay,
      chgClass,
      chgDisplay,
      score: liveScore,
      scoreTag: `${liveBias} · ${scoreLabel(liveScore)}`,
      liveLine,
      regimeChip: regimeChipFromString(regimeLabel),
      biasChip: liveBias,
    };
  }, [
    signal.gold,
    signal.meta.lastFetched,
    scoreApi?.lastFetched,
    liveGoldPrice,
    liveScore,
    liveBias,
    regimeLabel,
    scoreLogApi,
  ]);

  const scoreLastChangedIso = useMemo(() => {
    const entries = scoreLogApi?.entries;
    if (!entries?.length) return signal.meta.lastFetched;
    const current = entries[entries.length - 1]?.score;
    if (typeof current !== "number") return signal.meta.lastFetched;

    const epsilon = 0.05;
    let startOfCurrentRun = entries.length - 1;
    for (let i = entries.length - 2; i >= 0; i--) {
      const v = entries[i]?.score;
      if (typeof v !== "number") continue;
      if (Math.abs(v - current) <= epsilon) {
        startOfCurrentRun = i;
      } else {
        break;
      }
    }
    return entries[startOfCurrentRun]?.timestamp ?? signal.meta.lastFetched;
  }, [scoreLogApi, signal.meta.lastFetched]);

  async function refreshAllData(): Promise<void> {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await apiRequest("POST", "/api/refresh");
      await queryClient.invalidateQueries();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <IntelligenceDashboard
      signal={signal}
      regimeLabel={regimeLabel}
      nextRefreshIso={scoreApi?.nextRefresh}
      invalidationRows={invalidationRows}
      sessionStats={sessionStats}
      regimeMetrics={regimeMetrics}
      narrativeSlides={narrativeSlides}
      narrativeChanged={narrativeApi?.changed}
      positioning={positioning}
      scoreLastChangedIso={scoreLastChangedIso}
      scoreDelta={scoreDelta}
      dominanceModes={dominanceModesForUI}
      macroLastFetched={scoreApi?.lastFetched}
      scoreApiCurrent={scoreApi?.current}
      topbar={topbar}
      topbarExtra={
        <>
          <button
            type="button"
            onClick={refreshAllData}
            disabled={refreshing}
            className="kz-iconbtn"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Syncing" : "Refresh"}
          </button>
          <LogoutButton />
        </>
      }
    />
  );
}
