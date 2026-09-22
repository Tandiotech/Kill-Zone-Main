import type { NextFunction, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

declare global {
  namespace Express {
    interface Request {
      authUser?: { email: string; sub: string };
    }
  }
}

const SEND_COOLDOWN_MS = 15_000;
const sendCooldown = new Map<string, number>();
const APP_AUTH_TTL = "7d";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

let adminSingleton: ReturnType<typeof createClient> | null | undefined;
let envLoaded = false;

function loadDotEnvOnce() {
  if (envLoaded) return;
  envLoaded = true;
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith("\"") && v.endsWith("\"")) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

export function getSupabaseAdmin() {
  if (adminSingleton !== undefined) return adminSingleton;
  loadDotEnvOnce();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    adminSingleton = null;
    return null;
  }
  adminSingleton = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminSingleton;
}

export function getPublicSiteUrl(): string {
  loadDotEnvOnce();
  return (process.env.PUBLIC_APP_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
}

function getAppAuthSecret(): string | null {
  loadDotEnvOnce();
  const secret = process.env.APP_AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return secret || null;
}

export async function isEmailInAllowlist(email: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (!admin) return false;
  const normalized = normalizeEmail(email);
  const { data, error } = await admin
    .from("allowed_users")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();
  if (error) {
    console.error("[auth] allowed_users:", error.message);
    return false;
  }
  return data != null;
}

export async function logLoginAttempt(
  email: string,
  outcome: "denied_not_allowed" | "otp_sent" | "error" | "direct_login",
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  try {
    await admin.from("login_attempts").insert({
      email: normalizeEmail(email),
      outcome,
    } as never);
  } catch (e) {
    console.error("[auth] login_attempts log:", e);
  }
}

export async function sendMagicLinkIfAllowed(
  email: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return { ok: false, status: 503, message: "Authentication is not configured." };
  }

  const normalized = normalizeEmail(email);
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    await logLoginAttempt(email || "", "error");
    return { ok: false, status: 400, message: "Enter a valid email address." };
  }

  const now = Date.now();
  const last = sendCooldown.get(normalized) ?? 0;
  if (now - last < SEND_COOLDOWN_MS) {
    return {
      ok: false,
      status: 429,
      message: "Please wait 15 seconds before requesting another link.",
    };
  }

  const allowed = await isEmailInAllowlist(normalized);
  if (!allowed) {
    await logLoginAttempt(normalized, "denied_not_allowed");
    return {
      ok: false,
      status: 403,
      message: "Access restricted. Contact support to request access.",
    };
  }

  sendCooldown.set(normalized, now);

  const redirectTo = `${getPublicSiteUrl()}/auth/callback`;

  const { error } = await admin.auth.signInWithOtp({
    email: normalized,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) {
    console.error("[auth] signInWithOtp:", error.message);
    await logLoginAttempt(normalized, "error");
    const msg = error.message.toLowerCase();
    if (msg.includes("rate limit")) {
      return {
        ok: false,
        status: 429,
        message: "Email send limit reached. Please wait a few minutes and try again.",
      };
    }
    return {
      ok: false,
      status: 503,
      message: "Could not send login email. Try again later.",
    };
  }

  await logLoginAttempt(normalized, "otp_sent");
  return { ok: true };
}

export async function issueDirectLoginIfAllowed(
  email: string,
): Promise<{ ok: true; token: string; email: string } | { ok: false; status: number; message: string }> {
  const normalized = normalizeEmail(email);
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    await logLoginAttempt(email || "", "error");
    return { ok: false, status: 400, message: "Enter a valid email address." };
  }
  const allowed = await isEmailInAllowlist(normalized);
  if (!allowed) {
    await logLoginAttempt(normalized, "denied_not_allowed");
    return {
      ok: false,
      status: 403,
      message: "Access restricted. Contact support to request access.",
    };
  }

  const secret = getAppAuthSecret();
  if (!secret) {
    return { ok: false, status: 503, message: "Authentication is not configured." };
  }

  const token = jwt.sign({ typ: "app", email: normalized }, secret, {
    expiresIn: APP_AUTH_TTL,
    issuer: "gold-intel-app",
    audience: "gold-intel-client",
    subject: normalized,
  });
  await logLoginAttempt(normalized, "direct_login");
  return { ok: true, token, email: normalized };
}

export async function validateBearerAndAllowlist(
  authHeader: string | undefined,
): Promise<{ ok: true; email: string; sub: string } | { ok: false; status: 401 | 403 }> {
  const raw = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!raw) return { ok: false, status: 401 };

  const secret = getAppAuthSecret();
  if (secret) {
    try {
      const decoded = jwt.verify(raw, secret, {
        issuer: "gold-intel-app",
        audience: "gold-intel-client",
      }) as jwt.JwtPayload;
      if (decoded.typ === "app" && typeof decoded.email === "string") {
        const allowed = await isEmailInAllowlist(decoded.email);
        if (!allowed) return { ok: false, status: 403 };
        return { ok: true, email: decoded.email, sub: String(decoded.sub || decoded.email) };
      }
    } catch {
      // Not a local app token; fall through to Supabase token validation.
    }
  }

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, status: 401 };

  const {
    data: { user },
    error,
  } = await admin.auth.getUser(raw);

  if (error || !user?.email) return { ok: false, status: 401 };

  const allowed = await isEmailInAllowlist(user.email);
  if (!allowed) return { ok: false, status: 403 };

  return { ok: true, email: user.email, sub: user.id };
}

export function requireAllowedUser(req: Request, res: Response, next: NextFunction) {
  void (async () => {
    try {
      if (!getSupabaseAdmin()) {
        res.status(503).json({ message: "Authentication is not configured." });
        return;
      }
      const r = await validateBearerAndAllowlist(req.headers.authorization);
      if (!r.ok) {
        res.status(r.status).json({
          message:
            r.status === 403
              ? "Access restricted. Contact support to request access."
              : "Unauthorized",
        });
        return;
      }
      req.authUser = { email: r.email, sub: r.sub };
      next();
    } catch (e) {
      console.error("[auth] requireAllowedUser:", e);
      res.status(500).json({ message: "Authentication check failed." });
    }
  })();
}
