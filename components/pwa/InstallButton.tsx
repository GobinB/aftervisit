"use client";

import { SquarePlus, X } from "lucide-react";
import { useRef } from "react";
import { canOfferInstall, InstallSteps, useInstallPlatform } from "@/components/pwa/InstallApp";
import { isIosPlatform } from "@/lib/install-platform";
import { promptInstall, rememberInstalled, useInstallState } from "@/components/pwa/install-state";

/**
 * A small "Add to Home Screen" button in the top bar, on every signed-in and helper screen until the
 * app is on the Home Screen. Where the browser has its own install prompt (Android, Chrome or Edge on a
 * computer) one tap shows it. iPhone and iPad have none for websites, so the tap opens the steps.
 * Hidden when the app is opened from the Home Screen, and once the browser says it is installed. An
 * iPhone never says, so the steps end with "I added it".
 */
export function InstallButton() {
  const { prompt, installed } = useInstallState();
  const platform = useInstallPlatform();
  const sheet = useRef<HTMLDialogElement>(null);
  if (!canOfferInstall(platform, prompt, installed)) return null;

  const open = () => {
    if (prompt) {
      promptInstall(prompt).catch(() => undefined);
      return;
    }
    sheet.current?.showModal();
  };
  const close = () => sheet.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Add to Home Screen"
        title="Add to Home Screen"
        className="inline-flex size-[44px] items-center justify-center gap-1.5 rounded-full text-primary-700 hover:bg-sky-100 sm:h-10 sm:w-auto sm:border sm:border-border-200 sm:px-3 sm:text-hint sm:font-semibold"
      >
        <SquarePlus className="size-5 sm:size-4" aria-hidden="true" />
        <span className="max-sm:hidden">Add to Home Screen</span>
      </button>
      <dialog
        ref={sheet}
        aria-labelledby="install-sheet-title"
        onClick={(event) => {
          // A tap on the dimmed area outside the sheet closes it.
          if (event.target === event.currentTarget) close();
        }}
        className="mx-auto mt-auto mb-0 w-full max-w-full rounded-t-2xl bg-white p-0 text-ink-900 shadow-xl backdrop:bg-black/40 sm:mb-auto sm:max-w-md sm:rounded-2xl"
      >
        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="flex items-start justify-between gap-3">
            <h2 id="install-sheet-title" className="font-display text-[22px] leading-tight text-primary-900">
              Add to your Home Screen
            </h2>
            <button type="button" onClick={close} aria-label="Close" className="-mt-1 -mr-1 rounded-lg p-2 text-ink-500 hover:text-primary-900">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1 text-label text-ink-500">It opens like an app, one tap away.</p>
          <div className="mt-4">
            <InstallSteps platform={platform} />
          </div>
          {isIosPlatform(platform) ? (
            <button
              type="button"
              onClick={() => {
                rememberInstalled();
                close();
              }}
              className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-border-200 bg-white px-4 text-label font-semibold text-primary-700 hover:bg-sky-100"
            >
              I added it
            </button>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
