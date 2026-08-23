/**
 * The floating button that opens the chat, and the panel's open state.
 *
 * Split from ChatPopup so the panel's code can load when it is first opened
 * rather than with the dashboard: the launcher itself is a button and an SVG,
 * but the panel drags in the composer, the transcript, the join logic and the
 * socket hook — chat-room code a visitor who never taps the button should not
 * download. The same reasoning §28.3 applies to the socket applies to the
 * JavaScript.
 */

import { lazy, Suspense, useState } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery";

const ChatPopupLazy = lazy(() =>
  import("./ChatPopup").then((m) => ({ default: m.ChatPopup }))
);

export function ChatLauncher({ onExpand }: { onExpand?: () => void }) {
  const [open, setOpen] = useState(false);

  /*
   * A phone gets the page, not the panel.
   *
   * Readers reported the sheet closing on them mid-message. A phone keyboard
   * resizes the viewport under a fixed element and moves focus around as it
   * opens, and a panel living outside the page's own scroll container is the
   * fragile place to be standing when that happens — the full page has none of
   * that geometry to lose.
   *
   * The breakpoint is the same 768px the panel's own styling uses, so the
   * decision matches the layout that would have been drawn rather than
   * guessing from the input device: a narrow desktop window is the same shape
   * of problem as a phone.
   */
  const canFloat = useMediaQuery("(min-width: 768px)");

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => (canFloat ? setOpen(true) : onExpand?.())}
          aria-label="실시간 채팅 열기"
          /*
           * Above the phone's market tape and its home indicator; the install
           * button stacks above this one, so the two never overlap.
           */
          className="fixed right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-[#8b7cff] px-4 text-sm font-semibold text-white shadow-lg shadow-[rgba(139,124,255,0.35)] transition-transform duration-150 hover:scale-105 active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] md:right-6 md:bottom-6"
          style={{ bottom: "calc(2.5rem + env(safe-area-inset-bottom) + 0.75rem)" }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              d="M2.5 4.2a1.7 1.7 0 0 1 1.7-1.7h9.6a1.7 1.7 0 0 1 1.7 1.7v6.4a1.7 1.7 0 0 1-1.7 1.7H7.2L3.6 15.2v-2.9a1.7 1.7 0 0 1-1.1-1.6z"
              fill="currentColor"
            />
          </svg>
          채팅
        </button>
      )}

      {/* Nothing while loading: the button has already disappeared, and the
          panel follows within a beat — a flash of skeleton would outlive it. */}
      {open && canFloat && (
        <Suspense fallback={null}>
          <ChatPopupLazy onClose={() => setOpen(false)} onExpand={onExpand} />
        </Suspense>
      )}
    </>
  );
}
