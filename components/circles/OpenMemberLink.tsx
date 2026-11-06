"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { openMemberLink } from "@/app/actions/enter";
import { Button } from "@/components/ui/Button";
import { PinInput } from "@/components/ui/PinInput";
import { captureHelperKeyFromLocation } from "@/lib/crypto/session";

/** PIN gate for a member link. The app never sends the PIN. */
export function OpenMemberLink({ token, mode, lockedMessage }: { token: string; mode: "pin" | "ready"; lockedMessage?: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(lockedMessage ?? null);
  const [pending, start] = useTransition();

  useEffect(() => {
    captureHelperKeyFromLocation(token);
    if (mode === "ready" && !lockedMessage) form.current?.requestSubmit();
  }, [mode, lockedMessage, token]);

  return (
    <form
      ref={form}
      className="mx-auto w-full max-w-md rounded-2xl border border-border-200 bg-white p-6 text-center"
      action={(formData) => {
        start(async () => {
          const result = await openMemberLink(formData);
          if (result && !result.ok) setError(result.error);
        });
      }}
    >
      <h1 className="font-display text-section text-primary-900">{lockedMessage ? "This link is locked" : mode === "pin" ? "Enter the 4-digit PIN" : "Opening your link"}</h1>
      <p className="mt-2 text-ink-500">{mode === "pin" && !lockedMessage ? "The PIN is in the message that came with your link." : "All Hands Care does not send messages."}</p>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="pin" value={pin} />
      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-attn-bg px-3 py-2 text-attn-ink">
          {error}
        </p>
      ) : null}
      {mode === "pin" && !lockedMessage ? (
        <div className="mt-6">
          <PinInput
            label="PIN"
            value={pin}
            onChange={setPin}
            autoFocus
            disabled={pending}
            invalid={!!error}
            onComplete={(value) => {
              start(async () => {
                const result = await openMemberLink({ token, pin: value });
                if (result && !result.ok) setError(result.error);
              });
            }}
          />
        </div>
      ) : null}
      {!lockedMessage ? (
        <Button type="submit" className="mt-6 w-full" disabled={pending || (mode === "pin" && pin.length < 4)}>
          {pending ? "Checking" : "Continue"}
        </Button>
      ) : null}
    </form>
  );
}
