/**
 * The plot itself: axes, curve, baseline and cursor, in plain SVG.
 *
 * This replaced Recharts, which cost 108 KB gzipped for one area chart — and
 * whose v3 traded lodash for Redux Toolkit, arriving at the same weight by a
 * different route. The site already draws its sparklines and its shared image
 * by hand; one more chart is cheaper than the library.
 *
 * What had to survive the swap, because §12 asks for it: a dashed line at the
 * domestic close, real gaps where samples are missing rather than a bridge
 * across them, axis prices in won, and a tooltip naming the time in KST.
 */

import { useState } from "react";
import { formatKrw, formatPercent } from "../../lib/format";
import {
  nearestIndex,
  niceTicks,
  priceDomain,
  segments,
  type Point,
} from "./chartGeometry";

/** Room for the y labels; 70px held six digits plus 원 in the old chart. */
const AXIS_W = 62;
const PAD_TOP = 8;
const PAD_RIGHT = 6;
const AXIS_H = 20;
/** Minimum gap between x labels, so they never collide on a narrow phone. */
const X_LABEL_GAP = 76;

const LINE = "#8b7cff";

interface PlotProps {
  points: Point[];
  width: number;
  height: number;
  baseline?: number;
  /** KST formatters, passed in so the component owns no locale logic. */
  formatAxisTime: (ms: number) => string;
  formatTooltipTime: (ms: number) => string;
  gradientId: string;
}

export function ChartPlot({
  points,
  width,
  height,
  baseline,
  formatAxisTime,
  formatTooltipTime,
  gradientId,
}: PlotProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plotW = Math.max(0, width - AXIS_W - PAD_RIGHT);
  const plotH = Math.max(0, height - PAD_TOP - AXIS_H);

  const prices = points
    .map((p) => p.price)
    .filter((p): p is number => p !== null);
  const [minY, maxY] = priceDomain(prices, baseline);
  const times = points.map((p) => p.time);
  const minX = Math.min(...times);
  const maxX = Math.max(...times);
  const spanX = maxX - minX || 1;

  const x = (t: number) => AXIS_W + ((t - minX) / spanX) * plotW;
  const y = (v: number) => PAD_TOP + (1 - (v - minY) / (maxY - minY)) * plotH;

  const yTicks = niceTicks(minY, maxY, 4);
  const xTickCount = Math.max(2, Math.floor(plotW / X_LABEL_GAP));
  const xTicks = Array.from({ length: xTickCount + 1 }, (_, i) =>
    Math.round(minX + (spanX * i) / xTickCount)
  );

  const runs = segments(points);
  const linePath = (run: Point[]) =>
    run
      .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.time).toFixed(1)},${y(p.price!).toFixed(1)}`)
      .join(" ");
  const areaPath = (run: Point[]) => {
    const bottom = PAD_TOP + plotH;
    return `${linePath(run)} L ${x(run[run.length - 1].time).toFixed(1)},${bottom} L ${x(run[0].time).toFixed(1)},${bottom} Z`;
  };

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  const onPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - box.left;
    if (px < AXIS_W || plotW === 0) {
      setHoverIndex(null);
      return;
    }
    const t = minX + ((px - AXIS_W) / plotW) * spanX;
    const index = nearestIndex(points, t);
    setHoverIndex(points[index]?.price === null ? null : index);
  };

  return (
    <div className="relative">
      <svg
        width={width}
        height={height}
        // Pointer events cover mouse, pen and touch in one handler, so a phone
        // reads the chart by dragging along it exactly as a cursor does.
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setHoverIndex(null)}
        style={{ touchAction: "pan-y" }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={LINE} stopOpacity="0.2" />
            <stop offset="95%" stopColor={LINE} stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((v) => (
          <text
            key={v}
            x={AXIS_W - 8}
            y={y(v) + 3}
            textAnchor="end"
            fontSize="10"
            fill="var(--text-tertiary)"
          >
            {new Intl.NumberFormat("ko-KR").format(Math.round(v))}
          </text>
        ))}

        {xTicks.map((t, i) => (
          <text
            key={`${t}-${i}`}
            x={Math.min(Math.max(x(t), AXIS_W + 14), width - 14)}
            y={height - 6}
            textAnchor="middle"
            fontSize="10"
            fill="var(--text-tertiary)"
          >
            {formatAxisTime(t)}
          </text>
        ))}

        {baseline !== undefined && baseline >= minY && baseline <= maxY && (
          <>
            <line
              x1={AXIS_W}
              x2={width - PAD_RIGHT}
              y1={y(baseline)}
              y2={y(baseline)}
              stroke="var(--border-strong)"
              strokeDasharray="5 4"
            />
            <text
              x={width - PAD_RIGHT - 2}
              y={y(baseline) - 4}
              textAnchor="end"
              fontSize="9"
              fill="var(--text-tertiary)"
            >
              종가
            </text>
          </>
        )}

        {runs.map((run, i) => (
          <path key={`a${i}`} d={areaPath(run)} fill={`url(#${gradientId})`} />
        ))}
        {runs.map((run, i) => (
          <path
            key={`l${i}`}
            d={linePath(run)}
            fill="none"
            stroke={LINE}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {hovered?.price != null && (
          <>
            <line
              x1={x(hovered.time)}
              x2={x(hovered.time)}
              y1={PAD_TOP}
              y2={PAD_TOP + plotH}
              stroke="var(--border-strong)"
            />
            <circle
              cx={x(hovered.time)}
              cy={y(hovered.price)}
              r="4"
              fill={LINE}
              stroke="var(--surface-1)"
              strokeWidth="2"
            />
          </>
        )}
      </svg>

      {hovered?.price != null && (
        <div
          /*
           * Follows the cursor but never leaves the card: past the halfway mark
           * it flips to the other side of the line, which is what keeps it from
           * being clipped at either edge.
           */
          className="pointer-events-none absolute top-1 rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface-2)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] shadow-lg shadow-black/30"
          style={
            x(hovered.time) > width / 2
              ? { right: width - x(hovered.time) + 10 }
              : { left: x(hovered.time) + 10 }
          }
          role="status"
        >
          <span className="mb-1.5 block text-[10px] text-[var(--text-tertiary)]">
            {formatTooltipTime(hovered.time)}
          </span>
          <span className="block tabular-nums">
            예상가격 {formatKrw(hovered.price)}
          </span>
          {hovered.changeRate !== null && (
            <span className="block tabular-nums text-[var(--text-secondary)]">
              야간변동 {formatPercent(hovered.changeRate)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
