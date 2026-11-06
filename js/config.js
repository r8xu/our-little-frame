// ─────────────────────────────────────────────────────────────
//  Our Little Frame – configuration
//
//  Leave both Supabase values empty to run in DEMO MODE
//  (everything is stored only in this browser – nothing is shared).
//
//  To make it shared + private, paste your Supabase project values here.
//  The anon key is SAFE to publish: it is designed for browsers, and
//  access rules in the SQL you ran. NEVER paste the "service_role" key here.
// ─────────────────────────────────────────────────────────────
window.APP_CONFIG = {
  SUPABASE_URL: "https://ukgjnafeovxgyveeqirv.supabase.co",       // e.g. "https://abcdxyz.supabase.co"
  SUPABASE_ANON_KEY: "sb_publishable_Oi4GvV1dAP48JldvOYobkw_uFIuBYjj",  // the long "anon / public" key
  REQUIRE_LOGIN: false    // false = simple: no accounts, just share the link. (true needs supabase/schema-private.sql)
};
