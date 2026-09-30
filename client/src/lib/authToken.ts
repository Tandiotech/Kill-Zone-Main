const AUTH_TOKEN_KEY = "gold_intel_auth_token";

export function getStoredAuthToken(): string | null {
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredAuthToken(token: string): void {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearStoredAuthToken(): void {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

const ADMIN_AUTH_TOKEN_KEY = "gold_intel_admin_auth_token";

export function getStoredAdminToken(): string | null {
  return window.localStorage.getItem(ADMIN_AUTH_TOKEN_KEY);
}

export function setStoredAdminToken(token: string): void {
  window.localStorage.setItem(ADMIN_AUTH_TOKEN_KEY, token);
}

export function clearStoredAdminToken(): void {
  window.localStorage.removeItem(ADMIN_AUTH_TOKEN_KEY);
}
