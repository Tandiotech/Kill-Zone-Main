/**
 * Human-readable factor copy derived from the same live inputs as /api/score.
 * Keeps Battlefield "Supporting / Opposing" rows tied to observable market data, not generic score language.
 */

import type { MonthlyData } from "@shared/schema";
import type { LiveScoreData } from "./live-data";

export type ScoreComponentRow = {
  name: string;
  score: number;
  weight: number;
  contribution: number;
};

/** Key numbers behind each factor row (shown under Battlefield chips). */
export type FactorSnapshotRow = { label: string; value: string };

type MacroSlice = Pick<
  MonthlyData,
  | "realYield"
  | "vix"
  | "breakeven"
  | "hySpread"
  | "usdBroad"
  | "gpr"
  | "goldClose"
  | "ryScore"
  | "usdScore"
  | "gprScore"
  | "cbScore"
  | "riskoffScore"
  | "inflationScore"
  | "momentumScore"
>;

function signedPct(x: number, digits = 2): string {
  const s = x >= 0 ? "+" : "−";
  return `${s}${Math.abs(x).toFixed(digits)}%`;
}

function macroFromLive(live: LiveScoreData): MacroSlice {
  return {
    realYield: live.realYield,
    vix: live.vix,
    breakeven: live.breakeven,
    hySpread: live.hySpread,
    usdBroad: live.usdBroad,
    gpr: live.gpr,
    goldClose: live.goldClose,
    ryScore: live.ryScore,
    usdScore: live.usdScore,
    gprScore: live.gprScore,
    cbScore: live.cbScore,
    riskoffScore: live.riskoffScore,
    inflationScore: live.inflationScore,
    momentumScore: live.momentumScore,
  };
}

function stanceFromScore(score: number, bullAbove = 55, bearBelow = 45): "supportive" | "headwind" | "mixed" {
  if (score >= bullAbove) return "supportive";
  if (score <= bearBelow) return "headwind";
  return "mixed";
}

function narrativeRealYieldDirection(m: MacroSlice, live?: LiveScoreData): string {
  const st = stanceFromScore(m.ryScore);
  if (live?.factorContext != null) {
    const d = live.factorContext.realYieldDailyChange;
    const move =
      Math.abs(d) < 0.0001
        ? "Barely budged vs the prior update."
        : d < 0
          ? `Just moved ${signedPct(d)} (down)—right now that usually eases competition from yield-paying assets vs gold.`
          : `Just moved ${signedPct(d)} (up)—right now that usually tightens competition vs gold.`;
    return `Live yields: real (after-inflation) 10Y is ${m.realYield.toFixed(2)}%. ${move} Model read ${m.ryScore.toFixed(1)}/100 → ${st} for gold (25% of the score).`;
  }
  return `Live yields: real (after-inflation) 10Y is ${m.realYield.toFixed(2)}%. Latest refresh doesn’t include a step change yet—score ${m.ryScore.toFixed(1)}/100 → ${st}. Next data pull may show the day’s move.`;
}

function narrativeUsdTrend(m: MacroSlice, live?: LiveScoreData): string {
  const st = stanceFromScore(m.usdScore);
  if (live?.factorContext != null) {
    const mom = live.factorContext.usdMomPct;
    const mag = Math.abs(mom);
    let liveImpact: string;
    if (mag < 0.01) {
      liveImpact =
        "The dollar barely moved vs the last reading—FX is quiet, so not much fresh pressure or lift from this input right now.";
    } else if (mom > 0) {
      liveImpact = `The dollar strengthened ${signedPct(mom)} vs the last print (${m.usdBroad.toFixed(2)} on the broad index). A firmer dollar often makes each ounce of gold more expensive in currency terms, which can cap bids in the very short run.`;
    } else {
      liveImpact = `The dollar weakened ${signedPct(mom)} vs the last print (${m.usdBroad.toFixed(2)} on the broad index). A softer dollar often helps gold find buyers because each ounce costs fewer dollars.`;
    }
    return `Right now: ${liveImpact} Model read ${m.usdScore.toFixed(1)}/100 → ${st} (20% of the score).`;
  }
  return `Broad dollar index level ${m.usdBroad.toFixed(2)}—no intraday step vs prior in this payload, so focus on the level and score. ${m.usdScore.toFixed(1)}/100 → ${st}. Refresh soon for a live up/down read.`;
}

