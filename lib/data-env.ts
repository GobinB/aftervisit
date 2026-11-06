/**
 * Which database this deployment may use. Real families' data lives in the production project, and
 * only the production deployment reads its settings. A Vercel preview build (every pull request)
 * reads PREVIEW_* settings for a separate test project, or none at all, so a preview can never
 * reach production data even if production keys are later shared with previews by mistake.
 */
type Env = Record<string, string | undefined>;

export function dataEnv(source: Env = process.env) {
  const preview = source.VERCEL_ENV === "preview";
  const pick = (name: string) => (preview ? source[`PREVIEW_${name}`] : source[name]) ?? "";
  return {
    preview,
    supabaseUrl: pick("SUPABASE_URL"),
    anonKey: preview ? (source.PREVIEW_SUPABASE_ANON_KEY ?? "") : (source.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""),
    serviceRoleKey: pick("SUPABASE_SERVICE_ROLE_KEY"),
    helperSessionSecret: pick("HELPER_SESSION_SECRET"),
  };
}
