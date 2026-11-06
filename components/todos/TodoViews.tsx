"use client";

import { useState } from "react";
import { TodoList, type TodoRow } from "@/components/todos/TodoList";
import { TODO_VIEW_LABELS, type TodoView } from "@/lib/schema/todos";

/**
 * Open, Mine, Needs a volunteer and Done, switched on the phone itself. Every list is already here,
 * so a tap changes the list at once instead of waiting for the server. The address is updated
 * too, so a refresh or a shared link opens the same list.
 */
export function TodoViews({
  circleId,
  views,
  initial,
  lists,
  empty,
  canEdit,
}: {
  circleId: string;
  views: TodoView[];
  initial: TodoView;
  lists: Record<TodoView, TodoRow[]>;
  empty: Record<TodoView, string>;
  canEdit: boolean;
}) {
  const [view, setView] = useState<TodoView>(initial);
  const rows = lists[view] ?? [];
  const pick = (key: TodoView) => {
    setView(key);
    const href = key === views[0] ? `/circles/${circleId}/todos` : `/circles/${circleId}/todos?show=${key}`;
    window.history.replaceState(null, "", href);
  };
  return (
    <>
      <div role="tablist" aria-label="Which reminders" className="mb-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {views.map((key) => {
          const on = key === view;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => pick(key)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[15px] font-semibold ${
                on ? "border-primary-700 bg-primary-700 text-white" : "border-border-200 bg-white text-ink-900 hover:bg-paper-100"
              }`}
            >
              {TODO_VIEW_LABELS[key]}
              <span className={`tabular-nums ${on ? "text-white/80" : "text-ink-500"}`}>{lists[key]?.length ?? 0}</span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="rounded-lg border border-border-200 bg-white">
        {rows.length ? <TodoList todos={rows} circleId={circleId} canEdit={canEdit} /> : <p className="px-4 py-10 text-center text-[14px] text-ink-500">{empty[view]}</p>}
      </div>
    </>
  );
}
