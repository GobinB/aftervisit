"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ensureCircleKey, type OldKey } from "@/components/circles/circle-key";
import { OldPhotos } from "@/components/circles/OldPhotos";

/**
 * For a circle whose key for files was made with recovery words. If this device still has the
 * key, it is handed over without a word on screen, and every device opens saved photos after
 * sign-in from then on. `quiet` (the circle's frame) stops there. Otherwise, when no device has
 * handed it over, the caregiver is shown the one choice: type the words, or start fresh.
 */
export function CircleKeyCheck({ circleId, quiet = false }: { circleId: string; quiet?: boolean }) {
  const router = useRouter();
  const [old, setOld] = useState<OldKey | null>(null);

  useEffect(() => {
    let cancel = false;
    ensureCircleKey(circleId).then((result) => {
      if (cancel) return;
      if (result.ok) router.refresh();
      else if (result.reason === "words") setOld(result.old);
    });
    return () => {
      cancel = true;
    };
  }, [circleId, router]);

  if (quiet || !old) return null;
  return (
    <div className="mb-5">
      <OldPhotos
        circleId={circleId}
        old={old}
        onReady={() => {
          setOld(null);
          router.refresh();
        }}
      />
    </div>
  );
}
