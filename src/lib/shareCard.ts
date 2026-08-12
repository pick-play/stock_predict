/**
 * Generates a shareable PNG image of a stock estimate card using the
 * HTML5 Canvas API.  No external libraries are required.
 *
 * Mandatory elements per task spec:
 *   - Disclaimer text ("해외 선물가격 연계상품 기반 참고 예상가...")
 *   - Site domain "kospinow.com"
 *   - Direction symbols ▲ ▼ ― alongside colour coding
 */

import type { StockSnapshot } from "../types/market";
import {
  formatKrw,
  formatPercent,
  formatChangeAmount,
  formatDirectionSymbol,
  getDirection,
  formatBinancePrice,
} from "./format";
import { COLORS } from "../config/theme";
import { BRAND_NAME } from "../config/brand";


/**
 * The shared image always uses the light palette.
 *
 * It is viewed inside other apps — a messenger thread, a photo roll — which are
 * usually light, and a dark rectangle dropped into a light chat reads as a
 * screenshot of something else. Values mirror [data-theme="light"] in index.css.
 * Rise/fall keep the site's Korean-market colours: red up, blue down.
 */
const LIGHT = {
  backdropTop: "#eef2f8",
  backdropBottom: "#e4eaf3",
  surface: "#ffffff",
  panel: "#f5f8fc",
  border: "rgba(15,23,42,0.08)",
  divider: "rgba(15,23,42,0.06)",
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textTertiary: "#64748b",
  textMuted: "#94a3b8",
  /** Brand violet, darkened for contrast against a light tint. */
  brand: "#5b4bd6",
  brandTint: "rgba(139,124,255,0.10)",
  brandBorder: "rgba(139,124,255,0.24)",
} as const;

// ── Canvas dimensions ──────────────────────────────────────────────────────
const CARD_W = 540;
/** Exported PNG is CARD_W × CARD_H × this — crisp on any phone. */
const EXPORT_SCALE = 3;
const MARGIN = 22; // outer gap between canvas edge and card
const PAD = 28; // card edge to content

// ── Vertical rhythm ────────────────────────────────────────────────────────
// Every gap below is a named step so the canvas height can be derived from the
// same constants the drawing uses. Only the disclaimer wraps, so its line count
// is measured first and everything else is fixed.
const ACCENT_BAR_H = 4;
const HEAD_TOP = 20; // card top → header content top
const MARK = 26; // brand mark square
const HEAD_GAP = 16; // header bottom → divider
const NAME_GAP = 30; // divider → name baseline
const EYEBROW_GAP = 24; // name baseline → caption baseline
const PRICE_GAP = 54; // caption baseline → price baseline
const BADGE_GAP = 18; // price baseline → badge top
const BADGE_H = 32;
const PANEL_GAP = 22; // badge bottom → metrics panel top
const PANEL_PAD = 14;
const ROW_H = 25;
const PANEL_H = PANEL_PAD * 2 + 12 + ROW_H * 2 + 4;
/**
 * Recent-history chart, in the same place the card puts it: top right, beside
 * the company name. Drawn only when there are at least two points.
 *
 * Slightly larger than the card's 72×28 because the image is read on its own
 * with nothing around it, but it stays inside the header row so it costs no
 * height — which is why the card's total height no longer depends on it.
 */
const SPARK_W = 112;
const SPARK_H = 40;
const SPARK_MIN_POINTS = 2;

const FOOT_GAP = 20; // panel bottom → divider
const DISC_TOP = 18; // divider → first disclaimer baseline
const DISC_LINE_H = 15;
const DOMAIN_GAP = 12; // last disclaimer baseline → domain pill top
const DOMAIN_H = 28;
const CARD_BOTTOM = 20; // domain pill bottom → card bottom

/** Card height with a single-line disclaimer; extra lines are added on top. */
const CARD_BASE_H =
  HEAD_TOP +
  MARK +
  HEAD_GAP +
  NAME_GAP +
  EYEBROW_GAP +
  PRICE_GAP +
  BADGE_GAP +
  BADGE_H +
  PANEL_GAP +
  PANEL_H +
  FOOT_GAP +
  DISC_TOP +
  DOMAIN_GAP +
  DOMAIN_H +
  CARD_BOTTOM;

