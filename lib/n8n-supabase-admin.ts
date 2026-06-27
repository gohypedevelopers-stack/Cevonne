import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/server/config";

let cachedClient: SupabaseClient | null = null;

const n8nSupabaseUrl = env.n8nSupabaseUrl.trim();
const n8nSupabaseServiceRoleKey = env.n8nSupabaseServiceRoleKey.trim();

export const hasN8nSupabaseConfig = Boolean(n8nSupabaseUrl && n8nSupabaseServiceRoleKey);

export const getN8nSupabaseAdmin = () => {
  if (!hasN8nSupabaseConfig) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(n8nSupabaseUrl, n8nSupabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return cachedClient;
};
