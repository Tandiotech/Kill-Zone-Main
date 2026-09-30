import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { hashPassword } from "../server/auth.js";

function loadDotEnv() {
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
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function main() {
  loadDotEnv();
  const email = normalizeEmail(process.argv[2] ?? "");
  const password = process.argv[3] ?? "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    console.error("Usage: npm run add-admin -- admin@domain.com 'a strong password (8+ chars)'");
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env)");
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const password_hash = hashPassword(password);
  const { error } = await admin
    .from("admin_users")
    .upsert({ email, password_hash }, { onConflict: "email" });

  if (error) {
    console.error("admin_users:", error.message);
    process.exit(1);
  }

  console.log("admin_users:", email);
  console.log("Done. Use the 'Login as admin' link on the login page.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
