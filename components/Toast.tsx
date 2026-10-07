"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

interface ToastData {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

const ToastCtx = createContext<(t: Omit<ToastData, "id">) => void>(() => {});

/** Bottom-center toast, 4 seconds, with an optional action (Undo on delete). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((t: Omit<ToastData, "id">) => {
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now();
    setToast({ ...t, id });
    timer.current = setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), 4000);
  }, []);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite" role="status" className="no-print pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
        {toast ? (
          <div key={toast.id} className="pointer-events-auto flex animate-fade-in items-center gap-4 rounded-xl bg-ink-900 px-4 py-3 text-white shadow-lg">
            <span>{toast.message}</span>
            {toast.actionLabel ? (
              <button
                type="button"
                className="rounded-md px-2 py-1 font-semibold text-[#9cc3ff] underline-offset-4 hover:underline"
                onClick={() => {
                  toast.onAction?.();
                  setToast(null);
                }}
              >
                {toast.actionLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
