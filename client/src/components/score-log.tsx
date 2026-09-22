import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Minus, Clock, Target } from "lucide-react";
import { REACTIVE_REFRESH_MS } from "@/lib/refresh";
import { formatGmtPlus1Date, formatGmtPlus1Time, GMT_PLUS_ONE_LABEL } from "@/lib/timezone";

interface ScoreLogEntry {
  timestamp: string;
  score: number;
  signal: string;
  goldClose: number;
  vix: number;
  gpr: number;
  delta: number;
  pricePips: number;
  cumulativePips: number;
  basis?: number;
  contangoWarning?: boolean;
}

interface ZoneResult {
  signal: string;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  tpPrice: number;
  slPrice: number;
  highPrice: number;
  lowPrice: number;
  pips: number;
  mfePips: number;
  maePips: number;
  tpProgress: number;
  slProgress: number;
  outcome: "TP_HIT" | "SL_HIT" | "SIGNAL_EXIT" | "OPEN" | "FLAT";
  duration: number;
  isActive: boolean;
  readings: number;
}

interface OutcomeStat {
  count: number;
  avgPips: number;
  totalPips: number;
  avgDuration: number;
  avgMfe: number;
  avgMae: number;
}

interface SignalStat {
  signal: string;
  count: number;
  winRate: number;
  avgPips: number;
  totalPips: number;
  avgMfe: number;
  avgMae: number;
  avgDuration: number;
  tpHits: number;
  slHits: number;
  signalExits: number;
  openTrades: number;
}

interface ScoreLogResponse {
  entries: ScoreLogEntry[];
  zones: ZoneResult[];
  config: { tpPips: number; slPips: number; pipSize: number; riskReward: string };
  outcomeBreakdown: {
    tpHit: OutcomeStat;
    slHit: OutcomeStat;
    signalExit: OutcomeStat;
    open: OutcomeStat;
  };
  signalBreakdown: SignalStat[];
  summary: {
    totalReadings: number;
    currentSignal: string | null;
    inZoneSince: string | null;
    highScore: number | null;
    lowScore: number | null;
    avgScore: number | null;
    totalPips: number;
    winRate: number;
    winningZones: number;
    losingZones: number;
    totalZones: number;
    tpHits: number;
    slHits: number;
    signalExits: number;
    expectancy: number;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
  };
}

const signalColors: Record<string, { text: string; bg: string; border: string }> = {
  "STRONG BUY": { text: "#4ade80", bg: "#4ade8012", border: "#4ade8030" },
  BUY: { text: "#5fad46", bg: "#5fad4612", border: "#5fad4630" },
  HOLD: { text: "#C49B30", bg: "#C49B3012", border: "#C49B3030" },
  REDUCE: { text: "#c97040", bg: "#c9704012", border: "#c9704030" },
  SELL: { text: "#d15a5a", bg: "#d15a5a12", border: "#d15a5a30" },
  "STRONG SELL": { text: "#ef4444", bg: "#ef444412", border: "#ef444430" },
};

