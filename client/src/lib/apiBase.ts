/** Base URL for the Express API (no trailing slash). Empty = same origin as the static app. */
export function getApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (typeof raw !== "string" || !raw.trim()) return "";
  return raw.trim().replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
