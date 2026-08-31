import { AlertCircle } from "lucide-react";

interface ErrorStateProps {
  message: string;
  detail?: string;
}

export function ErrorState({ message, detail }: ErrorStateProps) {
  return (
    <div className="rounded-2xl border border-[rgba(255,93,108,0.3)] bg-[rgba(255,93,108,0.05)] p-6 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-[#ff5d6c] flex-shrink-0 mt-0.5" />
      {/* Theme tokens, not the dark palette spelled out: near-white text on the
          pink tint was unreadable in light mode, and this banner only appears
          when something is already wrong — it must read in both themes. */}
      <div>
        <p className="text-sm text-[var(--text-primary)] font-medium">
          {message}
        </p>
        {detail && (
          <p className="text-xs text-[var(--text-secondary)] mt-1">{detail}</p>
        )}
      </div>
    </div>
  );
}
