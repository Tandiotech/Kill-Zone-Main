import type { ReactNode } from "react";

type InvRow = {
  trigger: ReactNode;
  exp: string;
  status: "near" | "armed" | "remote";
  statusLbl: string;
};

const INVALIDATIONS: InvRow[] = [
  {
    trigger: (
      <>
        Real yields break <b>above 2.00%</b> and hold for two daily closes
      </>
    ),
    exp: "Would confirm rate regime has overtaken safe-haven demand as the dominant driver.",
    status: "near",
    statusLbl: "NEAR",
  },
  {
    trigger: (
      <>
        USD broad index pushes <b>above 108.50</b>
      </>
    ),
    exp: "Dollar strength would compound yield pressure on gold.",
    status: "armed",
    statusLbl: "ARMED",
  },
  {
    trigger: (
      <>
        VIX drops under <b>16</b>
      </>
    ),
    exp: "If fear premium fades, safe-haven demand can compress quickly.",
    status: "near",
    statusLbl: "NEAR",
  },
];

export function Invalidation({
  rows,
}: {
  rows?: InvRow[];
}) {
  const list = rows?.length ? rows : INVALIDATIONS;

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-eyebrow">INVALIDATION CONDITIONS</span>
        <span className="card-meta">WHAT WOULD BREAK THIS NARRATIVE</span>
      </div>
      <div className="b-inv-list">
        {list.map((iv, i) => (
          <div key={i} className="b-inv-row">
            <span className="idx">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <div className="cond">{iv.trigger}</div>
              <div className="delta">{iv.exp}</div>
            </div>
            <span className={`stat ${iv.status === "remote" ? "remote" : iv.status}`}>
              {iv.statusLbl}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
