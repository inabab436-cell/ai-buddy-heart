import type { ReactNode } from "react";

import { HubBar, HubTabBar } from "@/components/hub/hub-shell";

/**
 * Shared shell for merchant pages.
 * Presentation only — it now renders the same look as the orders page
 * (hub surfaces, frosted top bar, bottom tab bar). No data or logic here.
 */
export function PageShell({
  children,
  dir = "rtl",
  maxWidth = "max-w-3xl",
  backTo = "/dashboard",
  backLabel = "لوحة التحكم",
}: {
  children: ReactNode;
  dir?: "rtl" | "ltr";
  maxWidth?: string;
  backTo?: "/dashboard" | "/";
  backLabel?: string;
}) {
  return (
    <div dir={dir} className="hub min-h-screen pb-24">
      <HubBar backTo={backTo} backLabel={backLabel} maxWidth={maxWidth} />
      <div className={`mx-auto w-full ${maxWidth} space-y-5 px-4 pt-6`}>{children}</div>
      <HubTabBar />
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  highlight,
  description,
  actions,
  icon,
}: {
  eyebrow?: string;
  title: ReactNode;
  highlight?: string;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            {icon && <span className="grid h-4 w-4 place-items-center">{icon}</span>}
            {eyebrow}
          </div>
        )}
        <h1 className="mt-1.5 text-[26px] font-bold leading-tight sm:text-3xl">
          {title}
          {highlight && <> {highlight}</>}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </section>
  );
}

export function SurfaceCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`hub-card overflow-hidden ${className}`}>{children}</section>;
}

export function SectionHeader({
  icon,
  title,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
      <h2 className="flex min-w-0 items-center gap-2 text-sm font-bold">
        {icon && (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
            {icon}
          </span>
        )}
        <span className="truncate">{title}</span>
      </h2>
      {action}
    </header>
  );
}
