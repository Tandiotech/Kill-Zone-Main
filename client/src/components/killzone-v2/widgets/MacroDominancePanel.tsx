import { PressureBar } from "../primitives/PressureBar";
import { MetricCard } from "../primitives/MetricCard";
import type { DominanceResult } from "../score-utils";

export function MacroDominancePanel({
  macroModel,
  metrics,
  macroLastFetched,
}: {
  macroModel: DominanceResult;
  metrics?: { label: string; value: string; sub?: string }[];
  macroLastFetched?: string;
}) {
  const bull = macroModel.bullPct;
  const bear = macroModel.bearPct;
  const edge = macroModel.edge;
  const leaningLabel =
    macroModel.leaning === "bull"
      ? "LEANING BULLISH"
      : macroModel.leaning === "bear"
        ? "LEANING BEARISH"
        : "BALANCED";

  const freshness = macroLastFetched
    ? (() => {
        const ms = Date.now() - new Date(macroLastFetched).getTime();
        const mins = Math.floor(ms / 60000);
        if (mins < 1) return "<1m ago";
        if (mins < 60) return `${mins}m ago`;
        return `${Math.floor(mins / 60)}h ago`;
      })()
    : "n/a";

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-eyebrow">MACRO DOMINANCE · 24H</span>
        <span className="card-meta">DIRECTIONAL BIAS · {freshness}</span>
      </div>
      <div className="b-list">
        <div className="b-mini-pbar">
          <div className="row">
            <span className="lab">{leaningLabel}</span>
            <span className="val" style={{ color: "var(--gold-bright)" }}>
              {edge > 0 ? "+" : ""}
              {edge.toFixed(1)} EDGE
            </span>
          </div>
          <PressureBar bullPct={bull} bearPct={bear} height={10} showTick />
          <div className="row" style={{ marginTop: 2 }}>
            <span className="val" style={{ color: "var(--green-bright)", fontSize: 13 }}>
              {bull.toFixed(1)}%
            </span>
            <span className="val" style={{ color: "var(--red-bright)", fontSize: 13 }}>
              {bear.toFixed(1)}%
            </span>
          </div>
        </div>
        {(metrics ?? []).map((m) => (
          <MetricCard key={m.label} label={m.label} value={m.value} />
        ))}
      </div>
    </div>
  );
}