function narrativeGpr(m: MacroSlice): string {
  const st = stanceFromScore(m.gprScore, 58, 42);
  return `Geopolitical risk: a research index that measures how much global tension shows up in news and data. Higher readings → more “world stress” in the signal (people often reach for hedges like gold). Calmer periods lower it. Raw level ${m.gpr.toFixed(2)}; 13% of the mix; score ${m.gprScore.toFixed(1)}/100 → ${st}.`;
}

function narrativeCentralBank(_m: MacroSlice): string {
  return `Central bank buying: the model holds a steady positive score here for heavy official-sector gold demand in recent years (central banks taking metal off the market). It doesn’t update every minute like prices do. Small part of the mix (5%) but it reminds you that official buyers exist even when day-trading flows flip.`;
}

function narrativeRiskOff(m: MacroSlice, live?: LiveScoreData): string {
  const st = stanceFromScore(m.riskoffScore);
  if (live?.factorContext != null) {
    const dv = m.vix - live.factorContext.vixPrev;
    const dh = m.hySpread - live.factorContext.hyPrev;
    const fearUp = dv > 0.05;
    const creditWorse = dh > 0.01;
    let tension: string;
    if (fearUp && creditWorse) {
      tension = "Both got worse vs the last tick—nervous markets often steer flows toward hedges.";
    } else if (!fearUp && !creditWorse && dv < -0.05) {
      tension = "Fear eased vs the last tick—calmer tone can take some bid away from defensive gold in the short run.";
    } else {
      tension = "Mixed vs the last tick—watch whether fear or credit leads the session.";
    }
    return `Right now: VIX ${m.vix.toFixed(1)} (${dv >= 0 ? "+" : ""}${dv.toFixed(2)} vs prior), junk-bond stress ${m.hySpread.toFixed(2)}% (${dh >= 0 ? "+" : ""}${dh.toFixed(2)} pp). ${tension} Model ${m.riskoffScore.toFixed(1)}/100 → ${st} (15% of the score).`;
  }
  return `Right now: VIX ${m.vix.toFixed(1)}, high-yield spread ${m.hySpread.toFixed(2)}% (no prior tick in this bundle for a live delta). Score ${m.riskoffScore.toFixed(1)}/100 → ${st}.`;
}

function narrativeInflation(m: MacroSlice): string {
  const st = stanceFromScore(m.inflationScore);
  return `Inflation outlook: uses the market’s implied long-run inflation expectation from Treasury breakevens (what bond prices say about future inflation). Latest ${m.breakeven.toFixed(2)}%. When expected inflation ticks up, this leg can score higher as gold is often used as an inflation hedge. 10% of the mix; ${m.inflationScore.toFixed(1)}/100 → ${st}.`;
}

function narrativeMomentum(m: MacroSlice, live?: LiveScoreData): string {
  const st = stanceFromScore(m.momentumScore);
  const tail =
    live?.factorContext != null
      ? ` Short-term price move: about ${signedPct(live.factorContext.roc24hPct)} over ~24 hours and ${signedPct(live.factorContext.roc6hPct)} over ~6 hours.`
      : "";
  return `Price momentum: mixes trend (gold vs its ~2–3 month average), how strong today’s move is vs recent days, and very short bounce/drop over hours. It moves when gold actually trades, not just when macro numbers drift. Spot about $${m.goldClose.toFixed(2)}; 12% of the mix; ${m.momentumScore.toFixed(1)}/100 → ${st}.${tail}`;
}

function narrativeIntradayXauImpulse(live: LiveScoreData): string {
  const p = live.factorContext!;
  return `Live ROC: 15m ${signedPct(p.roc15mPct)} · 1h ${signedPct(p.roc1hPct)} → feeds this row’s score vs 50 in the intraday blend.`;
}

function narrativeIntradayXauAccel(live: LiveScoreData): string {
  const p = live.factorContext!;
  const accel = p.roc1hPct - p.roc4hPct;
  return `1h ${signedPct(p.roc1hPct)} vs 4h ${signedPct(p.roc4hPct)} · (1h−4h) gap ${signedPct(accel)} → acceleration row reads near-term vs session pace.`;
}

function narrativeIntradayUsdPulse(live: LiveScoreData): string {
  const p = live.factorContext!;
  const mom = p.usdMomPct;
  const mag = Math.abs(mom);
  const snap =
    mag < 0.01
      ? "FX barely moved vs the last tick—no fresh push from dollar impulse on this refresh."
      : mom > 0
        ? `Dollar up ${signedPct(mom)} vs the prior update—often a short-term drag on gold while the buck firms.`
        : `Dollar down ${signedPct(mom)} vs the prior update—often a short-term tailwind for gold.`;
  return `Live dollar pulse (fast board): ${snap} This row is the same broad index move the macro dollar uses, amplified for the intraday strip so you see what’s hitting the tape now.`;
}

