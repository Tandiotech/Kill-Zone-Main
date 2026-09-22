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
    url.search = "";
    url.hash = "#/";
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    return;
  }

  const h = window.location.hash;
  if (h.includes("access_token") || h.includes("type=magiclink")) {
    await supabase.auth.getSession();
    window.history.replaceState(null, "", `${window.location.pathname}#/`);
  }
}

async function boot() {
  await prepareAuthRedirect();
  if (!window.location.hash) {
    window.location.hash = "#/";
  }
  createRoot(document.getElementById("root")!).render(<App />);
}

void boot();
