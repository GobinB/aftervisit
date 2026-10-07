"use client";
import { useRouter } from "next/navigation";
import { sampleDraft, SAMPLE_CAREGIVER, SAMPLE_RECIPIENTS } from "@/lib/sample";
import { setOriginalFile, useFlow } from "@/lib/store";
import { Button } from "./Button";

export function StartSample({ className = "", variant = "secondary" as const }: { className?: string; variant?: "secondary" | "primary" }) {
  const router = useRouter();
  const startDraft = useFlow((s) => s.startDraft);
  const setOriginalName = useFlow((s) => s.setOriginalName);
  return (
    <Button
      variant={variant}
      className={className}
      onClick={() => {
        setOriginalFile(null);
        setOriginalName(null);
        startDraft(sampleDraft(), { isSample: true, caregiverFirstName: SAMPLE_CAREGIVER, recipients: SAMPLE_RECIPIENTS });
        router.push("/new/review");
      }}
    >
      Start with a sample visit
    </Button>
  );
}
