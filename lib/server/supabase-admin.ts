import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/config/server";

const config = getSupabaseAdminConfig();

export const supabaseAdmin = createClient(config.url, config.serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

