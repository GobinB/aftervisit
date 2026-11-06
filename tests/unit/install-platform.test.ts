import { describe, expect, it } from "vitest";
import { installPlatform, isIosPlatform } from "@/lib/install-platform";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
const IOS_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1";
const IOS_FIREFOX = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

describe("install platform", () => {
  it("tells iPhone, iPad and Chrome on iOS apart", () => {
    expect(installPlatform(IPHONE)).toBe("iphone-safari");
    expect(installPlatform(IPAD_DESKTOP_UA, 5)).toBe("ipad-safari");
    expect(installPlatform(IOS_CHROME)).toBe("ios-chrome");
    expect(installPlatform(IOS_FIREFOX)).toBe("ios-other");
  });
  it("treats a Mac without touch, and Android, as non-iOS", () => {
    expect(installPlatform(IPAD_DESKTOP_UA, 0)).toBe("other");
    expect(installPlatform(ANDROID)).toBe("android");
    expect(isIosPlatform("android")).toBe(false);
    expect(isIosPlatform("ios-chrome")).toBe(true);
  });
});
