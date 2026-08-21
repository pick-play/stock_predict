/**
 * The company wordmark beside a stock's name.
 *
 * Nothing here fetches a logo from a third party at runtime: a company logo is
 * a trademark, and the decision to publish one belongs to the site owner, who
 * puts the file in public/logos/ — not to a request this component makes on
 * their behalf to whatever host happens to serve it.
 *
 * It is decoration, not information. The card already names the company in text
 * and that text is what a screen reader announces, so this is `aria-hidden`
 * with an empty alt, and a listing with no file simply shows its name. The
 * lettered-badge fallback that used to stand in here is gone: with the name
 * directly to its left, a disc reading "삼" said nothing the reader could not
 * already see.
 *
 * Which file and how tall both come from src/config/logos.ts, shared with the
 * canvas that draws the shared image — see the note there on why every mark
 * carries its own height rather than one height for all of them.
 */

import { useState } from "react";
import { markFor, markSrc } from "../../config/logos";

interface StockLogoProps {
  koreanTicker: string;
  className?: string;
}

export function StockLogo({ koreanTicker, className = "" }: StockLogoProps) {
  // A broken <img> renders as a broken-image glyph, which is worse than no
  // logo — so a failed load stands down for good.
  const [failed, setFailed] = useState(false);

  const mark = markFor(koreanTicker);
  if (failed || !mark) return null;

  return (
    <img
      src={markSrc(mark)}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      /*
       * Sizes arrive as custom properties rather than Tailwind classes.
       *
       * Tailwind scans source text, so a computed `h-[${n}px]` generates no CSS
       * at all — and the number cannot simply move to an inline style, because
       * a style attribute has no way to express `md:`. Variables give both: the
       * class stays literal and static, the value stays per mark.
       */
      style={
        {
          "--mark-h": `${mark.height}px`,
          "--mark-h-md": `${mark.heightMd}px`,
          "--mark-w": `${mark.maxWidth}px`,
          "--mark-w-md": `${mark.maxWidthMd}px`,
        } as React.CSSProperties
      }
      className={`h-[var(--mark-h)] max-w-[var(--mark-w)] w-auto shrink-0 object-contain object-left md:h-[var(--mark-h-md)] md:max-w-[var(--mark-w-md)] ${className}`}
    />
  );
}
