import { forwardRef } from "react";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

const baseButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold tracking-tight transition-[color,background-color,border-color,box-shadow] duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--foreground)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-45";

const idleClass =
  "border-[var(--border)] bg-[var(--card-white)] text-[var(--foreground)] hover:bg-[var(--muted)] hover:border-[var(--foreground-muted)]";

const activeClass =
  "border-[var(--foreground)] bg-[var(--secondary)] text-[var(--foreground)] shadow-sm";

/** Sliders / filter lines icon (24×24 viewBox) */
export function FilterIcon({ className }) {
  return (
    <svg
      className={cx("h-[1.125rem] w-[1.125rem] shrink-0 opacity-90", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 6h16M8 12h8M10 18h4" />
    </svg>
  );
}

/** Up / down arrows sort icon */
export function SortIcon({ className }) {
  return (
    <svg
      className={cx("h-[1.125rem] w-[1.125rem] shrink-0 opacity-90", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 15V5M7 5L4 8m3-3l3 3M17 9v10m0 0l3-3m-3 3l-3-3" />
    </svg>
  );
}

/**
 * Opens filter UI (sheet, modal, dropdown). Wire `onClick` yourself.
 * @param {string} [label] - Visible text when `children` is omitted
 * @param {boolean} [active] - Highlights when filters are applied / panel open
 * @param {boolean} [showIcon]
 */
export const FilterButton = forwardRef(function FilterButton(
  {
    label = "Filter",
    children,
    active = false,
    showIcon = true,
    iconClassName,
    className,
    type = "button",
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(baseButtonClass, active ? activeClass : idleClass, className)}
      aria-pressed={active}
      {...props}
    >
      {showIcon ? <FilterIcon className={iconClassName} /> : null}
      {children ?? label}
    </button>
  );
});

/**
 * Opens sort UI or cycles sort. Wire `onClick` yourself.
 */
export const SortButton = forwardRef(function SortButton(
  {
    label = "Sort",
    children,
    active = false,
    showIcon = true,
    iconClassName,
    className,
    type = "button",
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(baseButtonClass, active ? activeClass : idleClass, className)}
      aria-pressed={active}
      {...props}
    >
      {showIcon ? <SortIcon className={iconClassName} /> : null}
      {children ?? label}
    </button>
  );
});

/**
 * Horizontal group — drop in a toolbar; pass the same handlers you would on the buttons.
 * @param {{ filter?: object, sort?: object }} [buttonProps] - Spread onto FilterButton / SortButton (e.g. onClick, active)
 */
export function FilterSortButtonRow({ className, buttonProps = {}, gapClassName = "gap-2" }) {
  const { filter: filterProps = {}, sort: sortProps = {} } = buttonProps;
  return (
    <div className={cx("flex flex-wrap items-center", gapClassName, className)} role="group" aria-label="Filter and sort">
      <FilterButton {...filterProps} />
      <SortButton {...sortProps} />
    </div>
  );
}
