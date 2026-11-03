"use client";

import { useLayoutEffect } from "react";
import { captureHelperKeyFromLocation } from "@/lib/crypto/session";

/** Removes #k= before paint on every invite page, including a link that is already closed. */
export function CaptureLinkKey({ token }: { token: string }) {
  useLayoutEffect(() => {
    captureHelperKeyFromLocation(token);
  }, [token]);
  return null;
}
