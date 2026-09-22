import { useEffect, useMemo, useState } from "react";

export type MarketNarrativeSlide = {
  id: "gold" | "yields" | "dollar" | "risk";
  title: string;
  metrics: { label: string; value: string }[];
  text: string;
  updatedLabel: string;
  bias: "Bullish" | "Bearish" | "Neutral";
  impact?: "High impact" | "Medium impact" | "Low impact";
  tags?: string[];
  imageUrl?: string;
  imageAlt?: string;
  freshness?: {
    market: string;
    news: string;
  };
  headlines?: {
    title: string;
    source: string;
    age: string;
    url?: string;
    imageUrl?: string;
  }[];
};

export type LiveMarketNarrativeCarouselProps = {
  slides: MarketNarrativeSlide[];
  rotateMs?: number;
};

const FALLBACK_SLIDES: MarketNarrativeSlide[] = [
  {
    id: "gold",
    title: "BREAKING: Gold flow initializing",
    metrics: [
      { label: "Gold", value: "Awaiting feed" },
      { label: "DXY Proxy", value: "Awaiting feed" },
    ],
    text: "Live macro narrative is initializing. Gold flow will update once the first market snapshot is available.",
    updatedLabel: "Syncing feed",
    bias: "Neutral",
    imageUrl:
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Macro market chart screen",
    freshness: { market: "n/a", news: "n/a" },
    headlines: [],
  },
  {
    id: "yields",
    title: "YIELDS WATCH: Feed initializing",
    metrics: [
      { label: "Headlines", value: "—" },
      { label: "Top Source", value: "—" },
    ],
    text: "Headline narrative will appear when fresh market news is detected and processed by the feed.",
    updatedLabel: "Syncing headlines",
    bias: "Neutral",
    imageUrl:
      "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Financial news desk and headlines",
    freshness: { market: "n/a", news: "n/a" },
    headlines: [],
  },
  {
    id: "dollar",
    title: "DOLLAR TRACKER: Feed initializing",
    metrics: [
      { label: "Score", value: "—" },
      { label: "Momentum", value: "—" },
    ],
    text: "Positioning summary will populate from the live score model as soon as the current cycle completes.",
    updatedLabel: "Syncing score model",
    bias: "Neutral",
    imageUrl:
      "https://images.unsplash.com/photo-1642790551116-18e150f248e3?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Technical trading chart analysis",
    freshness: { market: "n/a", news: "n/a" },
    headlines: [],
  },
  {
    id: "risk",
    title: "MACRO ALERT: Feed initializing",
    metrics: [
      { label: "Bias", value: "Neutral" },
      { label: "Risk-Off", value: "—" },
    ],
    text: "Short-term outlook is on standby until macro and headline inputs are synchronized.",
    updatedLabel: "Syncing outlook",
    bias: "Neutral",
    imageUrl:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Strategic planning and market outlook",
    freshness: { market: "n/a", news: "n/a" },
    headlines: [],
  },
];

const DEFAULT_STORY_IMAGE =
  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80";

type NarrativeKind = "macro" | "news" | "cbank" | "geo";

function impactClass(impact?: MarketNarrativeSlide["impact"]): "high" | "med" | "low" {
  if (impact === "High impact") return "high";
  if (impact === "Medium impact") return "med";
  return "low";
}

function narrativeKind(slide: MarketNarrativeSlide): NarrativeKind {
  if (slide.id === "yields") return "macro";
  if (slide.id === "dollar") return "macro";
  if (slide.id === "gold") return "cbank";
  if (slide.id === "risk") return "geo";
  return "news";
}

function kindLabel(kind: NarrativeKind): string {
  if (kind === "cbank") return "CENTRAL BANK";
  if (kind === "geo") return "GEOPOLITICAL";
  if (kind === "macro") return "MACRO PRINT";
  return "FLOW";
}

function driverStance(slide: MarketNarrativeSlide): "bull" | "bear" | "neutral" {
  if (slide.bias === "Bullish") return "bull";
  if (slide.bias === "Bearish") return "bear";
  return "neutral";
}

function primaryStoryForSlide(slide: MarketNarrativeSlide) {
  if (slide.headlines && slide.headlines.length > 0) {
    return {
      title: slide.headlines[0].title,
      source: slide.headlines[0].source,
      age: `${slide.headlines[0].age} ago`,
      imageUrl: slide.headlines[0].imageUrl ?? DEFAULT_STORY_IMAGE,
    };
  }

  return {
    title: slide.title || slide.text,
    source: "Gold Intelligence",
    age: slide.freshness?.market ?? "now",
    imageUrl: slide.imageUrl || DEFAULT_STORY_IMAGE,
  };
}

