/**
 * Company wordmarks: which file, and how big.
 *
 * One table, because two very different renderers draw these — the card in the
 * DOM and the shared image on a canvas — and a mark that is tuned in one and
 * not the other produces a picture that does not match the screen it came from.
 *
 * The files live in public/logos/ and are the site owner's to add. Nothing here
 * fetches a logo from a third party: a company logo is a trademark, and the
 * decision to publish one is not a request this code makes on the owner's
 * behalf. A listing with no entry simply shows its name.
 *
 * ## Why the heights differ
 *
 * Equal height is not equal size. A one-line wordmark spends its whole height
 * on letters; SK하이닉스 puts a butterfly above its name and spends most of the
 * height on everything except letters, so at a shared 14px it reads a third
 * smaller than the marks beside it. 한미반도체 sets its name inside a filled
 * emblem, which reads as a block of colour and goes loud early. NAVER's solid
 * slab letters carry far more ink per line than SAMSUNG's thin ones.
 *
 * So each mark carries its own height, set by eye against the others rather
 * than by a formula. When a new file is added, look at the row of cards and
 * pick the number that makes it sit level with its neighbours — that judgement
 * is the whole point of this table.
 */

export interface StockMark {
  /** Filename inside public/logos/. */
  file: string;
  /** Rendered height in px on a phone, and from the `md` breakpoint up. */
  height: number;
  heightMd: number;
  /** Width ceiling, so a very wide mark yields to the company name. */
  maxWidth: number;
  maxWidthMd: number;
}

function mark(
  file: string,
  height: number,
  maxWidth: number,
  scale = 1.15
): StockMark {
  return {
    file,
    height,
    heightMd: Math.round(height * scale),
    maxWidth,
    maxWidthMd: Math.round(maxWidth * scale),
  };
}

export const STOCK_MARKS: Record<string, StockMark> = {
  "005930": mark("005930.png", 13, 72), // 삼성전자 — thin wide wordmark
  "009150": mark("009150.png", 14, 84), // 삼성전기 — wordmark + second line
  "000660": mark("000660.png", 20, 52), // SK하이닉스 — stacked lockup
  "005380": mark("005380.png", 14, 80), // 현대차
  "066570": mark("066570.png", 14, 76), // LG전자
  "042700": mark("042700.png", 15, 42), // 한미반도체 — filled emblem
  "035420": mark("035420.png", 10, 54), // NAVER — solid slab letters
};

export function markFor(koreanTicker: string): StockMark | null {
  return STOCK_MARKS[koreanTicker] ?? null;
}

/** Path to a mark, honouring the deployment base. */
export function markSrc(mark: StockMark): string {
  return `${import.meta.env.BASE_URL}logos/${mark.file}`;
}
