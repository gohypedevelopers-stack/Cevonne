const { createClient } = require("@supabase/supabase-js");

const s = createClient(
  "https://iudasvlakokaibcmqeit.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1ZGFzdmxha29rYWliY21xZWl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODc4NTM3NywiZXhwIjoyMDk0MzYxMzc3fQ.POTN7-iKLSb0_bBP3HrULMaxWRUtTM7NSHFrYA5kMA0"
);

async function main() {
  // Full details of g10_recommendations
  const { data: recs, error: e1 } = await s.from("g10_recommendations").select("*").limit(3);
  console.log("=== g10_recommendations ===");
  if (e1) console.log("ERROR:", e1.message);
  else console.log(JSON.stringify(recs, null, 2));

  // Full details of g10_approvals 
  const { data: apps, error: e2 } = await s.from("g10_approvals").select("*").limit(3);
  console.log("\n=== g10_approvals ===");
  if (e2) console.log("ERROR:", e2.message);
  else console.log(JSON.stringify(apps, null, 2));

  // Full details of g10_execution_logs
  const { data: execs, error: e3 } = await s.from("g10_execution_logs").select("*").limit(3);
  console.log("\n=== g10_execution_logs ===");
  if (e3) console.log("ERROR:", e3.message);
  else console.log(JSON.stringify(execs, null, 2));

  // Full details of g10_google_data_runs
  const { data: runs, error: e4 } = await s.from("g10_google_data_runs").select("*").order("created_at", { ascending: false }).limit(2);
  console.log("\n=== g10_google_data_runs (latest) ===");
  if (e4) console.log("ERROR:", e4.message);
  else console.log(JSON.stringify(runs, null, 2));

  // g10_nextjs_integration_settings
  const { data: settings, error: e5 } = await s.from("g10_nextjs_integration_settings").select("*").limit(1);
  console.log("\n=== g10_nextjs_integration_settings ===");
  if (e5) console.log("ERROR:", e5.message);
  else console.log(JSON.stringify(settings, null, 2));

  // g10_nextjs_integration_events (latest)
  const { data: events, error: e6 } = await s.from("g10_nextjs_integration_events").select("*").order("created_at", { ascending: false }).limit(3);
  console.log("\n=== g10_nextjs_integration_events (latest) ===");
  if (e6) console.log("ERROR:", e6.message);
  else console.log(JSON.stringify(events, null, 2));
}

main().catch((e) => console.error(e.message));
