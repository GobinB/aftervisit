"use client";

import { useLayoutEffect } from "react";
import { stripLinkHash } from "@/lib/crypto/session";

/** Takes anything after # out of the address bar before paint on every invite page, including a link that is already closed. */
export function CaptureLinkKey() {
  useLayoutEffect(() => {
    stripLinkHash();
  }, []);
  return null;
}
