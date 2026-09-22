import { AlertTriangle, TrendingUp, ArrowUpDown } from "lucide-react";

interface BasisData {
  spot: number;
  futures: number;
  basis: number;
  basisPct: number;
  contangoWarning: boolean;
  spotSource: string;
  futuresSource: string;
}

export function BasisTracker({ data }: { data: BasisData | undefined }) {
  if (!data || data.spot === 0) return null;

  const { spot, futures, basis, basisPct, contangoWarning, spotSource, futuresSource } = data;

  const basisColor = contangoWarning
    ? "#ef4444"
    : basis > 30
    ? "#c97040"
    : basis > 0
    ? "#C49B30"
    : "#5fad46";

  const basisBg = contangoWarning ? "#ef444412" : "#C49B3010";
  const basisBorder = contangoWarning ? "#ef444430" : "#C49B3025";

  // Visual bar showing the basis as proportion of spot
  const maxBasisForBar = 80; // $80 = full bar
  const barWidth = Math.min(100, (Math.abs(basis) / maxBasisForBar) * 100);

  return (
    <div
      className="rounded-lg border p-4"
      style={{ backgroundColor: basisBg, borderColor: basisBorder }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ArrowUpDown size={14} className="text-[#C49B30]" />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(210_10%_70%)]">
            Spot–Futures Basis
          </h3>
        </div>
        {contangoWarning && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded border border-red-500/30 bg-red-500/10">
            <AlertTriangle size={11} className="text-red-400" />
            <span className="text-[9px] font-bold font-mono tracking-wider text-red-400">
              CONTANGO WARNING
            </span>
          </div>
        )}
      </div>

      {/* Price comparison row */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        {/* Spot */}
        <div>
          <div className="text-[9px] uppercase tracking-wider text-[hsl(210_8%_45%)] mb-0.5">
            XAU/USD Spot
          </div>
          <div className="text-sm font-bold font-mono tabular-nums text-[#C49B30]">
            ${spot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[9px] font-mono text-[hsl(210_8%_38%)]">
            {spotSource}
          </div>
        </div>

        {/* Futures */}
        <div>
          <div className="text-[9px] uppercase tracking-wider text-[hsl(210_8%_45%)] mb-0.5">
            GC=F Futures
          </div>
          <div className="text-sm font-bold font-mono tabular-nums text-[hsl(210_10%_70%)]">
            ${futures.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[9px] font-mono text-[hsl(210_8%_38%)]">
            {futuresSource}
          </div>
        </div>

        {/* Basis */}
        <div>
          <div className="text-[9px] uppercase tracking-wider text-[hsl(210_8%_45%)] mb-0.5">
            Basis (Premium)
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-sm font-bold font-mono tabular-nums"
              style={{ color: basisColor }}
            >
              {basis >= 0 ? "+" : ""}${basis.toFixed(2)}
            </span>
            <span
              className="text-[10px] font-mono tabular-nums"
              style={{ color: basisColor, opacity: 0.7 }}
            >
              ({basisPct >= 0 ? "+" : ""}{basisPct.toFixed(2)}%)
            </span>
          </div>
          <div className="text-[9px] font-mono text-[hsl(210_8%_38%)]">
            {contangoWarning ? "Elevated contango" : basis > 30 ? "Normal contango" : basis > 0 ? "Tight contango" : "Backwardation"}
          </div>
        </div>
      </div>

      {/* Basis bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-[9px] font-mono text-[hsl(210_8%_40%)] mb-1">
          <span>$0</span>
          <span>$50 warning</span>
          <span>$80+</span>
        </div>
        <div className="h-2 rounded-full bg-[hsl(210_15%_14%)] overflow-hidden relative">
          {/* Warning threshold line */}
          <div
            className="absolute top-0 bottom-0 w-px bg-red-500/50"
            style={{ left: `${(50 / maxBasisForBar) * 100}%` }}
          />
          {/* Basis bar */}
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${barWidth}%`,
              backgroundColor: basisColor,
            }}
          />
        </div>
      </div>

      {/* Interpretation */}
      <div className="text-[10px] text-[hsl(210_8%_48%)] leading-relaxed">
        {contangoWarning ? (
          <span className="text-red-400">
            Futures premium exceeds $50 — elevated contango signals strong carry cost for long futures positions.
            Consider spot/ETF over futures, or wait for basis to normalise before rolling contracts.
          </span>
        ) : basis > 30 ? (
          <span>
            Moderate contango — futures trading ${basis.toFixed(0)} above spot.
            Normal for gold but worth monitoring if widening. Carry cost for futures longs is noticeable.
          </span>
        ) : basis > 0 ? (
          <span>
            Tight contango — minimal premium between spot and futures. Basis is within normal range.
            Low carry cost for futures positions.
          </span>
        ) : (
          <span className="text-emerald-400">
            Backwardation — spot trading above futures. Unusual for gold and typically signals
            acute physical demand or supply squeeze. Historically bullish.
          </span>
        )}
      </div>
    </div>
  );
}
