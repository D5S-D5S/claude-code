import { notFound } from "next/navigation";

/**
 * /debug/env — shows which env vars are present (true/false), NOT their values.
 * Only accessible in non-production environments.
 * In production, add ?secret=<DEBUG_SECRET> and set DEBUG_SECRET env var.
 */
export default function DebugEnvPage({
  searchParams,
}: {
  searchParams: { secret?: string };
}) {
  const isProd = process.env.NODE_ENV === "production";
  const debugSecret = process.env.DEBUG_SECRET;

  if (isProd && (!debugSecret || searchParams.secret !== debugSecret)) {
    notFound();
  }

  const vars = [
    { key: "NEXT_PUBLIC_SUPABASE_URL", value: process.env.NEXT_PUBLIC_SUPABASE_URL },
    { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    { key: "SUPABASE_SERVICE_ROLE_KEY", value: process.env.SUPABASE_SERVICE_ROLE_KEY },
    { key: "NEXT_PUBLIC_ENABLE_GOOGLE_AUTH", value: process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH },
    { key: "STRIPE_SECRET_KEY", value: process.env.STRIPE_SECRET_KEY },
    { key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", value: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY },
    { key: "STRIPE_WEBHOOK_SECRET", value: process.env.STRIPE_WEBHOOK_SECRET },
    { key: "ANTHROPIC_API_KEY", value: process.env.ANTHROPIC_API_KEY },
    { key: "NEXT_PUBLIC_APP_URL", value: process.env.NEXT_PUBLIC_APP_URL },
    { key: "RESEND_API_KEY", value: process.env.RESEND_API_KEY },
    { key: "NODE_ENV", value: process.env.NODE_ENV },
  ];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseConfigured =
    supabaseUrl.startsWith("http") &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "placeholder";

  return (
    <div style={{ fontFamily: "monospace", padding: "2rem", maxWidth: "600px" }}>
      <h1 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
        Environment Variable Status
      </h1>
      <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
        Values are NOT shown — only presence is indicated.
      </p>

      <div style={{ marginBottom: "1rem", padding: "0.75rem", background: supabaseConfigured ? "#ecfdf5" : "#fef2f2", borderRadius: "0.5rem", border: `1px solid ${supabaseConfigured ? "#6ee7b7" : "#fca5a5"}` }}>
        <strong>Supabase configured:</strong> {supabaseConfigured ? "✅ Yes" : "❌ No — login will show misconfigured banner"}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
            <th style={{ textAlign: "left", padding: "0.5rem 0", color: "#374151" }}>Variable</th>
            <th style={{ textAlign: "left", padding: "0.5rem 0", color: "#374151" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {vars.map(({ key, value }) => (
            <tr key={key} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "0.5rem 0", color: "#111827" }}>{key}</td>
              <td style={{ padding: "0.5rem 0" }}>
                {value && value !== "placeholder" ? (
                  <span style={{ color: "#059669" }}>✅ set</span>
                ) : (
                  <span style={{ color: "#dc2626" }}>❌ missing</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
