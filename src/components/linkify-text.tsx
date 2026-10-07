import { Fragment } from "react";

// Matches full URLs, www. links, emails, and bare domains (e.g. wa.me/123, example.com/page).
const LINK_RE =
  /((?:https?:\/\/|www\.)[^\s<>"']+|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|(?:[a-z0-9-]+\.)+(?:com|net|org|me|io|co|app|store|shop|link|ly|gl|eg|sa|ae|info|biz|site|online|dev|page|xyz|tv|to|be|gg)(?:\/[^\s<>"']*)?)/gi;

function toHref(raw: string): { href: string; text: string; trail: string } {
  // Strip trailing punctuation that is usually not part of the link.
  const m = raw.match(/^(.*?)([.,!?؛،)\]]*)$/);
  const text = m ? m[1] : raw;
  const trail = m ? m[2] : "";
  if (/^https?:\/\//i.test(text)) return { href: text, text, trail };
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(text)) return { href: `mailto:${text}`, text, trail };
  return { href: `https://${text}`, text, trail };
}

export function LinkifyText({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  const parts = String(text).split(LINK_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1 && part) {
          const { href, text: t, trail } = toHref(part);
          return (
            <Fragment key={i}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className={className ?? "break-all text-primary underline underline-offset-2"}
                onClick={(e) => e.stopPropagation()}
              >
                {t}
              </a>
              {trail}
            </Fragment>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

/** Builds a clickable href for a store contact entry (phone, whatsapp, email, link...). */
export function contactHref(kind: string | null | undefined, value: string | null | undefined): string | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  const k = String(kind ?? "").toLowerCase();
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) return `mailto:${v}`;
  const digits = v.replace(/[^\d+]/g, "");
  if (k.includes("whats") || k.includes("واتس")) return `https://wa.me/${digits.replace(/^\+/, "")}`;
  if (/^(www\.)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(v)) return `https://${v}`;
  if (k.includes("phone") || k.includes("هاتف") || k.includes("tel") || /^\+?[\d\s-]{6,}$/.test(v)) return `tel:${digits}`;
  return null;
}
