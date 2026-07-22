// Seed the three DEV/STAGING demo accounts as real Supabase Auth users.
//
// These are for continued development and testing only — NOT the production
// user list. Real LGU staff accounts are created separately at onboarding.
//
// Run it yourself (the service_role key stays on your machine, never in the
// repo or the client bundle):
//
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<your service_role key> \
//   node supabase/seed-users.mjs
//
// It is idempotent: re-running updates the password + metadata of existing
// accounts, so it doubles as the "reset dev accounts" tool. To rotate the dev
// password, set SEED_PASSWORD and re-run.
//
// The agv_profiles row for each user is created automatically by the
// agv_handle_new_user trigger from the metadata below.

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
// One shared dev password across the three seed accounts keeps the dev
// quick-switcher simple. Override with SEED_PASSWORD to rotate.
const password = process.env.SEED_PASSWORD || "agv-dev-2026!";

if (!url || !serviceRole) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}

const admin = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ACCOUNTS = [
  { email: "admin@agv-demo.com", name: "A. Mercer", role: "admin" },
  { email: "user1@agv-demo.com", name: "S. Whitfield", role: "user" },
  { email: "user2@agv-demo.com", name: "R. Santiago", role: "user" },
];

async function findByEmail(email) {
  // paginate; the dev project is tiny so one page is plenty
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email === email) ?? null;
}

for (const acct of ACCOUNTS) {
  const meta = { name: acct.name, role: acct.role };
  const existing = await findByEmail(acct.email);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      user_metadata: meta,
      email_confirm: true,
    });
    if (error) throw error;
    // keep the profile in step in case the trigger predated a metadata change
    await admin
      .from("agv_profiles")
      .update({ name: acct.name, role: acct.role })
      .eq("id", existing.id);
    console.log(`updated  ${acct.email} (${acct.role})`);
  } else {
    const { error } = await admin.auth.admin.createUser({
      email: acct.email,
      password,
      email_confirm: true,
      user_metadata: meta,
    });
    if (error) throw error;
    console.log(`created  ${acct.email} (${acct.role})`);
  }
}

console.log(`\nDone. Dev password: ${password}`);
console.log("These are dev/staging accounts only — not production users.");
