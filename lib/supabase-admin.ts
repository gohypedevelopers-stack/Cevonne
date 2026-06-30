import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SupabaseAdminClient = ReturnType<typeof createClient>;

const getSupabaseAdminConfig = () => {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  return { supabaseUrl, serviceRoleKey };
};

const createSupabaseAdminClient = (): SupabaseAdminClient => {
  const { supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig();

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is missing");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

let cachedSupabaseAdmin: SupabaseAdminClient | null = null;
let cachedSupabaseAdminError: Error | null = null;

export const hasSupabaseAdminConfig = () => {
  const { supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig();
  return Boolean(supabaseUrl && serviceRoleKey);
};

export const getSupabaseAdmin = (): SupabaseClient => {
  if (cachedSupabaseAdmin) {
    return cachedSupabaseAdmin;
  }

  if (cachedSupabaseAdminError) {
    throw cachedSupabaseAdminError;
  }

  try {
    cachedSupabaseAdmin = createSupabaseAdminClient();
    return cachedSupabaseAdmin;
  } catch (error) {
    cachedSupabaseAdminError = error instanceof Error ? error : new Error(String(error));
    throw cachedSupabaseAdminError;
  }
};

export const supabaseAdmin = new Proxy({} as SupabaseAdminClient, {
  get(_target, property) {
    const client = getSupabaseAdmin() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(client, property, client);

    if (typeof value === "function") {
      return value.bind(client);
    }

    return value;
  },
}) as SupabaseClient;
