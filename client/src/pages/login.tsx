import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { setStoredAuthToken } from "@/lib/authToken";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string; token?: string };
      if (!res.ok) {
        setStatus("error");
        setMessage(
          res.status === 403
            ? "You don't have access to this platform"
            : body.message || "Something went wrong.",
        );
        return;
      }
      if (!body.token) {
        setStatus("error");
        setMessage("Login response was invalid. Please try again.");
        return;
      }
      setStoredAuthToken(body.token);
      setStatus("success");
      setMessage("Access granted. Redirecting…");
      setTimeout(() => {
        window.location.hash = "#/";
      }, 300);
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(210_22%_8%)] p-4 sm:p-6">
      <div className="w-full max-w-sm space-y-5 sm:space-y-6 rounded-lg border border-[hsl(210_15%_18%)] bg-[hsl(210_22%_10%)] p-5 sm:p-8 shadow-xl">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[hsl(210_10%_92%)]">
            Gold Intelligence
          </h1>
          <p className="mt-1 text-xs text-[hsl(210_8%_50%)]">
            Invite-only access. Enter your approved email to get access.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-[hsl(210_8%_55%)] mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-[hsl(210_15%_20%)] bg-[hsl(210_22%_12%)] px-3 py-2.5 text-sm text-[hsl(210_10%_90%)] placeholder:text-[hsl(210_8%_40%)] focus:outline-none focus:ring-1 focus:ring-[#C49B30]"
              placeholder="you@company.com"
              disabled={status === "loading"}
            />
          </div>
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full rounded-md bg-[#C49B30] px-3 py-3 text-sm font-semibold text-[hsl(210_22%_8%)] hover:bg-[#d4ae4a] disabled:opacity-60 transition-colors"
          >
            {status === "loading" ? "Verifying…" : "Verify Email & Grant Access"}
          </button>
        </form>

        {message && (
          <p
            className={`text-sm ${status === "success" ? "text-emerald-400/90" : "text-amber-500/90"}`}
            role={status === "error" ? "alert" : "status"}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
