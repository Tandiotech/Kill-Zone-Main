import { z } from "zod";

// Component score data for a single month
export const componentScoreSchema = z.object({
  name: z.string(),
  score: z.number(),
  weight: z.number(),
  contribution: z.number(),
  /** Server-generated copy from live macro + tape (see server/factor-narrative.ts). */
  factorDetail: z.string().optional(),
  /** Live figures that justify the row (index levels, prior print, step %, scores). */
  factorSnapshot: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .optional(),
});

export type ComponentScore = z.infer<typeof componentScoreSchema>;

// Single month of backtest data
export const monthlyDataSchema = z.object({
  date: z.string(),
  goldClose: z.number(),
  goldReturn: z.number(),
  ryScore: z.number(),
  usdScore: z.number(),
  gprScore: z.number(),
  cbScore: z.number(),
  riskoffScore: z.number(),
  inflationScore: z.number(),
  momentumScore: z.number(),
  goldSafeHavenScore: z.number(),
  scoreBucket: z.string(),
  // Raw underlying data
  realYield: z.number(),
  vix: z.number(),
  breakeven: z.number(),
  hySpread: z.number(),
  usdBroad: z.number(),
  gpr: z.number(),
});

export type MonthlyData = z.infer<typeof monthlyDataSchema>;

// API response for /api/score
export const scoreResponseSchema = z.object({
  current: monthlyDataSchema,
  components: z.array(componentScoreSchema),
  dominanceModes: z
    .object({
      macro: z.object({
        components: z.array(componentScoreSchema),
      }),
      intraday: z.object({
        components: z.array(componentScoreSchema),
        window: z.literal("15m/1h"),
        lastSampleAt: z.string(),
      }),
      intraday2h: z.object({
        components: z.array(componentScoreSchema),
        window: z.literal("2h"),
        lastSampleAt: z.string(),
      }),
      intraday4h: z.object({
        components: z.array(componentScoreSchema),
        window: z.literal("4h"),
        lastSampleAt: z.string(),
      }),
    })
    .optional(),
  compositeScore: z.number(),
  regime: z.string(),
  lastUpdated: z.string(),
  // Live data metadata
  lastFetched: z.string().optional(),
  nextRefresh: z.string().optional(),
  dataStatus: z.enum(["live", "stale", "error", "historical"]).optional(),
  sources: z.object({
    fred: z.boolean(),
    yahoo: z.boolean(),
    gpr: z.boolean(),
  }).optional(),
});

export type ScoreResponse = z.infer<typeof scoreResponseSchema>;

// API response for /api/history
export const historyResponseSchema = z.object({
  data: z.array(monthlyDataSchema),
});

export type HistoryResponse = z.infer<typeof historyResponseSchema>;

// API response for /api/hourly-sentiment
export const hourlySentimentPointSchema = z.object({
  time: z.string(), // HH:00 London
  bullishPct: z.number().nullable(),
  bearishPct: z.number().nullable(),
  macroScore: z.number().nullable(), // macro composite score per hour
  intradayScore: z.number().nullable(), // intraday composite score per hour
  capturedAt: z.string().nullable(), // ISO timestamp
});

export const hourlySentimentDaySchema = z.object({
  date: z.string(), // YYYY-MM-DD London date key
  label: z.string(), // e.g. Today, Mon 22 Apr
  points: z.array(hourlySentimentPointSchema),
});

export const hourlySentimentResponseSchema = z.object({
  timezone: z.literal("Europe/London"),
  generatedAt: z.string(),
  days: z.array(hourlySentimentDaySchema),
});

export type HourlySentimentResponse = z.infer<typeof hourlySentimentResponseSchema>;

// Weight presets
export const ORIGINAL_WEIGHTS = {
  realYield: 0.25,
  usd: 0.20,
  gpr: 0.15,
  cb: 0.10,
  riskoff: 0.15,
  inflation: 0.10,
  momentum: 0.05,
} as const;

export const OPTIMIZED_WEIGHTS = {
  realYield: 0.15,
  usd: 0.12,
  gpr: 0.15,
  cb: 0.20,
  riskoff: 0.15,
  inflation: 0.08,
  momentum: 0.15,
} as const;
