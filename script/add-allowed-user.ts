import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

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
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Usage: npm run add-user -- you@domain.com");
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

  const { error: upsertErr } = await admin.from("allowed_users").upsert(
    { email },
    { onConflict: "email" },
  );
  if (upsertErr) {
    console.error("allowed_users:", upsertErr.message);
    process.exit(1);
  }
  console.log("allowed_users:", email);

  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (createErr) {
    const m = createErr.message.toLowerCase();
    if (m.includes("already") || m.includes("registered") || m.includes("exists")) {
      console.log("auth.users: already present (ok)");
    } else {
      console.error("auth.admin.createUser:", createErr.message);
      process.exit(1);
    }
  } else {
    console.log("auth.users: created");
  }

  console.log("Done. User can request a magic link from the login page.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
