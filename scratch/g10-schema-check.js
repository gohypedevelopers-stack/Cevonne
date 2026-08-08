const { createClient } = require("@supabase/supabase-js");

const s = createClient(
  "https://iudasvlakokaibcmqeit.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1ZGFzdmxha29rYWliY21xZWl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODc4NTM3NywiZXhwIjoyMDk0MzYxMzc3fQ.POTN7-iKLSb0_bBP3HrULMaxWRUtTM7NSHFrYA5kMA0"
);

async function main() {
  const tables = [
    "g10_google_data_runs",
    "g10_google_opportunities",
    "g10_nextjs_integration_settings",
    "g10_nextjs_integration_events",
    "g10_recommendations",
    "g10_dry_runs",
    "g10_experiments",
    "g10_approvals",
    "g10_execution_logs",
    "g10_seo_cro_recommendations",
    "g10_approval_decisions",
  ];

  for (const t of tables) {
    const { data, error } = await s.from(t).select("*").limit(1);
    if (error) {
      console.log(t + ": ERROR - " + error.message);
    } else {
      console.log(t + ": EXISTS");
      if (data && data.length > 0) {
        console.log("  Cols: " + Object.keys(data[0]).join(", "));
        console.log("  Sample: " + JSON.stringify(data[0]).substring(0, 600));
      } else {
        console.log("  (empty)");
      }
    }
  }
}

main().catch((e) => console.error(e.message));
