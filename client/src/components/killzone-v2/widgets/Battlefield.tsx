import {
  buildDominanceFromComponents,
  type DominanceForce,
} from "../score-utils";

type BfSnapshotRow = { label: string; value: string };

const GOLD_SCORE_ROW_LABEL = /this row score|intraday row score/i;

/** Pull % numbers from a snapshot value string (handles +0.12%, −0.05%, Unicode minus). */
function parsePctValuesFromString(s: string): number[] {
  const out: number[] = [];
  const re = /([+−-]?\d+\.?\d*)\s*%/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    out.push(parseFloat(m[1].replace("−", "-")));
  }
  return out;
}

function compactGoldSnapshotLabel(label: string): string {
  return label.replace(/^Gold ~/, "").replace(/\s+change$/i, "").trim();
}

/** Short read on what the tape numbers imply (one line, no essay). */
function goldTapeHint(_normalizedName: string, tapeRows: BfSnapshotRow[]): string | null {
  if (tapeRows.length === 0) return null;

  const v0 = tapeRows[0]?.value ?? "";
  const pairFromFirst = parsePctValuesFromString(v0);

  if (pairFromFirst.length >= 2) {
    const [a, b] = pairFromFirst;
    if (Math.abs(a - b) < 0.02) return "Both horizons in that line print about the same direction.";
    if (a < b) return "Near-term leg weaker than the longer lookback.";
    return "Near-term leg stronger than the longer lookback.";
  }

  if (tapeRows.length >= 2) {
    const a = parsePctValuesFromString(tapeRows[0].value)[0];
    const b = parsePctValuesFromString(tapeRows[1].value)[0];
    if (a !== undefined && b !== undefined) {
      if (a < 0 && b < 0) return "Both windows down on the feed.";
      if (a > 0 && b > 0) return "Both windows up on the feed.";
      return "Windows disagree—score above blends them.";
    }
  }

  if (pairFromFirst.length === 1) {
    const x = pairFromFirst[0];
    if (x > 0.02) return "Logged window green.";
    if (x < -0.02) return "Logged window red.";
  }

  return null;
}

/**
 * Market-first line for Gold Price Action: row score vs 50, then tape figures, then a one-line tape read.
 * Prefer this over server factorDetail so users see numbers, not prose.
 */
function buildGoldPriceActionBlurb(
  normalizedName: string,
  side: "bull" | "bear",
  snapshot: BfSnapshotRow[] | undefined,
): string {
  const tapeRows =
    snapshot?.filter((r) => !GOLD_SCORE_ROW_LABEL.test(r.label) && !/score.*amplified/i.test(r.label)) ?? [];

  const scoreRow =
    snapshot?.find((r) => GOLD_SCORE_ROW_LABEL.test(r.label)) ??
    snapshot?.find((r) => /\/\s*100/.test(r.value));
  const scoreM = scoreRow?.value.match(/(\d+\.?\d*)\s*\/\s*100/);
  const scoreNum = scoreM ? parseFloat(scoreM[1]) : null;

  const sideWord = side === "bull" ? "Supporting" : "Opposing";
  const chunks: string[] = [];

  if (scoreNum != null) {
    const vs = scoreNum < 50 ? "below" : "above";
    chunks.push(`${sideWord}: ${scoreNum.toFixed(1)}/100 (${vs} neutral 50).`);
  } else {
    chunks.push(`${sideWord}.`);
  }

  if (tapeRows.length > 0) {
    chunks.push(
      `Tape: ${tapeRows.map((r) => `${compactGoldSnapshotLabel(r.label)} ${r.value}`).join(" · ")}.`,
    );
  }

  const hint = goldTapeHint(normalizedName, tapeRows);
  if (hint) chunks.push(hint);

  if (!scoreNum && tapeRows.length === 0) {
    return (
      `${sideWord}. ` +
      "There is nothing to show yet for this row: we did not receive the usual live pieces—" +
      "the percentage moves in gold over short windows (e.g. last ~15 minutes or ~1 hour), " +
      "and this factor’s score out of 100 (the model compares it to 50 as neutral to decide how hard this row pushes). " +
      "When the feed is connected and the server attaches those fields, they appear in the table above and this line fills in automatically. " +
      "If you stay on this message, try a refresh once you’re online."
    );
  }

  return chunks.join(" ");
}

