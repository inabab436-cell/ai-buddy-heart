import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /** Use on dark/colored backgrounds — renders in primary-foreground */
  light?: boolean;
};

/**
 * Cupai letterform mark — a bold "C" whose counter holds a rising "p" stem,
 * drawn as pure vector paths (no images, no AI iconography).
 */
export function CupaiMark({ className, light }: LogoProps) {
  const id = light ? "cupai-lg-light" : "cupai-lg";
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Cupai"
      className={cn("h-9 w-9", className)}
    >
      <defs>
        <linearGradient id={id} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          {light ? (
            <>
              <stop offset="0" stopColor="var(--primary-foreground)" />
              <stop offset="1" stopColor="color-mix(in oklab, var(--primary-foreground) 60%, transparent)" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="var(--primary)" />
              <stop offset="1" stopColor="color-mix(in oklab, var(--primary) 55%, transparent)" />
            </>
          )}
        </linearGradient>
      </defs>
      {/* Bold rounded "C" */}
      <path
        d="M34.5 13.2C31.4 9.9 27.2 8 22.6 8 14.9 8 8.6 14.3 8.6 22c0 7.7 6.3 14 14 14 4.6 0 8.8-1.9 11.9-5.2"
        stroke={`url(#${id})`}
        strokeWidth="6.4"
        strokeLinecap="round"
      />
      {/* "p" bowl nested in the C opening */}
      <circle
        cx="33"
        cy="22"
        r="6.5"
        stroke={`url(#${id})`}
        strokeWidth="5"
      />
      {/* "p" stem dropping below the baseline */}
      <path
        d="M33 28.5V42"
        stroke={`url(#${id})`}
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Full logo: mark + "Cupai" wordmark. */
export function CupaiLogo({
  className,
  light,
  markClassName,
  textClassName,
}: LogoProps & { markClassName?: string; textClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <CupaiMark light={light} className={markClassName} />
      <span
        className={cn(
          "text-xl font-extrabold tracking-tight",
          light ? "text-primary-foreground" : "text-foreground",
          textClassName
        )}
      >
        Cupai
      </span>
    </span>
  );
}
