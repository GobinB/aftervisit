"use client";
import { createContext, useContext } from "react";

/** Whether the server's reader takes the page photos themselves (OpenAI), or only text read on the phone. */
const ReaderContext = createContext(false);

export function ReaderProvider({ readsPages, children }: { readsPages: boolean; children: React.ReactNode }) {
  return <ReaderContext.Provider value={readsPages}>{children}</ReaderContext.Provider>;
}

export const useReaderReadsPages = () => useContext(ReaderContext);
