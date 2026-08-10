import type { ReactNode } from "react";
import { MarketTicker } from "../common/MarketTicker";
import { MarketDataProvider } from "../common/MarketDataProvider";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <MarketDataProvider>
      <div
        className="min-h-screen bg-background text-[var(--text-primary)]"
        style={{
          fontFamily:
            "Pretendard, 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        {/* Desktop only, full-bleed. On mobile the same tape is pinned to the
            bottom bar, where a fixed strip costs no scroll depth. */}
        <MarketTicker className="hidden md:block" />

        <div className="max-w-5xl mx-auto">{children}</div>
      </div>
    </MarketDataProvider>
  );
}
