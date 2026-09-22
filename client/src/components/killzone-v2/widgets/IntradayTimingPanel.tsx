import type { DominanceModesInput, DominanceModels } from "../dominance-models";
import { DominanceBarRow } from "./DominanceBarRow";

export function IntradayTimingPanel({
  models,
  dominanceModes,
}: {
  models: DominanceModels;
  dominanceModes?: DominanceModesInput;
}) {
  const rows = [
    {
      key: "4h",
      label: "Intraday Flow (4h)",
      model: models.intraday4h,
      at: dominanceModes?.intraday4h?.lastSampleAt,
    },
    {
      key: "2h",
      label: "Intraday Flow (2h)",
      model: models.intraday2h,
      at: dominanceModes?.intraday2h?.lastSampleAt,
    },
    {
      key: "fast",
      label: "Fast Intraday Flow (15m/1h)",
      model: models.intraday,
      at: dominanceModes?.intraday?.lastSampleAt,
    },
  ];

  return (
    <div className="card card-gold timing-panel">
      <div className="card-head">
        <span className="card-eyebrow">INTRADAY TIMING · 15M TO 4H</span>
        <span className="card-meta">EXECUTION LAYER</span>
      </div>
      <div className="timing-panel-body">
        {rows.map((row) => (
          <DominanceBarRow
            key={row.key}
            label={row.label}
            model={row.model}
            lastSampleAt={row.at}
            variant="timing"
          />
        ))}
      </div>
    </div>
  );
}
