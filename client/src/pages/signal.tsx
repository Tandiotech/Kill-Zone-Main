import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Copy, Check, RefreshCw, TrendingUp, TrendingDown, Minus, Clock, Target, Shield, ArrowRight, Zap, ChevronRight } from "lucide-react";
import bakedSignal from "@/data/signal-data.json";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { REACTIVE_REFRESH_MS } from "@/lib/refresh";

interface Reason {
  factor: string;
  status: string;
  impact: "bullish" | "bearish" | "neutral";
  detail: string;
  updatedAgo: string;
}

interface SignalData {
  gold: number;
  score: number;
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  tradeZone: string;
  reasons: Reason[];
  keyLevels: { tp: number; sl: number; pivotHigh: number; pivotLow: number };
  continuation: string;
  basis: { spot: number; futures: number; premium: number; warning: boolean };
  meta: {
    lastFetched: string;
    updatedAgo: string;
    dataStatus: string;
    bullishCount: number;
    bearishCount: number;
    neutralCount: number;
  };
  telegramText: string;
}

const biasConfig = {
  BULLISH: { color: "#4ade80", bg: "#4ade8010", border: "#4ade8025", glow: "#4ade8020", icon: TrendingUp, arrow: "↑" },
  BEARISH: { color: "#ef4444", bg: "#ef444410", border: "#ef444425", glow: "#ef444420", icon: TrendingDown, arrow: "↓" },
  NEUTRAL: { color: "#C49B30", bg: "#C49B3010", border: "#C49B3025", glow: "#C49B3020", icon: Minus, arrow: "→" },
};

const impactIcon = {
  bullish: { icon: "✓", color: "#4ade80", bg: "#4ade8012" },
  bearish: { icon: "✗", color: "#ef4444", bg: "#ef444412" },
  neutral: { icon: "—", color: "#C49B30", bg: "#C49B3012" },
};

