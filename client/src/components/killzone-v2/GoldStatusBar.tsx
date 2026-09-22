import type { ReactNode } from "react";

function shortScoreTag(scoreTag: string): string {
  const after = scoreTag.split("·")[1]?.trim();
  const raw = (after ?? scoreTag).trim();
  return raw.split(/\s+/)[0]?.toUpperCase() || "—";
}

function shortRegimeChip(regimeChip: string): string {
  const r = regimeChip.toLowerCase();
  if (r.includes("trend")) return "TREND";
  if (r.includes("vol")) return "VOL EXP";
  if (r.includes("range")) return "RANGE";
  if (r.includes("neutral") || r.includes("no clear") || r.includes("no signal")) return "NEUTRAL";
  const words = regimeChip.trim().split(/\s+/).slice(0, 2).join(" ");
  return words.toUpperCase();
}

export function GoldStatusBar({
  priceDisplay,
  chgDisplay,
  chgClass,
  score,
  scoreTag,
  regimeChip,
  biasChip,
  liveLine,
  extra,
}: {
  priceDisplay: string;
  chgDisplay: string;
  chgClass: "bull" | "bear";
  score: number;
  scoreTag: string;
  regimeChip: string;
  biasChip: string;
  liveLine: string;
  extra?: ReactNode;
}) {
  const scoreWord = shortScoreTag(scoreTag);
  const regimeWord = shortRegimeChip(regimeChip);
  const biasWord = biasChip.trim().split(/\s+/)[0]?.toUpperCase() || biasChip;

  return (
    <div className="kz-topbar">
      <div className="kz-logo">
        <div className="kz-logo-mark">K</div>
        <div className="kz-logo-text">
          <b>KILLZONE</b>
          <span>GOLD INTELLIGENCE</span>
        </div>
      </div>

      <div className="kz-topbar-center">
        <div className="kz-asset">
          <span className="kz-asset-pair">
            XAU<em>/</em>USD
          </span>
          <span className="kz-asset-price mono">{priceDisplay}</span>
          <span className={`kz-asset-chg mono ${chgClass}`}>{chgDisplay}</span>
        </div>
        <span className="kz-topbar-divider" />
        <span className="kz-pill kz-pill-gold" title={`Score ${Math.round(score)} · ${scoreTag}`}>
          SCORE <b>{Math.round(score)}</b>
          <span className="kz-pill-sep">·</span>
          <b>{scoreWord}</b>
        </span>
        <span className="kz-pill" title={regimeChip}>
          REGIME <b>{regimeWord}</b>
        </span>
        <span className="kz-pill" title={biasChip}>
          BIAS <b>{biasWord}</b>
        </span>
      </div>

      <div className="kz-topbar-right">
        <span className="kz-live">
          <span className="kz-live-dot" />
          {liveLine}
        </span>
        {extra}
      </div>
    </div>
  );
}
