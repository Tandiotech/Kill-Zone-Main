/**
 * When RYSE GLOBAL iframes the cockpit (`?embed=1`), Killzone login is skipped.
 * The parent posts a short-lived RYSE embed token; this module holds it in
 * memory (never localStorage, so it cannot overwrite an operator session).
 */

export function isRyseEmbed(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("embed") === "1";
}

let token: string | null = null;
const waiters: Array<(value: string) => void> = [];

export function getEmbedToken(): string | null {
  return token;
}

export function waitForEmbedToken(): Promise<string> {
  if (token) return Promise.resolve(token);
  return new Promise((resolve) => {
    waiters.push(resolve);
  });
}

function askParentForToken() {
  if (!isRyseEmbed() || window.parent === window) return;
  window.parent.postMessage({ type: "ryse-killzone:ready" }, "*");
}

export function clearEmbedToken() {
  token = null;
  askParentForToken();
}

if (typeof window !== "undefined" && isRyseEmbed()) {
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    const data = event.data as { type?: unknown; token?: unknown } | null;
    if (data?.type !== "ryse-killzone:token" || typeof data.token !== "string" || !data.token)
      return;
    token = data.token;
    const pending = waiters.splice(0);
    for (const resolve of pending) resolve(token);
  });
  askParentForToken();
  window.setInterval(() => {
    if (!token) askParentForToken();
  }, 400);
}
