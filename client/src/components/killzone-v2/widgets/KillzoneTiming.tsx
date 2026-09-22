import { formatGmtPlus1Time, GMT_PLUS_ONE_LABEL } from "@/lib/timezone";

const SESSIONS = [
  {
    name: "Asia",
    start: 0,
    end: 8,
    tz: "01:00 – 09:00",
    tag: "low" as const,
    tagLbl: "LOW VOL",
    primary: false,
    subLive: "Range-bound",
    subPrimary: "Liquidity thin — positioning into London open matters.",
  },
  {
    name: "London",
    start: 7,
    end: 15,
    tz: "08:00 – 16:00",
    tag: "primary" as const,
    tagLbl: "PRIMARY",
    primary: true,
    subLive: "London is the primary execution window.",
    subPrimary: "London is the primary execution window.",
  },
  {
    name: "New York",
    start: 13,
    end: 21,
    tz: "14:00 – 22:00",
    tag: "secondary" as const,
    tagLbl: "SECONDARY",
    primary: false,
    subLive: "Two-way flow at overlap",
    subPrimary: "Opens later — watch U.S. data cross-market reactions.",
  },
];

function sessionStatus(active: boolean, s: (typeof SESSIONS)[0], nowHour: number): string {
  if (!active) {
    if (nowHour < s.start) {
      const opensIn = s.start - nowHour;
      const h = Math.floor(opensIn);
      const m = Math.round((opensIn - h) * 60);
      return `Opens in ${h}h ${m}m`;
    }
    return "Closed";
  }
  const left = s.end - nowHour;
  const h = Math.floor(left);
  const m = Math.round((left - h) * 60);
  return `${s.subLive} · ${h}h ${m}m remaining`;
}

export function KillzoneTiming({
  stats,
}: {
  stats?: Record<string, string>;
}) {
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const nowHour = utcH + utcM / 60;
  const timeMeta = formatGmtPlus1Time(now.toISOString(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-eyebrow">KILLZONE TIMING</span>
        <span className="card-meta">
          {GMT_PLUS_ONE_LABEL} · {timeMeta}
        </span>
      </div>
      <div className="b-session-list">
        {SESSIONS.map((s) => {
          const active = nowHour >= s.start && nowHour < s.end;
          const upcoming =
            !active && nowHour < s.start && s.name === "London" && nowHour >= 0;
          const cls = [
            "b-session",
            active ? "is-live" : "",
            s.primary && (active || upcoming) ? "is-primary" : "",
          ]
            .filter(Boolean)
            .join(" ");

          let sub = sessionStatus(active, s, nowHour);
          if (!active && s.primary && nowHour < s.start) {
            const opensIn = s.start - nowHour;
            const h = Math.floor(opensIn);
            const m = Math.round((opensIn - h) * 60);
            sub = `${s.subPrimary} Opens in ${h}h ${m}m`;
          }
          if (stats?.[s.name] && active) {
            sub = `${sub.split("·")[0]?.trim() ?? s.subLive} · ${stats[s.name].replace("Avg range · ", "")}`;
          }

          return (
            <div key={s.name} className={cls}>
              <div>
                <div className="name">{s.name.toUpperCase()}</div>
                <div className="time mono">{s.tz}</div>
              </div>
              <div className="body">
                <div className="sub">{sub}</div>
              </div>
              <span className={`tag ${s.tag}`}>{s.tagLbl}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
