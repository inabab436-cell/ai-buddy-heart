import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useHubBadges, badgeText } from "@/lib/hub-badges";
import { CupaiLogo } from "@/components/cupai-logo";
import {
  ChevronLeft,
  ClipboardList,
  LayoutGrid,
  Package,
  MessagesSquare,
} from "lucide-react";

/**
 * Presentation shell for the merchant hub. This is now the single look used by
 * every merchant page (orders, products, settings, …).
 * Everything is scoped under `.hub`, so the customer chat and storefront keep
 * their own look untouched.
 */
export function HubShell({
  eyebrow,
  title,
  subtitle,
  aside,
  backTo = "/dashboard",
  backLabel = "لوحة التحكم",
  maxWidth = "max-w-3xl",
  dir = "rtl",
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  aside?: ReactNode;
  backTo?: string;
  backLabel?: string;
  maxWidth?: string;
  dir?: "rtl" | "ltr";
  children: ReactNode;
}) {
  return (
    <div dir={dir} className="hub min-h-screen pb-24">
      <HubBar backTo={backTo} backLabel={backLabel} maxWidth={maxWidth} />

      <div className={`mx-auto w-full ${maxWidth} space-y-5 px-4 pt-6`}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-end sm:justify-between">
          <div className="min-w-0">
            {eyebrow && (
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                {eyebrow}
              </div>
            )}
            <h1 className="mt-1.5 text-[26px] font-bold leading-tight sm:text-3xl">{title}</h1>
            {subtitle && (
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {aside && <div className="flex shrink-0 flex-wrap items-center gap-2">{aside}</div>}
        </div>

        {children}
      </div>

      <HubTabBar />
    </div>
  );
}

export function HubBar({
  backTo = "/dashboard",
  backLabel = "لوحة التحكم",
  maxWidth = "max-w-3xl",
}: {
  backTo?: string;
  backLabel?: string;
  maxWidth?: string;
}) {
  return (
    <header className="hub-bar">
      <div
        className={`mx-auto flex w-full ${maxWidth} items-center justify-between gap-3 px-4 py-3`}
      >
        <Link
          to={backTo as never}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
          {backLabel}
        </Link>
        <CupaiLogo markClassName="h-6 w-6" textClassName="hub-display text-sm font-bold text-primary" />
      </div>
    </header>
  );
}

const TABS = [
  { to: "/dashboard" as const, label: "الرئيسية", Icon: LayoutGrid },
  { to: "/orders" as const, label: "الطلبات", Icon: ClipboardList },
  { to: "/conversations" as const, label: "المحادثات", Icon: MessagesSquare },
  { to: "/products" as const, label: "المخزون", Icon: Package },
];

export function HubTabBar() {
  const { newOrders, pendingChats } = useHubBadges();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-muted-foreground transition-colors"
            activeProps={{ className: "text-primary" }}
            activeOptions={{ exact: true }}
          >
            <span className="relative">
              <Icon className="h-[18px] w-[18px]" />
              {(to === "/orders" ? newOrders : to === "/conversations" ? pendingChats : 0) > 0 && (
                <span className="absolute -right-2.5 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                  {badgeText(to === "/orders" ? newOrders : pendingChats)}
                </span>
              )}
            </span>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function HubCard({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`hub-card ${className}`}>{children}</div>;
}
