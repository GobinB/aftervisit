/**
 * Which database this deployment may use. Real families' data lives in the production project, and
 * only the production deployment reads its settings. A Vercel preview build (every pull request)
 * reads PREVIEW_* settings for a separate test project, or none at all, so a preview can never
 * reach production data even if production keys are later shared with previews by mistake.
 * Secret keys are read the same way, through `deploymentSetting`, in the server-only lib/env.ts.
 */
type Env = Record<string, string | undefined>;

export function isPreviewBuild(source: Env = process.env): boolean {
  return source.VERCEL_ENV === "preview";
}

/** A setting for this deployment: NAME in production and locally, PREVIEW_NAME on a preview build. */
export function deploymentSetting(name: string, source: Env = process.env): string {
  return (isPreviewBuild(source) ? source[`PREVIEW_${name}`] : source[name]) ?? "";
}

/** The database address and its public key. */
export function dataEnv(source: Env = process.env) {
  return {
    preview: isPreviewBuild(source),
    supabaseUrl: deploymentSetting("SUPABASE_URL", source),
    anonKey: isPreviewBuild(source) ? (source.PREVIEW_SUPABASE_ANON_KEY ?? "") : (source.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""),
  };
}
