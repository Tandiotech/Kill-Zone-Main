import type { GoldDecisionBrief as Brief } from "./decision-brief";

export function GoldDecisionBrief({ brief }: { brief: Brief }) {
  return (
    <div className="gold-decision-brief">
      <div className="gold-decision-brief-kicker">
        {brief.newsSource ? "GOLD NEWS" : "DECISION BRIEF"}
      </div>
      {brief.newsUrl ? (
        <a
          className="gold-decision-brief-headline gold-decision-brief-headline--link"
          href={brief.newsUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {brief.headline}
        </a>
      ) : (
        <div className="gold-decision-brief-headline">{brief.headline}</div>
      )}
      <div className="gold-decision-brief-body">{brief.body}</div>
      {brief.whatChanged && (
        <div className="gold-what-changed">
          <strong>What changed?</strong>
          <span>{brief.whatChanged}</span>
        </div>
      )}
    </div>
  );
}
