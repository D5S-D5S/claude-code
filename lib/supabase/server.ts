import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function createPreviewStub() {
  const nullResult = Promise.resolve({ data: null, error: null, count: 0 });

  function builder(): unknown {
    return new Proxy(nullResult, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      get(target: any, prop: string | symbol) {
        if (prop === "then" || prop === "catch" || prop === "finally") {
          const fn = target[prop];
          return typeof fn === "function" ? fn.bind(target) : fn;
        }
        return (..._args: unknown[]) => builder();
      },
    });
  }

  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
    },
    from: (_table: string) => builder(),
  } as unknown as ReturnType<typeof createServerClient>;
}

export async function createClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return createPreviewStub();
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component - ignore
          }
        },
      },
    }
  );
}
