import type { DominanceModels } from "./dominance-models";
import { dominanceInterpretation, splitRegimeFlag } from "./dominance-models";
import type { SignalData } from "./signal-types";

export type GoldNewsHeadline = {
  title: string;
  source?: string;
  age?: string;
  url?: string;
};

export type GoldDecisionBrief = {
  headline: string;
  body: string;
  whatChanged?: string;
  newsSource?: string;
  newsUrl?: string;
};

function cleanNewsTitle(title: string): string {
  return title
    .replace(/\s*[-–—|]\s*[A-Za-z0-9 .,&'+-]{2,40}$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildGoldDecisionBrief(
  signal: SignalData,
  models: DominanceModels,
  regimeLabel: string,
  positioningTitle: string,
  options?: {
    scoreLastChangedIso?: string;
    narrativeChanged?: boolean;
    scoreDelta?: number | null;
    newsHeadline?: GoldNewsHeadline | null;
  },
): GoldDecisionBrief {
  const split = splitRegimeFlag(models.macro, models.intraday4h);
  const interpretation = dominanceInterpretation(models.macro, models.intraday4h);

  const macroBull = models.macro.bullPct;
  const macroBear = models.macro.bearPct;
  const intraBull = models.intraday.bullPct;
  const intraBear = models.intraday.bearPct;
  const macroEdge = Math.abs(models.macro.edge);
  const intraEdge = Math.abs(models.intraday.edge);

  const newsTitle = options?.newsHeadline?.title
    ? cleanNewsTitle(options.newsHeadline.title)
    : "";
  const hasNews = newsTitle.length > 18;

  // Prefer live gold news in the brief headline; posture stays in the body.
  let headline = hasNews ? newsTitle : positioningTitle.replace(/\.$/, "");
  if (!hasNews) {
    if (split) {
      headline = "Split regime — stand aside until macro and timing agree";
    } else if (signal.score >= 65 || (macroBull >= 60 && models.macro.leaning === "bull")) {
      headline =
        intraBull >= intraBear
          ? "Constructive — macro and timing support longs"
          : "Constructive macro — wait for timing to confirm";
    } else if (signal.score <= 35 || (macroBear >= 60 && models.macro.leaning === "bear")) {
      headline =
        intraBear >= intraBull
          ? "Defensive — macro and timing both lean against gold"
          : "Defensive macro — rallies need confirmation";
    } else if (macroEdge < 8 && intraEdge < 8) {
      headline = "Balanced — no clean edge right now";
    } else if (models.macro.leaning === "bull") {
      headline = "Mildly constructive — selective longs only";
    } else if (models.macro.leaning === "bear") {
      headline = "Mildly defensive — respect the headwinds";
    } else {
      headline = "Mixed — wait for clearer structure";
    }
  }

  const parts: string[] = [];

  if (intraBear > intraBull && macroBull > macroBear) {
    parts.push(
      "Opposing pressure dominates intraday flow. Macro remains constructive, but timing is not confirmed.",
    );
  } else if (intraBull > intraBear && macroBear > macroBull) {
    parts.push(
      "Short-term tape is firmer than the macro backdrop — treat bounce strength as unconfirmed.",
    );
  } else if (split) {
    parts.push("Macro and intraday layers disagree — stand aside until structure aligns.");
  } else {
    parts.push(interpretation);
  }

  if (signal.tradeZone) {
    parts.push(signal.tradeZone);
  }
  if (signal.continuation && !parts.some((p) => p.includes(signal.continuation.slice(0, 20)))) {
    parts.push(signal.continuation);
  }

  if (signal.score >= 45 && signal.score < 65 && macroEdge < 12 && intraEdge < 12) {
    parts.push("No clean execution signal yet.");
  }

  const body = parts.filter(Boolean).join(" ");

  let whatChanged: string | undefined;
  if (hasNews && options?.newsHeadline) {
    const src = options.newsHeadline.source?.trim();
    const age = options.newsHeadline.age?.trim();
    whatChanged = [src ? `Source: ${src}` : null, age ? `${age} ago` : null]
      .filter(Boolean)
      .join(" · ") || "Latest gold news from live feed.";
  } else if (options?.narrativeChanged) {
    whatChanged = "Headline narrative updated since last pulse.";
  } else if (options?.scoreDelta != null && Math.abs(options.scoreDelta) >= 0.1) {
    whatChanged = `Score moved ${options.scoreDelta >= 0 ? "+" : ""}${options.scoreDelta.toFixed(1)} pts since last log entry.`;
  } else if (options?.scoreLastChangedIso) {
    try {
      const d = new Date(options.scoreLastChangedIso);
      const mins = Math.floor((Date.now() - d.getTime()) / 60000);
      if (mins < 120) {
        whatChanged = `Regime score stable for ${mins < 1 ? "<1" : mins}m — no material shift in composite.`;
      }
    } catch {
      /* ignore */
    }
  }

  void regimeLabel;

  return {
    headline,
    body,
    whatChanged,
    newsSource: hasNews ? options?.newsHeadline?.source : undefined,
    newsUrl: hasNews ? options?.newsHeadline?.url : undefined,
  };
}

export function postureStep(score: number): "observe" | "prepare" | "act" | "manage" {
  if (score >= 75) return "act";
  if (score >= 65) return "manage";
  if (score >= 45) return "prepare";
  return "observe";
}
