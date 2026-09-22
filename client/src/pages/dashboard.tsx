import { useQuery } from "@tanstack/react-query";
import type { ScoreResponse, HistoryResponse } from "@shared/schema";
import { ScoreGauge } from "@/components/score-gauge";
import { ComponentBreakdown } from "@/components/component-breakdown";
import { ScoreHistory } from "@/components/score-history";
import { UnderlyingData } from "@/components/underlying-data";
import { SignalPanel } from "@/components/signal-panel";
import { DashboardSidebar } from "@/components/sidebar";
import { LiveStatusBar } from "@/components/live-status-bar";
import { ScoreLog } from "@/components/score-log";
import { SignalDrivers } from "@/components/signal-drivers";
import { BasisTracker } from "@/components/basis-tracker";
import { REACTIVE_REFRESH_MS } from "@/lib/refresh";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [useOptimized, setUseOptimized] = useState(false);

  const { data: scoreData, isLoading: scoreLoading } = useQuery<ScoreResponse>({
    queryKey: ["/api/score"],
    refetchInterval: REACTIVE_REFRESH_MS, // High-reactivity polling cadence
    staleTime: 5 * 60 * 1000,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<HistoryResponse>({
    queryKey: ["/api/history"],
  });

  return (
    <div className="min-h-dvh w-full grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
      {/* Mobile header with hamburger */}
      <div className="md:hidden flex items-center justify-between gap-3 px-3 py-3 bg-[hsl(210_22%_10%)] border-b border-[hsl(210_15%_14%)]">
        <div className="flex items-center gap-2 min-w-0">
          <KillzoneLogo size={24} />
          <span className="text-xs sm:text-sm font-semibold text-[hsl(210_10%_85%)] truncate">
            KILLZONE <span className="text-[#C49B30]">Gold</span> Intelligence
          </span>
          {/* Compact live dot for mobile */}
          {scoreData?.dataStatus === "live" && (
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Live data" />
          )}
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-md hover:bg-[hsl(210_15%_16%)]"
          data-testid="button-hamburger"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={`
        ${sidebarOpen ? 'block' : 'hidden'} md:block
        md:row-span-2 bg-[hsl(210_22%_10%)] border-r border-[hsl(210_15%_14%)]
        overflow-y-auto overscroll-contain md:overflow-y-visible
        ${sidebarOpen ? 'fixed inset-0 z-50 md:relative md:z-auto' : ''}
      `}>
        <DashboardSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Desktop Header */}
      <header className="hidden md:flex items-center justify-between gap-4 px-4 lg:px-6 py-3 bg-[hsl(210_22%_10%)] border-b border-[hsl(210_15%_14%)]">
        <h1 className="text-xs lg:text-sm font-semibold tracking-wide text-[hsl(210_10%_85%)] whitespace-nowrap">
          KILLZONE <span className="text-[#C49B30]">Gold</span> Intelligence Dashboard
        </h1>
        <LiveStatusBar scoreData={scoreData} />
      </header>

      {/* Main content */}
      <main className="min-w-0 p-3 sm:p-4 md:p-6 space-y-4 md:space-y-5" id="main-content">
        {/* Hero: Score Gauge (left) + Signal Drivers (right) */}
        <section id="score-section" className="grid grid-cols-1 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] gap-4 md:gap-5">
          <div className="flex flex-col items-center justify-center bg-[hsl(210_20%_11%)] border border-[hsl(210_15%_14%)] rounded-lg p-4 sm:p-6">
            {scoreLoading || !scoreData ? (
              <ScoreGaugeSkeleton />
            ) : (
              <ScoreGauge
                score={computeScore(scoreData, useOptimized)}
                useOptimized={useOptimized}
                onToggle={() => setUseOptimized(!useOptimized)}
                lastFetched={scoreData.lastFetched}
                dataStatus={scoreData.dataStatus}
              />
            )}
          </div>

          {/* Signal Drivers — Why Buy/Sell */}
          <div className="bg-[hsl(210_20%_11%)] border border-[hsl(210_15%_14%)] rounded-lg p-4 sm:p-5" id="drivers-section">
            <h2 className="text-sm font-semibold text-[hsl(210_10%_75%)] uppercase tracking-wider mb-4">
              Signal Drivers
            </h2>
            {scoreLoading || !scoreData ? (
              <DataSkeleton />
            ) : (
              <SignalDrivers data={scoreData} useOptimized={useOptimized} />
            )}
          </div>
        </section>

        {/* Signal Interpretation */}
        <section className="bg-[hsl(210_20%_11%)] border border-[hsl(210_15%_14%)] rounded-lg p-4 sm:p-5" id="about-section">
          <h2 className="text-sm font-semibold text-[hsl(210_10%_75%)] uppercase tracking-wider mb-4">
            Signal Interpretation
          </h2>
          {scoreLoading || !scoreData ? (
            <DataSkeleton />
          ) : (
            <SignalPanel data={scoreData} useOptimized={useOptimized} />
          )}
        </section>

        {/* Component Breakdown */}
        <section className="bg-[hsl(210_20%_11%)] border border-[hsl(210_15%_14%)] rounded-lg p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-semibold text-[hsl(210_10%_75%)] uppercase tracking-wider" id="components-section">
              Component Breakdown
            </h2>
            <WeightToggle active={useOptimized} onToggle={() => setUseOptimized(!useOptimized)} />
          </div>
          {scoreLoading || !scoreData ? (
            <ComponentsSkeleton />
          ) : (
            <ComponentBreakdown data={scoreData} useOptimized={useOptimized} />
          )}
        </section>

        {/* Live Score Log */}
        <section className="bg-[hsl(210_20%_11%)] border border-[hsl(210_15%_14%)] rounded-lg p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-[hsl(210_10%_75%)] uppercase tracking-wider mb-4" id="log-section">
            Live Score Log
          </h2>
          <ScoreLog />
        </section>

        {/* Score History */}
        <section id="history-section" className="bg-[hsl(210_20%_11%)] border border-[hsl(210_15%_14%)] rounded-lg p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-[hsl(210_10%_75%)] uppercase tracking-wider mb-4">
            Score History — 2015 to 2025
          </h2>
          {historyLoading || !historyData ? (
            <ChartSkeleton />
          ) : (
            <ScoreHistory data={historyData.data} useOptimized={useOptimized} />
          )}
        </section>

        {/* Underlying Data + Basis Tracker */}
        <section className="bg-[hsl(210_20%_11%)] border border-[hsl(210_15%_14%)] rounded-lg p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-[hsl(210_10%_75%)] uppercase tracking-wider mb-4" id="data-section">
            Underlying Data
          </h2>
          {scoreLoading || !scoreData ? (
            <DataSkeleton />
          ) : (
            <div className="space-y-4">
              <UnderlyingData data={scoreData.current} />
              <BasisTracker data={(scoreData as any).basisData} />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// Compute score with optional optimized weights
function computeScore(data: ScoreResponse, useOptimized: boolean): number {
  if (!useOptimized) return data.compositeScore;
  const c = data.current;
  return (
    c.ryScore * 0.15 +
    c.usdScore * 0.12 +
    c.gprScore * 0.15 +
    c.cbScore * 0.20 +
    c.riskoffScore * 0.15 +
    c.inflationScore * 0.08 +
    c.momentumScore * 0.15
  );
}

function WeightToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
        ${active
          ? "bg-[#C49B30]/20 text-[#C49B30] border border-[#C49B30]/30"
          : "bg-[hsl(210_15%_16%)] text-[hsl(210_8%_55%)] border border-[hsl(210_15%_20%)] hover:text-[hsl(210_10%_75%)]"
        }
      `}
      data-testid="button-weight-toggle"
    >
      <div className={`w-7 h-4 rounded-full relative transition-colors ${active ? "bg-[#C49B30]" : "bg-[hsl(210_12%_25%)]"}`}>
        <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${active ? "translate-x-3.5" : "translate-x-0.5"}`} />
      </div>
      {active ? "Optimized" : "Original"}
    </button>
  );
}

// Skeleton loaders
function ScoreGaugeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="w-48 h-48 rounded-full bg-[hsl(210_15%_16%)] skeleton-pulse" />
      <div className="w-32 h-4 rounded bg-[hsl(210_15%_16%)] skeleton-pulse" />
      <div className="w-48 h-3 rounded bg-[hsl(210_15%_16%)] skeleton-pulse" />
    </div>
  );
}

function ComponentsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-32 h-3 rounded bg-[hsl(210_15%_16%)] skeleton-pulse" />
          <div className="flex-1 h-5 rounded bg-[hsl(210_15%_16%)] skeleton-pulse" />
          <div className="w-10 h-3 rounded bg-[hsl(210_15%_16%)] skeleton-pulse" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return <div className="w-full h-64 rounded bg-[hsl(210_15%_16%)] skeleton-pulse" />;
}

function DataSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-16 rounded bg-[hsl(210_15%_16%)] skeleton-pulse" />
      ))}
    </div>
  );
}

export function KillzoneLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-label="Killzone Logo"
      className="inline-block"
    >
      {/* Crosshair outer ring */}
      <circle cx="16" cy="16" r="13" stroke="#C49B30" strokeWidth="1.5" fill="none" />
      {/* Crosshair lines */}
      <line x1="16" y1="2" x2="16" y2="10" stroke="#C49B30" strokeWidth="1.5" />
      <line x1="16" y1="22" x2="16" y2="30" stroke="#C49B30" strokeWidth="1.5" />
      <line x1="2" y1="16" x2="10" y2="16" stroke="#C49B30" strokeWidth="1.5" />
      <line x1="22" y1="16" x2="30" y2="16" stroke="#C49B30" strokeWidth="1.5" />
      {/* Inner diamond target */}
      <path
        d="M16 10 L22 16 L16 22 L10 16 Z"
        stroke="#C49B30"
        strokeWidth="1"
        fill="#C49B3020"
      />
      {/* Center dot */}
      <circle cx="16" cy="16" r="2.5" fill="#20808D" />
    </svg>
  );
}
