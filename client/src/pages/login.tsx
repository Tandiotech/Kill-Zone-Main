import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import {
  getStoredAdminToken,
  setStoredAdminToken,
  clearStoredAdminToken,
  getStoredAuthToken,
  setStoredAuthToken,
} from "@/lib/authToken";

type Mode = "user" | "admin";

type Status = "idle" | "loading" | "success" | "error";

/* The look is hand-ported from the cockpit kit (client/src/cockpit/styles/kit.css)
   — hairlines, one accent, mono numerals — but scoped to `kz-` classes so no
   cockpit CSS leaks into this bundle. */

const SCOPE_CSS = `
.kz-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #070604;
  padding: 24px;
  font-family: "Geist", ui-sans-serif, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-feature-settings: "cv11", "ss01";
  color: #f0e9db;
  -webkit-font-smoothing: antialiased;
}
.kz-panel {
  width: 100%;
  max-width: 380px;
  background: #0e0c08;
  border: 1px solid #241f16;
  border-radius: 6px;
  padding: 24px;
  animation: kz-rise .42s cubic-bezier(.22, .7, .2, 1) both;
}
.kz-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.kz-eyebrow {
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: #948a76;
}
.kz-title {
  margin: 6px 0 0;
  font-size: 16px;
  font-weight: 560;
  letter-spacing: -.015em;
  line-height: 1.25;
  color: #f0e9db;
}
.kz-tag {
  flex: none;
  font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  color: #948a76;
  border: 1px solid #241f16;
  border-radius: 3px;
  padding: 2px 7px;
  opacity: .9;
}
.kz-sub {
  margin: 10px 0 0;
  font-size: 12.5px;
  line-height: 1.55;
  color: #948a76;
}
.kz-seg {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-top: 18px;
  background: #070604;
  border: 1px solid #241f16;
  border-radius: 4px;
  padding: 2px;
  gap: 2px;
}
.kz-seg-pill {
  position: absolute;
  z-index: 0;
  top: 2px;
  bottom: 2px;
  left: 2px;
  width: calc(50% - 3px);
  background: #0e0c08;
  border: 1px solid #241f16;
  border-radius: 3px;
  transition: transform .34s cubic-bezier(.22, .7, .2, 1);
  pointer-events: none;
}
.kz-seg[data-mode="admin"] .kz-seg-pill { transform: translateX(calc(100% + 2px)); }
.kz-seg button {
  position: relative;
  z-index: 1;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: #948a76;
  background: none;
  border: 0;
  border-radius: 3px;
  padding: 6px 10px;
  cursor: pointer;
  transition: color .16s cubic-bezier(.22, .7, .2, 1);
}
.kz-seg button:hover { color: #f0e9db; }
.kz-seg button.on { color: #e8b85a; }
.kz-field { margin-top: 16px; }
.kz-field label {
  display: block;
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: #948a76;
  margin-bottom: 6px;
}
.kz-field input {
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  font-size: 12.5px;
  color: #f0e9db;
  background: #070604;
  border: 1px solid #241f16;
  border-radius: 4px;
  padding: 8px 10px;
  outline: none;
  transition: border-color .16s cubic-bezier(.22, .7, .2, 1);
}
.kz-field input::placeholder { color: rgba(148, 138, 118, .55); }
.kz-field input:hover { border-color: #948a76; }
.kz-field input:focus-visible { border-color: #e8b85a; }
.kz-field input:disabled { opacity: .6; }
.kz-submit {
  width: 100%;
  margin-top: 20px;
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  color: #070604;
  background: #e8b85a;
  border: 1px solid #e8b85a;
  border-radius: 4px;
  padding: 9px 11px;
  cursor: pointer;
  transition: filter .16s cubic-bezier(.22, .7, .2, 1), opacity .16s;
}
.kz-submit:hover:not(:disabled) { filter: brightness(1.08); }
.kz-submit:active:not(:disabled) { transform: translateY(.5px); }
.kz-submit:disabled { opacity: .55; cursor: default; }
.kz-submit:focus-visible { outline: 2px solid #e8b85a; outline-offset: 1px; }
.kz-status {
  margin: 16px 0 0;
  font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
  color: #948a76;
}
.kz-status.ok { color: #e8b85a; }
.kz-status.err { color: #c2352b; }
.kz-foot {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid #241f16;
  font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10.5px;
  letter-spacing: .06em;
  color: rgba(148, 138, 118, .6);
}
@keyframes kz-rise {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .kz-panel, .kz-seg-pill, .kz-field input, .kz-submit { animation: none; transition: none; }
}
`;

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setStatus("idle");
    setMessage(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage(null);
    try {
      if (mode === "admin") {
        await submitAdmin();
      } else {
        await submitUser();
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  }

  async function submitUser() {
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
  }

  async function submitAdmin() {
    const res = await fetch(apiUrl("/api/admin/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string; token?: string };
    if (!res.ok) {
      // A failed admin attempt must never leave a stale admin session behind.
      clearStoredAdminToken();
      setStatus("error");
      if (res.status === 401) {
        setMessage(body.message || "Wrong credentials.");
      } else if (res.status === 429) {
        setMessage(body.message || "Too many attempts. Try again later.");
      } else {
        setMessage(body.message || "Something went wrong.");
      }
      return;
    }
    if (!body.token) {
      setStatus("error");
      setMessage("Login response was invalid. Please try again.");
      return;
    }
    // Admin session lives under its own storage key — the user token is untouched.
    setStoredAdminToken(body.token);
    if (!getStoredAdminToken()) {
      setStatus("error");
      setMessage("Could not persist the admin session. Check browser storage.");
      return;
    }
    setStatus("success");
    setMessage("Access granted. Redirecting…");
    setTimeout(() => {
      window.location.hash = "#/admin";
    }, 300);
  }

  const loading = status === "loading";

  return (
    <div className="kz-screen">
      <style>{SCOPE_CSS}</style>
      <div className="kz-panel">
        <div className="kz-head">
          <div>
            <div className="kz-eyebrow">Killzone · Gold Intelligence</div>
            <h1 className="kz-title">Command Access</h1>
          </div>
          <span className="kz-tag">{mode === "admin" ? "ADM" : "OPS"}</span>
        </div>

        <p className="kz-sub">
          {mode === "admin"
            ? "Administrator console. Credentials are required."
            : "Invite-only access. Enter your approved email to get access."}
        </p>

        <div className="kz-seg" data-mode={mode} role="tablist" aria-label="Login mode">
          <span className="kz-seg-pill" aria-hidden="true" />
          <button
            type="button"
            role="tab"
            aria-selected={mode === "user"}
            className={mode === "user" ? "on" : ""}
            onClick={() => switchMode("user")}
          >
            Operator
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "admin"}
            className={mode === "admin" ? "on" : ""}
            onClick={() => switchMode("admin")}
          >
            Admin
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="kz-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              disabled={loading}
            />
          </div>

          {mode === "admin" && (
            <div className="kz-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
          )}

          <button type="submit" className="kz-submit" disabled={loading}>
            {loading
              ? "Verifying…"
              : mode === "admin"
                ? "Authenticate"
                : "Verify Email & Grant Access"}
          </button>
        </form>

        {message && (
          <p
            className={`kz-status ${status === "success" ? "ok" : status === "error" ? "err" : ""}`}
            role={status === "error" ? "alert" : "status"}
          >
            {message}
          </p>
        )}

        <div className="kz-foot">AUTH · {mode === "admin" ? "/api/admin/login" : "/api/auth/login"}</div>
      </div>
    </div>
  );
}
