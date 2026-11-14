"use client";

/** A person's link as it is shared: this site's address, then /i/ and their token. Nothing else rides on it. */
export function memberUrl(token: string): string {
  return `${window.location.origin}/i/${token}`;
}
