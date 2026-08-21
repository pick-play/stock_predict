# public/logos

Company wordmarks shown beside a stock's name on its dashboard card.

## Convention

- One PNG per mark, named by the **KRX ticker** of the listing it belongs to:
  `005930.png`, `000660.png`, … `StockLogo` maps a ticker to a filename, so two
  listings may share one file — 삼성전기 (009150) points at the SAMSUNG wordmark
  in `005930.png` rather than carrying a byte-identical copy.
- **48px tall**, width whatever the mark's own proportions give (these run from
  about 1.6:1 to 7.25:1). The component sizes by height — 14px on a phone, 16px
  from `md` up — so 48px is a 3× asset.
- **Trim the transparent margin before scaling.** Height is what the layout
  gives a mark, so padding inside the file is height the logo does not get to
  use: 한미반도체 shipped with its emblem filling 64% of the frame and rendered
  a third smaller than everything beside it for no reason.
- Transparent background. The card is painted in both light and dark themes and
  a white box around a logo shows in one of them.
- Keep them small; they are on the first screen. The set is about 32 KB total
  after `zopflipng -y --lossy_transparent`.

## Adding one

1. Crop the transparent margin, scale to 48px tall, save as `<ticker>.png`.
2. Add the ticker to `LOGO_FILE` in `src/components/dashboard/StockLogo.tsx`.

Step 2 is not optional. The component renders no `<img>` at all for a ticker
outside that map, which is how a listing without a logo costs zero requests
instead of a 404 on every render. A listing with no file simply shows its name,
which is the normal state, not a broken one.

## What these are, and are not

These marks belong to the companies they name and are used here only to identify
the listing whose reference price is shown — the same way a broker's watchlist
does. They are not part of this site's branding: they never appear in the
favicon, the header wordmark, the Open Graph image, or the shared card image,
and nothing on the site is presented as issued, endorsed or approved by these
companies (see §20 and the disclaimer in §21 of CLAUDE.md).

Marks are used unaltered apart from scaling. Do not recolour, crop, add effects,
or place one next to the site's own name in a way that reads as a partnership.