function formatTime(iso: string): string {
  return `${formatGmtPlus1Time(iso, {
    hour: "2-digit",
    minute: "2-digit",
  })} ${GMT_PLUS_ONE_LABEL}`;
}
function formatDate(iso: string): string {
  return formatGmtPlus1Date(iso, { day: "2-digit", month: "short" });
}
function formatDuration(startIso: string): string {
  const diff = Date.now() - new Date(startIso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
function formatDurationMs(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function PipDisplay({ pips, size = "sm" }: { pips: number; size?: "sm" | "lg" }) {
  const color = pips > 0 ? "#5fad46" : pips < 0 ? "#d15a5a" : "#C49B30";
  const cls = size === "lg" ? "text-lg font-bold" : "text-xs font-semibold";
  return (
    <span className={`font-mono tabular-nums ${cls}`} style={{ color }}>
      {pips > 0 ? "+" : ""}{pips.toFixed(1)} <span className="text-[9px] opacity-70">pips</span>
    </span>
  );
}

/** Tiny sparkline */
function Sparkline({ entries }: { entries: ScoreLogEntry[] }) {
  if (entries.length < 2) return null;
  const values = entries.map((e) => e.cumulativePips);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 120, h = 28, pad = 2;
  const usableW = w - pad * 2, usableH = h - pad * 2;
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * usableW;
    const y = pad + usableH - ((v - min) / range) * usableH;
    return `${x},${y}`;
  });
  const last = values[values.length - 1];
  const color = last > 0 ? "#5fad46" : last < 0 ? "#d15a5a" : "#C49B30";
  // Zero line
  const zeroY = min <= 0 && max >= 0 ? pad + usableH - ((0 - min) / range) * usableH : -1;

  return (
    <svg width={w} height={h} className="overflow-visible">
      {zeroY >= 0 && (
        <line x1={pad} y1={zeroY} x2={w - pad} y2={zeroY} stroke="#ffffff15" strokeWidth={0.5} strokeDasharray="2,2" />
      )}
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={parseFloat(points[points.length - 1].split(",")[0])} cy={parseFloat(points[points.length - 1].split(",")[1])} r={2.5} fill={color} />
    </svg>
  );
}

export function ScoreLog() {
  const [now, setNow] = useState(Date.now());
  const { data, isLoading } = useQuery<ScoreLogResponse>({
    queryKey: ["/api/score-log"],
    refetchInterval: REACTIVE_REFRESH_MS,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <div className="h-16 rounded bg-[hsl(210_15%_16%)] animate-pulse" />
        <div className="h-32 rounded bg-[hsl(210_15%_16%)] animate-pulse" />
      </div>
    );
  }

  const { entries, zones, config, outcomeBreakdown, signalBreakdown, summary } = data;
  const { tpPips, slPips } = config;
  const ob = outcomeBreakdown;

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-[hsl(210_8%_45%)] text-xs">
        <Clock size={20} className="mx-auto mb-2 opacity-50" />
        Score log is empty — readings accumulate every 30 minutes.
      </div>
    );
  }

  const displayEntries = [...entries].reverse();
  const signalColor = signalColors[summary.currentSignal || "HOLD"] || signalColors.HOLD;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {/* Current Zone */}
        <div className="rounded-lg px-3 py-2.5 border" style={{ backgroundColor: signalColor.bg, borderColor: signalColor.border }}>
          <div className="text-[9px] uppercase tracking-wider text-[hsl(210_8%_50%)] mb-1">Current Zone</div>
          <div className="text-xs font-bold font-mono" style={{ color: signalColor.text }}>{summary.currentSignal}</div>
          {summary.inZoneSince && (
            <div className="text-[10px] font-mono text-[hsl(210_8%_45%)] mt-0.5">for {formatDuration(summary.inZoneSince)}</div>
          )}
        </div>

        {/* Total Pips */}
        <div className="rounded-lg px-3 py-2.5 border border-[hsl(210_15%_16%)] bg-[hsl(210_18%_13%)]">
          <div className="text-[9px] uppercase tracking-wider text-[hsl(210_8%_50%)] mb-1">
            <Target size={9} className="inline mr-1 -mt-px" />Total Pips
          </div>
          <PipDisplay pips={summary.totalPips} size="lg" />
        </div>

        {/* Win Rate */}
        <div className="rounded-lg px-3 py-2.5 border border-[hsl(210_15%_16%)] bg-[hsl(210_18%_13%)]">
          <div className="text-[9px] uppercase tracking-wider text-[hsl(210_8%_50%)] mb-1">Win Rate</div>
          <div className="text-xs font-bold font-mono text-[hsl(210_10%_75%)]">{summary.winRate}%</div>
          <div className="text-[10px] font-mono text-[hsl(210_8%_45%)] mt-0.5">
            <span className="text-[#5fad46]">{summary.winningZones}W</span>
            <span className="mx-1 text-[hsl(210_8%_30%)]">/</span>
            <span className="text-[#d15a5a]">{summary.losingZones}L</span>
            <span className="mx-1 text-[hsl(210_8%_30%)]">/</span>
            <span>{summary.totalZones} zones</span>
          </div>
        </div>

        {/* Range */}
        <div className="rounded-lg px-3 py-2.5 border border-[hsl(210_15%_16%)] bg-[hsl(210_18%_13%)]">
          <div className="text-[9px] uppercase tracking-wider text-[hsl(210_8%_50%)] mb-1">Score (H / L)</div>
          <div className="text-xs font-mono text-[hsl(210_10%_75%)]">
            <span className="font-bold text-[#5fad46]">{summary.highScore}</span>
            <span className="text-[hsl(210_8%_38%)] mx-1">/</span>
            <span className="font-bold text-[#d15a5a]">{summary.lowScore}</span>
          </div>
          <div className="text-[10px] font-mono text-[hsl(210_8%_45%)] mt-0.5">avg {summary.avgScore}</div>
        </div>

        {/* Pip Sparkline */}
        <div className="rounded-lg px-3 py-2.5 border border-[hsl(210_15%_16%)] bg-[hsl(210_18%_13%)] flex flex-col justify-center items-center">
          <div className="text-[9px] uppercase tracking-wider text-[hsl(210_8%_50%)] mb-1 self-start">P&L Trend</div>
          <Sparkline entries={entries} />
        </div>
      </div>

      {/* Collapsible raw readings log */}
      <RawReadingsLog entries={displayEntries} />

      {/* Trade Journal — with TP/SL tracking */}
      {zones.filter(z => z.signal !== "HOLD" && z.signal !== "REDUCE").length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[9px] uppercase tracking-wider text-[hsl(210_8%_45%)] font-medium">Trade Journal</h4>
            <div className="flex items-center gap-3 text-[9px] font-mono">
              <span className="text-[#5fad46]">TP: {tpPips} pips</span>
              <span className="text-[#d15a5a]">SL: {slPips} pips</span>
              <span className="text-[hsl(210_8%_45%)]">R:R {config.riskReward}</span>
            </div>
          </div>

          {/* Win Rate Summary */}
          <div className="rounded-lg border border-[hsl(210_15%_16%)] bg-[hsl(210_18%_12%)] p-3 mb-3">
            {/* Top row: key stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-3">
              <div>
                <div className="text-[8px] uppercase tracking-wider text-[hsl(210_8%_42%)] mb-0.5">Expectancy</div>
                <span className={`text-sm font-bold font-mono tabular-nums ${summary.expectancy > 0 ? "text-[#5fad46]" : summary.expectancy < 0 ? "text-[#d15a5a]" : "text-[#C49B30]"}`}>
                  {summary.expectancy > 0 ? "+" : ""}{summary.expectancy}
                  <span className="text-[9px] ml-0.5 opacity-60">pips/trade</span>
                </span>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-wider text-[hsl(210_8%_42%)] mb-0.5">Profit Factor</div>
                <span className={`text-sm font-bold font-mono tabular-nums ${summary.profitFactor >= 1 ? "text-[#5fad46]" : "text-[#d15a5a]"}`}>
                  {summary.profitFactor === Infinity ? "∞" : summary.profitFactor.toFixed(2)}
                </span>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-wider text-[hsl(210_8%_42%)] mb-0.5">Avg Win</div>
                <span className="text-xs font-bold font-mono tabular-nums text-[#5fad46]">+{summary.avgWin} pips</span>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-wider text-[hsl(210_8%_42%)] mb-0.5">Avg Loss</div>
                <span className="text-xs font-bold font-mono tabular-nums text-[#d15a5a]">{summary.avgLoss} pips</span>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-wider text-[hsl(210_8%_42%)] mb-0.5">Total P&L</div>
                <span className={`text-xs font-bold font-mono tabular-nums ${summary.totalPips >= 0 ? "text-[#5fad46]" : "text-[#d15a5a]"}`}>
                  {summary.totalPips > 0 ? "+" : ""}{summary.totalPips} pips
                </span>
              </div>
            </div>

            {/* Outcome breakdown table */}
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-[8px] uppercase tracking-wider text-[hsl(210_8%_38%)] border-b border-[hsl(210_15%_18%)]">
                  <th className="text-left py-1 font-medium">Outcome</th>
                  <th className="text-right py-1 font-medium">Count</th>
                  <th className="text-right py-1 font-medium">%</th>
                  <th className="text-right py-1 font-medium">Avg Pips</th>
                  <th className="text-right py-1 font-medium">Total Pips</th>
                  <th className="text-right py-1 font-medium">Avg MFE</th>
                  <th className="text-right py-1 font-medium">Avg MAE</th>
                  <th className="text-right py-1 font-medium">Avg Duration</th>
                </tr>
              </thead>
              <tbody>
                {([
                  { key: "tpHit", label: "TP HIT", color: "#4ade80", bg: "#4ade8015", data: ob.tpHit },
                  { key: "slHit", label: "SL HIT", color: "#ef4444", bg: "#ef444415", data: ob.slHit },
                  { key: "signalExit", label: "SIGNAL EXIT", color: "#C49B30", bg: "#C49B3015", data: ob.signalExit },
                  { key: "open", label: "OPEN", color: "#20808D", bg: "#20808D15", data: ob.open },
                ] as const).filter(r => r.data.count > 0).map((row) => {
                  const total = ob.tpHit.count + ob.slHit.count + ob.signalExit.count + ob.open.count;
                  const pct = total > 0 ? Math.round((row.data.count / total) * 100) : 0;
                  return (
                    <tr key={row.key} className="border-b border-[hsl(210_15%_15%)]">
                      <td className="py-1.5">
                        <span className="inline-block text-[8px] font-bold font-mono tracking-wide px-1.5 py-0.5 rounded min-w-[72px] text-center" style={{ color: row.color, backgroundColor: row.bg }}>
                          {row.label}
                        </span>
                      </td>
                      <td className="py-1.5 text-right font-mono font-bold tabular-nums text-[hsl(210_10%_70%)]">{row.data.count}</td>
                      <td className="py-1.5 text-right font-mono tabular-nums text-[hsl(210_8%_50%)]">{pct}%</td>
                      <td className="py-1.5 text-right font-mono font-semibold tabular-nums" style={{ color: row.data.avgPips >= 0 ? "#5fad46" : "#d15a5a" }}>
                        {row.data.avgPips > 0 ? "+" : ""}{row.data.avgPips}
                      </td>
                      <td className="py-1.5 text-right font-mono font-semibold tabular-nums" style={{ color: row.data.totalPips >= 0 ? "#5fad46" : "#d15a5a" }}>
                        {row.data.totalPips > 0 ? "+" : ""}{row.data.totalPips}
                      </td>
                      <td className="py-1.5 text-right font-mono tabular-nums text-[#5fad46]">+{row.data.avgMfe}</td>
                      <td className="py-1.5 text-right font-mono tabular-nums text-[#d15a5a]">{row.data.avgMae}</td>
                      <td className="py-1.5 text-right font-mono tabular-nums text-[hsl(210_8%_50%)]">{formatDurationMs(row.data.avgDuration)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Signal Zone Breakdown */}
            {signalBreakdown.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[hsl(210_15%_18%)]">
                <h5 className="text-[8px] uppercase tracking-wider text-[hsl(210_8%_42%)] mb-2 font-medium">Performance by Conviction Level</h5>
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-[8px] uppercase tracking-wider text-[hsl(210_8%_38%)] border-b border-[hsl(210_15%_18%)]">
                      <th className="text-left py-1 font-medium">Signal</th>
                      <th className="text-right py-1 font-medium">Score</th>
                      <th className="text-right py-1 font-medium">Trades</th>
                      <th className="text-right py-1 font-medium">Win %</th>
                      <th className="text-right py-1 font-medium">Avg Pips</th>
                      <th className="text-right py-1 font-medium">Total Pips</th>
                      <th className="text-right py-1 font-medium">Avg MFE</th>
                      <th className="text-right py-1 font-medium">Avg MAE</th>
                      <th className="text-right py-1 font-medium">TP</th>
                      <th className="text-right py-1 font-medium">SL</th>
                      <th className="text-right py-1 font-medium">Sig Exit</th>
                      <th className="text-right py-1 font-medium">Avg Dur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signalBreakdown.map((s) => {
                      const sc = signalColors[s.signal] || signalColors.HOLD;
                      const scoreRange = s.signal === "STRONG BUY" ? "75–100"
                        : s.signal === "BUY" ? "65–74"
                        : s.signal === "SELL" ? "20–34"
                        : s.signal === "STRONG SELL" ? "0–19" : "—";
                      return (
                        <tr key={s.signal} className="border-b border-[hsl(210_15%_15%)]">
                          <td className="py-1.5">
                            <span className="inline-block text-[8px] font-bold font-mono tracking-wide px-1.5 py-0.5 rounded border min-w-[72px] text-center" style={{ color: sc.text, backgroundColor: sc.bg, borderColor: sc.border }}>
                              {s.signal}
                            </span>
                          </td>
                          <td className="py-1.5 text-right font-mono tabular-nums text-[hsl(210_8%_50%)]">{scoreRange}</td>
                          <td className="py-1.5 text-right font-mono font-bold tabular-nums text-[hsl(210_10%_70%)]">{s.count}</td>
                          <td className="py-1.5 text-right font-mono font-bold tabular-nums" style={{ color: s.winRate >= 50 ? "#5fad46" : s.winRate > 0 ? "#C49B30" : "#d15a5a" }}>
                            {s.winRate}%
                          </td>
                          <td className="py-1.5 text-right font-mono font-semibold tabular-nums" style={{ color: s.avgPips >= 0 ? "#5fad46" : "#d15a5a" }}>
                            {s.avgPips > 0 ? "+" : ""}{s.avgPips}
                          </td>
                          <td className="py-1.5 text-right font-mono font-semibold tabular-nums" style={{ color: s.totalPips >= 0 ? "#5fad46" : "#d15a5a" }}>
                            {s.totalPips > 0 ? "+" : ""}{s.totalPips}
                          </td>
                          <td className="py-1.5 text-right font-mono tabular-nums text-[#5fad46]">+{s.avgMfe}</td>
                          <td className="py-1.5 text-right font-mono tabular-nums text-[#d15a5a]">{s.avgMae}</td>
                          <td className="py-1.5 text-right font-mono tabular-nums text-[#4ade80]">{s.tpHits}</td>
                          <td className="py-1.5 text-right font-mono tabular-nums text-[#ef4444]">{s.slHits}</td>
                          <td className="py-1.5 text-right font-mono tabular-nums text-[#C49B30]">{s.signalExits}</td>
                          <td className="py-1.5 text-right font-mono tabular-nums text-[hsl(210_8%_50%)]">{formatDurationMs(s.avgDuration)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="text-[9px] text-[hsl(210_8%_33%)] mt-1">
                  Higher score = higher conviction · Compare avg pips and win rate between STRONG BUY (75–100) and BUY (65–74) to validate conviction edge
                </div>
              </div>
            )}
          </div>
          <div className="overflow-x-auto pb-1">
            <table className="w-full min-w-[760px] text-[11px]">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-[hsl(210_8%_40%)] border-b border-[hsl(210_15%_16%)]">
                  <th className="text-left py-1.5 pl-2 font-medium">Signal</th>
                  <th className="text-left py-1.5 font-medium">Entry</th>
                  <th className="text-right py-1.5 font-medium">Entry $</th>
                  <th className="text-right py-1.5 font-medium">TP / SL $</th>
                  <th className="text-center py-1.5 font-medium">SL Progress</th>
                  <th className="text-center py-1.5 font-medium">TP Progress</th>
                  <th className="text-right py-1.5 font-medium">Peak DD</th>
                  <th className="text-right py-1.5 font-medium">Peak Profit</th>
                  <th className="text-right py-1.5 font-medium">Result</th>
                  <th className="text-left py-1.5 pl-2 pr-2 font-medium">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {[...zones].reverse().filter(z => z.signal !== "HOLD" && z.signal !== "REDUCE").map((zone) => {
                  const sc = signalColors[zone.signal] || signalColors.HOLD;
                  const tpBarW = Math.min(100, zone.tpProgress);
                  const slBarW = Math.min(100, zone.slProgress);

                  const outcomeConfig: Record<string, { label: string; color: string; bg: string }> = {
                    TP_HIT: { label: "TP HIT", color: "#4ade80", bg: "#4ade8018" },
                    SL_HIT: { label: "SL HIT", color: "#ef4444", bg: "#ef444418" },
                    SIGNAL_EXIT: { label: "SIGNAL EXIT", color: "#C49B30", bg: "#C49B3018" },
                    OPEN: { label: "OPEN", color: "#20808D", bg: "#20808D18" },
                    FLAT: { label: "FLAT", color: "#6b7280", bg: "#6b728018" },
                  };
                  const oc = outcomeConfig[zone.outcome] || outcomeConfig.FLAT;

                  return (
                    <tr key={zone.entryTime} className={`border-b border-[hsl(210_15%_14%)] ${zone.isActive ? "bg-[hsl(210_18%_14%)]" : "hover:bg-[hsl(210_18%_13%)]"}`}>
                      {/* Signal */}
                      <td className="py-2.5 pl-2">
                        <span
                          className="inline-block text-[9px] font-bold font-mono tracking-wide px-1.5 py-0.5 rounded border text-center min-w-[64px]"
                          style={{ color: sc.text, backgroundColor: sc.bg, borderColor: sc.border }}
                        >
                          {zone.signal}
                        </span>
                      </td>
                      {/* Entry time */}
                      <td className="py-2.5 font-mono tabular-nums text-[hsl(210_8%_50%)]">
                        {formatDate(zone.entryTime)} {formatTime(zone.entryTime)}
                      </td>
                      {/* Entry price */}
                      <td className="py-2.5 text-right font-mono tabular-nums text-[hsl(210_10%_65%)]">
                        ${zone.entryPrice.toFixed(2)}
                      </td>
                      {/* TP / SL levels */}
                      <td className="py-2.5 text-right font-mono tabular-nums text-[10px]">
                        <span className="text-[#5fad46]">${zone.tpPrice.toFixed(0)}</span>
                        <span className="text-[hsl(210_8%_30%)] mx-0.5">/</span>
                        <span className="text-[#d15a5a]">${zone.slPrice.toFixed(0)}</span>
                      </td>
                      {/* SL Progress bar */}
                      <td className="py-2.5 px-2">
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="w-24 h-1.5 rounded-full bg-[hsl(210_15%_14%)] overflow-hidden relative">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${slBarW}%`,
                                backgroundColor: zone.slProgress >= 100 ? "#ef4444" : zone.slProgress >= 70 ? "#c97040" : "#d15a5a50",
                              }}
                            />
                          </div>
                          <span className="text-[9px] font-mono tabular-nums" style={{ color: zone.slProgress >= 100 ? "#ef4444" : zone.slProgress >= 70 ? "#c97040" : "#d15a5a60" }}>
                            {zone.slProgress}%{zone.slProgress >= 100 ? " ⚠" : ""}
                          </span>
                        </div>
                      </td>
                      {/* TP Progress bar */}
                      <td className="py-2.5 px-2">
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="w-24 h-1.5 rounded-full bg-[hsl(210_15%_14%)] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${tpBarW}%`,
                                backgroundColor: zone.tpProgress >= 100 ? "#4ade80" : zone.tpProgress >= 50 ? "#5fad46" : "#5fad4650",
                              }}
                            />
                          </div>
                          <span className="text-[9px] font-mono tabular-nums" style={{ color: zone.tpProgress >= 100 ? "#4ade80" : zone.tpProgress >= 50 ? "#5fad46" : "#5fad4660" }}>
                            {zone.tpProgress}%{zone.tpProgress >= 100 ? " ✓" : ""}
                          </span>
                        </div>
                      </td>
                      {/* Peak DD (MAE) */}
                      <td className="py-2.5 text-right font-mono font-semibold tabular-nums text-[#d15a5a]">
                        {zone.maePips.toFixed(1)}
                      </td>
                      {/* Peak Profit (MFE) */}
                      <td className="py-2.5 text-right font-mono font-semibold tabular-nums text-[#5fad46]">
                        +{zone.mfePips.toFixed(1)}
                      </td>
                      {/* Result pips */}
                      <td className="py-2.5 text-right font-mono font-bold tabular-nums" style={{ color: zone.pips > 0 ? "#5fad46" : zone.pips < 0 ? "#d15a5a" : "#C49B30" }}>
                        {zone.pips > 0 ? "+" : ""}{zone.pips.toFixed(1)}
                      </td>
                      {/* Outcome badge */}
                      <td className="py-2.5 pl-2 pr-2">
                        <span
                          className="inline-block text-[9px] font-bold font-mono tracking-wide px-1.5 py-0.5 rounded"
                          style={{ color: oc.color, backgroundColor: oc.bg }}
                        >
                          {oc.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="text-[11px] text-[hsl(210_8%_35%)] mt-1 px-2">
            TP = {tpPips} pips target · SL = {slPips} pips stop · Peak DD = max adverse excursion · Peak Profit = max favourable excursion · HOLD/REDUCE = flat (no position)
          </div>
        </div>
      )}

      <div className="text-[11px] text-[hsl(210_8%_38%)] text-center pt-1">
        1 pip = $0.10 (XAUUSD) · BUY/STRONG BUY = long · SELL/STRONG SELL = short · HOLD/REDUCE = flat
      </div>
    </div>
  );
}

/** Collapsible raw readings — shows zone transitions only by default */
function RawReadingsLog({ entries }: { entries: ScoreLogEntry[] }) {
  const [expanded, setExpanded] = useState(false);

  // Filter to only zone transitions + latest entry
  const filtered = entries.filter((entry, i) => {
    if (i === 0) return true; // always show latest (NOW)
    if (i === entries.length - 1) return true; // always show first entry
    const next = entries[i - 1]; // entries are reversed (newest first)
    return next.signal !== entry.signal; // zone change
  });

  const displayList = expanded ? entries : filtered;
  const hiddenCount = entries.length - filtered.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-[9px] uppercase tracking-wider text-[hsl(210_8%_42%)] font-medium">Data Readings</h4>
        {hiddenCount > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[9px] font-mono text-[#20808D] hover:text-[#2da0b0] transition-colors"
          >
            {expanded ? `Collapse (hide ${hiddenCount} readings)` : `Show all ${entries.length} readings (+${hiddenCount} hidden)`}
          </button>
        )}
      </div>
      <div className="overflow-x-auto pb-1">
        <table className="w-full min-w-[620px] text-[11px]">
          <thead>
            <tr className="text-[9px] uppercase tracking-wider text-[hsl(210_8%_40%)] border-b border-[hsl(210_15%_16%)]">
              <th className="text-left py-1 pl-2 font-medium">Time</th>
              <th className="text-right py-1 font-medium">Score</th>
              <th className="text-left py-1 pl-2 font-medium">Signal</th>
              <th className="text-right py-1 font-medium">Gold</th>
              <th className="text-right py-1 font-medium">Δ Pips</th>
              <th className="text-right py-1 pr-2 font-medium">Running P&L</th>
            </tr>
          </thead>
          <tbody>
            {displayList.map((entry, i) => {
              const sc = signalColors[entry.signal] || signalColors.HOLD;
              const isLatest = i === 0;
              const prevEntry = i < displayList.length - 1 ? displayList[i + 1] : null;
              const zoneChanged = prevEntry && prevEntry.signal !== entry.signal;

              return (
                <tr
                  key={entry.timestamp}
                  className={`
                    border-b border-[hsl(210_15%_14%)]
                    ${isLatest ? "bg-[hsl(210_18%_14%)]" : ""}
                    ${zoneChanged ? "border-t-2 border-t-[hsl(210_15%_22%)]" : ""}
                  `}
                >
                  <td className="py-1 pl-2 font-mono tabular-nums text-[hsl(210_8%_50%)]">
                    {formatDate(entry.timestamp)} {formatTime(entry.timestamp)}
                    {isLatest && <span className="ml-1 text-[9px] text-emerald-400 font-semibold">NOW</span>}
                    {zoneChanged && <span className="ml-1 text-[9px] text-[#C49B30]">⚡ ZONE CHANGE</span>}
                  </td>
                  <td className="py-1 text-right font-mono font-bold tabular-nums" style={{ color: sc.text }}>{entry.score}</td>
                  <td className="py-1 pl-2">
                    <span className="text-[9px] font-bold font-mono px-1 py-0.5 rounded" style={{ color: sc.text, backgroundColor: sc.bg }}>
                      {entry.signal}
                    </span>
                  </td>
                  <td className="py-1 text-right font-mono tabular-nums text-[hsl(210_10%_60%)]">
                    ${entry.goldClose.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-1 text-right font-mono tabular-nums" style={{ color: entry.pricePips > 0 ? "#5fad4680" : entry.pricePips < 0 ? "#d15a5a80" : "hsl(210,8%,30%)" }}>
                    {entry.pricePips !== 0 ? `${entry.pricePips > 0 ? "+" : ""}${entry.pricePips.toFixed(0)}` : "—"}
                  </td>
                  <td className="py-1 text-right pr-2 font-mono font-semibold tabular-nums" style={{ color: entry.cumulativePips > 0 ? "#5fad46" : entry.cumulativePips < 0 ? "#d15a5a" : "#C49B30" }}>
                    {entry.cumulativePips > 0 ? "+" : ""}{entry.cumulativePips.toFixed(0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!expanded && hiddenCount > 0 && (
        <div className="text-[11px] text-[hsl(210_8%_33%)] text-center mt-1">
          Showing zone transitions only · {hiddenCount} intermediate readings hidden
        </div>
      )}
    </div>
  );
}
