import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createChart, ColorType, CandlestickSeries, LineSeries, AreaSeries } from "lightweight-charts";
import chartData from "@/data/chart-data.json";
import bakedSignal from "@/data/signal-data.json";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { REACTIVE_REFRESH_MS } from "@/lib/refresh";
import { formatGmtPlus1Date, formatGmtPlus1Time, GMT_PLUS_ONE_LABEL } from "@/lib/timezone";

interface SignalData {
  gold: number;
  score: number;
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  tradeZone: string;
  reasons: { factor: string; status: string; impact: string; detail: string; updatedAgo: string }[];
  continuation: string;
  basis: { spot: number; futures: number; premium: number; warning: boolean };
  meta: { lastFetched: string; updatedAgo: string; bullishCount: number; bearishCount: number; neutralCount: number };
}

function scoreColor(s: number): string {
  if (s >= 75) return "#4ade80";
  if (s >= 65) return "#5fad46";
  if (s >= 50) return "#C49B30";
  if (s >= 35) return "#c97040";
  return "#ef4444";
}

function scoreLabel(s: number): string {
  if (s >= 75) return "STRONG CONVICTION";
  if (s >= 65) return "HIGH";
  if (s >= 50) return "NEUTRAL";
  if (s >= 35) return "LOW";
  return "WEAK";
}

