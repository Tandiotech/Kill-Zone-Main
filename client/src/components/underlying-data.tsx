import type { MonthlyData } from "@shared/schema";
import { TrendingDown, TrendingUp, DollarSign, Shield, Activity, Flame } from "lucide-react";

const dataCards = [
  {
    key: "goldClose" as const,
    label: "XAU/USD Spot",
    icon: DollarSign,
    format: (v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    color: "#C49B30",
  },
  {
    key: "vix" as const,
    label: "VIX Level",
    icon: Activity,
    format: (v: number) => v.toFixed(2),
    color: "#d15a5a",
  },
  {
    key: "realYield" as const,
    label: "10Y Real Yield",
    icon: TrendingDown,
    format: (v: number) => `${v.toFixed(2)}%`,
    color: "#20808D",
  },
  {
    key: "usdBroad" as const,
    label: "USD Index",
    icon: TrendingUp,
    format: (v: number) => v.toFixed(2),
    color: "#7a8a95",
  },
  {
    key: "gpr" as const,
    label: "GPR Index",
    icon: Shield,
    format: (v: number) => v.toFixed(1),
    color: "#c97040",
  },
  {
    key: "breakeven" as const,
    label: "10Y Breakeven",
    icon: Flame,
    format: (v: number) => `${v.toFixed(2)}%`,
    color: "#C49B30",
  },
];

export function UnderlyingData({ data }: { data: MonthlyData }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {dataCards.map(({ key, label, icon: Icon, format, color }) => (
        <div
          key={key}
          className="bg-[hsl(210_18%_13%)] rounded-lg p-3 border border-[hsl(210_15%_16%)]"
          data-testid={`data-card-${key}`}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Icon size={12} style={{ color }} className="shrink-0" />
            <span className="text-[10px] text-[hsl(210_8%_50%)] uppercase tracking-wider truncate">
              {label}
            </span>
          </div>
          <div
            className="text-base font-mono font-bold tabular-nums"
            style={{ color }}
          >
            {format(data[key])}
          </div>
        </div>
      ))}
    </div>
  );
}
