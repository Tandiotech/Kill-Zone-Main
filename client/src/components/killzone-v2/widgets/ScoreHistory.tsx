type HourlySentimentDay = {
  date: string;
  label: string;
  points: {
    time: string;
    bullishPct: number | null;
    bearishPct: number | null;
    macroScore: number | null;
    intradayScore: number | null;
    capturedAt: string | null;
  }[];
};

export function ScoreHistory({
  days,
}: {
  days?: HourlySentimentDay[];
}) {
  const hasData = !!days?.length;

  return (
    <div className="w-card">
      <div className="w-head">
        <div className="title">London Hourly Sentiment</div>
        <div className="meta">HOURLY SNAPSHOTS · EUROPE/LONDON</div>
      </div>
      <div className="w-body">
        {!hasData && (
          <div
            style={{
              border: "1px solid var(--line-1)",
              borderRadius: 6,
              padding: "14px 12px",
              color: "var(--text-2)",
              fontSize: 13,
            }}
          >
            Hourly London sentiment snapshots will appear after the first on-the-hour capture.
          </div>
        )}

        {hasData &&
          days?.map((day) => (
            <div
              key={day.date}
              style={{
                marginTop: 12,
                border: "1px solid var(--line-1)",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  background: "var(--bg-2)",
                  borderBottom: "1px solid var(--line-1)",
                  padding: "8px 10px",
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                }}
              >
                <span>{day.label}</span>
                <span className="mono">{day.date}</span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 1fr 1fr 1fr 1fr",
                  gap: 8,
                  padding: "8px 10px",
                  borderBottom: "1px solid var(--line-1)",
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                }}
              >
                <span>Time (London)</span>
                <span>Macro</span>
                <span>Intraday</span>
                <span>Bullish</span>
                <span>Bearish</span>
              </div>

              {day.points.map((point, idx) => (
                <div
                  key={`${day.date}-${point.time}-${idx}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px 1fr 1fr 1fr 1fr",
                    gap: 8,
                    alignItems: "center",
                    padding: "8px 10px",
                    borderBottom:
                      idx < day.points.length - 1 ? "1px solid var(--line-1)" : "none",
                    fontSize: 13,
                    color: "var(--text-1)",
                  }}
                >
                  <span className="mono" style={{ color: "var(--text-2)" }}>
                    {point.time}
                  </span>
                  <span className="mono" style={{ color: "var(--warn)" }}>
                    {typeof point.macroScore === "number" ? point.macroScore.toFixed(1) : "—"}
                  </span>
                  <span className="mono" style={{ color: "var(--gold-bright)" }}>
                    {typeof point.intradayScore === "number" ? point.intradayScore.toFixed(1) : "—"}
                  </span>
                  <span className="mono" style={{ color: "var(--bull)" }}>
                    {typeof point.bullishPct === "number" ? `${point.bullishPct.toFixed(1)}%` : "—"}
                  </span>
                  <span className="mono" style={{ color: "var(--bear)" }}>
                    {typeof point.bearishPct === "number" ? `${point.bearishPct.toFixed(1)}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
          ))}

        {hasData && (
          <div
            style={{
              marginTop: 10,
              fontSize: 11,
              color: "var(--text-3)",
              fontFamily: "Geist Mono, monospace",
            }}
          >
            Fixed hourly snapshots captured in London time.
          </div>
        )}
      </div>
    </div>
  );
}
