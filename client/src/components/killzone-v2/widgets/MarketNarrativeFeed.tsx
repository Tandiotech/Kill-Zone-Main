import { useMemo } from "react";
import type { MarketNarrativeSlide } from "./LiveMarketNarrativeCarousel";

function impactClass(impact?: MarketNarrativeSlide["impact"]): "high" | "med" | "low" {
  if (impact === "High impact") return "high";
  if (impact === "Medium impact") return "med";
  return "low";
}

function impactLabel(impact?: MarketNarrativeSlide["impact"]): string {
  if (impact === "High impact") return "HIGH";
  if (impact === "Medium impact") return "MED";
  return "LOW";
}

function slideToHeadline(slide: MarketNarrativeSlide): string {
  if (slide.headlines?.[0]?.title) return slide.headlines[0].title;
  return slide.title;
}

function slideToSource(slide: MarketNarrativeSlide): string {
  if (slide.headlines?.[0]?.source) return slide.headlines[0].source.toUpperCase();
  return "GOLD INTEL";
}

function slideToTs(slide: MarketNarrativeSlide): string {
  const age = slide.freshness?.news ?? slide.updatedLabel ?? "now";
  return age.replace(/^Updated\s*/i, "").slice(0, 12) || "LIVE";
}

export function MarketNarrativeFeed({
  slides,
  narrativeChanged,
}: {
  slides: MarketNarrativeSlide[];
  narrativeChanged?: boolean;
}) {
  const rows = useMemo(() => slides.slice(0, 4), [slides]);

  return (
    <div className="card feed-card">
      <div className="card-head">
        <span className="card-eyebrow">INTELLIGENCE FEED · FUNDAMENTAL NEWS</span>
        <span className="card-meta">
          {String(rows.length).padStart(2, "0")} ITEMS
          {narrativeChanged ? " · UPDATED" : ""}
        </span>
      </div>
      <div className="feed-list">
        {rows.length === 0 ? (
          <div style={{ padding: "16px 22px", color: "var(--text-3)", fontSize: 13 }}>
            Narrative feed initializing…
          </div>
        ) : (
          rows.map((slide, i) => (
            <div
              key={`${slide.id}-${i}`}
              className={`feed-row ${i === 0 ? "is-primary" : ""}`}
            >
              <span className="ts mono">{slideToTs(slide)}</span>
              <span className="headline">
                {i === 0 && slide.id === "yields" ? (
                  <>
                    <em>YIELDS WATCH:</em> {slideToHeadline(slide).replace(/^YIELDS WATCH:\s*/i, "")}
                  </>
                ) : (
                  slideToHeadline(slide)
                )}
              </span>
              <span className="src">{slideToSource(slide)}</span>
              <span className={`imp ${impactClass(slide.impact)}`}>{impactLabel(slide.impact)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