export default function SignalPage() {
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());

  const { data: liveData, isLoading, refetch, isFetching } = useQuery<SignalData>({
    queryKey: ["/api/signal"],
    refetchInterval: REACTIVE_REFRESH_MS,
    staleTime: 60 * 1000,
    retry: false,
  });
  const data: SignalData = (liveData ?? bakedSignal) as SignalData;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleCopy = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.telegramText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-[#0F1419] flex items-center justify-center">
        <div className="animate-pulse text-[hsl(210_8%_45%)] font-mono text-sm">Loading signal...</div>
      </div>
    );
  }

  const bc = biasConfig[data.bias];
  const BiasIcon = bc.icon;

  // Time since last update
  const msSince = now - new Date(data.meta.lastFetched).getTime();
  const secSince = Math.floor(msSince / 1000);
  const liveTime = secSince < 60 ? `${secSince}s ago` : `${Math.floor(secSince / 60)}m ${secSince % 60}s ago`;

  return (
    <div className="min-h-screen bg-[#0F1419] text-white">
      {/* Compact header */}
      <header className="flex items-center justify-between gap-2 px-3 sm:px-4 py-3 bg-[hsl(210_22%_10%)] border-b border-[hsl(210_15%_14%)]">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="text-sm font-bold tracking-wide text-[hsl(210_10%_85%)]">
            KILL<span className="text-[#C49B30]">ZONE</span>
          </span>
          <span className="text-[10px] text-[hsl(210_8%_45%)] uppercase tracking-wider truncate">Signal</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-[hsl(210_8%_50%)]">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {liveTime}
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-md hover:bg-[hsl(210_15%_16%)] text-[hsl(210_8%_45%)] hover:text-white transition-colors"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          </button>
          <LogoutButton className="inline-flex items-center gap-1 rounded-md border border-[hsl(210_15%_18%)] bg-[hsl(210_22%_12%)] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(210_8%_55%)] hover:bg-[hsl(210_15%_16%)]" />
        </div>
      </header>

      <main className="max-w-xl mx-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* ═══ HERO: Price + Bias ═══ */}
        <div
          className="rounded-xl border p-5 text-center relative overflow-hidden"
          style={{ backgroundColor: bc.bg, borderColor: bc.border }}
        >
          {/* Glow effect */}
          <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(ellipse at center, ${bc.glow}, transparent 70%)` }} />

          <div className="relative z-10">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[hsl(210_8%_55%)] mb-2">XAUUSD Spot</div>
            <div className="text-3xl sm:text-4xl font-bold font-mono tabular-nums tracking-tight" style={{ color: bc.color }}>
              ${data.gold.toFixed(2)}
            </div>
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border" style={{ borderColor: bc.border, backgroundColor: `${bc.color}10` }}>
              <BiasIcon size={16} style={{ color: bc.color }} />
              <span className="text-sm font-bold font-mono tracking-wider" style={{ color: bc.color }}>
                {data.bias}
              </span>
              <span className="text-xs text-[hsl(210_8%_55%)]">
                {data.score}/100
              </span>
            </div>
          </div>
        </div>

        {/* ═══ TRADE ZONE BANNER ═══ */}
        <div
          className="rounded-lg border px-4 py-3 flex items-center justify-between"
          style={{ backgroundColor: bc.bg, borderColor: bc.border }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Zap size={16} style={{ color: bc.color }} />
            <span className="text-xs sm:text-sm font-bold font-mono tracking-wider truncate" style={{ color: bc.color }}>
              {data.tradeZone}
            </span>
          </div>
          <div className="text-[10px] font-mono text-[hsl(210_8%_50%)]">
            {data.meta.bullishCount}/5 bullish
          </div>
        </div>

        {/* ═══ KEY LEVELS (if directional) ═══ */}
        {data.bias !== "NEUTRAL" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-lg bg-[hsl(210_20%_11%)] border border-[hsl(210_15%_14%)] p-3 text-center">
              <div className="text-[9px] uppercase tracking-wider text-[#4ade80] mb-1 flex items-center justify-center gap-1">
                <Target size={9} /> TP
              </div>
              <div className="text-sm font-bold font-mono text-[#4ade80]">${data.keyLevels.tp.toFixed(0)}</div>
              <div className="text-[9px] text-[hsl(210_8%_40%)]">+300 pips</div>
            </div>
            <div className="rounded-lg bg-[hsl(210_20%_11%)] border border-[hsl(210_15%_14%)] p-3 text-center">
              <div className="text-[9px] uppercase tracking-wider text-[hsl(210_8%_50%)] mb-1">Entry</div>
              <div className="text-sm font-bold font-mono text-[hsl(210_10%_75%)]">${data.gold.toFixed(0)}</div>
              <div className="text-[9px] text-[hsl(210_8%_40%)]">current</div>
            </div>
            <div className="rounded-lg bg-[hsl(210_20%_11%)] border border-[hsl(210_15%_14%)] p-3 text-center">
              <div className="text-[9px] uppercase tracking-wider text-[#ef4444] mb-1 flex items-center justify-center gap-1">
                <Shield size={9} /> SL
              </div>
              <div className="text-sm font-bold font-mono text-[#ef4444]">${data.keyLevels.sl.toFixed(0)}</div>
              <div className="text-[9px] text-[hsl(210_8%_40%)]">-150 pips</div>
            </div>
          </div>
        )}

        {/* ═══ 5 KEY DRIVERS ═══ */}
        <div className="space-y-1.5">
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-[hsl(210_8%_50%)] font-semibold mb-2">
            5 Key Drivers
          </h3>
          {data.reasons.map((reason, i) => {
            const ic = impactIcon[reason.impact];
            return (
              <div
                key={reason.factor}
                className="rounded-lg border border-[hsl(210_15%_14%)] bg-[hsl(210_20%_11%)] px-3 py-2.5 flex items-start gap-3"
              >
                <div
                  className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold mt-0.5"
                  style={{ color: ic.color, backgroundColor: ic.bg }}
                >
                  {ic.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[hsl(210_10%_80%)]">{reason.factor}</span>
                    <span className="text-[9px] font-mono font-bold tracking-wide px-1.5 py-0.5 rounded" style={{ color: ic.color, backgroundColor: ic.bg }}>
                      {reason.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-[hsl(210_8%_50%)] mt-0.5 leading-relaxed">{reason.detail}</p>
                  <div className="text-[9px] text-[hsl(210_8%_35%)] mt-0.5 flex items-center gap-1">
                    <Clock size={8} /> {reason.updatedAgo}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ═══ WHAT NEEDS TO HAPPEN NEXT ═══ */}
        <div className="rounded-lg border border-[hsl(210_15%_14%)] bg-[hsl(210_20%_11%)] p-4">
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-[hsl(210_8%_50%)] font-semibold mb-2 flex items-center gap-1.5">
            <ChevronRight size={12} className="text-[#C49B30]" />
            What Needs to Happen Next
          </h3>
          <p className="text-xs text-[hsl(210_8%_65%)] leading-relaxed">
            {data.continuation}
          </p>
        </div>

        {/* ═══ COPY TO TELEGRAM ═══ */}
        <button
          onClick={handleCopy}
          className="w-full rounded-lg border border-[#20808D40] bg-[#20808D15] hover:bg-[#20808D25] transition-colors px-4 py-3 flex items-center justify-center gap-2"
        >
          {copied ? (
            <>
              <Check size={16} className="text-[#4ade80]" />
              <span className="text-sm font-semibold text-[#4ade80]">Copied to clipboard</span>
            </>
          ) : (
            <>
              <Copy size={16} className="text-[#20808D]" />
              <span className="text-sm font-semibold text-[#20808D]">Copy for Telegram</span>
            </>
          )}
        </button>

        {/* ═══ Basis note ═══ */}
        {data.basis.warning && (
          <div className="text-[10px] text-[#ef4444] text-center bg-[#ef444410] rounded-lg py-2 px-3 border border-[#ef444420]">
            ⚠ Contango warning: futures ${data.basis.premium.toFixed(0)} above spot — consider spot/ETF over futures
          </div>
        )}

        <div className="text-[9px] text-[hsl(210_8%_30%)] text-center pb-4">
          KILLZONE Gold Intelligence · Not financial advice · DYOR
        </div>
      </main>
    </div>
  );
}
