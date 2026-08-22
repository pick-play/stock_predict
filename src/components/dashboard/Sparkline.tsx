/**
 * The recent trend, small, beside the company name.
 *
 * It was briefly a large picture behind the price block; this is the shape it
 * came back to (owner decision, 2026-08-22). A thumbnail is not trying to be
 * read value by value — the chart behind 차트 보기 is for that — it is there so
 * the card carries the shape of the last hours at a glance.
 */

interface SparklineProps {
  data: number[];
  /**
   * The card's overnight change, which decides the colour.
   *
   * Owner decision, 2026-08-22: the picture is tinted by the number printed
   * beside it, not by its own first-to-last direction. The two can disagree —
   * the last six hours can run opposite to the move since the domestic close —
   * and when they did, the card showed a red figure over a blue line. Whatever
   * rule is chosen here, the shared image must use the same one, or a saved
   * picture comes out a different colour from the screen it was taken from.
   */
  changeRate?: number;
  /** Viewbox size. The rendered size comes from `className`. */
  width?: number;
  height?: number;
  /**
   * Tailwind sizing for the element itself.
   *
   * The card wants a different size on a phone than on a desktop, and an SVG
   * cannot express a breakpoint in its width attribute. `meet` is left on, so a
   * class whose ratio differs slightly from the viewbox letterboxes rather than
   * stretching the curve.
   */
  className?: string;
}

export function Sparkline({
  data,
  changeRate,
  width = 132,
  height = 44,
  className = "",
}: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 3;

  const toX = (i: number) =>
    (i / (data.length - 1)) * (width - pad * 2) + pad;
  const toY = (v: number) =>
    height - pad - ((v - min) / range) * (height - pad * 2);

  // Falls back to the series' own direction only when no rate is supplied, so
  // a caller that forgets the prop still draws something coherent.
  const basis =
    changeRate ?? data[data.length - 1] - data[0];
  const trend = basis > 0 ? "rise" : basis < 0 ? "fall" : "neutral";

  const strokeColor =
    trend === "rise"
      ? "#ff4d5e"
      : trend === "fall"
      ? "#3f82ff"
      : "#6f7a8c";

  const fillOpacity =
    trend === "rise"
      ? "rgba(255,77,94,0.07)"
      : trend === "fall"
      ? "rgba(63,130,255,0.07)"
      : "rgba(111,122,140,0.07)";

  const pts = data.map((v, i) => ({
    x: parseFloat(toX(i).toFixed(2)),
    y: parseFloat(toY(v).toFixed(2)),
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");

  const areaPath = [
    `M ${pts[0].x},${height}`,
    ...pts.map((p) => `L ${p.x},${p.y}`),
    `L ${pts[pts.length - 1].x},${height}`,
    "Z",
  ].join(" ");

  const last = pts[pts.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className={className}
      style={{ overflow: "visible", display: "block" }}
    >
      <path d={areaPath} fill={fillOpacity} />
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r="2.5" fill={strokeColor} />
    </svg>
  );
}
