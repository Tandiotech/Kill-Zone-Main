export interface SignalData {
  gold: number;
  score: number;
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  tradeZone: string;
  reasons: { factor: string; status: string; impact: string; detail: string; updatedAgo: string }[];
  continuation: string;
  basis: { spot: number; futures: number; premium: number; warning: boolean };
  meta: {
    lastFetched: string;
    updatedAgo: string;
    bullishCount: number;
    bearishCount: number;
    neutralCount: number;
  };
}
