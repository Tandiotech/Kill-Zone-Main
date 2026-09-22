import { useState, useEffect } from "react";
import type { ScoreResponse } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { RefreshCw, Wifi, WifiOff, Clock, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  scoreData: ScoreResponse | undefined;
}

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

function getCountdown(nextRefresh: string): string {
  const diff = new Date(nextRefresh).getTime() - Date.now();
  if (diff <= 0) return "Refreshing...";
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

const statusConfig = {
  live: {
    color: "#4ade80",
    bgColor: "#4ade8015",
    borderColor: "#4ade8030",
    label: "LIVE",
    Icon: Wifi,
  },
  stale: {
    color: "#C49B30",
    bgColor: "#C49B3015",
    borderColor: "#C49B3030",
    label: "STALE",
    Icon: AlertCircle,
  },
  error: {
    color: "#d15a5a",
    bgColor: "#d15a5a15",
    borderColor: "#d15a5a30",
    label: "OFFLINE",
    Icon: WifiOff,
  },
  historical: {
    color: "#6b7280",
    bgColor: "#6b728015",
    borderColor: "#6b728030",
    label: "HISTORICAL",
    Icon: Clock,
  },
  loading: {
    color: "#6b7280",
    bgColor: "#6b728015",
    borderColor: "#6b728030",
    label: "LOADING",
    Icon: RefreshCw,
  },
};

export function LiveStatusBar({ scoreData }: Props) {
  const [now, setNow] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Tick every second for live countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const status = scoreData?.dataStatus ?? "loading";
  const config = statusConfig[status] || statusConfig.loading;
  const { Icon } = config;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await apiRequest("POST", "/api/refresh");
      // Force refetch of score data
      window.location.reload();
    } catch {
      // ignore
    } finally {
      setIsRefreshing(false);
    }
  };

  // Source indicators
  const sources = scoreData?.sources;

  return (
    <div className="flex items-center gap-2 lg:gap-3 flex-wrap justify-end">
      {/* Source pills */}
      {sources && (
        <div className="hidden lg:flex items-center gap-1.5">
          <SourcePill label="FRED" active={sources.fred} />
          <SourcePill label="Yahoo" active={sources.yahoo} />
          <SourcePill label="GPR" active={sources.gpr} />
        </div>
      )}

      {/* Divider */}
      {sources && <div className="hidden lg:block w-px h-4 bg-[hsl(210_15%_20%)]" />}

      {/* Last fetched */}
      {scoreData?.lastFetched && (
        <span className="text-[11px] font-mono tabular-nums text-[hsl(210_8%_50%)]">
          {formatTimeAgo(scoreData.lastFetched)}
        </span>
      )}

      {/* Next refresh countdown */}
      {scoreData?.nextRefresh && status === "live" && (
        <span className="hidden xl:inline text-[11px] font-mono tabular-nums text-[hsl(210_8%_40%)]">
          next: {getCountdown(scoreData.nextRefresh)}
        </span>
      )}

      {/* Status badge */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[10px] font-bold font-mono tracking-widest"
        style={{
          color: config.color,
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
        }}
      >
        {status === "live" ? (
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: config.color }}
          />
        ) : (
          <Icon size={10} />
        )}
        {config.label}
      </div>

      {/* Manual refresh button */}
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="p-2 rounded-md hover:bg-[hsl(210_15%_16%)] text-[hsl(210_8%_45%)] hover:text-[hsl(210_10%_70%)] transition-colors disabled:opacity-50"
        title="Refresh data now"
      >
        <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
      </button>
    </div>
  );
}

function SourcePill({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className="text-[9px] font-mono font-semibold tracking-wider px-1.5 py-0.5 rounded border"
      style={{
        color: active ? "#4ade80" : "#d15a5a80",
        backgroundColor: active ? "#4ade8010" : "transparent",
        borderColor: active ? "#4ade8025" : "#d15a5a20",
      }}
    >
      {active ? <CheckCircle2 size={8} className="inline mr-0.5 -mt-px" /> : null}
      {label}
    </span>
  );
}
