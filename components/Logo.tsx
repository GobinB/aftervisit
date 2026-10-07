export function LogoMark({ className = "h-8 w-8 text-lg" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-[9px] bg-primary-700 font-semibold text-white ${className}`}
    >
      A
    </span>
  );
}
