import { describe, expect, test } from "vitest";
import { isSaveOrRefresh } from "@/components/WholeResponses";

const tree = (marker: string | null) => encodeURIComponent(JSON.stringify(["", { children: ["circles", {}] }, null, marker]));

describe("isSaveOrRefresh: which answers are read whole", () => {
  test("a save (server action) is", () => {
    expect(isSaveOrRefresh("/circles/c/medications", { method: "POST", headers: { "Next-Action": "abc123", "Next-Router-State-Tree": tree(null) } })).toBe(true);
  });

  test("a refresh (router.refresh, marked refetch) is", () => {
    expect(isSaveOrRefresh("/circles/c/medications?_rsc=x", { headers: { RSC: "1", "Next-Router-State-Tree": tree("refetch") } })).toBe(true);
  });

  test("a page navigation is not", () => {
    expect(isSaveOrRefresh("/circles/c/todos?_rsc=x", { headers: { RSC: "1", "Next-Router-State-Tree": tree(null) } })).toBe(false);
  });

  test("a prefetch is not, even with the marker", () => {
    expect(isSaveOrRefresh("/circles/c/todos?_rsc=x", { headers: { RSC: "1", "Next-Router-Prefetch": "1", "Next-Router-State-Tree": tree("refetch") } })).toBe(false);
  });

  test("anything else is not", () => {
    expect(isSaveOrRefresh("/api/drug-names?q=lis")).toBe(false);
    expect(isSaveOrRefresh(new Request("https://example.org/api/extract", { method: "POST" }))).toBe(false);
  });

  test("headers on a Request object count", () => {
    expect(isSaveOrRefresh(new Request("https://example.org/circles/c", { method: "POST", headers: { "Next-Action": "abc" } }))).toBe(true);
  });
});
