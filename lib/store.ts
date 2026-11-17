"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Reviewed, ReviewSection } from "./review";
import type { HandoffDraft, RecipientShare, Role } from "./schema";

/**
 * Which reader made the draft, for the note on Review: the AI model (OpenAI), the built-in reader on
 * our server (pasted text, a PDF's text), or the phone reading the photos itself.
 */
export type DraftReader = "openai" | "builtin" | "device";

export interface CreatedHandoff {
  token: string;
  manageKey: string;
  manageUrl: string;
  expiresAt: string;
  hasPin: boolean;
  /** One personal link per person, shown once. */
  invites: { id: string; name: string; role: Role; url: string }[];
}

interface FlowState {
  draft: HandoffDraft | null;
  isSample: boolean;
  /** Set when the parser could not place anything (shows the "Nothing parsed" message). */
  unsorted: boolean;
  /** The "I reviewed it" buttons on Review (lib/review.ts). */
  reviewed: Reviewed;
  caregiverFirstName: string;
  recipients: RecipientShare[];
  created: CreatedHandoff | null;
  /** Name of the file kept in memory for "Attach the original summary". */
  originalName: string | null;
  /** Set when the visit was started from a care circle: confirming updates that circle. */
  circleId: string | null;
  /** Which reader made the draft; null for the sample. */
  reader: DraftReader | null;
  startDraft: (
    draft: HandoffDraft,
    opts: { isSample: boolean; unsorted?: boolean; caregiverFirstName?: string; recipients?: RecipientShare[]; circleId?: string | null; reader?: DraftReader | null },
  ) => void;
  updateDraft: (fn: (d: HandoffDraft) => HandoffDraft) => void;
  setReviewed: (section: ReviewSection, value: boolean) => void;
  setRecipients: (r: RecipientShare[]) => void;
  setCaregiver: (name: string) => void;
  setCreated: (c: CreatedHandoff | null) => void;
  setOriginalName: (n: string | null) => void;
  reset: () => void;
}

const initial = {
  draft: null,
  isSample: false,
  unsorted: false,
  reviewed: {},
  caregiverFirstName: "",
  recipients: [],
  created: null,
  originalName: null,
  circleId: null,
  reader: null,
};

/** Client-side flow state. Lives in sessionStorage so a refresh never loses the draft. */
export const useFlow = create<FlowState>()(
  persist(
    (set) => ({
      ...initial,
      startDraft: (draft, opts) =>
        set({
          draft,
          isSample: opts.isSample,
          unsorted: !!opts.unsorted,
          reviewed: {},
          created: null,
          caregiverFirstName: opts.caregiverFirstName ?? "",
          recipients: opts.recipients ?? [],
          circleId: opts.circleId ?? null,
          reader: opts.reader ?? null,
        }),
      updateDraft: (fn) => set((s) => (s.draft ? { draft: fn(s.draft) } : s)),
      setReviewed: (section, value) => set((s) => ({ reviewed: { ...s.reviewed, [section]: value } })),
      setRecipients: (recipients) => set({ recipients }),
      setCaregiver: (caregiverFirstName) => set({ caregiverFirstName }),
      setCreated: (created) => set({ created }),
      setOriginalName: (originalName) => set({ originalName }),
      reset: () => {
        originalFile = null;
        originalPages = [];
        set(initial);
      },
    }),
    {
      name: "aftervisit-flow",
      storage: createJSONStorage(() => sessionStorage),
      version: 5,
      // Version 2 kept one tick per section. A draft from before starts its two confirms again.
      // 4: one check mark per section instead of two confirms, so ticks from before do not carry over.
      // 5: three "I reviewed it" buttons instead of one "Looks right"; a review from before starts again.
      migrate: (persisted, version) => (version < 5 ? { ...(persisted as object), reviewed: {} } : persisted) as FlowState,
    },
  ),
);

/** The uploaded file stays in memory only (never in storage) until Share. */
let originalFile: File | null = null;
export const setOriginalFile = (f: File | null) => {
  originalFile = f;
};
export const getOriginalFile = () => originalFile;

/**
 * The photos (or the PDF) of the summary being read, in page order. Memory only: they are lost on
 * a reload and never written to the browser's storage. Shown on Review, and kept with the visit
 * on Update when the caregiver leaves "Keep the photos" on.
 */
let originalPages: File[] = [];
export const setOriginalPages = (files: File[]) => {
  originalPages = files;
};
export const getOriginalPages = () => originalPages;
