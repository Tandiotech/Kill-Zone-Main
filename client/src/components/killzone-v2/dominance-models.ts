import {
  buildDominanceFromComponents,
  type DominanceResult,
} from "./score-utils";

export type DominanceComponent = {
  name: string;
  score: number;
  weight: number;
  contribution: number;
  factorDetail?: string;
  factorSnapshot?: { label: string; value: string }[];
};

export type DominanceModesInput = {
  macro?: { components?: DominanceComponent[] };
  intraday?: {
    components?: DominanceComponent[];
    window?: string;
    lastSampleAt?: string;
  };
  intraday2h?: {
    components?: DominanceComponent[];
    window?: string;
    lastSampleAt?: string;
  };
  intraday4h?: {
    components?: DominanceComponent[];
    window?: string;
    lastSampleAt?: string;
  };
};

export type DominanceModels = {
  macro: DominanceResult;
  intraday: DominanceResult;
  intraday2h: DominanceResult;
  intraday4h: DominanceResult;
};

export function buildDominanceModels(
  score: number | undefined,
  modes?: DominanceModesInput,
): DominanceModels {
  // Wider dead zone on timing windows so near-50 noise doesn't flip red/green.
  const timingDeadZone = 0.12;
  return {
    macro: buildDominanceFromComponents({
      score,
      components: modes?.macro?.components,
    }),
    intraday: buildDominanceFromComponents({
      score,
      components: modes?.intraday?.components,
      deadZone: timingDeadZone,
    }),
    intraday2h: buildDominanceFromComponents({
      score,
      components: modes?.intraday2h?.components,
      deadZone: timingDeadZone,
    }),
    intraday4h: buildDominanceFromComponents({
      score,
      components: modes?.intraday4h?.components,
      deadZone: timingDeadZone,
    }),
  };
}

export function splitRegimeFlag(macro: DominanceResult, intraday: DominanceResult): boolean {
  const macroBull = macro.bullPct;
  const intraBull = intraday.bullPct;
  const macroStrongBull = macroBull >= 65;
  const macroStrongBear = macroBull <= 35;
  const intraStrongBull = intraBull >= 65;
  const intraStrongBear = intraBull <= 35;
  return (macroStrongBull && intraStrongBear) || (macroStrongBear && intraStrongBull);
}

export function dominanceInterpretation(macro: DominanceResult, intraday: DominanceResult): string {
  const macroBull = macro.bullPct;
  const intraBull = intraday.bullPct;
  const macroStrongBull = macroBull >= 65;
  const macroStrongBear = macroBull <= 35;
  const intraStrongBull = intraBull >= 65;
  const intraStrongBear = intraBull <= 35;

  if (macroStrongBull && intraStrongBull) {
    return "Aligned Bullish: trend and timing are both supportive for long setups.";
  }
  if (macroStrongBear && intraStrongBear) {
    return "Aligned Bearish: trend and timing both favor defensive or short bias.";
  }
  if (macroStrongBull && intraStrongBear) {
    return "Macro Bull, Intraday Pullback: broader uptrend with short-term pressure.";
  }
  if (macroStrongBear && intraStrongBull) {
    return "Macro Bear, Intraday Bounce: broader downtrend with short-term relief rally.";
  }
  return "Mixed / No Edge: wait for clearer alignment between regime and execution.";
}
