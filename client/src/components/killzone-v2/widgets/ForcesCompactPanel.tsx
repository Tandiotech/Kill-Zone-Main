import type { DominanceResult } from "../score-utils";

export function ForcesCompactPanel({ model }: { model: DominanceResult }) {
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-eyebrow">FORCES · FAST TAPE</span>
        <span className="card-meta">TOP WEIGHTED</span>
      </div>
      <div className="b-forces-compact">
        {model.bullForces.slice(0, 3).map((f) => (
          <div key={f.name} className="b-force-line bull">
            <span className="fname">{f.name}</span>
            <span className="fw">+{f.weight.toFixed(2)}</span>
          </div>
        ))}
        {model.bearForces.slice(0, 3).map((f) => (
          <div key={f.name} className="b-force-line bear">
            <span className="fname">{f.name}</span>
            <span className="fw">−{f.weight.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
