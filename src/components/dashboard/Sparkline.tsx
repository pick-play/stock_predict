interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
}

export function Sparkline({ data, width = 80, height = 30 }: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;

  const toX = (i: number) =>
    (i / (data.length - 1)) * (width - pad * 2) + pad;
  const toY = (v: number) =>
    height - pad - ((v - min) / range) * (height - pad * 2);

  const firstVal = data[0];
  const lastVal = data[data.length - 1];
  const trend =
    lastVal > firstVal ? "rise" : lastVal < firstVal ? "fall" : "neutral";

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
      style={{ overflow: "visible", display: "block" }}
    >
      <path d={areaPath} fill={fillOpacity} />
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r="2" fill={strokeColor} />
    </svg>
  );
}
