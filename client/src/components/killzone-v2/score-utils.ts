import { formatGmtPlus1DateTime, GMT_PLUS_ONE_LABEL } from "@/lib/timezone";

export function scoreLabel(s: number): string {
  if (s >= 75) return "STRONG CONVICTION";
  if (s >= 65) return "HIGH";
  if (s >= 50) return "NEUTRAL";
  if (s >= 35) return "LOW";
  return "WEAK";
}

export function formatUtcShort(iso: string): string {
  try {
    return `${formatGmtPlus1DateTime(iso, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })} ${GMT_PLUS_ONE_LABEL}`;
  } catch {
    return "—";
  }
}

export function formatNextRefresh(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = Date.now();
    const ms = Math.max(0, d.getTime() - now);
    const m = Math.floor(ms / 60000);
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h > 0) return `${h}h ${mm}m`;
    return `${mm}m`;
  } catch {
    return "—";
  }
}

export type FactorSnapshotItem = { label: string; value: string };

export type DominanceInput = {
  score?: number;
  components?: {
    name: string;
    score: number;
    weight: number;
    contribution?: number;
    factorDetail?: string;
    factorSnapshot?: FactorSnapshotItem[];
  }[];
};

export type DominanceForce = {
  name: string;
  weight: number;
  strong?: boolean;
  factorDetail?: string;
  factorSnapshot?: FactorSnapshotItem[];
};

export type DominanceResult = {
  bullPct: number;
  bearPct: number;
  edge: number;
  leaning: "bull" | "bear" | "neutral";
  magnitude: "Narrow" | "Moderate" | "Decisive";
  bullSum: number;
  bearSum: number;
  bullForces: DominanceForce[];
  bearForces: DominanceForce[];
};

const DEFAULT_BULL_FORCES: DominanceForce[] = [
  { name: "Geopolitical Tension", weight: 28, strong: true },
  { name: "Central Bank Demand", weight: 18 },
  { name: "ETF Flows (WoW)", weight: 9 },
  { name: "Dollar Stagnation", weight: 7 },
];

const DEFAULT_BEAR_FORCES: DominanceForce[] = [
  { name: "Real Yields Rising", weight: 22, strong: true },
  { name: "Risk-On Sentiment", weight: 9 },
  { name: "Inflation Cooling", weight: 5 },
  { name: "Momentum Fading", weight: 2 },
];

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function componentSignedWeight(score: number, baseWeight: number, deadZone = 0.06): number {
  const neutralCentered = (score - 50) / 50; // -1 .. +1
  const adjusted = Math.abs(neutralCentered) < deadZone ? 0 : neutralCentered;
  const scaled = clamp(adjusted * baseWeight, -baseWeight, baseWeight);
  // Clamp extremes per refresh cycle to avoid sharp spikes from one component
  return clamp(scaled, -baseWeight * 0.85, baseWeight * 0.85);
}

function normalizeComponentName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

export function buildDominanceFromComponents(
  input: DominanceInput & { deadZone?: number },
): DominanceResult {
  const deadZone = input.deadZone ?? 0.06;
  const rows = input.components
    ?.filter((c) => Number.isFinite(c?.score) && Number.isFinite(c?.weight))
    .map((c) => {
      const weight = Math.max(0.5, Number(c.weight));
      const signed = componentSignedWeight(Number(c.score), weight, deadZone);
      return {
        name: normalizeComponentName(c.name),
        signed,
        abs: Math.abs(signed),
        factorDetail: c.factorDetail,
        factorSnapshot: c.factorSnapshot,
      };
    })
    .filter((c) => c.abs > 0);

  if (!rows?.length) {
    const fallbackBull = Math.max(0, (input.score ?? 50) - 20);
    const fallbackBear = Math.max(0, 80 - (input.score ?? 50));
    const base = fallbackBull + fallbackBear || 1;
    const bullPct = Math.round((fallbackBull / base) * 100);
    const bearPct = 100 - bullPct;
    const edge = bullPct - bearPct;
    return {
      bullPct,
      bearPct,
      edge,
      leaning: edge > 0 ? "bull" : edge < 0 ? "bear" : "neutral",
      magnitude: Math.abs(edge) < 6 ? "Narrow" : Math.abs(edge) < 18 ? "Moderate" : "Decisive",
      bullSum: fallbackBull,
      bearSum: fallbackBear,
      bullForces: DEFAULT_BULL_FORCES,
      bearForces: DEFAULT_BEAR_FORCES,
    };
  }

  const bullRows = rows.filter((r) => r.signed > 0).sort((a, b) => b.abs - a.abs);
  const bearRows = rows.filter((r) => r.signed < 0).sort((a, b) => b.abs - a.abs);

  const bullSum = bullRows.reduce((sum, r) => sum + r.abs, 0);
  const bearSum = bearRows.reduce((sum, r) => sum + r.abs, 0);
  const total = bullSum + bearSum || 1;

  const bullPct = (bullSum / total) * 100;
  const bearPct = 100 - bullPct;
  const edge = bullPct - bearPct;
  const leaning: "bull" | "bear" | "neutral" = edge > 0 ? "bull" : edge < 0 ? "bear" : "neutral";
  const magnitude: "Narrow" | "Moderate" | "Decisive" =
    Math.abs(edge) < 6 ? "Narrow" : Math.abs(edge) < 18 ? "Moderate" : "Decisive";

  const bullForces = bullRows.slice(0, 4).map((r, i) => ({
    name: r.name,
    weight: Number(r.abs.toFixed(3)),
    strong: i === 0,
    factorDetail: r.factorDetail,
    factorSnapshot: r.factorSnapshot,
  }));
  const bearForces = bearRows.slice(0, 4).map((r, i) => ({
    name: r.name,
    weight: Number(r.abs.toFixed(3)),
    strong: i === 0,
    factorDetail: r.factorDetail,
    factorSnapshot: r.factorSnapshot,
  }));

  return {
    bullPct,
    bearPct,
    edge,
    leaning,
    magnitude,
    bullSum,
    bearSum,
    bullForces: bullForces.length ? bullForces : DEFAULT_BULL_FORCES,
    bearForces: bearForces.length ? bearForces : DEFAULT_BEAR_FORCES,
  };
}
