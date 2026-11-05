import { beforeEach, describe, expect, test, vi } from "vitest";

const loadCircleKey = vi.fn();
const exportKeyBytes = vi.fn();
vi.mock("@/lib/crypto/idb", () => ({ loadCircleKey: (...args: unknown[]) => loadCircleKey(...args) }));
vi.mock("@/lib/crypto/export", () => ({ exportKeyBytes: (...args: unknown[]) => exportKeyBytes(...args) }));

const { memberLinkForVersion, urlForMemberToken } = await import("@/components/circles/member-link");

const token = "abcdefghijklmnopqrstuvwx";
const key = new Uint8Array(32).fill(4);

describe("helper link key version", () => {
  test("builds a link only when the device key matches the circle", () => {
    const built = memberLinkForVersion("https://allhandscare.example", token, key, 2, 2);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const url = new URL(built.url);
    expect(url.pathname).toBe(`/i/${token}`);
    expect(url.search).toBe("");
    expect(url.hash.startsWith("#k=")).toBe(true);
    expect(url.href.split("#")[0]).not.toContain(url.hash.slice(3));
  });

  test("refuses a link when the device key is missing or old", () => {
    expect(memberLinkForVersion("https://allhandscare.example", token, key, null, 2).ok).toBe(false);
    expect(memberLinkForVersion("https://allhandscare.example", token, key, 1, 2).ok).toBe(false);
    expect(memberLinkForVersion("https://allhandscare.example", token, key, 2, null).ok).toBe(false);
  });

  test("without the current key on this device, the link is made without one", async () => {
    vi.stubGlobal("window", { location: { origin: "https://allhandscare.example" } });
    loadCircleKey.mockResolvedValue({ circleId: "circle", keyVersion: 1, key: {} });
    const old = await urlForMemberToken("circle", token, 2);
    expect(old).toEqual({ ok: true, url: `https://allhandscare.example/i/${token}`, withKey: false });
    expect(exportKeyBytes).not.toHaveBeenCalled();
    loadCircleKey.mockResolvedValue(undefined);
    expect(await urlForMemberToken("circle", token, 1)).toEqual({ ok: true, url: `https://allhandscare.example/i/${token}`, withKey: false });
    vi.unstubAllGlobals();
  });

  test("with the current key on this device, it rides after #", async () => {
    vi.stubGlobal("window", { location: { origin: "https://allhandscare.example" } });
    loadCircleKey.mockResolvedValue({ circleId: "circle", keyVersion: 2, key: {} });
    exportKeyBytes.mockResolvedValue(key);
    const result = await urlForMemberToken("circle", token, 2);
    expect(result.ok && result.withKey && result.url.includes("#k=")).toBe(true);
    vi.unstubAllGlobals();
  });
});

beforeEach(() => {
  loadCircleKey.mockReset();
  exportKeyBytes.mockReset();
});
