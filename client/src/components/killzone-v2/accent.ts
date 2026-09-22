export type AccentKey = "gold" | "amber" | "copper" | "ivory";

export const V2_ACCENTS: Record<
  AccentKey,
  Record<"--gold" | "--gold-bright" | "--gold-deep" | "--gold-dim" | "--gold-glow", string>
> = {
  gold: {
    "--gold": "#d4a24c",
    "--gold-bright": "#e8b85a",
    "--gold-deep": "#a07a2f",
    "--gold-dim": "rgba(212,162,76,0.14)",
    "--gold-glow": "rgba(212,162,76,0.35)",
  },
  amber: {
    "--gold": "#e89a3a",
    "--gold-bright": "#ffb347",
    "--gold-deep": "#b06a1a",
    "--gold-dim": "rgba(232,154,58,0.14)",
    "--gold-glow": "rgba(232,154,58,0.35)",
  },
  copper: {
    "--gold": "#c67a4e",
    "--gold-bright": "#e69366",
    "--gold-deep": "#8a4a25",
    "--gold-dim": "rgba(198,122,78,0.14)",
    "--gold-glow": "rgba(198,122,78,0.35)",
  },
  ivory: {
    "--gold": "#d7c9a8",
    "--gold-bright": "#f2e3c0",
    "--gold-deep": "#8a7c5a",
    "--gold-dim": "rgba(215,201,168,0.12)",
    "--gold-glow": "rgba(215,201,168,0.3)",
  },
};

export const TWEAK_DEFAULTS_V2 = {
  accent: "gold" as AccentKey,
  density: "comfortable" as "compact" | "comfortable" | "spacious",
};
