"use client";

import { Download, Share, SquarePlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { installPlatform, isIosPlatform, type InstallPlatform } from "@/lib/install-platform";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISSED_KEY = "ahc-install-dismissed";

function isInstalled(): boolean {
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
  return Boolean(standalone || (navigator as Navigator & { standalone?: boolean }).standalone);
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

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

/**
 * "Put it on your Home Screen." Where the browser offers an install prompt (Android, and Chrome or
 * Edge on a computer), this is one real Install button. iPhone and iPad have no such prompt for
 * websites, so they get the steps with a picture of where Share is. Hidden once installed or dismissed.
 * `band` is the home page version: no dismiss, and a short note when nothing applies to this device.
 */
export function InstallApp({ band = false }: { band?: boolean }) {
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isInstalled() || (!band && wasDismissed())) return;
    setPlatform(installPlatform(navigator.userAgent, navigator.maxTouchPoints));
    setHidden(false);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [band]);

  if (hidden || !platform) return null;
  const ios = isIosPlatform(platform);
  // Android before Chrome offers its prompt, or a browser that never does: the menu route.
  if (!ios && !prompt && (platform !== "android" || band)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
    setHidden(true);
  };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setPrompt(null);
    if (choice.outcome === "accepted") setHidden(true);
  };

  return (
    <section aria-label="Put the app on your Home Screen" className={`no-print relative rounded-2xl border border-border-200 bg-white p-4 sm:p-5 ${band ? "" : "mb-6"}`}>
      {band ? null : (
        <button type="button" onClick={dismiss} aria-label="Not now" className="absolute top-2 right-2 rounded-lg p-2 text-ink-500 hover:text-primary-900">
          <X size={20} aria-hidden="true" />
        </button>
      )}
      <h2 className="font-display pr-8 text-[20px] leading-tight text-primary-900">Put it on your Home Screen</h2>
      {prompt ? (
        <>
          <p className="mt-1 text-[15px] text-ink-500">It opens like an app, one tap away. Nothing to download from an app store.</p>
          <button
            type="button"
            onClick={install}
            className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary-700 px-5 text-[16px] font-bold text-white hover:bg-primary-900"
          >
            <Download size={20} aria-hidden="true" /> Install the app
          </button>
        </>
      ) : ios ? (
        <div className="mt-3 flex items-start gap-4">
          <ShareSpot platform={platform} />
          <ol className="min-w-0 flex-1 space-y-3 text-[15px] text-ink-900">
            <li className="flex gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#FCEDEA] text-[14px] font-bold text-attn-ink">1</span>
              <span>
                In your browser, tap Share <Share size={16} className="inline align-[-2px] text-primary-700" aria-hidden="true" />, {SHARE_WHERE[platform]}
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#FCEDEA] text-[14px] font-bold text-attn-ink">2</span>
              <span>
                Scroll down and tap <strong>Add to Home Screen</strong> <SquarePlus size={16} className="inline align-[-2px] text-primary-700" aria-hidden="true" />
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#FCEDEA] text-[14px] font-bold text-attn-ink">3</span>
              <span>
                Tap <strong>Add</strong>. {band ? "" : "You stay signed in."}
              </span>
            </li>
          </ol>
        </div>
      ) : (
        <ol className="mt-3 space-y-3 text-[15px] text-ink-900">
          <li className="flex gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#FCEDEA] text-[14px] font-bold text-attn-ink">1</span>
            <span>
              In Chrome, tap the menu <strong>⋮</strong> at the top right.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#FCEDEA] text-[14px] font-bold text-attn-ink">2</span>
            <span>
              Tap <strong>Add to Home screen</strong>, then <strong>Install</strong>.
            </span>
          </li>
        </ol>
      )}
    </section>
  );
}
