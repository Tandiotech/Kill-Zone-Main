export function PressureBar({
  bullPct,
  bearPct,
  height = 8,
  showTick = false,
}: {
  bullPct: number;
  bearPct: number;
  height?: number;
  showTick?: boolean;
}) {
  const bull = Math.max(0, Math.min(100, bullPct));
  const bear = Math.max(0, Math.min(100, bearPct));
  return (
    <div className="pbar" style={{ height }}>
      <div className="pbar-fill-l" style={{ width: `${bull}%` }} />
      <div className="pbar-fill-r" style={{ width: `${bear}%` }} />
      {showTick && <div className="pbar-tick" style={{ left: "50%" }} />}
    </div>
  );
}
