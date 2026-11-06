/**
 * Where the "add to Home Screen" controls are on this device. Only Android and desktop Chrome and
 * Edge offer a real install prompt to websites; on iPhone and iPad every browser has to be told by
 * hand, and the Share button sits in a different place in each.
 */
export type InstallPlatform = "iphone-safari" | "ipad-safari" | "ios-chrome" | "ios-other" | "android" | "other";

export function installPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  const ua = userAgent;
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  const ios = ipad || /iPhone|iPod/.test(ua);
  if (ios) {
    if (/CriOS/.test(ua)) return "ios-chrome";
    if (/FxiOS|EdgiOS|OPiOS|GSA\//.test(ua)) return "ios-other";
    return ipad ? "ipad-safari" : "iphone-safari";
  }
  if (/Android/.test(ua)) return "android";
  return "other";
}

export function isIosPlatform(platform: InstallPlatform): boolean {
  return platform.startsWith("ip") || platform.startsWith("ios");
}
