import { describe, expect, it } from "vitest";
import { secureCookies } from "@/lib/session-cookie";

describe("secureCookies", () => {
  it("is on for a production build and off in development", () => {
    expect(secureCookies({ NODE_ENV: "production" })).toBe(true);
    expect(secureCookies({ NODE_ENV: "development" })).toBe(false);
  });

  it("is off for the end-to-end tests' local production build", () => {
    expect(secureCookies({ NODE_ENV: "production", E2E_INSECURE_COOKIES: "1" })).toBe(false);
  });

  it("only turns off for the exact value 1", () => {
    expect(secureCookies({ NODE_ENV: "production", E2E_INSECURE_COOKIES: "true" })).toBe(true);
  });

  it("refuses the test flag on any deployment", () => {
    expect(() => secureCookies({ NODE_ENV: "production", E2E_INSECURE_COOKIES: "1", VERCEL: "1", VERCEL_ENV: "production" })).toThrow(/must never be set on a deployment/);
    expect(() => secureCookies({ NODE_ENV: "production", E2E_INSECURE_COOKIES: "1", VERCEL_ENV: "preview" })).toThrow();
  });
});
