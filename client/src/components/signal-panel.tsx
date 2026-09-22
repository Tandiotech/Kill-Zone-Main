import type { ScoreResponse } from "@shared/schema";

function getRegimeLabel(score: number): string {
  if (score >= 75) return "Strong Safe Haven — Gold Bullish Bias";
  if (score >= 65) return "Elevated — Lean Long Gold";
  if (score >= 50) return "Neutral — No Clear Directional Signal";
  if (score >= 35) return "Weak — Lean Short / Reduce Gold Exposure";
  return "Risk-Off for Gold — Gold Bearish Bias";
}

function getRegimeColor(score: number): string {
  if (score >= 65) return "#5fad46";
  if (score >= 50) return "#C49B30";
  if (score >= 35) return "#c97040";
  return "#d15a5a";
}

function getSignalDetails(data: ScoreResponse) {
  const c = data.current;
  const signals: { label: string; value: string; status: "bullish" | "bearish" | "neutral" }[] = [];

  // Gold direction
  if (data.compositeScore >= 65) {
    signals.push({ label: "Gold Bias", value: "Bullish", status: "bullish" });
  } else if (data.compositeScore >= 50) {
    signals.push({ label: "Gold Bias", value: "Neutral", status: "neutral" });
  } else {
    signals.push({ label: "Gold Bias", value: "Bearish", status: "bearish" });
  }

  // USD
  if (c.usdScore >= 60) {
    signals.push({ label: "USD", value: "Weak (Gold+)", status: "bullish" });
  } else if (c.usdScore <= 40) {
    signals.push({ label: "USD", value: "Strong (Gold–)", status: "bearish" });
  } else {
    signals.push({ label: "USD", value: "Mixed", status: "neutral" });
  }

  // VIX / Risk
  if (c.riskoffScore >= 65) {
    signals.push({ label: "Volatility", value: "Elevated", status: "bullish" });
  } else if (c.riskoffScore <= 35) {
    signals.push({ label: "Volatility", value: "Low", status: "bearish" });
  } else {
    signals.push({ label: "Volatility", value: "Moderate", status: "neutral" });
  }

  // Real Yields
  if (c.ryScore >= 60) {
    signals.push({ label: "Real Yields", value: "Falling (Gold+)", status: "bullish" });
  } else if (c.ryScore <= 40) {
    signals.push({ label: "Real Yields", value: "Rising (Gold–)", status: "bearish" });
  } else {
    signals.push({ label: "Real Yields", value: "Stable", status: "neutral" });
  }

  return signals;
}

const statusColors = {
  bullish: { bg: "#5fad4618", text: "#5fad46", border: "#5fad4630" },
  bearish: { bg: "#d15a5a18", text: "#d15a5a", border: "#d15a5a30" },
  neutral: { bg: "#C49B3018", text: "#C49B30", border: "#C49B3030" },
};

export function SignalPanel({
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

  const regime = getRegimeLabel(score);
  const color = getRegimeColor(score);
  const signals = getSignalDetails(data);

  return (
    <div className="space-y-4">
      {/* Regime classification */}
      <div
        className="rounded-lg px-4 py-3 border"
        style={{
          backgroundColor: `${color}10`,
          borderColor: `${color}25`,
        }}
      >
        <div className="text-[10px] uppercase tracking-wider text-[hsl(210_8%_50%)] mb-1">
          Regime Classification
        </div>
        <div className="text-sm font-semibold" style={{ color }} data-testid="text-regime-label">
          {regime}
        </div>
      </div>

      {/* Signal matrix */}
      <div className="grid grid-cols-2 gap-2">
        {signals.map((s) => {
          const colors = statusColors[s.status];
          return (
            <div
              key={s.label}
              className="rounded-md px-3 py-2 border"
              style={{
                backgroundColor: colors.bg,
                borderColor: colors.border,
              }}
              data-testid={`signal-${s.label.toLowerCase().replace(/\s/g, "-")}`}
            >
              <div className="text-[10px] text-[hsl(210_8%_50%)] uppercase tracking-wider">
                {s.label}
              </div>
              <div className="text-xs font-semibold mt-0.5" style={{ color: colors.text }}>
                {s.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Buy / Sell Score Zones */}
      <div className="bg-[hsl(210_18%_13%)] rounded-lg p-3 border border-[hsl(210_15%_16%)]">
        <div className="text-[10px] uppercase tracking-wider text-[hsl(210_8%_50%)] mb-2.5">
          Trade Signal Zones
        </div>
        <div className="space-y-1.5">
          {[
            { range: "75 – 100", label: "STRONG BUY", color: "#4ade80", desc: "High-conviction long gold" },
            { range: "65 – 74", label: "BUY", color: "#5fad46", desc: "Lean long gold exposure" },
            { range: "50 – 64", label: "HOLD", color: "#C49B30", desc: "Neutral — wait for confirmation" },
            { range: "35 – 49", label: "REDUCE", color: "#c97040", desc: "Trim gold positions" },
            { range: "20 – 34", label: "SELL", color: "#d15a5a", desc: "Exit gold exposure" },
            { range: "0 – 19", label: "STRONG SELL", color: "#ef4444", desc: "Max bearish — risk-off" },
          ].map((zone) => {
            const isActive = 
              (zone.label === "STRONG BUY" && score >= 75) ||
              (zone.label === "BUY" && score >= 65 && score < 75) ||
              (zone.label === "HOLD" && score >= 50 && score < 65) ||
              (zone.label === "REDUCE" && score >= 35 && score < 50) ||
              (zone.label === "SELL" && score >= 20 && score < 35) ||
              (zone.label === "STRONG SELL" && score < 20);
            return (
              <div
                key={zone.label}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-[11px] transition-all ${
                  isActive
                    ? "border"
                    : "opacity-50"
                }`}
                style={isActive ? {
                  backgroundColor: `${zone.color}12`,
                  borderColor: `${zone.color}35`,
                } : {}}
              >
                <span
                  className="font-mono font-bold text-[10px] w-[52px] shrink-0 tabular-nums"
                  style={{ color: zone.color }}
                >
                  {zone.range}
                </span>
                <span
                  className="font-bold font-mono text-[10px] w-[80px] shrink-0 tracking-wide"
                  style={{ color: zone.color }}
                >
                  {zone.label}
                </span>
                <span className="text-[hsl(210_8%_50%)] text-[10px]">{zone.desc}</span>
                {isActive && (
                  <span className="ml-auto text-[10px] font-mono" style={{ color: zone.color }}>◀ Current</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Practical guidance */}
      <div className="bg-[hsl(210_18%_13%)] rounded-lg p-3 border border-[hsl(210_15%_16%)]">
        <div className="text-[10px] uppercase tracking-wider text-[hsl(210_8%_50%)] mb-2">
          Practical Guidance
        </div>
        <ul className="space-y-1.5 text-xs text-[hsl(210_8%_60%)]">
          <li className="flex items-start gap-2">
            <span className="text-[#5fad46] mt-0.5">●</span>
            <span>BUY when Score &gt; 65, USD weakening, real yields falling</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#d15a5a] mt-0.5">●</span>
            <span>SELL when Score &lt; 35, USD strengthening, VIX low</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#C49B30] mt-0.5">●</span>
            <span>HOLD zone (35-65): wait for multiple components to align</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#4ade80] mt-0.5">●</span>
            <span>Score &gt; 70 produced +3.50% avg monthly returns in back-test</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
