import type { ReactNode } from "react";
import { MarketTicker } from "../common/MarketTicker";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div
      className="min-h-screen bg-background text-[var(--text-primary)]"
      style={{
        fontFamily:
          "Pretendard, 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Full-bleed: the tape reads as a strip across the top, so it sits
          outside the centred column the rest of the page uses. */}
      <MarketTicker />

      <div className="max-w-5xl mx-auto">{children}</div>
    </div>
  );
}
