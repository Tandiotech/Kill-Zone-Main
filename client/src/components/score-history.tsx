import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  CartesianGrid,
  Label,
} from "recharts";
import type { MonthlyData } from "@shared/schema";

function computeOptimizedScore(d: MonthlyData): number {
  return (
    d.ryScore * 0.15 +
    d.usdScore * 0.12 +
    d.gprScore * 0.15 +
    d.cbScore * 0.20 +
    d.riskoffScore * 0.15 +
    d.inflationScore * 0.08 +
    d.momentumScore * 0.15
  );
}

export function ScoreHistory({
  data,
  useOptimized,
}: {
  data: MonthlyData[];
  useOptimized: boolean;
}) {
  const chartData = data.map((d) => ({
    date: d.date,
    label: new Date(d.date).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    }),
    score: useOptimized ? computeOptimizedScore(d) : d.goldSafeHavenScore,
    goldPrice: d.goldClose,
  }));

  return (
    <div className="w-full h-72" data-testid="chart-score-history">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#20808D" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#20808D" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(210 15% 16%)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "hsl(210 8% 45%)", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(210 15% 16%)" }}
            interval={Math.floor(chartData.length / 8)}
          />
          <YAxis
            yAxisId="score"
            domain={[0, 100]}
            tick={{ fill: "hsl(210 8% 45%)", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
            tickLine={false}
            axisLine={false}
            width={35}
          />
          <YAxis
            yAxisId="gold"
            orientation="right"
            tick={{ fill: "hsl(210 8% 35%)", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
            tickLine={false}
            axisLine={false}
            width={55}
            tickFormatter={(v: number) => `$${v.toLocaleString()}`}
          />

          {/* BUY zone shading (65-100) */}
          <ReferenceArea
            yAxisId="score"
            y1={65}
            y2={100}
            fill="#5fad46"
            fillOpacity={0.04}
          />
          {/* SELL zone shading (0-35) */}
          <ReferenceArea
            yAxisId="score"
            y1={0}
            y2={35}
            fill="#d15a5a"
            fillOpacity={0.04}
          />
          {/* Zone lines with labels */}
          <ReferenceLine
            yAxisId="score"
            y={65}
            stroke="#5fad46"
            strokeDasharray="6 3"
            strokeOpacity={0.4}
          >
            <Label
              value="BUY ≥ 65"
              position="insideTopLeft"
              offset={4}
              style={{ fill: "#5fad46", fontSize: 9, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}
            />
          </ReferenceLine>
          <ReferenceLine
            yAxisId="score"
            y={35}
            stroke="#d15a5a"
            strokeDasharray="6 3"
            strokeOpacity={0.4}
          >
            <Label
              value="SELL ≤ 35"
              position="insideBottomLeft"
              offset={4}
              style={{ fill: "#d15a5a", fontSize: 9, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}
            />
          </ReferenceLine>

          {/* Score area fill */}
          <Area
            yAxisId="score"
            type="monotone"
            dataKey="score"
            fill="url(#scoreGradient)"
            stroke="none"
          />

          {/* Gold price line */}
          <Line
            yAxisId="gold"
            type="monotone"
            dataKey="goldPrice"
            stroke="#C49B30"
            strokeWidth={1.5}
            dot={false}
            strokeOpacity={0.5}
          />

          {/* Score line */}
          <Line
            yAxisId="score"
            type="monotone"
            dataKey="score"
            stroke="#20808D"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#20808D", stroke: "#0F1419", strokeWidth: 2 }}
          />

          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const scoreVal = payload.find((p) => p.dataKey === "score");
              const goldVal = payload.find((p) => p.dataKey === "goldPrice");
              return (
                <div className="bg-[hsl(210_20%_12%)] border border-[hsl(210_15%_20%)] rounded-lg px-3 py-2 shadow-lg">
                  <div className="text-[10px] text-[hsl(210_8%_55%)] mb-1.5 font-mono">{label}</div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#20808D]" />
                      <span className="text-xs text-[hsl(210_10%_75%)]">Score</span>
                      <span className="text-xs font-mono font-bold text-[#20808D] tabular-nums">
                        {Number(scoreVal?.value || 0).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#C49B30]" />
                      <span className="text-xs text-[hsl(210_10%_75%)]">Gold</span>
                      <span className="text-xs font-mono font-bold text-[#C49B30] tabular-nums">
                        ${Number(goldVal?.value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-[#20808D] rounded" />
          <span className="text-[10px] text-[hsl(210_8%_50%)]">Safe Haven Score</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-[#C49B30] rounded opacity-50" />
          <span className="text-[10px] text-[hsl(210_8%_50%)]">Gold Price (USD)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 border-t border-dashed border-[#5fad46] opacity-50" />
          <span className="text-[10px] text-[hsl(210_8%_50%)]">BUY zone (≥65)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 border-t border-dashed border-[#d15a5a] opacity-50" />
          <span className="text-[10px] text-[hsl(210_8%_50%)]">SELL zone (≤35)</span>
        </div>
      </div>
    </div>
  );
}
