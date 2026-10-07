"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { HandoffDraft, RecipientShare, Role } from "./schema";

export type SectionKey = "visit" | "medications" | "tasks" | "watchFor" | "questions" | "otherNotes";

export const SECTION_ORDER: SectionKey[] = ["visit", "medications", "tasks", "watchFor", "questions", "otherNotes"];

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
  reviewed: Partial<Record<SectionKey, boolean>>;
  caregiverFirstName: string;
  recipients: RecipientShare[];
  created: CreatedHandoff | null;
  /** Name of the file kept in memory for "Attach the original summary". */
  originalName: string | null;
  startDraft: (draft: HandoffDraft, opts: { isSample: boolean; unsorted?: boolean; caregiverFirstName?: string; recipients?: RecipientShare[] }) => void;
  updateDraft: (fn: (d: HandoffDraft) => HandoffDraft) => void;
  setReviewed: (key: SectionKey, value: boolean) => void;
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
        }),
      updateDraft: (fn) => set((s) => (s.draft ? { draft: fn(s.draft) } : s)),
      setReviewed: (key, value) => set((s) => ({ reviewed: { ...s.reviewed, [key]: value } })),
      setRecipients: (recipients) => set({ recipients }),
      setCaregiver: (caregiverFirstName) => set({ caregiverFirstName }),
      setCreated: (created) => set({ created }),
      setOriginalName: (originalName) => set({ originalName }),
      reset: () => {
        originalFile = null;
        set(initial);
      },
    }),
    {
      name: "aftervisit-flow",
      storage: createJSONStorage(() => sessionStorage),
      version: 1,
    },
  ),
);

/** The uploaded file stays in memory only (never in storage) until Share. */
let originalFile: File | null = null;
export const setOriginalFile = (f: File | null) => {
  originalFile = f;
};
export const getOriginalFile = () => originalFile;

/** Sections shown on Review: Other notes only when it has something in it. */
export function activeSections(draft: HandoffDraft | null): SectionKey[] {
  return SECTION_ORDER.filter((k) => k !== "otherNotes" || (draft?.otherNotes.length ?? 0) > 0);
}
