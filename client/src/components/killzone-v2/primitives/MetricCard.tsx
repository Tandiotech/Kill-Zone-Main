export function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="b-row">
      <span className="k">{label}</span>
      <span className="v">{value}</span>
    </div>
  );
}
