"use client";

import { useSyncExternalStore } from "react";

/** The browser's own install prompt (Android, and Chrome or Edge on a computer). */
export type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

type InstallState = {
  /** Set once the browser offers its prompt; null where it never does (iPhone, iPad, Firefox, Safari on a Mac). */
  prompt: InstallPrompt | null;
  /** Opened from the Home Screen, or known to be there already, so there is nothing to offer. */
  installed: boolean;
};

const INSTALLED_KEY = "ahc-installed";
const SERVER: InstallState = { prompt: null, installed: true };

let state: InstallState = SERVER;
let started = false;
const listeners = new Set<() => void>();

function set(next: Partial<InstallState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

/** Opened from the Home Screen icon: a window of its own, with no address bar. */
export function runningAsApp(): boolean {
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
  return Boolean(standalone || (navigator as Navigator & { standalone?: boolean }).standalone);
}

function remembered(): boolean {
  try {
    return localStorage.getItem(INSTALLED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The app is on this phone's Home Screen: the browser said so after its prompt, or, on iPhone and
 * iPad (which never tell a website), the person tapped "I added it". The button stays hidden here.
 */
export function rememberInstalled() {
  try {
    localStorage.setItem(INSTALLED_KEY, "1");
  } catch {}
  set({ installed: true, prompt: null });
}

/**
 * Listens once for the whole page, so the header button and the home page card share the same
 * prompt. The browser offers it only while the app is not installed, so an offer also clears an
 * old "installed" note (the app was removed from the Home Screen since).
 */
function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  state = { prompt: null, installed: runningAsApp() || remembered() };
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    try {
      localStorage.removeItem(INSTALLED_KEY);
    } catch {}
    set({ prompt: event as InstallPrompt, installed: runningAsApp() });
  });
  window.addEventListener("appinstalled", rememberInstalled);
  // Chrome on Android can say whether this site is already on the Home Screen (the manifest lists itself).
  const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
  nav
    .getInstalledRelatedApps?.()
    .then((apps) => {
      if (apps.length) rememberInstalled();
    })
    .catch(() => undefined);
}

if (typeof window !== "undefined") start();

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The install prompt and whether the app is installed. On the server, and before hydration, it reads as installed, so nothing flashes. */
export function useInstallState(): InstallState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER,
  );
}

/** Shows the browser's prompt. True when the person said yes. */
export async function promptInstall(prompt: InstallPrompt): Promise<boolean> {
  await prompt.prompt();
  const choice = await prompt.userChoice.catch(() => ({ outcome: "dismissed" as const }));
  if (choice.outcome === "accepted") {
    rememberInstalled();
    return true;
  }
  // A prompt can be shown only once; the browser offers a fresh one later.
  set({ prompt: null });
  return false;
}
