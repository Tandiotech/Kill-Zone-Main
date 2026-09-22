const REGIMES = [
  {
    key: "range" as const,
    name: "RANGE",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 12h16M7 8l-3 4 3 4M17 8l3 4-3 4" />
      </svg>
    ),
  },
  {
    key: "trend" as const,
    name: "TRENDING",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 18l5-6 4 3 7-9M14 6h6v6" />
      </svg>
    ),
  },
  {
    key: "vol" as const,
    name: "VOL EXP",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M3 12h3l2-5 4 10 2-5 2 3h5" />
      </svg>
    ),
  },
];

function regimeKeyFromLabel(regime: string): "range" | "trend" | "vol" {
  const r = regime.toLowerCase();
  if (r.includes("trend") || r.includes("bullish") || r.includes("bearish bias")) return "trend";
  if (r.includes("vol") || r.includes("expansion")) return "vol";
  return "range";
}

export function MarketRegime({
  regimeLabel,
  metrics,
}: {
  regimeLabel: string;
  metrics?: { label: string; value: string; sub: string }[];
}) {
  const activeKey = regimeKeyFromLabel(regimeLabel);

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-eyebrow">MARKET REGIME</span>
        <span className="card-meta">FROM LIVE SCORE REGIME</span>
      </div>
      <div style={{ padding: "18px 22px 22px" }}>
        <div className="b-regime-buttons">
          {REGIMES.map((r) => (
            <div key={r.key} className={`b-regime-btn ${r.key === activeKey ? "is-on" : ""}`}>
              {r.icon}
              {r.name}
            </div>
          ))}
        </div>
        <div className="b-regime-desc">{regimeLabel}</div>
      </div>
    </div>
  );
}
