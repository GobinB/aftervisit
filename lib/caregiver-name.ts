/**
 * The name shown for a caregiver on a circle.
 * Google sign-in stores the profile name on the user. The role label is the fallback.
 */
export function caregiverDisplayName(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const record = metadata as Record<string, unknown>;
  const text = (key: string) => {
    const value = record[key];
    return typeof value === "string" ? value.trim() : "";
  };
  const full = text("full_name") || text("name");
  if (full) return full.slice(0, 80);
  const combined = [text("given_name"), text("family_name")].filter(Boolean).join(" ");
  return combined ? combined.slice(0, 80) : null;
}
