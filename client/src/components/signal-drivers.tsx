import type { ScoreResponse } from "@shared/schema";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatGmtPlus1Date, formatGmtPlus1Time, GMT_PLUS_ONE_LABEL } from "@/lib/timezone";

interface Driver {
  name: string;
  score: number;
  weight: number;
  contribution: number;
  rawValue: string;
  reason: string;
  bias: "bullish" | "bearish" | "neutral";
}

function getSignalLabel(score: number): string {
  if (score >= 75) return "STRONG BUY";
  if (score >= 65) return "BUY";
  if (score >= 50) return "HOLD";
  if (score >= 35) return "REDUCE";
  if (score >= 20) return "SELL";
  return "STRONG SELL";
}

function getSignalColor(score: number): string {
  if (score >= 75) return "#4ade80";
  if (score >= 65) return "#5fad46";
  if (score >= 50) return "#C49B30";
  if (score >= 35) return "#c97040";
  if (score >= 20) return "#d15a5a";
  return "#ef4444";
}

function buildDrivers(data: ScoreResponse, useOptimized: boolean): Driver[] {
  const c = data.current;

  const origWeights = [0.25, 0.20, 0.15, 0.10, 0.15, 0.10, 0.05];
  const optWeights = [0.15, 0.12, 0.15, 0.20, 0.15, 0.08, 0.15];
  const weights = useOptimized ? optWeights : origWeights;

  const components = [
    {
      name: "Real Yield Direction",
      score: c.ryScore,
      rawValue: `${c.realYield.toFixed(2)}%`,
      getReason: (s: number) =>
        s >= 65
          ? `Real yields falling (${c.realYield.toFixed(2)}%) — reduces opportunity cost of holding gold`
          : s >= 40
          ? `Real yields stable — neutral for gold`
          : `Real yields rising (${c.realYield.toFixed(2)}%) — increases opportunity cost, gold headwind`,
    },
    {
      name: "USD Trend",
      score: c.usdScore,
      rawValue: c.usdBroad.toFixed(1),
      getReason: (s: number) =>
        s >= 65
          ? `Dollar weakening (${c.usdBroad.toFixed(1)}) — bullish for gold priced in USD`
          : s >= 40
          ? `Dollar mixed — no clear directional pressure on gold`
          : `Dollar strengthening (${c.usdBroad.toFixed(1)}) — headwind for gold, only bearish driver`,
    },
    {
      name: "GPR Index",
      score: c.gprScore,
      rawValue: c.gpr.toFixed(0),
      getReason: (s: number) =>
        s >= 80
          ? `GPR at ${c.gpr.toFixed(0)} — extreme geopolitical risk, max safe haven demand`
          : s >= 50
          ? `GPR at ${c.gpr.toFixed(0)} — elevated geopolitical tensions supporting gold`
          : `GPR at ${c.gpr.toFixed(0)} — low geopolitical risk, reduced safe haven bid`,
    },
    {
      name: "Central Bank Demand",
      score: c.cbScore,
      rawValue: `${c.cbScore}/100`,
      getReason: (s: number) =>
        s >= 60
          ? `Post-2022 structural central bank buying regime — sustained demand floor for gold`
          : `Central bank demand moderate — no strong structural bid`,
    },
    {
      name: "Risk-Off Score",
      score: c.riskoffScore,
      rawValue: `VIX ${c.vix.toFixed(1)}`,
      getReason: (s: number) =>
        s >= 65
          ? `VIX at ${c.vix.toFixed(1)} + wide HY spreads — risk-off environment, flight to gold`
          : s >= 40
          ? `VIX moderate (${c.vix.toFixed(1)}) — market stress neutral`
          : `VIX low (${c.vix.toFixed(1)}) — risk-on, less demand for gold as safe haven`,
    },
    {
      name: "Inflation Expectations",
      score: c.inflationScore,
      rawValue: `${c.breakeven.toFixed(2)}%`,
      getReason: (s: number) =>
        s >= 65
          ? `Breakevens rising (${c.breakeven.toFixed(2)}%) — inflation hedge demand supports gold`
          : s >= 40
          ? `Inflation expectations stable — neutral for gold`
          : `Breakevens falling (${c.breakeven.toFixed(2)}%) — less inflation hedging demand`,
    },
    {
      name: "Momentum",
      score: c.momentumScore,
      rawValue: c.momentumScore >= 80 ? "Above SMA" : "Below SMA",
      getReason: (s: number) =>
        s >= 65
          ? `Gold above 3-month moving average — trend intact, momentum bullish`
          : `Gold below 3-month moving average — momentum has broken down`,
    },
  ];

  return components.map((comp, i) => {
    const weight = weights[i];
    const contribution = Math.round(comp.score * weight * 10) / 10;
    const bias: "bullish" | "bearish" | "neutral" =
      comp.score >= 60 ? "bullish" : comp.score <= 40 ? "bearish" : "neutral";

    return {
      name: comp.name,
      score: comp.score,
      weight,
      contribution,
      rawValue: comp.rawValue,
      reason: comp.getReason(comp.score),
      bias,
    };
  });
}

const biasColors = {
  bullish: { text: "#5fad46", bg: "#5fad4612", icon: TrendingUp },
  bearish: { text: "#d15a5a", bg: "#d15a5a12", icon: TrendingDown },
  neutral: { text: "#C49B30", bg: "#C49B3012", icon: Minus },
};