export default function ChartPage() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);

  const { data: liveSignal } = useQuery<SignalData>({
    queryKey: ["/api/signal"],
    refetchInterval: REACTIVE_REFRESH_MS,
    staleTime: 60 * 1000,
    retry: false,
  });
  const signal: SignalData = (liveSignal ?? bakedSignal) as SignalData;

  // Build score data aligned to candle timestamps
  // Use the backtest monthly scores for the historical overlay
  const scoreMap = new Map<string, number>();
  if ((chartData as any).scores) {
    for (const s of (chartData as any).scores) {
      scoreMap.set(s.time, s.value);
    }
  }

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const chart = createChart(el, {
      width: el.clientWidth, height: el.clientHeight,
      layout: { background: { type: ColorType.Solid, color: "#0F1419" }, textColor: "#9CA3AF", fontSize: 11 },
      grid: { vertLines: { color: "#1C253025" }, horzLines: { color: "#1C253025" } },
      crosshair: { vertLine: { color: "#C49B3040", width: 1, labelBackgroundColor: "#1C2D3A" }, horzLine: { color: "#C49B3040", width: 1, labelBackgroundColor: "#1C2D3A" } },
      rightPriceScale: { borderColor: "#1C2530", scaleMargins: { top: 0.02, bottom: 0.25 } },
      timeScale: { borderColor: "#1C2530", rightOffset: 5, timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;

    // Candlesticks
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#4ade80", downColor: "#ef4444", borderUpColor: "#4ade80", borderDownColor: "#ef4444",
      wickUpColor: "#4ade8080", wickDownColor: "#ef444480",
    });
    candles.setData(chartData.candles as any);

    // Score area overlay in bottom 25%
    const scoreArea = chart.addSeries(AreaSeries, {
      priceScaleId: "score",
      lineColor: "#20808D",
      topColor: "#20808D30",
      bottomColor: "#20808D05",
      lineWidth: 2,
      lastValueVisible: true,
      priceLineVisible: false,
    });

    chart.priceScale("score").applyOptions({
      scaleMargins: { top: 0.78, bottom: 0.02 },
      borderColor: "#1C2530",
      textColor: "#20808D80",
    });

    // Build score data from backtest (monthly) or use current score for all candles
    if ((chartData as any).scores && (chartData as any).scores.length > 0) {
      scoreArea.setData((chartData as any).scores as any);
    }

    // Score threshold lines
    scoreArea.createPriceLine({ price: 65, color: "#4ade8040", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "65" });
    scoreArea.createPriceLine({ price: 35, color: "#ef444440", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "35" });
    scoreArea.createPriceLine({ price: 50, color: "#C49B3030", lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "" });

    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => { if (el && chartRef.current) chartRef.current.resize(el.clientWidth, el.clientHeight); });
    ro.observe(el);
    return () => { ro.disconnect(); chartRef.current?.remove(); chartRef.current = null; };
  }, [signal]);

  const price = signal?.gold ?? chartData.candles[chartData.candles.length - 1]?.close ?? 0;
  const sc = signal?.score ?? 50;
  const safeFixed = (v: any, d = 2) => (v != null && !isNaN(v) ? Number(v).toFixed(d) : "—");
  const sColor = scoreColor(sc);

  // Score gauge arc
  const gaugeAngle = (sc / 100) * 180;

  return (
    <div style={{ background: "#0F1419", minHeight: "100vh", width: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: isNarrow ? "8px 10px" : "6px 16px", borderBottom: "1px solid #1C2530", background: "#0A0F14", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: isNarrow ? 8 : 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: isNarrow ? 12 : 14, fontWeight: 700, letterSpacing: "0.1em" }}>
            <span style={{ color: "#C49B30" }}>KILL</span><span style={{ color: "#9CA3AF" }}>ZONE</span>
          </span>
          {!isNarrow && <span style={{ color: "#4B5563" }}>|</span>}
          <span style={{ color: "#E5E7EB", fontSize: isNarrow ? 13 : 15, fontWeight: 700, fontFamily: "monospace" }}>XAUUSD</span>
          <span style={{ color: "#6B7280", fontSize: 11 }}>1H</span>
          <span style={{ color: "#E5E7EB", fontSize: isNarrow ? 13 : 15, fontWeight: 700, fontFamily: "monospace" }}>${safeFixed(price)}</span>
          <span style={{ color: sColor, fontSize: isNarrow ? 10 : 11, fontWeight: 700, fontFamily: "monospace", background: `${sColor}12`, border: `1px solid ${sColor}25`, padding: isNarrow ? "2px 8px" : "3px 10px", borderRadius: 4 }}>
            Score {safeFixed(sc, 0)} — {scoreLabel(sc)}
          </span>
        </div>
        <LogoutButton className="inline-flex items-center gap-1 rounded border border-[#1C2530] bg-[#0F1419] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF] hover:bg-[#1C2530]" />
      </div>

      {/* Main: Chart + Panel */}
      <div style={{ display: "flex", flexDirection: isNarrow ? "column" : "row", flex: 1, minHeight: 0, overflow: "hidden" }}>
        {/* Chart — 50% */}
        <div
          ref={chartContainerRef}
          style={{
            flex: isNarrow ? "0 0 auto" : 1,
            minWidth: 0,
            height: isNarrow ? "42vh" : "100%",
            minHeight: isNarrow ? 300 : undefined,
          }}
        />

        {/* Intelligence Panel — 50% */}
        <div style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto", borderLeft: isNarrow ? "none" : "1px solid #1C2530", borderTop: isNarrow ? "1px solid #1C2530" : "none", background: "#0A0F14" }}>
          {signal && (
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Overall Score — big arrow + percentage */}
              <div style={{ textAlign: "center", padding: "16px 0", borderRadius: 10, background: `${sColor}08`, border: `1px solid ${sColor}20` }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: sColor, lineHeight: 1 }}>
                  {sc >= 50 ? "↑" : "↓"}
                </div>
                <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "monospace", color: sColor, marginTop: 4 }}>
                  {safeFixed(sc, 0)}%
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>Gold Safe Haven Score</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: "#E5E7EB", marginTop: 8 }}>${safeFixed(signal?.gold)}</div>
                <div style={{ fontSize: 10, color: "#4B5563", marginTop: 2 }}>XAU/USD Spot · {signal.meta?.bullishCount ?? 0}/5 factors favour gold</div>
              </div>

              {/* Divider */}
              <div style={{ borderTop: "1px solid #1C2530" }} />

              {/* 5 Macro Factors */}
              <div style={{ fontSize: 10, color: "#6B7280", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600 }}>
                MACRO FACTORS DRIVING SCORE
              </div>

              {/* Analysis context */}
              <div style={{ background: "#0F1419", borderRadius: 6, padding: "10px 12px", border: "1px solid #1C2530", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#E5E7EB", fontSize: 12, fontWeight: 700, fontFamily: "monospace" }}>XAUUSD ${safeFixed(signal?.gold)}</span>
                  <span style={{ color: "#4B5563", fontSize: 9, fontFamily: "monospace" }}>
                    {formatGmtPlus1Date(signal.meta?.lastFetched ?? Date.now(), { day: "2-digit", month: "short", year: "numeric" })}
                    {" "}
                    {formatGmtPlus1Time(signal.meta?.lastFetched ?? Date.now(), { hour: "2-digit", minute: "2-digit" })} {GMT_PLUS_ONE_LABEL}
                  </span>
                </div>
                <div style={{ color: "#9CA3AF", fontSize: 10, lineHeight: 1.5 }}>
                  {sc >= 65
                    ? `At $${safeFixed(signal?.gold, 0)}, the macro environment favours gold. ${signal.meta?.bullishCount ?? 0} of 5 factors are supportive — primarily driven by ${(signal.reasons ?? []).filter(r => r.impact === "bullish").sort((a, b) => ((b as any).score ?? 0) - ((a as any).score ?? 0)).slice(0, 2).map(r => r.factor.toLowerCase()).join(" and ")}. The score of ${safeFixed(sc, 0)}% reflects elevated safe-haven demand conditions.`
                    : sc >= 50
                    ? `At $${safeFixed(signal?.gold, 0)}, conditions are mixed. ${signal.meta?.bullishCount ?? 0} of 5 factors lean supportive but conviction is moderate at ${safeFixed(sc, 0)}%. No dominant macro theme is driving gold in either direction.`
                    : `At $${safeFixed(signal?.gold, 0)}, the macro backdrop is unfavourable for gold. ${signal.meta?.bearishCount ?? 0} of 5 factors are working against it. The score of ${safeFixed(sc, 0)}% reflects weakening safe-haven demand.`
                  }
                </div>
              </div>

              {/* Plain-English summary */}
              {(() => {
                const sorted = [...signal.reasons]
                  .filter(r => r.impact !== "neutral")
                  .sort((a, b) => ((b as any).score ?? 0) - ((a as any).score ?? 0));
                const topBullish = sorted.filter(r => r.impact === "bullish").slice(0, 2);
                const topBearish = sorted.filter(r => r.impact === "bearish").slice(0, 1);
                let summary = "";
                if (topBullish.length >= 2) {
                  summary = `${topBullish[0].factor} and ${topBullish[1].factor.toLowerCase()} are the primary drivers today`;
                } else if (topBullish.length === 1) {
                  summary = `${topBullish[0].factor} is the primary driver today`;
                }
                if (topBearish.length > 0) {
                  summary += summary ? `, offset by ${topBearish[0].factor.toLowerCase()}` : `${topBearish[0].factor} is weighing on the score`;
                }
                if (!summary) summary = "No dominant factor — macro conditions are mixed";
                return (
                  <div style={{ color: "#C49B30", fontSize: 12, lineHeight: 1.5, fontStyle: "italic", padding: "0 2px" }}>
                    "{summary}"
                  </div>
                );
              })()}

              {signal.reasons.map((r) => {
                const ic = r.impact === "bullish" ? "#4ade80" : r.impact === "bearish" ? "#ef4444" : "#C49B30";
                const arrow = r.impact === "bullish" ? "↑" : r.impact === "bearish" ? "↓" : "→";
                const pct = (r as any).score ?? (r.impact === "bullish" ? 75 : r.impact === "bearish" ? 20 : 50);
                return (
                  <div key={r.factor} style={{ background: "#0F1419", borderRadius: 8, padding: "12px 14px", border: `1px solid ${ic}15`, display: "flex", gap: 12, alignItems: "center" }}>
                    {/* Arrow + Percentage */}
                    <div style={{ textAlign: "center", flexShrink: 0, width: 56 }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: ic, lineHeight: 1 }}>{arrow}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "monospace", color: ic }}>{pct}%</div>
                    </div>
                    {/* Detail */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                        <span style={{ color: "#E5E7EB", fontSize: 12, fontWeight: 600 }}>{r.factor}</span>
                        <span style={{ color: ic, fontSize: 9, fontWeight: 700, fontFamily: "monospace", background: `${ic}10`, padding: "2px 6px", borderRadius: 3 }}>
                          {r.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ color: "#9CA3AF", fontSize: 10, lineHeight: 1.4 }}>{r.detail}</div>
                    </div>
                  </div>
                );
              })}

              {/* Divider */}
              <div style={{ borderTop: "1px solid #1C2530" }} />

              {/* What to watch */}
              <div style={{ background: "#0F1419", borderRadius: 6, padding: "10px 12px", border: "1px solid #C49B3015" }}>
                <div style={{ color: "#C49B30", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", marginBottom: 4 }}>KEY LEVELS TO WATCH</div>
                <div style={{ color: "#9CA3AF", fontSize: 10, lineHeight: 1.6 }}>{signal.continuation}</div>
              </div>

              {/* Basis */}
              {signal.basis && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#4B5563", padding: "0 2px" }}>
                  <span>Spot: ${safeFixed(signal.basis?.spot)}</span>
                  <span>Futures: ${safeFixed(signal.basis?.futures)}</span>
                  <span style={{ color: signal.basis?.warning ? "#ef4444" : "#4B5563" }}>
                    Basis: ${safeFixed(signal.basis?.premium)}{signal.basis?.warning ? " ⚠" : ""}
                  </span>
                </div>
              )}

              {/* Score zones legend */}
              <div style={{ background: "#0F1419", borderRadius: 6, padding: "8px 12px", border: "1px solid #1C2530" }}>
                <div style={{ fontSize: 9, color: "#6B7280", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 6 }}>SCORE ZONES</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  {[
                    { range: "75–100", label: "Strong Conviction", color: "#4ade80" },
                    { range: "65–74", label: "High", color: "#5fad46" },
                    { range: "50–64", label: "Neutral", color: "#C49B30" },
                    { range: "35–49", label: "Low", color: "#c97040" },
                    { range: "0–34", label: "Weak", color: "#ef4444" },
                  ].map((z) => (
                    <div key={z.range} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: z.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 9, color: "#6B7280" }}><span style={{ color: z.color, fontWeight: 600, fontFamily: "monospace" }}>{z.range}</span> {z.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: 8, color: "#333", textAlign: "center" }}>
                KILLZONE Gold Intelligence · Score reflects macro conditions · Not a trade signal
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
