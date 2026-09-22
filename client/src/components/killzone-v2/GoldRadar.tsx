import { useId, useMemo, useState, type CSSProperties } from "react";
import { formatGmtPlus1Time, GMT_PLUS_ONE_LABEL } from "@/lib/timezone";
import type { DominanceModesInput, DominanceModels } from "./dominance-models";
import { splitRegimeFlag } from "./dominance-models";
import {
  buildRadarVertices,
  labelAnchor,
  polygonPoints,
  radarConviction,
  vertexToPoint,
  type RadarCurrent,
  type RadarVertex,
} from "./radar-utils";
import { scoreLabel } from "./score-utils";

const VERTEX_COLOR = {
  bull: "#8fc89a",
  bear: "#dc8a8e",
  neutral: "#b6b1a4",
};

function sideTone(side: RadarVertex["side"]): string {
  if (side === "bull") return "Supporting gold";
  if (side === "bear") return "Opposing gold";
  return "Balanced / neutral";
}

function tipPosition(angleDeg: number): CSSProperties {
  // Keep tip toward outer edge of that spoke so it never covers the hub.
  const rad = (angleDeg * Math.PI) / 180;
  const x = 50 + Math.sin(rad) * 34;
  const y = 50 - Math.cos(rad) * 34;
  return {
    left: `${x}%`,
    top: `${y}%`,
    transform: "translate(-50%, -50%)",
  };
}

