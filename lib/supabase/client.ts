import { createBrowserClient } from "@supabase/ssr";

function createBrowserStub() {
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: (_table: string) => ({
      select: () => Promise.resolve({ data: [], error: null, count: 0 }),
    }),
  } as unknown as ReturnType<typeof createBrowserClient>;
}

export function createClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return createBrowserStub();
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
