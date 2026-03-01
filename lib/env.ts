/**
 * Centralized environment variable helpers.
 * Use these instead of reading process.env directly to get consistent
 * validation and friendly error messages.
 */

/** Returns validated Supabase config or throws a readable error. */
export function getPublicSupabaseConfig(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !url.startsWith("http") || !key || key === "placeholder") {
    throw new Error(
      "App misconfigured: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in environment variables."
    );
  }
  return { url, key };
}

/** Safe boolean check — never throws. */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return (
    !!url &&
    url.startsWith("http") &&
    !!key &&
    key !== "placeholder"
  );
}

/** Returns the Stripe publishable key, or undefined if not set. */
export function getStripePublishableKey(): string | undefined {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || undefined;
}

/**
 * Returns true only when NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true.
 * Default is false — Google button is hidden until explicitly enabled
 * AND the Supabase Google provider is configured.
 */
export function isGoogleAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true";
}
