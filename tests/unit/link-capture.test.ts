import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";
import { stripLinkHash } from "@/lib/crypto/session";

const token = "abcdefghijklmnopqrstuvwx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("invite pages clear anything after #", () => {
  test("the page wrapper renders on every branch, including a closed link", () => {
    const text = readFileSync("app/i/[invite]/page.tsx", "utf8");
    const page = text.slice(text.indexOf("export default async function InvitePage"));
    const wrapper = page.slice(0, page.indexOf("async function inviteBody"));
    expect(wrapper).toContain("<CaptureLinkKey");
    expect(wrapper).not.toContain("<GonePage");
    expect(page).toContain("return <GonePage");
  });

  test("anything after # on an old link is removed from the address bar and not kept", () => {
    const replaceState = vi.fn();
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      location: { hash: "#k=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", pathname: `/i/${token}`, search: "?x=1" },
      history: { state: { idx: 1 }, replaceState },
    });
    vi.stubGlobal("sessionStorage", { setItem: (name: string, value: string) => store.set(name, value), getItem: () => null });
    stripLinkHash();
    expect(replaceState).toHaveBeenCalledWith({ idx: 1 }, "", `/i/${token}?x=1`);
    expect(store.size).toBe(0);
  });

  test("a link with nothing after # is left alone", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("window", { location: { hash: "", pathname: `/i/${token}`, search: "" }, history: { state: null, replaceState } });
    stripLinkHash();
    expect(replaceState).not.toHaveBeenCalled();
  });
});
