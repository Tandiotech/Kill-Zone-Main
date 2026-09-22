import { formatNextRefresh } from "../score-utils";

export function NextPulseCard({ nextRefreshIso }: { nextRefreshIso?: string | null }) {
  const next = formatNextRefresh(nextRefreshIso);
  const display = next === "—" ? "— : — : —" : next.replace(/\s+/g, " · ");

  return (
    <div className="card b-next-pulse">
      <div>
        <span className="label-eye label-eye-gold">NEXT INTELLIGENCE PULSE</span>
        <div className="timer mono">{display}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <span className="label-eye">DATA SOURCES</span>
        <div
          className="mono"
          style={{ fontSize: 11, letterSpacing: "0.14em", color: "var(--text-2)", marginTop: 4 }}
        >
          REUTERS · CME · ICE · FRED · GPR
        </div>
      </div>
    </div>
  );
}
