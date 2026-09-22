const GMT_PLUS_ONE_TIMEZONE = "Etc/GMT-1";

function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatGmtPlus1Time(
  value: string | number | Date,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  const date = toDate(value);
  return date.toLocaleTimeString("en-GB", {
    hour12: false,
    timeZone: GMT_PLUS_ONE_TIMEZONE,
    ...opts,
  });
}

export function formatGmtPlus1Date(
  value: string | number | Date,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  const date = toDate(value);
  return date.toLocaleDateString("en-GB", {
    timeZone: GMT_PLUS_ONE_TIMEZONE,
    ...opts,
  });
}

export function formatGmtPlus1DateTime(
  value: string | number | Date,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  const date = toDate(value);
  return date.toLocaleString("en-GB", {
    hour12: false,
    timeZone: GMT_PLUS_ONE_TIMEZONE,
    ...opts,
  });
}

export const GMT_PLUS_ONE_LABEL = "GMT+1";