export function GoldRadar({
  score,
  models,
  dominanceModes,
  current,
  macroLastFetched,
}: {
  score: number;
  models: DominanceModels;
  dominanceModes?: DominanceModesInput;
  current?: RadarCurrent;
  macroLastFetched?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const vertices = useMemo(
    () =>
      buildRadarVertices(
        models.macro,
        models.intraday,
        models.intraday4h,
        dominanceModes?.macro?.components,
        dominanceModes?.intraday?.components,
        dominanceModes?.intraday4h?.components,
        current,
      ),
    [models, dominanceModes, current],
  );

  const poly = useMemo(() => polygonPoints(vertices), [vertices]);
  const hovered = vertices.find((v) => v.id === hoveredId) ?? null;
  const split = splitRegimeFlag(models.macro, models.intraday);
  const intra = models.intraday;
  const bullPct = intra.bullPct;
  const bearPct = intra.bearPct;
  const edge = intra.edge;
  const conviction = radarConviction(models.macro, intra, split);
  const biasWord = scoreLabel(score).split(" ")[0];

  const timeLabel = macroLastFetched
    ? `${formatGmtPlus1Time(macroLastFetched, { hour: "2-digit", minute: "2-digit" })} ${GMT_PLUS_ONE_LABEL}`
    : GMT_PLUS_ONE_LABEL;

  return (
    <div
      className="radar-card"
      style={
        {
          "--radar-macro": models.macro.bullPct / 100,
          "--radar-intra": models.intraday.bearPct / 100,
        } as CSSProperties
      }
    >
      <div className="radar-head">
        <span className="card-eyebrow">
          <span className="radar-live-pip" aria-hidden />
          GOLD PRESSURE RADAR · LIVE
        </span>
        <span className="card-meta">8-FACTOR SYNTHESIS · {timeLabel}</span>
      </div>

      <div className="radar-stage">
        <div className="radar-stage-bg" aria-hidden>
          <div className="radar-stage-grid" />
          <div className="radar-stage-glow radar-stage-glow--bull" />
          <div className="radar-stage-glow radar-stage-glow--bear" />
          <div className="radar-stage-vignette" />
        </div>

        <div className="radar-svg-wrap">
          <div className={`radar-visual${hovered ? " is-focus" : ""}`}>
            <svg
              className="radar-svg"
              viewBox="-272 -272 544 544"
              preserveAspectRatio="xMidYMid meet"
              aria-label="Gold pressure radar"
            >
              <defs>
                <radialGradient id={`${uid}-rGlow`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#d4af57" stopOpacity="0.35" />
                  <stop offset="55%" stopColor="#d4af57" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#d4af57" stopOpacity="0" />
                </radialGradient>
                <radialGradient id={`${uid}-rBull`} cx="50%" cy="0%" r="85%">
                  <stop offset="0%" stopColor="#6ca678" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#6ca678" stopOpacity="0" />
                </radialGradient>
                <radialGradient id={`${uid}-rBear`} cx="50%" cy="100%" r="85%">
                  <stop offset="0%" stopColor="#c66a6f" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#c66a6f" stopOpacity="0" />
                </radialGradient>
                <linearGradient id={`${uid}-bullArc`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6ca678" stopOpacity="0.05" />
                  <stop offset="50%" stopColor="#8fc89a" stopOpacity="1" />
                  <stop offset="100%" stopColor="#6ca678" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id={`${uid}-bearArc`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#c66a6f" stopOpacity="0.05" />
                  <stop offset="50%" stopColor="#dc8a8e" stopOpacity="1" />
                  <stop offset="100%" stopColor="#c66a6f" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id={`${uid}-polyFill`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#8fc89a" stopOpacity="0.12" />
                  <stop offset="50%" stopColor="#d4af57" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#dc8a8e" stopOpacity="0.12" />
                </linearGradient>
                <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="2.2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <circle cx="0" cy="-36" r="255" fill={`url(#${uid}-rBull)`} />
              <circle cx="0" cy="36" r="255" fill={`url(#${uid}-rBear)`} />

              {[245, 205, 165, 125, 95].map((r, i) => (
                <circle
                  key={r}
                  cx="0"
                  cy="0"
                  r={r}
                  fill={i === 3 ? `url(#${uid}-rGlow)` : "none"}
                  stroke={
                    i === 4
                      ? "rgba(212,175,87,0.35)"
                      : i === 2
                        ? "rgba(255,255,255,0.07)"
                        : "rgba(255,255,255,0.04)"
                  }
                  strokeWidth={i === 4 ? 1.5 : 1}
                  strokeDasharray={i === 2 ? "3 5" : undefined}
                  className={i === 4 ? "radar-ring-pulse" : undefined}
                />
              ))}

              <g stroke="rgba(255,255,255,0.07)" strokeWidth="1">
                <line x1="0" y1="-245" x2="0" y2="245" />
                <line x1="-245" y1="0" x2="245" y2="0" />
                <line x1="-173" y1="-173" x2="173" y2="173" />
                <line x1="-173" y1="173" x2="173" y2="-173" />
              </g>

              <path
                d="M -228 0 A 228 228 0 0 1 228 0"
                fill="none"
                stroke={`url(#${uid}-bullArc)`}
                strokeWidth="2.5"
                strokeLinecap="square"
                opacity={models.macro.bullPct / 100}
              />
              <path
                d="M 228 0 A 228 228 0 0 1 -228 0"
                fill="none"
                stroke={`url(#${uid}-bearArc)`}
                strokeWidth="2.5"
                strokeLinecap="square"
                opacity={models.intraday.bearPct / 100}
              />

              <circle
                className="radar-sweep"
                cx="0"
                cy="0"
                r="238"
                fill="none"
                stroke="rgba(212,175,87,0.2)"
                strokeWidth="1.25"
                strokeDasharray="36 1480"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 0 0"
                  to="360 0 0"
                  dur="11s"
                  repeatCount="indefinite"
                />
              </circle>

              <text x="0" y="-258" textAnchor="middle" fill="#6ca678" fontSize="8.5" letterSpacing="2.2" opacity="0.85">
                ↑ BULL HEMISPHERE · MACRO
              </text>
              <text x="0" y="264" textAnchor="middle" fill="#c66a6f" fontSize="8.5" letterSpacing="2.2" opacity="0.85">
                INTRADAY · BEAR HEMISPHERE ↓
              </text>

              <polygon
                className="radar-polygon radar-polygon--fill"
                points={poly}
                fill={`url(#${uid}-polyFill)`}
                stroke="none"
                filter={`url(#${uid}-glow)`}
              />
              <polygon
                className="radar-polygon radar-polygon--stroke"
                points={poly}
                fill="none"
                stroke="#e8c878"
                strokeWidth="2"
                strokeLinejoin="miter"
                strokeMiterlimit="8"
              />

              {vertices.map((v, idx) => {
                const p = vertexToPoint(v.normalized, v.angleDeg);
                const lbl = labelAnchor(v.angleDeg, 248);
                const color = VERTEX_COLOR[v.side];
                const isHot = hoveredId === v.id;
                const nameDy = Math.abs(lbl.x) > 40 ? -6 : lbl.y < 0 ? -8 : 4;
                const valueDy = nameDy + 12;

                return (
                  <g
                    key={v.id}
                    className={`radar-spoke${isHot ? " is-hot" : ""}`}
                    onMouseEnter={() => setHoveredId(v.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onFocus={() => setHoveredId(v.id)}
                    onBlur={() => setHoveredId(null)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${v.label} ${v.sublabel}. ${v.detail}`}
                  >
                    {/* Invisible hit target */}
                    <circle cx={lbl.x} cy={lbl.y} r="28" fill="transparent" className="radar-spoke-hit" />
                    <circle cx={p.x} cy={p.y} r="22" fill="transparent" className="radar-spoke-hit" />

                    <circle cx={p.x} cy={p.y} r={isHot ? 8 : 6} fill={color} opacity={isHot ? 0.32 : 0.18}>
                      <animate
                        attributeName="r"
                        values={isHot ? "7;10;7" : "5;7;5"}
                        dur={`${2.2 + (idx % 4) * 0.3}s`}
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle cx={p.x} cy={p.y} r={isHot ? 4.2 : 3.2} fill={color} />

                    <text
                      className="radar-spoke-name"
                      x={lbl.x}
                      y={lbl.y + nameDy}
                      textAnchor="middle"
                      fill={isHot ? "#ece8db" : "#9a9689"}
                      fontSize={isHot ? 11 : 9}
                      letterSpacing="1.1"
                      fontWeight={isHot ? 600 : 500}
                    >
                      {v.label}
                    </text>
                    <text
                      className="radar-spoke-val"
                      x={lbl.x}
                      y={lbl.y + valueDy}
                      textAnchor="middle"
                      fill={color}
                      fontSize={isHot ? 13 : 9.5}
                      fontWeight="600"
                    >
                      {v.sublabel}
                    </text>
                  </g>
                );
              })}

              <circle cx="0" cy="0" r="70" fill="#080a0e" stroke="rgba(212,175,87,0.5)" strokeWidth="1.2" />
              <circle
                className="radar-hub-ring"
                cx="0"
                cy="0"
                r="80"
                fill="none"
                stroke="rgba(212,175,87,0.22)"
                strokeWidth="1"
              />
              <text x="0" y="-28" textAnchor="middle" fill="#6b6e75" fontSize="8" letterSpacing="2.5">
                SCORE
              </text>
              <text
                x="0"
                y="14"
                textAnchor="middle"
                fill="#ece8db"
                fontSize="40"
                fontWeight="600"
                letterSpacing="-2"
              >
                {Math.round(score)}
              </text>
              <text x="0" y="38" textAnchor="middle" fill="#ecc878" fontSize="9" letterSpacing="2.5">
                {biasWord}
              </text>
              {split ? (
                <text x="0" y="54" textAnchor="middle" fill="#c9a24b" fontSize="7" letterSpacing="1.5">
                  SPLIT
                </text>
              ) : null}
            </svg>

            {hovered ? (
              <div
                className={`radar-tip radar-tip--${hovered.side}`}
                style={tipPosition(hovered.angleDeg)}
                role="tooltip"
              >
                <div className="radar-tip-head">
                  <span className="radar-tip-name">{hovered.label}</span>
                  <span className="radar-tip-val mono">{hovered.sublabel}</span>
                </div>
                <div className="radar-tip-tone">{sideTone(hovered.side)}</div>
                <p className="radar-tip-detail">{hovered.detail}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="radar-foot">
        <div className="cell">
          <span className="k">SUPPORT</span>
          <span className="v green">{bullPct.toFixed(1)}%</span>
        </div>
        <div className="cell">
          <span className="k">OPPOSE</span>
          <span className="v red">{bearPct.toFixed(1)}%</span>
        </div>
        <div className="cell">
          <span className="k">NET EDGE</span>
          <span className={`v ${edge >= 0 ? "green" : "red"}`}>
            {edge > 0 ? "+" : ""}
            {edge.toFixed(1)}
          </span>
        </div>
        <div className="cell">
          <span className="k">CONVICTION</span>
          <span className="v gold">{conviction}</span>
        </div>
      </div>
    </div>
  );
}
