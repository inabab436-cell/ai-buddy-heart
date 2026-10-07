import type { ReactNode } from "react";

import { HubBar, HubTabBar } from "@/components/hub/hub-shell";

type Props = {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

/** Same shell as the orders page. Presentation only. */
export function PageShell({ title, description, icon, actions, children }: Props) {
  return (
    <div dir="rtl" className="hub min-h-screen pb-24">
      <HubBar />

      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 pt-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-end sm:justify-between">
          <div className="min-w-0">
            {icon && (
              <span className="mb-2 inline-grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground">
                {icon}
              </span>
            )}
            <h1 className="text-[26px] font-bold leading-tight sm:text-3xl">{title}</h1>
            {description && (
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>

        {children}
      </div>

      <HubTabBar />
    </div>
  );
}
