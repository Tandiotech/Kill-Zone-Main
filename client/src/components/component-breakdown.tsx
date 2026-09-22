import type { ScoreResponse } from "@shared/schema";
import { ORIGINAL_WEIGHTS, OPTIMIZED_WEIGHTS } from "@shared/schema";

function getBarColor(score: number): string {
  if (score >= 65) return "#5fad46";
  if (score >= 50) return "#C49B30";
  if (score >= 35) return "#c97040";
  return "#d15a5a";
}

const COMPONENT_KEYS = [
  { key: "ryScore" as const, name: "Real Yield Direction", wKey: "realYield" as const },
  { key: "usdScore" as const, name: "USD Trend", wKey: "usd" as const },
  { key: "gprScore" as const, name: "GPR Index", wKey: "gpr" as const },
  { key: "cbScore" as const, name: "Central Bank Demand", wKey: "cb" as const },
  { key: "riskoffScore" as const, name: "Risk-Off Score", wKey: "riskoff" as const },
  { key: "inflationScore" as const, name: "Inflation Expectations", wKey: "inflation" as const },
  { key: "momentumScore" as const, name: "Momentum", wKey: "momentum" as const },
];

export function ComponentBreakdown({
  data,
  useOptimized,
}: {
  data: ScoreResponse;
  useOptimized: boolean;
}) {
  const weights = useOptimized ? OPTIMIZED_WEIGHTS : ORIGINAL_WEIGHTS;
  const current = data.current;

  return (
    <div className="space-y-2.5">
      {COMPONENT_KEYS.map(({ key, name, wKey }) => {
        const score = current[key];
        const weight = weights[wKey];
        const contribution = score * weight;
        const color = getBarColor(score);

        return (
          <div key={key} className="group" data-testid={`component-${key}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[hsl(210_8%_55%)] group-hover:text-[hsl(210_10%_75%)] transition-colors">
                {name}
              </span>
              <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                <span className="text-[hsl(210_8%_45%)]">
                  {(weight * 100).toFixed(0)}%
                </span>
                <span
                  className="font-semibold min-w-[28px] text-right"
                  style={{ color }}
                >
                  {score.toFixed(0)}
                </span>
                <span className="text-[hsl(210_8%_40%)] min-w-[32px] text-right">
                  +{contribution.toFixed(1)}
                </span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="relative h-2 rounded-full bg-[hsl(210_15%_16%)] overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${Math.max(score, 1)}%`,
                  backgroundColor: color,
                  opacity: 0.85,
                }}
              />
            </div>
          </div>
        );
      })}

      {/* Total row */}
      <div className="flex items-center justify-between pt-2 mt-2 border-t border-[hsl(210_15%_16%)]">
        <span className="text-xs font-semibold text-[hsl(210_10%_75%)]">
          Composite Score
        </span>
        <span
          className="text-sm font-bold font-mono tabular-nums"
          style={{ color: getBarColor(computeTotal(current, weights)) }}
          data-testid="text-composite-score"
        >
          {computeTotal(current, weights).toFixed(1)}
        </span>
      </div>
    </div>
  );
}

function computeTotal(
  current: ScoreResponse["current"],
  weights: typeof ORIGINAL_WEIGHTS | typeof OPTIMIZED_WEIGHTS,
): number {
  return (
    current.ryScore * weights.realYield +
    current.usdScore * weights.usd +
    current.gprScore * weights.gpr +
    current.cbScore * weights.cb +
    current.riskoffScore * weights.riskoff +
    current.inflationScore * weights.inflation +
    current.momentumScore * weights.momentum
  );
}
