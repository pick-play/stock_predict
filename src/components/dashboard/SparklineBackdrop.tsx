/**
 * The recent trend, drawn large in the card's top-right corner.
 *
 * The card used to carry an 88×30 sparkline there, which is about as small as a
 * chart can be and still be a chart. This is the same series in the same
 * corner, several times the size, sitting behind the content instead of taking
 * a slot in it.
 *
 * The corner is chosen, not incidental: the name sits top-left and the price
 * bottom-left, so the upper right is the one region of the card that carries no
 * text of its own.
 *
 * Everything else here exists to keep it from touching legibility:
 *
 *   - it stretches (`preserveAspectRatio="none"`), so it never dictates layout;
 *   - the fill fades downward from the line, the way an area chart's glow does,
 *     so it thins out toward the price rather than banding across it;
 *   - the caller fades its left edge, so it dissolves into the card instead of
 *     ending in a straight line beside the name;
 *   - the whole thing is held at low opacity and carries no end dot or
 *     gridlines — details at this contrast read as smudges, not information.
 *
 * It is decoration. The card states the change as a number with a sign and an
 * arrow (§11.2), and nothing here is the only carrier of any fact, which is why
 * it is `aria-hidden` and why a card with fewer than two points simply draws
 * nothing rather than inventing a shape (§12).
 *
 * Direction comes from the series itself — first point versus last — not from
 * the card's change against its anchor. The two can disagree (the last six
 * hours can run opposite to the day) and the picture should agree with itself.
 */

interface SparklineBackdropProps {
  data: number[];
  className?: string;
}

/** Viewbox units. Arbitrary — the SVG is stretched to its container. */
const W = 300;
const H = 100;

export function SparklineBackdrop({
  data,
  className = "",
}: SparklineBackdropProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  /*
   * Vertical headroom, in viewbox units.
   *
   * Small margins only: this box has no text of its own, so the curve may use
   * nearly all of it. They exist so a flat series is not pinned to an edge and
   * a volatile one is not clipped by the stroke's own width.
   */
  const top = H * 0.12;
  const bottom = H * 0.9;

  const toX = (i: number) => (i / (data.length - 1)) * W;
  const toY = (v: number) => bottom - ((v - min) / range) * (bottom - top);

  const trend =
    data[data.length - 1] > data[0]
      ? "rise"
      : data[data.length - 1] < data[0]
        ? "fall"
        : "neutral";

  const color =
    trend === "rise" ? "#ff4d5e" : trend === "fall" ? "#3f82ff" : "#6f7a8c";

  const pts = data.map((v, i) => ({
    x: parseFloat(toX(i).toFixed(2)),
    y: parseFloat(toY(v).toFixed(2)),
  }));

  const line = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`)
    .join(" ");
  const area = `${line} L ${W},${H} L 0,${H} Z`;

  // Unique per instance: seven cards render seven of these, and a shared id
  // would point every gradient at whichever card mounted first.
  const gradientId = `trend-${data.length}-${pts[0].y}-${pts[pts.length - 1].y}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.20" />
          <stop offset="60%" stopColor={color} stopOpacity="0.07" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeOpacity="0.5"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
