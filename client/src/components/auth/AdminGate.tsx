import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { clearStoredAdminToken, getStoredAdminToken } from "@/lib/authToken";

export function AdminGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      const token = getStoredAdminToken();
      if (!token) {
        if (!cancelled) {
          setAllowed(false);
          setReady(true);
          window.location.hash = "#/login";
        }
        return;
      }

      const r = await fetch(apiUrl("/api/admin/session"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!r.ok) {
        clearStoredAdminToken();
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

    return () => {
      cancelled = true;
    };
  }, []);

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
