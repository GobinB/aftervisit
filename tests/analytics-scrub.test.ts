import { describe, expect, test } from "vitest";
import type { BeforeSendEvent } from "@vercel/analytics/next";
import { scrubAnalyticsEvent } from "@/lib/analytics-scrub";

/** The installed script's beforeSend event is `{ type, url }`. Route, path, and referrer are optional extras. */
type Incoming = BeforeSendEvent & { route?: string; path?: string; referrer?: string };

const page = (url: string, extra?: Partial<Pick<Incoming, "route" | "path" | "referrer">>) =>
  scrubAnalyticsEvent({ type: "pageview", url, ...extra });

describe("scrubAnalyticsEvent", () => {
  test("removes the hash", () => {
    expect(page("https://aftervisit.example/privacy#how-long")).toEqual({
      type: "pageview",
      url: "https://aftervisit.example/privacy",
    });
  });

  test("removes the query string, including a manage key", () => {
    expect(page("https://aftervisit.example/new?key=manage-key&print=1")).toEqual({
      type: "pageview",
      url: "https://aftervisit.example/new",
    });
    expect(page("https://aftervisit.example/h/abc123/manage?key=manage-key")).toEqual({
      type: "pageview",
      url: "https://aftervisit.example/h/[token]/manage",
    });
  });

  test("replaces the invite and share token segments", () => {
    expect(page("https://aftervisit.example/i/abc123")).toEqual({
      type: "pageview",
      url: "https://aftervisit.example/i/[token]",
    });
    expect(page("https://aftervisit.example/h/abc123")).toEqual({
      type: "pageview",
      url: "https://aftervisit.example/h/[token]",
    });
  });

  test("keeps nested paths after the token", () => {
    expect(page("https://aftervisit.example/h/abc123/manage/view?key=manage-key#notes")).toEqual({
      type: "pageview",
      url: "https://aftervisit.example/h/[token]/manage/view",
    });
    expect(page("https://aftervisit.example/i/abc123/tasks#done")).toEqual({
      type: "pageview",
      url: "https://aftervisit.example/i/[token]/tasks",
    });
  });

  test("leaves ordinary paths unchanged", () => {
    for (const path of ["/", "/new", "/new/review", "/new/share", "/privacy"]) {
      const url = path === "/" ? "https://aftervisit.example/" : `https://aftervisit.example${path}`;
      expect(page(url)).toEqual({ type: "pageview", url });
    }
  });

  test("drops the event when the url cannot be parsed", () => {
    expect(page("not a url")).toBeNull();
    expect(page("")).toBeNull();
    expect(page("http://")).toBeNull();
    expect(scrubAnalyticsEvent({ type: "event", url: "://" })).toBeNull();
  });

  test("scrubs custom events the same way", () => {
    const event = { type: "event" as const, url: "https://aftervisit.example/i/abc123?key=manage-key#x" };
    expect(scrubAnalyticsEvent(event)).toEqual({ type: "event", url: "https://aftervisit.example/i/[token]" });
    expect(event.url).toBe("https://aftervisit.example/i/abc123?key=manage-key#x");
  });

  test("scrubs a separate route, path, or referrer", () => {
    expect(
      page("https://aftervisit.example/new", {
        route: "/api/handoffs/abc123/tasks?ticket=secret#file",
        path: "/api/invites/abc123/original",
        referrer: "https://other.example/from?utm=1#top",
      }),
    ).toEqual({
      type: "pageview",
      url: "https://aftervisit.example/new",
      route: "/api/handoffs/[token]/tasks",
      path: "/api/invites/[token]/original",
      referrer: "https://other.example/from",
    });
  });

  test("drops the event when a separate location field cannot be parsed", () => {
    expect(page("https://aftervisit.example/new", { referrer: "not a url" })).toBeNull();
  });
});