export function SignalDrivers({
  data,
  useOptimized,
}: {
  data: ScoreResponse;
  useOptimized: boolean;
}) {
  const score = useOptimized
    ? data.current.ryScore * 0.15 +
      data.current.usdScore * 0.12 +
      data.current.gprScore * 0.15 +
      data.current.cbScore * 0.20 +
      data.current.riskoffScore * 0.15 +
      data.current.inflationScore * 0.08 +
      data.current.momentumScore * 0.15
    : data.compositeScore;

  const signal = getSignalLabel(score);
  const signalColor = getSignalColor(score);
  const drivers = buildDrivers(data, useOptimized);

  // Sort by contribution descending
  const sorted = [...drivers].sort((a, b) => b.contribution - a.contribution);
  const bullish = sorted.filter((d) => d.bias === "bullish");
  const bearish = sorted.filter((d) => d.bias === "bearish");
  const neutral = sorted.filter((d) => d.bias === "neutral");

  // Build narrative summary
  const topDriver = sorted[0];
  const bearishDriver = bearish.length > 0 ? bearish[0] : null;

  const now = new Date();
  const timeStr = `${formatGmtPlus1Time(now, {
    hour: "2-digit",
    minute: "2-digit",
  })} ${GMT_PLUS_ONE_LABEL}`;
  const dateStr = formatGmtPlus1Date(now, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      {/* Header with signal */}
      <div
        className="rounded-lg px-4 py-3 border"
        style={{
          backgroundColor: `${signalColor}10`,
          borderColor: `${signalColor}25`,
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[hsl(210_8%_50%)] mb-1">
              Signal Analysis — {dateStr} at {timeStr}
            </div>
            <div className="text-sm font-semibold" style={{ color: signalColor }}>
              Why {signal}? — Score {Math.round(score)}/100
            </div>
          </div>
          <div
            className="text-xs font-bold font-mono tracking-wider px-3 py-1.5 rounded-md border"
            style={{
              color: signalColor,
              backgroundColor: `${signalColor}18`,
              borderColor: `${signalColor}35`,
            }}
          >
            {signal}
          </div>
        </div>

        {/* Narrative summary */}
        <div className="mt-2 text-xs text-[hsl(210_8%_60%)] leading-relaxed">
          {bullish.length} of 7 components are bullish
          {bearish.length > 0 && `, ${bearish.length} bearish`}
          {neutral.length > 0 && `, ${neutral.length} neutral`}.
          {" "}Largest contributor: {topDriver.name} at +{topDriver.contribution} pts.
          {bearishDriver && (
            <> Key headwind: {bearishDriver.name} ({bearishDriver.score}/100), dragging the score by limiting its contribution to just +{bearishDriver.contribution} pts.</>
          )}
        </div>
      </div>

      {/* Driver table */}
      <div className="overflow-x-auto pb-1">
        <table className="w-full min-w-[680px] text-[11px] sm:text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-[hsl(210_8%_45%)] border-b border-[hsl(210_15%_16%)]">
              <th className="text-left py-2 pl-2 font-medium">Component</th>
              <th className="text-right py-2 font-medium">Score</th>
              <th className="text-right py-2 font-medium">Weight</th>
              <th className="text-right py-2 font-medium">Contrib</th>
              <th className="text-left py-2 pl-3 font-medium">Bias</th>
              <th className="text-left py-2 pl-3 pr-2 font-medium">Why</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => {
              const bc = biasColors[d.bias];
              const Icon = bc.icon;
              return (
                <tr
                  key={d.name}
                  className="border-b border-[hsl(210_15%_14%)] hover:bg-[hsl(210_18%_13%)]"
                >
                  <td className="py-2 pl-2 font-medium text-[hsl(210_10%_70%)]">
                    {d.name}
                  </td>
                  <td className="py-2 text-right font-mono font-bold tabular-nums" style={{ color: bc.text }}>
                    {d.score}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-[hsl(210_8%_50%)]">
                    {(d.weight * 100).toFixed(0)}%
                  </td>
                  <td className="py-2 text-right font-mono font-semibold tabular-nums" style={{ color: bc.text }}>
                    +{d.contribution}
                  </td>
                  <td className="py-2 pl-3">
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold font-mono tracking-wide px-1.5 py-0.5 rounded"
                      style={{
                        color: bc.text,
                        backgroundColor: bc.bg,
                      }}
                    >
                      <Icon size={9} />
                      {d.bias.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2 pl-3 pr-2 text-[11px] text-[hsl(210_8%_55%)] max-w-[320px]">
                    {d.reason}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Total row */}
          <tfoot>
            <tr className="border-t-2 border-[hsl(210_15%_20%)]">
              <td className="py-2 pl-2 font-bold text-[hsl(210_10%_75%)]">Composite</td>
              <td className="py-2 text-right font-mono font-bold tabular-nums" style={{ color: signalColor }}>
                {Math.round(score * 10) / 10}
              </td>
              <td className="py-2 text-right font-mono text-[hsl(210_8%_50%)]">100%</td>
              <td className="py-2 text-right font-mono font-bold tabular-nums" style={{ color: signalColor }}>
                {Math.round(score * 10) / 10}
              </td>
              <td colSpan={2} className="py-2 pl-3">
                <span
                  className="text-[11px] font-bold font-mono tracking-wide px-2 py-0.5 rounded border"
                  style={{
                    color: signalColor,
                    backgroundColor: `${signalColor}15`,
                    borderColor: `${signalColor}30`,
                  }}
                >
                  {signal}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Caveat */}
      <div className="text-[11px] text-[hsl(210_8%_38%)] leading-relaxed px-1">
        This model measures whether macro conditions favour gold demand — not whether gold is cheap or expensive.
        {score >= 65 && (
          <> Even with a {signal} signal, gold at all-time highs carries asymmetric downside risk. Consider position sizing accordingly.</>
        )}
        {score < 35 && (
          <> A low score suggests conditions are unfavourable, but sharp reversals can occur if geopolitical events spike.</>
        )}
      </div>
    </div>
  );
}