const DISCLAIMER =
  "해외 선물가격 연계상품 기반 참고 예상가이며 실제 국내 체결가격과 다를 수 있습니다. 투자 권유가 아닙니다.";

// ── Font stacks (no web-font loading; rely on system Korean fonts) ─────────
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif";
const MONO = "'Courier New', monospace";

const DISC_FONT = `400 10px ${FONT}`;

// ── Helpers ────────────────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const R = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + R, y);
  ctx.lineTo(x + w - R, y);
  ctx.arc(x + w - R, y + R, R, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - R);
  ctx.arc(x + w - R, y + h - R, R, 0, Math.PI / 2);
  ctx.lineTo(x + R, y + h);
  ctx.arc(x + R, y + h - R, R, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + R);
  ctx.arc(x + R, y + R, R, Math.PI, -Math.PI / 2);
  ctx.closePath();
}

/** Character-by-character text wrapping (works for both CJK and Latin). */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const char of text) {
    const trial = line + char;
    if (ctx.measureText(trial).width > maxWidth && line.length > 0) {
      lines.push(line);
      line = char;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Letter-spaced text, drawn glyph by glyph.
 *
 * `ctx.letterSpacing` would be shorter but is missing from Safari before 17,
 * where it fails silently and the wordmark comes out cramped instead.
 * Returns the advance so callers can lay out what follows.
 */
function fillTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
): number {
  let cursor = x;
  for (const char of text) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + spacing;
  }
  return cursor - x - spacing;
}

function trackedWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  spacing: number,
): number {
  let w = 0;
  for (const char of text) w += ctx.measureText(char).width + spacing;
  return w - spacing;
}

/** Rounded rect with a fill and a 1px border, the shape used by every chip. */
function chip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke: string,
): void {
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
}

function hLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y: number,
  color: string,
  width = 1,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
}

/**
 * Absolute KST stamp, e.g. "2026.08.12 22:41".
 *
 * The card used to carry a relative time ("10초 전"), which is true only at the
 * moment of export — a saved file still claiming "10초 전" a week later is a
 * false freshness claim, so the shared image states the wall-clock instead.
 */
function kstStamp(isoString: string): string {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(isoString));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  // hourCycle h23 still yields "24" for midnight in some engines.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}.${get("month")}.${get("day")} ${hour}:${get("minute")}`;
}

/** Number part of a KRW price, so the "원" can be drawn smaller. */
function krwParts(value: number): { number: string; unit: string } {
  return {
    number: new Intl.NumberFormat("ko-KR", {
      maximumFractionDigits: 0,
    }).format(value),
    unit: "원",
  };
}

/**
 * Area chart of the recent series, in the direction's colour.
 *
 * A flat series (every value equal) would divide by a zero range, so the line is
 * centred instead — which is also the honest picture of a price that has not
 * moved. No axis labels: the numbers are already stated above and below, and the
 * shape is the only thing this adds.
 */
