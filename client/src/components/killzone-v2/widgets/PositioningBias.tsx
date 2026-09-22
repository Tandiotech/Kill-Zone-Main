import type { ReactNode } from "react";
import { postureStep } from "../decision-brief";

const STEPS = ["OBSERVE", "PREPARE", "ACT", "MANAGE"] as const;

export function PositioningBias({
  score,
  title,
  body,
}: {
  bias?: string;
  score: number;
  title: string;
  body: ReactNode;
}) {
  const active = postureStep(score);
  const activeIdx =
    active === "observe" ? 0 : active === "prepare" ? 1 : active === "act" ? 2 : 3;

  const parts = title.split(/(?<=\.)\s+/);
  const line1 = parts[0] ?? title;
  const line2 = parts.slice(1).join(" ");

  return (
    <div className="card card-gold b-action-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span className="card-eyebrow">ACTION POSTURE</span>
        <span className="card-meta">APPROACH · NOT A SIGNAL</span>
      </div>
      <div className="b-action-stance">
        {line1}
        {line2 ? (
          <>
            <br />
            <em>{line2}</em>
          </>
        ) : null}
      </div>
      <div className="b-action-sub">{body}</div>
      <div>
        <div className="label-eye" style={{ marginBottom: 8 }}>
          POSTURE LADDER
        </div>
        <div className="b-action-meter">
          {STEPS.map((step, i) => (
            <span key={step} className={`step ${i === activeIdx ? "on" : "dim"}`}>
              {step}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
