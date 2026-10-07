import { json } from "@/lib/access";
import { COPY } from "@/lib/copy";
import { db } from "@/lib/db";
import { env, RATE_LIMITS } from "@/lib/env";
import { checkRateLimit } from "@/lib/ratelimit";
import { CreateHandoffSchema, HandoffPayloadSchema } from "@/lib/schema";
import { deleteOriginal, isAllowedOriginalType, uploadOriginal } from "@/lib/storage";
import { hashManageKey, hashPin, newManageKey, newShareToken } from "@/lib/tokens";

export const runtime = "nodejs";
export const maxDuration = 30;

function baseUrl(req: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL ? env.appUrl : new URL(req.url).origin;
}

/**
 * POST /api/handoffs: store a confirmed handoff.
 * JSON body, or multipart with the JSON in "data" and the optional original in "original".
 * Returns the share token and the plaintext manage key exactly once.
 */
export async function POST(req: Request) {
  const maxBytes = env.maxUploadMb * 1024 * 1024;
  if (Number(req.headers.get("content-length") ?? 0) > maxBytes + 256 * 1024) {
    return json({ error: "too_large", message: COPY.uploadSize(env.maxUploadMb) }, 413);
  }
  if (!(await checkRateLimit(req, "create", RATE_LIMITS.create))) {
    return json({ error: "rate_limited", message: COPY.rateLimited }, 429);
  }

  let raw: unknown;
  let original: File | null = null;
  try {
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await req.formData();
      raw = JSON.parse(String(form.get("data") ?? "null"));
      const f = form.get("original");
      if (f instanceof File && f.size > 0) original = f;
    } else {
      raw = await req.json();
    }
  } catch {
    return json({ error: "invalid", message: COPY.genericError }, 400);
  }

  const parsed = CreateHandoffSchema.safeParse(raw);
  if (!parsed.success) {
    const noConsent = parsed.error.issues.some((i) => i.path[0] === "consent");
    return json({ error: noConsent ? "consent_required" : "invalid", message: noConsent ? COPY.consentRequired : COPY.genericError }, 400);
  }
  const input = parsed.data;

  // Nothing is shared until a person has confirmed every item.
  const unconfirmed =
    input.draft.medications.some((m) => m.confidence === "low") || input.draft.tasks.some((t) => t.confidence === "low");
  if (unconfirmed) return json({ error: "unconfirmed", message: COPY.lowConfidenceHelper }, 400);

  if (original) {
    if (original.size > maxBytes) return json({ error: "too_large", message: COPY.uploadSize(env.maxUploadMb) }, 413);
    if (!isAllowedOriginalType(original.type)) return json({ error: "unsupported_type", message: COPY.uploadType }, 415);
  }

  // Only the confirmed handoff fields are stored. The extracted source text is never saved:
  // it was only needed on the caregiver's device to build and check the draft.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sourceText, ...rest } = input.draft;
  const payload = HandoffPayloadSchema.parse(rest);
  const token = newShareToken();
  const manageKey = newManageKey();
  const expiresAt = new Date(Date.now() + env.ttlDays * 86_400_000).toISOString();

  let originalPath: string | null = null;
  try {
    if (original) originalPath = await uploadOriginal(token, original);
    const { error } = await db()
      .from("handoffs")
      .insert({
        token,
        manage_key_hash: hashManageKey(manageKey),
        pin_hash: input.pin ? hashPin(token, input.pin) : null,
        payload,
        source_text: null,
        original_path: originalPath,
        created_by: input.createdByFirstName || null,
        recipients: input.recipients,
        acks: [],
        expires_at: expiresAt,
      });
    if (error) throw error;
  } catch (e) {
    console.error("create handoff failed:", (e as { message?: string }).message);
    await deleteOriginal(originalPath).catch(() => {});
    return json({ error: "storage", message: COPY.genericError }, 500);
  }

  const base = baseUrl(req);
  return json(
    {
      token,
      manageKey,
      shareUrl: `${base}/h/${token}`,
      manageUrl: `${base}/h/${token}/manage?key=${manageKey}`,
      expiresAt,
    },
    201,
  );
}
