export function getRequiredPublicEnv(
  name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "NEXT_PUBLIC_AUTH_CALLBACK_URL"
) {
  const values = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_AUTH_CALLBACK_URL: process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL
  };
  const value = values[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

// Empty means "no captcha configured", not "misconfigured": the auth forms must stay usable
// until GoTrue actually demands a token.
export function getOptionalPublicEnv(name: "NEXT_PUBLIC_TURNSTILE_SITE_KEY") {
  const values = {
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  };

  return values[name];
}