function narrativeIntradayYieldPulse(live: LiveScoreData): string {
  const p = live.factorContext!;
  return `Yield jolt: the last day-to-day move in real (after-inflation) bond yields is ${signedPct(
    p.realYieldDailyChange,
  )} in yield terms. If yields jump, gold often feels more competition from interest-paying assets over the next little while—this row catches that for the fast board.`;
}

function narrativeIntradayRiskPulse(live: LiveScoreData): string {
  const p = live.factorContext!;
  return `Nerves in markets (fast): stock fear index ${live.vix.toFixed(1)} (change ${(live.vix - p.vixPrev).toFixed(2)}) and junk-bond stress ${live.hySpread.toFixed(
    2,
  )}% (change ${(live.hySpread - p.hyPrev).toFixed(2)} points). Spikes here often help defensive hedges like gold in the very near term.`;
}

function narrativeIntradayXau2hImpulse(live: LiveScoreData): string {
  const p = live.factorContext!;
  return `1h ${signedPct(p.roc1hPct)} · 4h ${signedPct(p.roc4hPct)} (2h strip impulse).`;
}

function narrativeIntradayXau2hStructure(live: LiveScoreData): string {
  const p = live.factorContext!;
  return `1h ${signedPct(p.roc1hPct)} vs 8h ${signedPct(p.roc8hPct)} → shorter vs session leg (2h structure).`;
}

function narrativeIntradayXau4hImpulse(live: LiveScoreData): string {
  const p = live.factorContext!;
  return `4h ${signedPct(p.roc4hPct)} · 8h ${signedPct(p.roc8hPct)} (4h strip impulse).`;
}

function narrativeIntradayXau4hStructure(live: LiveScoreData): string {
  const p = live.factorContext!;
  return `4h ${signedPct(p.roc4hPct)} vs 24h ${signedPct(p.roc24hPct)} → current swing vs full day (4h structure).`;
}