export function Battlefield({
  score,
  dominanceModes,
  macroLastFetched,
  title,
  showMacroBar = true,
  showIntradayBars = true,
  showForces = true,
}: {
  score?: number;
  dominanceModes?: {
    macro?: {
      components?: {
        name: string;
        score: number;
        weight: number;
        contribution?: number;
        factorDetail?: string;
        factorSnapshot?: { label: string; value: string }[];
      }[];
    };
    intraday?: {
      components?: {
        name: string;
        score: number;
        weight: number;
        contribution?: number;
        factorDetail?: string;
        factorSnapshot?: { label: string; value: string }[];
      }[];
      window?: string;
      lastSampleAt?: string;
    };
    intraday2h?: {
      components?: {
        name: string;
        score: number;
        weight: number;
        contribution?: number;
        factorDetail?: string;
        factorSnapshot?: { label: string; value: string }[];
      }[];
      window?: string;
      lastSampleAt?: string;
    };
    intraday4h?: {
      components?: {
        name: string;
        score: number;
        weight: number;
        contribution?: number;
        factorDetail?: string;
        factorSnapshot?: { label: string; value: string }[];
      }[];
      window?: string;
      lastSampleAt?: string;
    };
  };
  macroLastFetched?: string;
  title?: string;
  showMacroBar?: boolean;
  showIntradayBars?: boolean;
  showForces?: boolean;
}) {
  function minsAgo(iso?: string): string {
    if (!iso) return "n/a";
    const ms = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms < 0) return "n/a";
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "<1m ago";
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    return `${h}h ago`;
  }

  function normalizeForceName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function forceReasonTag(name: string): string {
    const n = normalizeForceName(name);
    if (n.includes("real yield") || n.includes("yield")) return "Yields";
    if (n.includes("usd") || n.includes("dollar")) return "Dollar";
    if (n.includes("gpr") || n.includes("geopolitical")) return "Geopolitical";
    if (n.includes("risk")) return "Risk On/Off";
    if (n.includes("central bank")) return "Central Banks";
    if (n.includes("inflation") || n.includes("breakeven")) return "Inflation";
    if (n.includes("momentum")) return "Momentum";
    if (n.includes("xau") || n.includes("impulse") || n.includes("acceleration") || n.includes("structure")) {
      return "Gold Price Action";
    }
    return "Macro Flow";
  }

  /** Fallback when /api/score factorDetail is missing—aligned to Killzone scoring (FRED/Yahoo/GPR), not generic macro blurbs. */
  function forceExplanation(name: string, side: "bull" | "bear"): string {
    const tag = forceReasonTag(name);
    const n = normalizeForceName(name);
    const lean =
      side === "bull"
        ? "On this side because this factor’s score nets as supportive for gold after weighting."
        : "On this side because this factor’s score nets as opposing for gold after weighting.";

    const byTag: Record<string, string> = {
      Yields:
        "Bonds / real yields: the return on inflation-linked government bonds (yield after inflation is stripped out). Lower yield → usually better for gold in this mix; higher yield → gold competes harder with income from bonds/cash. Big-picture macro leg (~25% of the score). The “yield pulse” row is the same idea for the very fast board.",
      Dollar:
        "Dollar (~20% of the score): when the feed is up, the live figures above show the exact broad dollar index, the prior observation, the step between prints, and the model score—that is the evidence behind this row. Versus the last print, a firmer dollar often weighs on gold short-term; a softer dollar often helps this leg. If this line appears without that figure block or the full server text, refresh once you’re online.",
      Geopolitical:
        "A geopolitical stress index from public data—think global tension and headlines, not the stock market fear index. Higher stress can support flight-to-safety demand; calmer periods can soften that bid. ~13% of the mix.",
      "Risk On/Off":
        "Mix of stock-market fear (VIX) and how tight risky corporate credit looks (high-yield spreads). When investors are scared or credit looks stressed, gold often scores better as a “worry” asset. ~15% of the mix.",
      "Central Banks":
        "A steady positive tilt for heavy central-bank gold buying in recent years (metal taken off the market by officials). It doesn’t update like live price; it’s a small anchor (~5%) while other rows move every refresh.",
      Inflation:
        "What bond markets imply about future inflation (breakevens). When expected inflation rises, this leg can lean bullish for gold as an inflation hedge. ~10% of the mix.",
      Momentum:
        "Trend and short-term price strength: gold vs its recent average, how today compares to recent days, and moves over the last hours. Moves when gold actually trades. ~12% of the mix.",
      "Macro Flow":
        "This label didn’t map cleanly, but it still feeds the blended score—open the live dashboard with a fresh /api/score when online for the full breakdown.",
    };

    let body = byTag[tag] ?? byTag["Macro Flow"];

    if (tag === "Yields" && n.includes("pulse")) {
      body =
        "Quick read on the last jump in real bond yields. If yields just popped, gold often faces more competition from interest-bearing assets in the next little while.";
    } else if (tag === "Risk On/Off" && n.includes("pulse")) {
      body =
        "Short-term nerves: latest move in fear (VIX) and junk-bond stress vs the last reading. Spikes here often matter more for the next few hours than slow macro averages.";
    }

    return `${body} ${lean}`;
  }

  const timingDeadZone = 0.12;
  const macroModel = buildDominanceFromComponents({
    score,
    components: dominanceModes?.macro?.components,
  });
  const intradayModel = buildDominanceFromComponents({
    score,
    components: dominanceModes?.intraday?.components,
    deadZone: timingDeadZone,
  });
  const intraday2hModel = buildDominanceFromComponents({
    score,
    components: dominanceModes?.intraday2h?.components,
    deadZone: timingDeadZone,
  });
  const intraday4hModel = buildDominanceFromComponents({
    score,
    components: dominanceModes?.intraday4h?.components,
    deadZone: timingDeadZone,
  });
  // Main card often shows intraday bars only; trend forces should follow macro, not 15m/1h tape.
  const intradayOnlyCard = !showMacroBar && showIntradayBars && showForces;
  const forcesModel = intradayOnlyCard ? macroModel : intradayModel;
  const bullSum = forcesModel.bullSum;
  const bearSum = forcesModel.bearSum;
  const BULL_FORCES: DominanceForce[] = forcesModel.bullForces;
  const BEAR_FORCES: DominanceForce[] = forcesModel.bearForces;
  const motionStrength = 0.5;
  const macroBull = macroModel.bullPct;
  const intraBull = intradayModel.bullPct;
  const macroBear = 100 - macroBull;
  const intraBear = 100 - intraBull;
  const macroStrongBull = macroBull >= 65;
  const macroStrongBear = macroBull <= 35;
  const intraStrongBull = intraBull >= 65;
  const intraStrongBear = intraBull <= 35;
  const splitRegime = (macroStrongBull && intraStrongBear) || (macroStrongBear && intraStrongBull);

  const interpretation = (() => {
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
  })();

  const barConfigs = [
    ...(showMacroBar
      ? [{ key: "macro", label: "Macro Regime (24h+ context)", m: macroModel, freshness: minsAgo(macroLastFetched) }]
      : []),
    ...(showIntradayBars
      ? [
          {
            key: "intraday-4h",
            label: "Intraday Flow (4h)",
            m: intraday4hModel,
            freshness: minsAgo(dominanceModes?.intraday4h?.lastSampleAt),
          },
          {
            key: "intraday-2h",
            label: "Intraday Flow (2h)",
            m: intraday2hModel,
            freshness: minsAgo(dominanceModes?.intraday2h?.lastSampleAt),
          },
          {
            key: "intraday-fast",
            label: "Fast Intraday Flow (15m/1h)",
            m: intradayModel,
            freshness: minsAgo(dominanceModes?.intraday?.lastSampleAt),
          },
        ]
      : []),
  ];

  const defaultTitle = intradayOnlyCard
    ? "Intraday timing · 15m to 4h"
    : "Bull vs Bear · Dominance";
  const headMeta = intradayOnlyCard
    ? "BARS = ENTRY TIMING ONLY · TREND DIRECTION IS MACRO (RIGHT PANEL)"
    : "MACRO = DIRECTIONAL BIAS · INTRADAY = TIMING LAYER";

  return (
    <div className="w-card accent">
      <div className="w-head">
        <div className="title">{title ?? defaultTitle}</div>
        <div className="meta">{headMeta}</div>
      </div>
      {splitRegime && (
        <div
          style={{
            marginBottom: 10,
            border: "1px solid var(--line-1)",
            borderRadius: 6,
            padding: "8px 10px",
            fontSize: 11,
            letterSpacing: "0.04em",
            color: "var(--warn)",
            background: "var(--bg-2)",
          }}
        >
          <div style={{ textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            Split regime — do not use 15m/1h as trend
          </div>
          <div style={{ color: "var(--text-2)", textTransform: "none", letterSpacing: "normal", lineHeight: 1.45 }}>
            {interpretation}
          </div>
        </div>
      )}
      {barConfigs.map(({ key, label, m, freshness }) => {
        const mBull = Number(m.bullPct.toFixed(1));
        const mBear = Number((100 - mBull).toFixed(1));
        const mEdge = Number((mBull - mBear).toFixed(1));
        const mLeaning = mEdge > 0 ? "bull" : mEdge < 0 ? "bear" : "neutral";
        const isIntradayBar = key.startsWith("intraday");
        const mLeaningLabel = isIntradayBar
          ? mLeaning === "bull"
            ? "TIMING · BULLISH"
            : mLeaning === "bear"
              ? "TIMING · BEARISH"
              : "TIMING · NEUTRAL"
          : mLeaning === "bull"
            ? "LEANING BULLISH"
            : mLeaning === "bear"
              ? "LEANING BEARISH"
              : "BALANCED";
        return (
          <div key={key} className="bf-hero" style={{ ["--bf-motion" as string]: motionStrength, marginBottom: 6, padding: "7px 9px" }}>
            <div style={{ fontSize: 8, letterSpacing: "0.06em", color: "var(--text-3)", textTransform: "uppercase", marginBottom: 2 }}>
              {label}
            </div>
            <div className="mono" style={{ fontSize: 8, color: "var(--text-3)", marginBottom: 2 }}>
              Updated {freshness}
            </div>
            <div className="bf-hero-top" style={{ marginBottom: 4 }}>
              <div className="bf-hero-side bull">
                <div className="bf-hero-lbl">Supporting Gold</div>
                <div className="bf-hero-pct mono" style={{ fontSize: 20 }}>{mBull.toFixed(1)}%</div>
              </div>
              <div className={`bf-hero-verdict ${mLeaning} bf-live-verdict`}>
                <div className="bf-hero-verdict-text">
                  <div className="bf-hero-verdict-lbl">{mLeaningLabel}</div>
                  <div className="bf-hero-verdict-edge mono">
                    {mEdge > 0 ? "+" : ""}
                    {mEdge.toFixed(1)} pt edge · {m.magnitude}
                  </div>
                </div>
              </div>
              <div className="bf-hero-side bear">
                <div className="bf-hero-lbl">Opposing Gold</div>
                <div className="bf-hero-pct mono" style={{ fontSize: 20 }}>{mBear.toFixed(1)}%</div>
              </div>
            </div>
            <div className="bf-hero-bar" style={{ height: 12 }}>
              <div className="bull bf-live-fill" style={{ width: `${mBull}%`, fontSize: 9 }}>
                <span className="bf-hero-bar-lbl">{mBull.toFixed(1)}%</span>
              </div>
              <div className="bear bf-live-fill" style={{ width: `${mBear}%`, fontSize: 9 }}>
                <span className="bf-hero-bar-lbl">{mBear.toFixed(1)}%</span>
              </div>
              <div className="bf-hero-bar-center" />
            </div>
          </div>
        );
      })}
      {!splitRegime && (
        <div
          style={{
            marginBottom: 12,
            borderTop: "1px solid var(--line-1)",
            paddingTop: 10,
            fontSize: 13,
            color: "var(--text-2)",
          }}
        >
          {interpretation}
        </div>
      )}
      {showForces && (
        <div
          className="mono"
          style={{
            marginBottom: 10,
            fontSize: 10,
            color: "var(--text-3)",
            letterSpacing: "0.04em",
          }}
        >
          {intradayOnlyCard
            ? "Supporting / opposing forces = macro trend (24h+). Bars above = timing only."
            : "Forces follow Fast Intraday Flow (15m/1h)"}
        </div>
      )}

      {showForces && (
        <div className="battlefield-grid">
        <div className="bf-side bull">
          <div className="bf-head">
            <div className="bf-label bull">Supporting Forces</div>
            <div className="bf-dom bull mono">+{bullSum.toFixed(2)}</div>
          </div>
          <div className="bf-forces">
            {BULL_FORCES.map((f, i) => (
              <div key={i} className={`bf-force ${f.strong ? "strong" : ""}`}>
                <div className="bf-force-main">
                  <div className="bf-force-name">
                    {f.name}
                    <span className="bf-reason-tag bull">{forceReasonTag(f.name)}</span>
                  </div>
                  {f.factorSnapshot && f.factorSnapshot.length > 0 && (
                    <div className="bf-force-snapshot" aria-label="Live figures for this factor">
                      {f.factorSnapshot.map((row, j) => (
                        <div key={j} className="bf-force-snapshot-row">
                          <span className="bf-force-snapshot-lbl">{row.label}</span>
                          <span className="bf-force-snapshot-val mono">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="bf-force-desc">
                    {forceReasonTag(f.name) === "Gold Price Action"
                      ? buildGoldPriceActionBlurb(normalizeForceName(f.name), "bull", f.factorSnapshot)
                      : (f.factorDetail ?? forceExplanation(f.name, "bull"))}
                  </div>
                </div>
                <div className="bf-force-wt bull">+{f.weight.toFixed(3)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bf-side bear">
          <div className="bf-head">
            <div className="bf-label bear">Opposing Forces</div>
            <div className="bf-dom bear mono">−{bearSum.toFixed(2)}</div>
          </div>
          <div className="bf-forces">
            {BEAR_FORCES.map((f, i) => (
              <div key={i} className={`bf-force ${f.strong ? "strong" : ""}`}>
                <div className="bf-force-main">
                  <div className="bf-force-name">
                    {f.name}
                    <span className="bf-reason-tag bear">{forceReasonTag(f.name)}</span>
                  </div>
                  {f.factorSnapshot && f.factorSnapshot.length > 0 && (
                    <div className="bf-force-snapshot" aria-label="Live figures for this factor">
                      {f.factorSnapshot.map((row, j) => (
                        <div key={j} className="bf-force-snapshot-row">
                          <span className="bf-force-snapshot-lbl">{row.label}</span>
                          <span className="bf-force-snapshot-val mono">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="bf-force-desc">
                    {forceReasonTag(f.name) === "Gold Price Action"
                      ? buildGoldPriceActionBlurb(normalizeForceName(f.name), "bear", f.factorSnapshot)
                      : (f.factorDetail ?? forceExplanation(f.name, "bear"))}
                  </div>
                </div>
                <div className="bf-force-wt bear">−{f.weight.toFixed(3)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
