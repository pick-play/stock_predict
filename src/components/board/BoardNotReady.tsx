/**
 * Shown when VITE_BOARD_API_BASE is not configured (Worker not yet deployed).
 * Default scenario per task #15 constraints.
 */
export function BoardNotReady() {
  return (
    <div className="animate-slide-fade-in flex flex-col items-center justify-center py-24 px-6 text-center">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
        style={{
          background: "linear-gradient(135deg, rgba(139,124,255,0.13) 0%, rgba(139,124,255,0.06) 100%)",
          border: "1px solid rgba(139,124,255,0.2)",
        }}
        aria-hidden="true"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#8b7cff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>

      <h2 className="text-base font-semibold text-[var(--text-primary)] mb-2 tracking-tight">
        커뮤니티 준비 중
      </h2>
      <p className="text-sm text-[var(--text-tertiary)] max-w-xs leading-relaxed">
        커뮤니티가 곧 열립니다.
        <br />
        지금은 시세 화면을 이용해주세요.
      </p>
    </div>
  );
}
