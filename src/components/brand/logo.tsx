import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /** Show the "FarmCrate" wordmark next to the symbol. */
  withWordmark?: boolean;
};

// The FarmCrate mark: a crate with a sprouting leaf. Colours come from design
// tokens, so the logo adapts to dark mode.
export function Logo({ className, withWordmark = true }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" role="img" aria-label="FarmCrate">
        <path d="M16 14c0-5 3-8 8-8 0 5-3 8-8 8Z" fill="var(--primary)" />
        <path d="M16 14V9" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
        <rect x="5" y="15" width="22" height="12" rx="2" fill="none" stroke="var(--foreground)" strokeWidth="2.5" />
        <path d="M5 21h22M12 15v12M20 15v12" stroke="var(--foreground)" strokeWidth="1.5" />
      </svg>
      {withWordmark && (
        <span aria-hidden="true" className="text-xl font-bold tracking-tight">
          FarmCrate
        </span>
      )}
    </span>
  );
}
