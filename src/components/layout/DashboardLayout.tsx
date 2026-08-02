import type { ReactNode } from "react";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div
      className="min-h-screen bg-background text-[#f4f7fb]"
      style={{
        fontFamily:
          "Pretendard, 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div className="max-w-5xl mx-auto">{children}</div>
    </div>
  );
}
