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
  formatRelativeTime,
} from "./format";
import { COLORS } from "../config/theme";


/**
 * The shared image always uses the light palette.
 *
 * It is viewed inside other apps — a messenger thread, a photo roll — which are
 * usually light, and a dark rectangle dropped into a light chat reads as a
 * screenshot of something else. Values mirror [data-theme="light"] in index.css.
 * Rise/fall keep the site's Korean-market colours: red up, blue down.
 */
const LIGHT = {
  background: "#f0f4f8",
  surface: "#ffffff",
  border: "rgba(0,0,0,0.09)",
  divider: "rgba(0,0,0,0.06)",
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textTertiary: "#64748b",
  textMuted: "#94a3b8",
} as const;

// ── Canvas dimensions ──────────────────────────────────────────────────────
const CARD_W = 480;
// Sized for: price block, metrics, timestamp, wrapped disclaimer, domain line.
const CARD_H = 378;
/** Exported PNG is CARD_W × CARD_H × this — 1440×1134, crisp on any phone. */
const EXPORT_SCALE = 3;
const MARGIN = 20; // outer gap between canvas edge and card

// ── Font stacks (no web-font loading; rely on system Korean fonts) ─────────
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif";
const MONO = "'Courier New', monospace";

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

// ── Main export ────────────────────────────────────────────────────────────

