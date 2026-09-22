import { useEffect, useState } from "react";
import { useHashLocation } from "wouter/use-hash-location";
import { apiUrl } from "@/lib/apiBase";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { clearStoredAuthToken, getStoredAuthToken } from "@/lib/authToken";

const PUBLIC_PATHS = new Set(["/login"]);

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [location] = useHashLocation();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (PUBLIC_PATHS.has(location)) {
        if (!cancelled) {
          setAllowed(true);
          setReady(true);
        }
        return;
      }

      const localToken = getStoredAuthToken();
      if (localToken) {
        const r = await fetch(apiUrl("/api/auth/session"), {
          headers: { Authorization: `Bearer ${localToken}` },
        });
        if (r.ok) {
          if (!cancelled) {
            setAllowed(true);
            setReady(true);
          }
          return;
        }
        clearStoredAuthToken();
      }

      if (!supabaseConfigured) {
        if (!cancelled) {
          setAllowed(false);
          setReady(true);
          window.location.hash = "#/login";
        }
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        if (!cancelled) {
          setAllowed(false);
          setReady(true);
          window.location.hash = "#/login";
        }
        return;
      }

      const r = await fetch(apiUrl("/api/auth/session"), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!r.ok) {
        await supabase.auth.signOut();
        clearStoredAuthToken();
        if (!cancelled) {
          setAllowed(false);
          setReady(true);
          window.location.hash = "#/login";
        }
        return;
      }

      if (!cancelled) {
        setAllowed(true);
        setReady(true);
      }
    }

    void verify();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void verify();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [location]);

  if (PUBLIC_PATHS.has(location)) {
    return <>{children}</>;
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(210_22%_8%)] text-[hsl(210_8%_55%)] text-sm">
        Loading…
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
