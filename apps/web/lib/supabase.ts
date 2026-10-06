import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRequiredPublicEnv } from "@/lib/env";

let cachedClient: SupabaseClient | null = null;

// One createClient() call spawns its own GoTrue instance, and they fight over the
// stored session while logging "Multiple GoTrueClient instances detected".
export function getSupabaseBrowserClient(): SupabaseClient {
  cachedClient ??= createClient(
    getRequiredPublicEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );

  return cachedClient;
}
