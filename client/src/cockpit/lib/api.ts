import { apiUrl } from '@/lib/apiBase'
import { clearStoredAuthToken, getStoredAuthToken } from '@/lib/authToken'
import { getAccessToken, supabase } from '@/lib/supabase'

/* The login screen lives in the main app at "#/login" (same origin, one level
   up from this page), so a rejected session sends the user back there. */
export function goToLogin() {
  window.location.replace('./#/login')
}

export async function signOut() {
  clearStoredAuthToken()
  try { await supabase.auth.signOut() } catch { /* not configured / already out */ }
  goToLogin()
}

/** Authenticated GET against the Killzone API, mirroring the main app's token handling. */
export async function getJSON<T>(path: string): Promise<T> {
  const token = getStoredAuthToken() ?? (await getAccessToken())
  const res = await fetch(apiUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (res.status === 401 || res.status === 403) {
    await signOut()
    throw new Error(`${res.status}: not authorised`)
  }
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`)
  return (await res.json()) as T
}
