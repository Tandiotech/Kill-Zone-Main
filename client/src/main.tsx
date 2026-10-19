import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/killzone-v2.css";
import "./styles/killzone-concept-b.css";
import { supabase, supabaseConfigured } from "./lib/supabase";

async function prepareAuthRedirect(): Promise<void> {
  if (!supabaseConfigured) return;

  const url = new URL(window.location.href);

  if (url.searchParams.has("code")) {
    const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
    if (error) console.error("[auth] exchangeCodeForSession:", error.message);
    window.history.replaceState(null, "", "/");
    return;
  }

  // Supabase's implicit/magic-link flow delivers the session in the URL
  // fragment (#access_token=...). That's unrelated to app routing — just
  // strip it once consumed so it doesn't linger in the address bar.
  const h = window.location.hash;
  if (h.includes("access_token") || h.includes("type=magiclink")) {
    await supabase.auth.getSession();
    window.history.replaceState(null, "", "/");
  }
}

async function boot() {
  await prepareAuthRedirect();
  createRoot(document.getElementById("root")!).render(<App />);
}

void boot();