function drawSparkline(
  ctx: CanvasRenderingContext2D,
  series: number[],
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min;
  const padY = 8;

  const toX = (i: number) => x + (i / (series.length - 1)) * w;
  const toY = (v: number) =>
    range === 0
      ? y + h / 2
      : y + h - padY - ((v - min) / range) * (h - padY * 2);

  const points = series.map((v, i) => ({ x: toX(i), y: toY(v) }));

  // Filled area first, so the line sits on top of its own shading.
  const fill = ctx.createLinearGradient(0, y, 0, y + h);
  fill.addColorStop(0, withAlpha(color, 0.18));
  fill.addColorStop(1, withAlpha(color, 0.02));

  ctx.beginPath();
  ctx.moveTo(points[0].x, y + h);
  for (const p of points) ctx.lineTo(p.x, p.y);
  ctx.lineTo(points[points.length - 1].x, y + h);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  // The latest point, marked so the reader knows which end is now.
  const last = points[points.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2);
  ctx.strokeStyle = LIGHT.surface;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/**
 * Alpha variant of a palette colour.
 *
 * The palette mixes #rrggbb and rgba() forms; parsing both here keeps the chart
 * from having to carry its own duplicate set of tints.
 */
function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("#") && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (match) {
    const [r, g, b] = match[1].split(",").map((n) => n.trim());
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

/** Measure the disclaimer up front: it is the only element that reflows. */
function measureDisclaimerLines(contentWidth: number): number {
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return 2;
    ctx.font = DISC_FONT;
    return wrapText(ctx, DISCLAIMER, contentWidth).length;
  } catch {
    return 2;
  }
}

// ── Main export ────────────────────────────────────────────────────────────

export interface ShareImageOptions {
  /**
   * Recent estimated prices, oldest first — the same series the card's
   * sparkline uses. Fewer than two points draws nothing and shortens the card,
   * rather than inventing a shape out of one value (§12).
   */
  sparkline?: number[];
}

export async function generateShareImage(
  snapshot: StockSnapshot,
  options: ShareImageOptions = {},
): Promise<Blob> {
  const series = (options.sparkline ?? []).filter((v) => Number.isFinite(v) && v > 0);
  const hasChart = series.length >= SPARK_MIN_POINTS;

  const contentW = CARD_W - MARGIN * 2 - PAD * 2;
  const discLineCount = measureDisclaimerLines(contentW);
  const cardH = CARD_BASE_H + (discLineCount - 1) * DISC_LINE_H;
  const canvasH = cardH + MARGIN * 2;

  const canvas = document.createElement("canvas");
  // Fixed export scale rather than devicePixelRatio: the file is judged on the
  // recipient's screen, not the sender's, and a 540px-wide image looks soft
  // once a messenger opens it full width. Layout below stays in logical units.
  canvas.width = CARD_W * EXPORT_SCALE;
  canvas.height = canvasH * EXPORT_SCALE;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
  ctx.textBaseline = "alphabetic";

  // Direction-dependent colours
  const direction = getDirection(snapshot.changeRate);
  const dirSymbol = formatDirectionSymbol(snapshot.changeRate);

  const dirColor =
    direction === "rise"
      ? COLORS.rise
      : direction === "fall"
        ? COLORS.fall
        : LIGHT.textSecondary;

  const dirBadgeBg =
    direction === "rise"
      ? COLORS.riseSoft
      : direction === "fall"
        ? COLORS.fallSoft
        : "rgba(15,23,42,0.05)";

  const dirBorderColor =
    direction === "rise"
      ? "rgba(255,77,94,0.22)"
      : direction === "fall"
        ? "rgba(63,130,255,0.22)"
        : "rgba(15,23,42,0.10)";

  const dirGlow =
    direction === "rise"
      ? "rgba(255,77,94,0.16)"
      : direction === "fall"
        ? "rgba(63,130,255,0.16)"
        : "rgba(139,124,255,0.12)";

  // ── Canvas background: soft vertical wash + a glow in the day's colour ──
  const wash = ctx.createLinearGradient(0, 0, 0, canvasH);
  wash.addColorStop(0, LIGHT.backdropTop);
  wash.addColorStop(1, LIGHT.backdropBottom);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, CARD_W, canvasH);

  const glow = ctx.createRadialGradient(
    CARD_W * 0.82,
    0,
    0,
    CARD_W * 0.82,
    0,
    CARD_W * 0.62,
  );
  glow.addColorStop(0, dirGlow);
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, canvasH);

  // ── Card ──────────────────────────────────────────────────────────────
  const cX = MARGIN;
  const cY = MARGIN;
  const cW = CARD_W - MARGIN * 2;
  const RADIUS = 24;

  ctx.save();
  ctx.shadowColor = "rgba(15,23,42,0.14)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = LIGHT.surface;
  roundRect(ctx, cX, cY, cW, cardH, RADIUS);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = LIGHT.border;
  ctx.lineWidth = 1;
  roundRect(ctx, cX, cY, cW, cardH, RADIUS);
  ctx.stroke();

  // Accent top bar, fading across the card (clipped to the rounded corners)
  ctx.save();
  roundRect(ctx, cX, cY, cW, cardH, RADIUS);
  ctx.clip();
  const bar = ctx.createLinearGradient(cX, 0, cX + cW, 0);
  bar.addColorStop(0, dirColor);
  bar.addColorStop(1, direction === "neutral" ? dirColor : "#8b7cff");
  ctx.fillStyle = bar;
  ctx.fillRect(cX, cY, cW, ACCENT_BAR_H);
  ctx.restore();

  // Inner layout bounds
  const iX = cX + PAD;
  const iR = cX + cW - PAD;

  // ── Header: wordmark + snapshot time ──────────────────────────────────
  const headTop = cY + HEAD_TOP;

  const markGrad = ctx.createLinearGradient(iX, headTop, iX + MARK, headTop + MARK);
  markGrad.addColorStop(0, "#8b7cff");
  markGrad.addColorStop(1, "#6b5ce7");
  ctx.fillStyle = markGrad;
  roundRect(ctx, iX, headTop, MARK, MARK, 8);
  ctx.fill();

  ctx.font = `800 15px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  const kW = ctx.measureText("K").width;
  ctx.fillText("K", iX + (MARK - kW) / 2, headTop + 19);

  ctx.font = `800 13px ${FONT}`;
  ctx.fillStyle = LIGHT.textPrimary;
  fillTracked(ctx, BRAND_NAME, iX + MARK + 10, headTop + 18, 0.8);

  ctx.font = `400 11px ${FONT}`;
  ctx.fillStyle = LIGHT.textMuted;
  const stamp = `${kstStamp(snapshot.eventTime)} KST 기준`;
  ctx.fillText(stamp, iR - ctx.measureText(stamp).width, headTop + 17);

  let y = headTop + MARK + HEAD_GAP;
  hLine(ctx, iX, iR, y, LIGHT.divider);

  // ── Name + ticker chip ────────────────────────────────────────────────
  y += NAME_GAP;
  ctx.font = `700 19px ${FONT}`;
  ctx.fillStyle = LIGHT.textPrimary;
  ctx.fillText(snapshot.displayName, iX, y);
  const nameW = ctx.measureText(snapshot.displayName).width;

  ctx.font = `500 11px ${MONO}`;
  const tickerW = ctx.measureText(snapshot.koreanTicker).width;
  const chipW = tickerW + 16;
  chip(
    ctx,
    iX + nameW + 10,
    y - 13,
    chipW,
    19,
    6,
    "rgba(15,23,42,0.045)",
    "rgba(15,23,42,0.07)",
  );
  ctx.fillStyle = LIGHT.textTertiary;
  ctx.fillText(snapshot.koreanTicker, iX + nameW + 18, y - 0.5);

  // Recent trend, right-aligned against the name — the card's arrangement, so a
  // reader who saw the screen recognises the picture.
  if (hasChart) {
    drawSparkline(ctx, series, iR - SPARK_W, y - 26, SPARK_W, SPARK_H, dirColor);
  }

  // ── Caption — states what the number is before the number is read ─────
  y += EYEBROW_GAP;
  ctx.font = `500 12px ${FONT}`;
  ctx.fillStyle = LIGHT.textTertiary;
  ctx.fillText("해외 선물가격 기반 참고 예상가", iX, y);

  // ── Estimated price ───────────────────────────────────────────────────
  y += PRICE_GAP;
  const price = krwParts(snapshot.estimatedPrice);
  ctx.font = `800 52px ${FONT}`;
  ctx.fillStyle = LIGHT.textPrimary;
  ctx.fillText(price.number, iX, y);
  const priceW = ctx.measureText(price.number).width;

  ctx.font = `600 20px ${FONT}`;
  ctx.fillStyle = LIGHT.textTertiary;
  ctx.fillText(price.unit, iX + priceW + 6, y);

  // ── Direction badge: symbol + change amount + percentage ──────────────
  // All three elements are drawn so colour alone never conveys direction.
  y += BADGE_GAP;
  const changeStr = `${dirSymbol} ${formatChangeAmount(snapshot.changeAmount)}`;
  const sepStr = "  ·  ";
  const pctStr = formatPercent(snapshot.changeRate);

  ctx.font = `700 14px ${FONT}`;
  const changeW = ctx.measureText(changeStr).width;
  const pctW = ctx.measureText(pctStr).width;
  ctx.font = `500 14px ${FONT}`;
  const sepW = ctx.measureText(sepStr).width;

  const bPad = 14;
  const bW = changeW + sepW + pctW + bPad * 2;

  chip(ctx, iX, y, bW, BADGE_H, 10, dirBadgeBg, dirBorderColor);

  const bTextY = y + BADGE_H / 2 + 5;
  let bx = iX + bPad;

  ctx.font = `700 14px ${FONT}`;
  ctx.fillStyle = dirColor;
  ctx.fillText(changeStr, bx, bTextY);
  bx += changeW;

  ctx.font = `500 14px ${FONT}`;
  ctx.fillStyle = LIGHT.textMuted;
  ctx.fillText(sepStr, bx, bTextY);
  bx += sepW;

  ctx.font = `700 14px ${FONT}`;
  ctx.fillStyle = dirColor;
  ctx.fillText(pctStr, bx, bTextY);

  // ── Key metrics, grouped in a tinted panel ────────────────────────────
  y += BADGE_H + PANEL_GAP;
  const panelTop = y;
  chip(
    ctx,
    iX,
    panelTop,
    iR - iX,
    PANEL_H,
    14,
    LIGHT.panel,
    "rgba(15,23,42,0.05)",
  );

  const anchorDate = snapshot.anchorMarketDate ?? "";
  const anchorKind = snapshot.anchorKind ?? "close";
  const anchorKindLabel = anchorKind === "open" ? "시가" : "종가";
  const dateSlash = anchorDate ? anchorDate.slice(5).replace("-", "/") : "";

  const krxLabel =
    anchorKind === "open"
      ? `국내 시가 (${dateSlash})`
      : `최근 국내 종가 (${dateSlash})`;

  const metrics: { label: string; value: string }[] = [
    {
      label: krxLabel,
      value: snapshot.krxClose > 0 ? formatKrw(snapshot.krxClose) : "—",
    },
    {
      label: "현재 해외 선물가",
      value:
        snapshot.currentBinancePrice > 0
          ? formatBinancePrice(snapshot.currentBinancePrice)
          : "—",
    },
    {
      label: `기준가 (${dateSlash} ${anchorKindLabel})`,
      value:
        snapshot.baselineBinancePrice > 0
          ? formatBinancePrice(snapshot.baselineBinancePrice)
          : "—",
    },
  ];

  const rowX = iX + PANEL_PAD;
  const rowR = iR - PANEL_PAD;

  for (let mi = 0; mi < metrics.length; mi++) {
    const { label, value } = metrics[mi];
    const rowY = panelTop + PANEL_PAD + 12 + mi * ROW_H;

    ctx.font = `400 12px ${FONT}`;
    ctx.fillStyle = LIGHT.textTertiary;
    ctx.fillText(label, rowX, rowY);

    ctx.font = `600 12px ${MONO}`;
    ctx.fillStyle = LIGHT.textPrimary;
    ctx.fillText(value, rowR - ctx.measureText(value).width, rowY);

    if (mi < metrics.length - 1) {
      hLine(ctx, rowX, rowR, rowY + 8, LIGHT.divider, 0.5);
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────
  y = panelTop + PANEL_H + FOOT_GAP;
  hLine(ctx, iX, iR, y, LIGHT.divider);

  // Disclaimer — mandatory per spec
  y += DISC_TOP;
  ctx.font = DISC_FONT;
  ctx.fillStyle = LIGHT.textMuted;
  const discLines = wrapText(ctx, DISCLAIMER, iR - iX);
  for (let li = 0; li < discLines.length; li++) {
    ctx.fillText(discLines[li], iX, y + li * DISC_LINE_H);
  }
  y += (discLines.length - 1) * DISC_LINE_H;

  // Domain, centred at the foot — this is what a reader types in after seeing
  // the image somewhere else, so it sits last and stands alone.
  y += DOMAIN_GAP;
  ctx.font = `700 13px ${FONT}`;
  const domain = "kospinow.com";
  const domainW = trackedWidth(ctx, domain, 0.4);
  const pillW = domainW + 30;
  const pillX = (CARD_W - pillW) / 2;
  chip(ctx, pillX, y, pillW, DOMAIN_H, DOMAIN_H / 2, LIGHT.brandTint, LIGHT.brandBorder);
  ctx.fillStyle = LIGHT.brand;
  fillTracked(ctx, domain, pillX + 15, y + DOMAIN_H / 2 + 4.5, 0.4);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob returned null"));
      },
      "image/png",
    );
  });
}
