"use client";

import { Download, Share, SquarePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { promptInstall, useInstallState } from "@/components/pwa/install-state";
import { installPlatform, isIosPlatform, type InstallPlatform } from "@/lib/install-platform";

/** Where the Share button is, in words, for each iPhone and iPad browser. */
const SHARE_WHERE: Record<string, string> = {
  "iphone-safari": "at the bottom of the screen. If you only see •••, tap that first.",
  "ipad-safari": "at the top right, next to the address.",
  "ios-chrome": "at the top right, in the address bar.",
  "ios-other": "in the browser's menu.",
};

/**
 * A drawing of the device with the Share button circled where it really is, so the steps read as
 * instructions to follow on the browser itself, not as a button on this page.
 */
function ShareSpot({ platform }: { platform: InstallPlatform }) {
  const ipad = platform === "ipad-safari";
  const top = platform === "ipad-safari" || platform === "ios-chrome" || platform === "ios-other";
  const w = ipad ? 150 : 96;
  const h = ipad ? 112 : 176;
  const spotX = ipad ? w - 30 : top ? w - 24 : w / 2;
  const spotY = top ? 24 : h - 22;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
      <rect x="2" y="2" width={w - 4} height={h - 4} rx={ipad ? 10 : 16} fill="#fff" stroke="#1E2A3A" strokeWidth="3" />
      {/* the browser's toolbar */}
      <rect x="8" y={top ? 12 : h - 34} width={w - 16} height="24" rx="6" fill="#EEF2F7" />
      {/* the page */}
      <rect x="14" y={top ? 46 : 18} width={w - 28} height="8" rx="3" fill="#DDE3EC" />
      <rect x="14" y={top ? 60 : 32} width={w - 40} height="8" rx="3" fill="#DDE3EC" />
      <rect x="14" y={top ? 74 : 46} width={w - 34} height="8" rx="3" fill="#DDE3EC" />
      {/* the share icon: a box with an arrow up */}
      <g transform={`translate(${spotX - 6} ${spotY - 8})`} stroke="#1E4E8C" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 7v7h8V7" />
        <path d="M6 1v9M3 4l3-3 3 3" />
      </g>
      <circle cx={spotX} cy={spotY - 1} r="14" fill="none" stroke="#E5644E" strokeWidth="3" />
    </svg>
  );
}

const stepNumber = "flex size-7 shrink-0 items-center justify-center rounded-full bg-[#FCEDEA] text-note font-bold text-attn-ink";

/** This device's platform, read after the page loads (the server cannot know it). */
export function useInstallPlatform(): InstallPlatform | null {
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);
  useEffect(() => setPlatform(installPlatform(navigator.userAgent, navigator.maxTouchPoints)), []);
  return platform;
}

/** Whether there is anything to offer here: a real prompt, the iPhone and iPad steps, or Chrome's menu on Android. */
export function canOfferInstall(platform: InstallPlatform | null, prompt: unknown, installed: boolean): platform is InstallPlatform {
  if (installed || !platform) return false;
  return Boolean(prompt) || isIosPlatform(platform) || platform === "android";
}

/**
 * The steps for a browser with no install button of its own: on iPhone and iPad, Share and then
 * Add to Home Screen, with a picture of where Share is; on Android, Chrome's menu.
 */
export function InstallSteps({ platform, signedIn = true }: { platform: InstallPlatform; signedIn?: boolean }) {
  if (isIosPlatform(platform)) {
    return (
      <div className="flex items-start gap-4">
        <ShareSpot platform={platform} />
        <ol className="min-w-0 flex-1 space-y-3 text-label text-ink-900">
          <li className="flex gap-2.5">
            <span className={stepNumber}>1</span>
            <span>
              In your browser, tap Share <Share size={16} className="inline align-[-2px] text-primary-700" aria-hidden="true" />, {SHARE_WHERE[platform]}
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className={stepNumber}>2</span>
            <span>
              Scroll down and tap <strong>Add to Home Screen</strong> <SquarePlus size={16} className="inline align-[-2px] text-primary-700" aria-hidden="true" />
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className={stepNumber}>3</span>
            <span>
              Tap <strong>Add</strong>. {signedIn ? "You stay signed in." : ""}
            </span>
          </li>
        </ol>
      </div>
    );
  }
  return (
    <ol className="space-y-3 text-label text-ink-900">
      <li className="flex gap-2.5">
        <span className={stepNumber}>1</span>
        <span>
          In Chrome, tap the menu <strong>⋮</strong> at the top right.
        </span>
      </li>
      <li className="flex gap-2.5">
        <span className={stepNumber}>2</span>
        <span>
          Tap <strong>Add to Home screen</strong>, then <strong>Install</strong>.
        </span>
      </li>
    </ol>
  );
}

/**
 * "Put it on your Home Screen", the card on the home page. Where the browser offers an install prompt
 * (Android, and Chrome or Edge on a computer), this is one real Install button. iPhone and iPad have
 * no such prompt for websites, so they get the steps. Hidden once installed. Signed-in screens have
 * the small button in the top bar instead (InstallButton).
 */
export function InstallApp() {
  const { prompt, installed } = useInstallState();
  const platform = useInstallPlatform();
  if (!canOfferInstall(platform, prompt, installed)) return null;
  // Android before Chrome offers its prompt: the top bar's button covers it once signed in.
  if (!prompt && !isIosPlatform(platform)) return null;

  return (
    <section aria-label="Put the app on your Home Screen" className="no-print relative rounded-2xl border border-border-200 bg-white p-4 sm:p-5">
      <h2 className="font-display text-section leading-tight text-primary-900">Put it on your Home Screen</h2>
      {prompt ? (
        <>
          <p className="mt-1 text-[15px] text-ink-500">It opens like an app, one tap away. Nothing to download from an app store.</p>
          <button
            type="button"
            onClick={() => promptInstall(prompt)}
            className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary-700 px-5 text-[16px] font-bold text-white hover:bg-primary-900"
          >
            <Download size={20} aria-hidden="true" /> Install the app
          </button>
        </>
      ) : (
        <div className="mt-3">
          <InstallSteps platform={platform} signedIn={false} />
        </div>
      )}
    </section>
  );
}