export async function generateShareImage(
  snapshot: StockSnapshot,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  // Fixed export scale rather than devicePixelRatio: the file is judged on the
  // recipient's screen, not the sender's, and a 480px-wide image looks soft
  // once a messenger opens it full width. Layout below stays in logical units.
  canvas.width = CARD_W * EXPORT_SCALE;
  canvas.height = CARD_H * EXPORT_SCALE;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
  ctx.textBaseline = "alphabetic";

  // Direction-dependent colours
  const direction = getDirection(snapshot.changeRate);
  const dirSymbol = formatDirectionSymbol(snapshot.changeRate);

  const accentColor =
    direction === "rise"
      ? COLORS.rise
      : direction === "fall"
        ? COLORS.fall
        : "rgba(15,23,42,0.15)";

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

  // ── Canvas background ──────────────────────────────────────────────────
  ctx.fillStyle = LIGHT.background;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // ── Card ──────────────────────────────────────────────────────────────
  const cX = MARGIN;
  const cY = MARGIN;
  const cW = CARD_W - MARGIN * 2;
  const cH = CARD_H - MARGIN * 2;

  ctx.fillStyle = LIGHT.surface;
  roundRect(ctx, cX, cY, cW, cH, 16);
  ctx.fill();

  ctx.strokeStyle = LIGHT.border;
  ctx.lineWidth = 1;
  roundRect(ctx, cX, cY, cW, cH, 16);
  ctx.stroke();

  // Accent top bar (clipped so it respects the rounded corners)
  ctx.save();
  roundRect(ctx, cX, cY, cW, cH, 16);
  ctx.clip();
  ctx.fillStyle = accentColor;
  ctx.fillRect(cX, cY, cW, 3);
  ctx.restore();

  // Inner layout bounds
  const iX = cX + 24;
  const iR = cX + cW - 24;

  let y = cY + 32;

  // ── Header: company name + ticker + domain ────────────────────────────
  ctx.font = `700 14px ${FONT}`;
  ctx.fillStyle = LIGHT.textPrimary;
  ctx.fillText(snapshot.displayName, iX, y);
  const nameW = ctx.measureText(snapshot.displayName).width;

  ctx.font = `500 10px ${MONO}`;
  ctx.fillStyle = LIGHT.textTertiary;
  ctx.fillText(snapshot.koreanTicker, iX + nameW + 8, y - 1);

  y += 12;

  // ── Estimated price ───────────────────────────────────────────────────
  ctx.font = `700 42px ${FONT}`;
  ctx.fillStyle = LIGHT.textPrimary;
  ctx.fillText(formatKrw(snapshot.estimatedPrice), iX, y + 42);
  y += 56;

  ctx.font = `400 9px ${FONT}`;
  ctx.fillStyle = LIGHT.textMuted;
  ctx.fillText("예상가", iX, y);
  y += 18;

  // ── Direction badge: symbol + change amount + percentage ──────────────
  // All three elements are drawn so colour alone never conveys direction.
  const changeStr = `${dirSymbol}  ${formatChangeAmount(snapshot.changeAmount)}`;
  const sepStr = "  ·  ";
  const pctStr = formatPercent(snapshot.changeRate);

  ctx.font = `700 13px ${FONT}`;
  const changeW = ctx.measureText(changeStr).width;
  ctx.font = `500 13px ${FONT}`;
  const sepW = ctx.measureText(sepStr).width;
  const pctW = ctx.measureText(pctStr).width;

  const bPad = 12;
  const bW = changeW + sepW + pctW + bPad * 2;
  const bH = 28;

  ctx.fillStyle = dirBadgeBg;
  roundRect(ctx, iX, y, bW, bH, 8);
  ctx.fill();
  ctx.strokeStyle = dirBorderColor;
  ctx.lineWidth = 1;
  roundRect(ctx, iX, y, bW, bH, 8);
  ctx.stroke();

  const bTextY = y + bH / 2 + 5;
  let bx = iX + bPad;

  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = dirColor;
  ctx.fillText(changeStr, bx, bTextY);
  bx += changeW;

  ctx.font = `500 13px ${FONT}`;
  ctx.fillStyle = LIGHT.textTertiary;
  ctx.fillText(sepStr, bx, bTextY);
  bx += sepW;

  ctx.fillStyle = dirColor;
  ctx.fillText(pctStr, bx, bTextY);

  y += bH + 18;

  // ── Section divider ───────────────────────────────────────────────────
  ctx.strokeStyle = LIGHT.divider;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(iX, y);
  ctx.lineTo(iR, y);
  ctx.stroke();
  y += 14;

  // ── Key metrics ───────────────────────────────────────────────────────
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

  for (let mi = 0; mi < metrics.length; mi++) {
    const { label, value } = metrics[mi];

    ctx.font = `400 11px ${FONT}`;
    ctx.fillStyle = LIGHT.textTertiary;
    ctx.fillText(label, iX, y);

    ctx.font = `500 11px ${MONO}`;
    ctx.fillStyle = LIGHT.textSecondary;
    ctx.fillText(value, iR - ctx.measureText(value).width, y);

    y += 18;

    if (mi < metrics.length - 1) {
      ctx.strokeStyle = LIGHT.divider;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(iX, y - 5);
      ctx.lineTo(iR, y - 5);
      ctx.stroke();
    }
  }

  y += 4;

  // ── Section divider ───────────────────────────────────────────────────
  ctx.strokeStyle = LIGHT.divider;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(iX, y);
  ctx.lineTo(iR, y);
  ctx.stroke();
  y += 12;

  // ── Timestamp ─────────────────────────────────────────────────────────
  const relTime = formatRelativeTime(snapshot.eventTime);
  ctx.font = `400 10px ${FONT}`;
  ctx.fillStyle = LIGHT.textMuted;
  ctx.fillText(relTime, iR - ctx.measureText(relTime).width, y + 8);

  y += 20;

  // ── Disclaimer — mandatory per spec ───────────────────────────────────
  const disclaimer =
    "해외 선물가격 연계상품 기반 참고 예상가이며 실제 국내 체결가격과 다를 수 있습니다. 투자 권유가 아닙니다.";
  ctx.font = `400 9px ${FONT}`;
  ctx.fillStyle = LIGHT.textMuted;
  const discLines = wrapText(ctx, disclaimer, iR - iX);
  for (const line of discLines) {
    ctx.fillText(line, iX, y);
    y += 12;
  }

  // ── Domain, centred at the foot — this is what a reader types in after
  //    seeing the image somewhere else, so it sits last and stands alone.
  y += 6;
  const domain = "kospinow.com";
  ctx.font = `600 12px ${FONT}`;
  ctx.fillStyle = LIGHT.textSecondary;
  ctx.fillText(domain, (CARD_W - ctx.measureText(domain).width) / 2, y + 4);

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