function buildFactorSnapshot(
  name: string,
  m: MacroSlice,
  live: LiveScoreData | undefined,
  rowScore: number,
): FactorSnapshotRow[] {
  const n = name.toLowerCase();
  const fc = live?.factorContext;

  if (n.includes("usd") && n.includes("trend")) {
    const rows: FactorSnapshotRow[] = [
      { label: "Broad dollar index (latest Fed print)", value: m.usdBroad.toFixed(2) },
      { label: "Previous observation", value: (fc?.usdIndexPrior ?? m.usdBroad).toFixed(2) },
    ];
    if (fc) rows.push({ label: "Change (last print vs prior)", value: signedPct(fc.usdMomPct) });
    rows.push({
      label: "USD component score in model",
      value: `${rowScore.toFixed(1)} / 100 (higher here = dollar softer vs its history → tends to support gold)`,
    });
    return rows;
  }

  if (n.includes("usd") && n.includes("pulse")) {
    const rows: FactorSnapshotRow[] = [
      { label: "Underlying dollar index (same data as macro USD)", value: m.usdBroad.toFixed(2) },
      { label: "Prior index", value: (fc?.usdIndexPrior ?? m.usdBroad).toFixed(2) },
    ];
    if (fc) rows.push({ label: "Step % (feeds this pulse)", value: signedPct(fc.usdMomPct) });
    rows.push({
      label: "This intraday row score (amplified)",
      value: `${rowScore.toFixed(1)} / 100`,
    });
    return rows;
  }

  if (n.includes("real yield") && n.includes("direction")) {
    const rows: FactorSnapshotRow[] = [
      { label: "10Y real (after-inflation) yield", value: `${m.realYield.toFixed(3)}%` },
      { label: "Prior observation", value: `${(fc?.realYieldPrior ?? m.realYield).toFixed(3)}%` },
    ];
    if (fc) rows.push({ label: "Daily change in yield", value: signedPct(fc.realYieldDailyChange) });
    rows.push({
      label: "Yields component score",
      value: `${rowScore.toFixed(1)} / 100 (higher = yields falling vs history → tends to support gold)`,
    });
    return rows;
  }

  if ((n.includes("yield") || n.includes("real yield")) && n.includes("pulse")) {
    const rows: FactorSnapshotRow[] = [];
    if (fc) {
      rows.push(
        { label: "10Y real yield (level)", value: `${m.realYield.toFixed(3)}%` },
        { label: "Daily yield change (feeds pulse)", value: signedPct(fc.realYieldDailyChange) },
      );
    }
    rows.push({ label: "This row score", value: `${rowScore.toFixed(1)} / 100` });
    return rows;
  }

  if (n.includes("risk-off") || (n.includes("risk") && n.includes("off"))) {
    const rows: FactorSnapshotRow[] = [
      { label: "VIX (fear gauge)", value: m.vix.toFixed(2) },
      { label: "VIX prior observation", value: (fc?.vixPrev ?? m.vix).toFixed(2) },
      { label: "High-yield credit spread", value: `${m.hySpread.toFixed(2)}%` },
      { label: "HY spread prior", value: `${(fc?.hyPrev ?? m.hySpread).toFixed(2)}%` },
      {
        label: "Risk component score",
        value: `${rowScore.toFixed(1)} / 100`,
      },
    ];
    return rows;
  }

  if (n.includes("risk") && n.includes("pulse")) {
    const rows: FactorSnapshotRow[] = [
      { label: "VIX now", value: live ? live.vix.toFixed(2) : m.vix.toFixed(2) },
    ];
    if (fc && live) {
      rows.push(
        { label: "VIX change vs prior", value: (live.vix - fc.vixPrev).toFixed(2) },
        { label: "HY spread now", value: `${live.hySpread.toFixed(2)}%` },
        { label: "HY change vs prior (pp)", value: (live.hySpread - fc.hyPrev).toFixed(2) },
      );
    }
    rows.push({ label: "This pulse row score", value: `${rowScore.toFixed(1)} / 100` });
    return rows;
  }

  if (n.includes("inflation")) {
    const rows: FactorSnapshotRow[] = [
      { label: "10Y inflation breakeven (market-implied)", value: `${m.breakeven.toFixed(2)}%` },
      { label: "Prior observation", value: `${(fc?.breakevenPrior ?? m.breakeven).toFixed(2)}%` },
      { label: "Inflation expectations score", value: `${rowScore.toFixed(1)} / 100` },
    ];
    return rows;
  }

  if (n.includes("gpr")) {
    return [
      { label: "Geopolitical risk index (GPR)", value: m.gpr.toFixed(2) },
      { label: "GPR score in model", value: `${rowScore.toFixed(1)} / 100` },
    ];
  }

  if (n.includes("central bank")) {
    return [
      { label: "Central bank leg", value: "Fixed structural bid (not a live tick)" },
      { label: "Score held in model", value: `${rowScore.toFixed(1)} / 100` },
    ];
  }

  if (n.includes("momentum")) {
    const rows: FactorSnapshotRow[] = [{ label: "Gold spot (for momentum)", value: `$${m.goldClose.toFixed(2)}` }];
    if (fc) {
      rows.push(
        { label: "~24h gold move", value: signedPct(fc.roc24hPct) },
        { label: "~6h gold move", value: signedPct(fc.roc6hPct) },
      );
    }
    rows.push({ label: "Momentum component score", value: `${rowScore.toFixed(1)} / 100` });
    return rows;
  }

  if (live?.factorContext && (n.includes("xau") || n.includes("impulse") || n.includes("acceleration") || n.includes("structure"))) {
    const p = live.factorContext;
    if (n.includes("15m") || (n.includes("xau") && n.includes("impulse") && !n.includes("2h") && !n.includes("4h"))) {
      return [
        { label: "Gold ~15m change", value: signedPct(p.roc15mPct) },
        { label: "Gold ~1h change", value: signedPct(p.roc1hPct) },
        { label: "This row score", value: `${rowScore.toFixed(1)} / 100` },
      ];
    }
    if (n.includes("acceleration")) {
      return [
        { label: "Gold ~1h vs ~4h", value: `${signedPct(p.roc1hPct)} vs ${signedPct(p.roc4hPct)}` },
        { label: "This row score", value: `${rowScore.toFixed(1)} / 100` },
      ];
    }
    if (n.includes("2h") && n.includes("impulse")) {
      return [
        { label: "Gold ~1h / ~4h", value: `${signedPct(p.roc1hPct)} / ${signedPct(p.roc4hPct)}` },
        { label: "This row score", value: `${rowScore.toFixed(1)} / 100` },
      ];
    }
    if (n.includes("2h") && n.includes("structure")) {
      return [
        { label: "Gold ~1h vs ~8h", value: `${signedPct(p.roc1hPct)} vs ${signedPct(p.roc8hPct)}` },
        { label: "This row score", value: `${rowScore.toFixed(1)} / 100` },
      ];
    }
    if (n.includes("4h") && n.includes("impulse")) {
      return [
        { label: "Gold ~4h vs ~8h", value: `${signedPct(p.roc4hPct)} vs ${signedPct(p.roc8hPct)}` },
        { label: "This row score", value: `${rowScore.toFixed(1)} / 100` },
      ];
    }
    if (n.includes("4h") && n.includes("structure")) {
      return [
        { label: "Gold ~4h vs ~24h", value: `${signedPct(p.roc4hPct)} vs ${signedPct(p.roc24hPct)}` },
        { label: "This row score", value: `${rowScore.toFixed(1)} / 100` },
      ];
    }
  }

  return [{ label: "Model score (this row)", value: `${rowScore.toFixed(1)} / 100` }];
}

