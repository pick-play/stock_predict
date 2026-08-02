export const COLORS = {
  background: "#080b10",
  surface1: "#0d1118",
  surface2: "#121824",
  surface3: "#18202e",
  borderSubtle: "rgba(255, 255, 255, 0.07)",
  borderStrong: "rgba(255, 255, 255, 0.13)",
  textPrimary: "#f4f7fb",
  textSecondary: "#a6b0c0",
  textTertiary: "#6f7a8c",
  rise: "#ff4d5e",
  riseSoft: "rgba(255, 77, 94, 0.14)",
  fall: "#3f82ff",
  fallSoft: "rgba(63, 130, 255, 0.14)",
  neutral: "#d6dde8",
  accent: "#8b7cff",
  success: "#31c48d",
  warning: "#f5b942",
  danger: "#ff5d6c",
} as const;

export const CONFIDENCE_THRESHOLDS = {
  good: 80,
  fair: 60,
  caution: 40,
} as const;
