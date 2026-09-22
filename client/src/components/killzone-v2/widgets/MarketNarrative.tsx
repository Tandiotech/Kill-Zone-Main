import type { ReactNode } from "react";

export type MarketNarrativeProps = {
  updatedTs: string;
  marketSymbol?: string;
  statement: ReactNode;
  sub: string;
  primaryTitle: string;
  primaryDesc: string;
  opposingTitle: string;
  opposingDesc: string;
};

export function MarketNarrative({
  updatedTs,
  marketSymbol,
  statement,
  sub,
  primaryTitle,
  primaryDesc,
  opposingTitle,
  opposingDesc,
}: MarketNarrativeProps) {
  return (
    <>
      <div className="bf-disclaimer bf-disclaimer-standalone">
        <svg className="bf-disclaimer-ic" width="12" height="12" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="8" cy="11" r="0.7" fill="currentColor" />
        </svg>
        <div>
          <span className="bf-disclaimer-lbl">Narrative, not a signal.</span> Gold carries significant
          intraday volatility and is exposed to macro shocks, policy prints, and geopolitical tail events.
          This dashboard is a framing tool for context — not a directional recommendation. Size your
          exposure, define invalidation, and make your own decisions.
        </div>
      </div>
      <div className="narrative">
        <div className="narrative-top">
          <div className="narrative-eyebrow">
            <span className="pulse" />
            <span>Live Market Narrative</span>
            <span className="sep">·</span>
            <span>{marketSymbol || "XAU / USD"}</span>
          </div>
          <div className="narrative-ts">{updatedTs}</div>
        </div>

        <div className="narrative-statement">{statement}</div>

        <div className="narrative-sub">{sub}</div>

        <div className="narrative-forces">
          <div className="nf-col">
            <div className="nf-lbl">
              Primary Driver <span className="chip primary">SUPPORT</span>
            </div>
            <div className="nf-value">{primaryTitle}</div>
            <div className="nf-desc">{primaryDesc}</div>
          </div>
          <div className="nf-vs">VS</div>
          <div className="nf-col">
            <div className="nf-lbl">
              Opposing Force <span className="chip opposing">PRESSURE</span>
            </div>
            <div className="nf-value">{opposingTitle}</div>
            <div className="nf-desc">{opposingDesc}</div>
          </div>
        </div>
      </div>
    </>
  );
}
