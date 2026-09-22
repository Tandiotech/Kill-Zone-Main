import { useEffect, useRef, useState, useMemo } from "react";
import { formatGmtPlus1Time, GMT_PLUS_ONE_LABEL } from "@/lib/timezone";

function getScoreColor(score: number): string {
  if (score >= 65) return "#5fad46"; // green/bullish
  if (score >= 50) return "#C49B30"; // gold/neutral
  if (score >= 35) return "#c97040"; // orange/lean bear
  return "#d15a5a"; // red/bearish
}

function getTradeSignal(score: number): { label: string; sublabel: string; color: string } {
  if (score >= 75) return { label: "STRONG BUY", sublabel: "High-conviction long gold", color: "#4ade80" };
  if (score >= 65) return { label: "BUY", sublabel: "Lean long gold exposure", color: "#5fad46" };
  if (score >= 50) return { label: "HOLD / NEUTRAL", sublabel: "No clear signal — wait for confirmation", color: "#C49B30" };
  if (score >= 35) return { label: "REDUCE", sublabel: "Trim gold exposure", color: "#c97040" };
  if (score >= 20) return { label: "SELL", sublabel: "Exit gold positions", color: "#d15a5a" };
  return { label: "STRONG SELL", sublabel: "Risk-off for gold — max bearish", color: "#ef4444" };
}

function getRegimeLabel(score: number): string {
  if (score >= 75) return "Strong Safe Haven — Gold Bullish Bias";
  if (score >= 65) return "Elevated — Lean Long Gold";
  if (score >= 50) return "Neutral — No Clear Directional Signal";
  if (score >= 35) return "Weak — Lean Short / Reduce Gold";
  return "Risk-Off for Gold — Bearish Bias";
}

export function ScoreGauge({
  score,
  useOptimized,
  onToggle,
  lastFetched,
  dataStatus,
}: {
  score: number;
  useOptimized: boolean;
  onToggle: () => void;
  lastFetched?: string;
  dataStatus?: string;
}) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [isCompact, setIsCompact] = useState(false);
  const prevScore = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => setIsCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const start = prevScore.current;
    const end = score;
    const duration = 1200;
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      setAnimatedScore(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        prevScore.current = end;
      }
    }

    requestAnimationFrame(animate);
  }, [score]);

  const displayScore = Math.round(animatedScore);
  const color = getScoreColor(score);
  const regime = getRegimeLabel(score);
  const tradeSignal = getTradeSignal(score);

  // SVG Arc gauge parameters
  const size = isCompact ? 164 : 200;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  // Arc goes from 135deg to 405deg (270deg sweep)
  const startAngle = 135;
  const endAngle = 405;
  const totalAngle = endAngle - startAngle;
  const scoreAngle = startAngle + (animatedScore / 100) * totalAngle;

  // Convert angles to radians for SVG path
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  function describeArc(cx: number, cy: number, r: number, start: number, end: number) {
    const startRad = toRad(start);
    const endRad = toRad(end);
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  // Background arc (full 270 deg)
  const bgArc = describeArc(center, center, radius, startAngle, endAngle);
  // Value arc
  const valueArc = animatedScore > 0.5
    ? describeArc(center, center, radius, startAngle, scoreAngle)
    : "";

  return (
    <div className="flex flex-col items-center" data-testid="score-gauge">
      {/* SVG Gauge */}
      <div className="relative" style={{ width: size, height: size * 0.72 }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible"
          style={{ marginTop: -size * 0.14 }}
        >
          {/* Label above gauge */}
          <text
            x={center}
            y={center - radius - 8}
            textAnchor="middle"
            style={{
              fontSize: "9px",
              fill: "hsl(210 8% 55%)",
              fontFamily: "'Inter', sans-serif",
              letterSpacing: "0.15em",
              textTransform: "uppercase" as const,
              fontWeight: 500,
            }}
          >
            Gold Safe Haven Score
          </text>
          {/* Zone background bands */}
          <path
            d={describeArc(center, center, radius, startAngle, startAngle + totalAngle * 0.35)}
            stroke="#d15a5a"
            strokeWidth={3}
            fill="none"
            opacity={0.15}
          />
          <path
            d={describeArc(center, center, radius, startAngle + totalAngle * 0.35, startAngle + totalAngle * 0.5)}
            stroke="#c97040"
            strokeWidth={3}
            fill="none"
            opacity={0.15}
          />
          <path
            d={describeArc(center, center, radius, startAngle + totalAngle * 0.5, startAngle + totalAngle * 0.65)}
            stroke="#C49B30"
            strokeWidth={3}
            fill="none"
            opacity={0.15}
          />
          <path
            d={describeArc(center, center, radius, startAngle + totalAngle * 0.65, endAngle)}
            stroke="#5fad46"
            strokeWidth={3}
            fill="none"
            opacity={0.15}
          />

          {/* Background track */}
          <path
            d={bgArc}
            stroke="hsl(210 15% 16%)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />

          {/* Value arc */}
          {valueArc && (
            <path
              d={valueArc}
              stroke={color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
            />
          )}

          {/* Score text */}
          <text
            x={center}
            y={center + 8}
            textAnchor="middle"
            className="font-mono tabular-nums"
            style={{
              fontSize: "48px",
              fontWeight: 700,
              fill: color,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {displayScore}
          </text>
          <text
            x={center}
            y={center + 28}
            textAnchor="middle"
            style={{
              fontSize: "12px",
              fill: "hsl(210 8% 55%)",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            / 100
          </text>
        </svg>
      </div>

      {/* Trade Signal Badge */}
      <div
        className="flex flex-col items-center mt-1"
        data-testid="trade-signal"
      >
        <div
          className="text-xs sm:text-sm font-bold font-mono tracking-wider px-3 sm:px-4 py-1.5 rounded-md"
          style={{
            color: tradeSignal.color,
            backgroundColor: `${tradeSignal.color}18`,
            border: `1.5px solid ${tradeSignal.color}40`,
          }}
        >
          {tradeSignal.label}
        </div>
        <div className="text-[11px] text-[hsl(210_8%_55%)] mt-1.5 text-center px-2">
          {tradeSignal.sublabel}
        </div>
      </div>

      {/* Live timestamp */}
      {lastFetched && (
        <LiveTimestamp lastFetched={lastFetched} dataStatus={dataStatus} />
      )}

      {/* Weight badge */}
      <div className="mt-1.5 text-[10px] text-[hsl(210_8%_45%)]">
        Using {useOptimized ? "Optimized" : "Original"} Weights
      </div>
    </div>
  );
}

/** Compact live timestamp with ticking relative time */
function LiveTimestamp({ lastFetched, dataStatus }: { lastFetched: string; dataStatus?: string }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchedDate = new Date(lastFetched);
  const diffMs = now - fetchedDate.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  let relative: string;
  if (diffSec < 60) relative = `${diffSec}s ago`;
  else if (diffSec < 3600) relative = `${Math.floor(diffSec / 60)}m ${diffSec % 60}s ago`;
  else relative = `${Math.floor(diffSec / 3600)}h ${Math.floor((diffSec % 3600) / 60)}m ago`;

  const timeStr = `${formatGmtPlus1Time(fetchedDate, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })} ${GMT_PLUS_ONE_LABEL}`;

  const isLive = dataStatus === "live";

  return (
    <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-mono tabular-nums text-[hsl(210_8%_50%)]">
      {isLive && (
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      )}
      <span>
        Score as of {timeStr}
      </span>
      <span className="text-[hsl(210_8%_38%)]">·</span>
      <span className="text-[hsl(210_8%_42%)]">{relative}</span>
    </div>
  );
}
