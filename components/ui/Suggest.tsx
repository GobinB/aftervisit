"use client";

import { useId, useState } from "react";

/**
 * A text field with its suggestions shown as a list of large buttons right under it, instead of
 * the browser's own list (which iPhones tuck into the keyboard bar, where people miss it).
 * Arrow keys and Enter work as in any combobox.
 */
export function Suggest({
  id,
  value,
  onChange,
  suggestions,
  className,
  placeholder,
  maxLength,
  label,
  emptyHint,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  className: string;
  placeholder?: string;
  maxLength?: number;
  label: string;
  emptyHint?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const shown = open ? suggestions.filter((item) => item.toLowerCase() !== value.trim().toLowerCase()) : [];

  const pick = (item: string) => {
    onChange(item);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div>
      <input
        id={id}
        role="combobox"
        aria-expanded={shown.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 && shown[active] ? `${listId}-${active}` : undefined}
        className={className}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (!shown.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((active + 1) % shown.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive(active <= 0 ? shown.length - 1 : active - 1);
          } else if (event.key === "Enter" && active >= 0) {
            event.preventDefault();
            pick(shown[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {shown.length ? (
        <div className="mt-1.5 overflow-hidden rounded-lg border border-primary-700/30 bg-white shadow-sm">
          <p className="border-b border-border-200 bg-sky-100/60 px-3 py-1.5 text-[12px] font-semibold text-primary-900">Tap to choose</p>
          <ul id={listId} role="listbox" aria-label={label} className="max-h-72 divide-y divide-border-200 overflow-y-auto">
            {shown.map((item, index) => (
              <li
                key={item}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                // Pointer-down, so the choice lands before the field loses focus.
                onPointerDown={(event) => {
                  event.preventDefault();
                  pick(item);
                }}
                onClick={() => pick(item)}
                className={`flex min-h-12 cursor-pointer items-center px-3 text-[16px] font-medium text-ink-900 ${index === active ? "bg-sky-100" : "hover:bg-sky-100/60"}`}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : open && emptyHint && value.trim().length >= 2 ? (
        <p className="mt-1.5 text-[13px] text-ink-500">{emptyHint}</p>
      ) : null}
    </div>
  );
}
