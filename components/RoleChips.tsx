"use client";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/schema";

/** Selectable pills: Family, Home aide, Day program, Care manager, Other. */
export function RoleChips({ value, onChange, name }: { value: Role; onChange: (r: Role) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label={`Role for ${name || "this person"}`} className="flex flex-wrap gap-2">
      {ROLES.map((r) => {
        const on = r === value;
        return (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(r)}
            className={`min-h-10 rounded-full px-3.5 text-sm font-medium transition-colors ${
              on ? "bg-action-500/10 text-primary-900 ring-2 ring-action-500" : "bg-white text-ink-900 ring-1 ring-border-200 hover:bg-sky-100"
            }`}
          >
            {ROLE_LABELS[r]}
          </button>
        );
      })}
    </div>
  );
}
