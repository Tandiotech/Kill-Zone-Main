import type { DominanceResult } from "../score-utils";

function minsAgo(iso?: string): string {
  if (!iso) return "n/a";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "n/a";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "<1m ago";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function DominanceBarRow({
  label,
  model,
  lastSampleAt,
  variant = "timing",
}: {
  label: string;
  model: DominanceResult;
  lastSampleAt?: string;
  variant?: "timing" | "macro";
}) {
  const bull = Number(model.bullPct.toFixed(1));
  const bear = Number((100 - bull).toFixed(1));
  const edge = Number(model.edge.toFixed(1));
  const leaning = edge > 0 ? "bull" : edge < 0 ? "bear" : "neutral";
  const leaningLabel =
    variant === "timing"
      ? leaning === "bull"
        ? "TIMING · BULLISH"
        : leaning === "bear"
          ? "TIMING · BEARISH"
          : "TIMING · NEUTRAL"
      : leaning === "bull"
        ? "LEANING BULLISH"
        : leaning === "bear"
          ? "LEANING BEARISH"
          : "BALANCED";

  return (
    <div className={`timing-bar timing-bar--${leaning}`}>
      <div className="timing-bar-head">
        <span className="timing-bar-label">{label}</span>
        <span className="timing-bar-fresh mono">Updated {minsAgo(lastSampleAt)}</span>
      </div>

      <div className="timing-bar-stats">
        <div className="timing-bar-side bull">
          <span className="lbl">Supporting Gold</span>
          <span className="pct mono">{bull.toFixed(1)}%</span>
        </div>

        <div className={`timing-bar-verdict ${leaning}`}>
          <span className="verdict-lbl">{leaningLabel}</span>
          <span className="verdict-edge mono">
            {edge > 0 ? "+" : ""}
            {edge.toFixed(1)} pt edge · {model.magnitude}
          </span>
        </div>

        <div className="timing-bar-side bear">
          <span className="lbl">Opposing Gold</span>
          <span className="pct mono">{bear.toFixed(1)}%</span>
        </div>
      </div>

      <div className="timing-bar-track">
        <div className="bull bf-live-fill" style={{ width: `${bull}%` }}>
          <span className="track-lbl">{bull.toFixed(1)}%</span>
        </div>
        <div className="bear bf-live-fill" style={{ width: `${bear}%` }}>
          <span className="track-lbl">{bear.toFixed(1)}%</span>
        </div>
        <div className="timing-bar-center" />
      </div>
    </div>
  );
}
