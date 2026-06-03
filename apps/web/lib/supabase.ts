import { createClient } from "@supabase/supabase-js";
import { getRequiredPublicEnv } from "@/lib/env";

export function createSupabaseBrowserClient() {
  return createClient(
    getRequiredPublicEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}
