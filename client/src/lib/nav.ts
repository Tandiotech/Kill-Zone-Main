/** Hard navigation to the login screen, for call sites that can't reach a
   router hook (plain utility modules, module-level fetch wrappers). Routing
   is path-based, so this always lands on a clean /login — no stale path
   segment left behind from wherever the redirect was triggered. */
export function goToLogin(): void {
  window.location.assign("/login");
}