export function LiveMarketNarrativeCarousel({
  slides,
  rotateMs = 6500,
}: LiveMarketNarrativeCarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const displaySlides = useMemo(
    () => (slides.length > 0 ? slides.slice(0, 5) : FALLBACK_SLIDES),
    [slides],
  );
  const total = displaySlides.length;
  const current = displaySlides[index];
  const prev = displaySlides[(index - 1 + total) % total];
  const next = displaySlides[(index + 1) % total];
  const currentStory = primaryStoryForSlide(current);

  useEffect(() => {
    if (paused || total <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % total);
    }, rotateMs);
    return () => window.clearInterval(timer);
  }, [paused, rotateMs, total]);

  useEffect(() => {
    setIndex((value) => (value >= total ? 0 : value));
  }, [total]);

  const goTo = (nextIndex: number) => {
    const wrapped = ((nextIndex % total) + total) % total;
    setIndex(wrapped);
  };

  return (
    <>
      <div className="bf-disclaimer bf-disclaimer-standalone">
        <svg className="bf-disclaimer-ic" width="12" height="12" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="8" cy="11" r="0.7" fill="currentColor" />
        </svg>
        <div>
          <span className="bf-disclaimer-lbl">Narrative, not a signal.</span> Context updates from live macro
          flow and headlines. Use this for framing, then validate with your own levels and risk plan.
        </div>
      </div>

      <div
        className="narr-car"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="narr-car-head">
          <div className="narr-car-eyebrow">
            <span className="pulse" />
            <span>Live Market Narrative</span>
            <span className="sep">·</span>
            <span>Fundamental News Flow</span>
          </div>
          <div className="narr-car-controls">
            <div className="narr-car-counter mono">
              <span className="cur">{String(index + 1).padStart(2, "0")}</span>
              <span className="sep">/</span>
              <span>{String(total).padStart(2, "0")}</span>
            </div>
            <button className="narr-car-btn" type="button" onClick={() => goTo(index - 1)} aria-label="Previous">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M10 3l-5 5 5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button className="narr-car-btn" type="button" onClick={() => goTo(index + 1)} aria-label="Next">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M6 3l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="narr-car-stage">
          <button className="narr-car-peek left" type="button" onClick={() => goTo(index - 1)}>
            <div className="narr-peek-kind">{kindLabel(narrativeKind(prev))}</div>
            <div className="narr-peek-head">{prev.title}</div>
          </button>

          <article className="narr-car-slide" key={`${current.id}-${index}`}>
            <div className="narr-slide-top">
              <div className="narr-slide-tags">
                <span className={`narr-tag kind-${narrativeKind(current)}`}>
                  {kindLabel(narrativeKind(current))}
                </span>
                <span className={`narr-tag impact-${impactClass(current.impact)}`}>
                  <span className="impact-dot" />
                  {current.impact ?? "Low impact"}
                </span>
                <span className={`narr-tag driver-${driverStance(current)}`}>
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M8 4v4l2.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  {(current.tags && current.tags[0]) || current.id.toUpperCase()}
                </span>
              </div>
              <div className="narr-slide-ts mono">
                <span className="ago">{current.freshness?.news ?? "now"}</span>
                <span className="sep">·</span>
                <span>{current.updatedLabel}</span>
              </div>
            </div>

            <div className="narr-slide-headline">{current.title}</div>
            <div className="narr-slide-body">{current.text}</div>

            <div className="narr-slide-context">
              <div className="narr-slide-context-lbl">Why it matters</div>
              <div className="narr-slide-context-body">{currentStory.title}</div>
            </div>

            <div className="narr-slide-foot">
              <div className="narr-slide-source mono">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                  <rect x="2.5" y="3" width="11" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M2.5 6h11M6 3v10" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                SOURCE · {currentStory.source}
              </div>
              <div className="narr-slide-actions">
                <button className="narr-action" type="button" onClick={() => goTo(index - 1)}>
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M10 3l-5 5 5 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Previous
                </button>
                <button className="narr-action primary" type="button" onClick={() => goTo(index + 1)}>
                  Next update
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M6 3l5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {!paused && (
              <div className="narr-slide-progress">
                <div key={`progress-${index}`} className="narr-slide-progress-bar" />
              </div>
            )}
          </article>

          <button className="narr-car-peek right" type="button" onClick={() => goTo(index + 1)}>
            <div className="narr-peek-kind">{kindLabel(narrativeKind(next))}</div>
            <div className="narr-peek-head">{next.title}</div>
          </button>
        </div>

        <div className="narr-car-dots">
          {displaySlides.map((slide, i) => (
            <button
              key={`dot-${slide.id}-${i}`}
              type="button"
              className={`narr-dot ${i === index ? "active" : ""} impact-${impactClass(slide.impact)}`}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
            >
              <span className="narr-dot-fill" />
            </button>
          ))}
          <div className="narr-car-auto mono">{paused ? "PAUSED" : "AUTO · 6.5s"}</div>
        </div>
      </div>
    </>
  );
}