/** Public: attach factorDetail + live data snapshot to each component. */
export function enrichComponentsWithFactorDetails(
  components: ScoreComponentRow[],
  opts: { live: LiveScoreData } | { monthly: MonthlyData },
): Array<ScoreComponentRow & { factorDetail: string; factorSnapshot: FactorSnapshotRow[] }> {
  const live = "live" in opts ? opts.live : undefined;
  const monthly = "monthly" in opts ? opts.monthly : undefined;
  const m = live ? macroFromLive(live) : macroFromMonthly(monthly!);

  return components.map((c) => ({
    ...c,
    factorDetail: factorDetailForComponentName(c.name, m, live),
    factorSnapshot: buildFactorSnapshot(c.name, m, live, c.score),
  }));
}

function macroFromMonthly(row: MonthlyData): MacroSlice {
  return {
    realYield: row.realYield,
    vix: row.vix,
    breakeven: row.breakeven,
    hySpread: row.hySpread,
    usdBroad: row.usdBroad,
    gpr: row.gpr,
    goldClose: row.goldClose,
    ryScore: row.ryScore,
    usdScore: row.usdScore,
    gprScore: row.gprScore,
    cbScore: row.cbScore,
    riskoffScore: row.riskoffScore,
    inflationScore: row.inflationScore,
    momentumScore: row.momentumScore,
  };
}

function factorDetailForComponentName(name: string, m: MacroSlice, live?: LiveScoreData): string {
  const n = name.toLowerCase();

  if (live?.factorContext) {
    if (n.includes("xau") && n.includes("15m")) return narrativeIntradayXauImpulse(live);
    if (n.includes("acceleration")) return narrativeIntradayXauAccel(live);
    if (n.includes("usd") && n.includes("pulse")) return narrativeIntradayUsdPulse(live);
    if ((n.includes("yield") || n.includes("real yield")) && n.includes("pulse"))
      return narrativeIntradayYieldPulse(live);
    if (n.includes("risk") && n.includes("pulse")) return narrativeIntradayRiskPulse(live);
    if (n.includes("xau") && n.includes("2h") && n.includes("impulse")) return narrativeIntradayXau2hImpulse(live);
    if (n.includes("xau") && n.includes("2h") && n.includes("structure")) return narrativeIntradayXau2hStructure(live);
    if (n.includes("xau") && n.includes("4h") && n.includes("impulse")) return narrativeIntradayXau4hImpulse(live);
    if (n.includes("xau") && n.includes("4h") && n.includes("structure")) return narrativeIntradayXau4hStructure(live);
  }

  if (n.includes("real yield") && n.includes("direction")) return narrativeRealYieldDirection(m, live);
  if (n.includes("usd") && n.includes("trend")) return narrativeUsdTrend(m, live);
  if (n.includes("gpr")) return narrativeGpr(m);
  if (n.includes("central bank")) return narrativeCentralBank(m);
  if (n.includes("risk-off") || n.includes("risk off")) return narrativeRiskOff(m, live);
  if (n.includes("inflation")) return narrativeInflation(m);
  if (n.includes("momentum")) return narrativeMomentum(m, live);

  if (n.includes("intraday")) {
    return `${name}: quick “what if” copy when very short-term data is missing—use the main rows above for the real drivers.`;
  }

  return `${name}: snapshot still tied to live data (gold ~$${m.goldClose.toFixed(
    2,
  )}, yield ${m.realYield.toFixed(2)}%, dollar index ${m.usdBroad.toFixed(2)}) but this label didn’t match a usual name—see the other factors for the story.`;
}
