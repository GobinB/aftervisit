import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";
import { bytesToBase64Url } from "@/lib/crypto/bytes";
import { captureHelperKeyFromLocation, readHelperKey } from "@/lib/crypto/session";

const token = "abcdefghijklmnopqrstuvwx";
const key = new Uint8Array(32).fill(9);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("invite pages clear the key fragment", () => {
  test("the page wrapper renders on every branch, including a closed link", () => {
    const text = readFileSync("app/i/[invite]/page.tsx", "utf8");
    const page = text.slice(text.indexOf("export default async function InvitePage"));
    const wrapper = page.slice(0, page.indexOf("async function inviteBody"));
    expect(wrapper).toContain("<CaptureLinkKey");
    expect(wrapper).not.toContain("<GonePage");
    expect(page).toContain("return <GonePage");
  });

  test("a valid fragment is kept for the tab and removed from the address bar", () => {
    const hash = `#k=${bytesToBase64Url(key)}`;
    const replaceState = vi.fn();
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      location: { hash, pathname: `/i/${token}`, search: "" },
      history: { state: { idx: 1 }, replaceState },
    });
    vi.stubGlobal("sessionStorage", {
      setItem: (name: string, value: string) => store.set(name, value),
      getItem: (name: string) => store.get(name) ?? null,
    });
    captureHelperKeyFromLocation(token);
    expect(replaceState).toHaveBeenCalledWith({ idx: 1 }, "", `/i/${token}`);
    expect(readHelperKey(token)).toBe(bytesToBase64Url(key));
  });

  test("a fragment is removed even when the key cannot be kept", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("window", {
      location: { hash: "#k=short", pathname: `/i/${token}`, search: "?x=1" },
      history: { state: null, replaceState },
    });
    vi.stubGlobal("sessionStorage", {
      setItem: () => {
        throw new Error("blocked");
      },
      getItem: () => null,
    });
    captureHelperKeyFromLocation(token);
    expect(replaceState).toHaveBeenCalledWith(null, "", `/i/${token}?x=1`);
  });
});
