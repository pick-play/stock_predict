/**
 * Floating "앱 설치" button, bottom right, phones only.
 *
 * Two platforms, two mechanisms:
 *
 *   Android — Chrome fires beforeinstallprompt when the site qualifies, and the
 *   page may replay that event later on a tap. The button only appears once the
 *   event has arrived, so it is never offered where it would do nothing.
 *
 *   iOS — Safari has no such API and never will expose one. The only route is
 *   the reader doing it: 공유 → 홈 화면에 추가. The button therefore opens a
 *   short instruction card instead of pretending it can act.
 *
 * The button says 앱 설치 (owner decision, 2026-08-13), but the iOS card still
 * quotes "홈 화면에 추가" exactly: that is the label of the menu item the reader
 * has to find. Renaming it in the instructions would send someone hunting for
 * something Safari does not offer.
 *
 * It hides itself when the site is already running from the home screen, after
 * an install, and for a month after a dismissal.
 */

import { useCallback, useEffect, useState } from "react";
import { Plus, X, Share } from "lucide-react";
import {
  detectInstallPlatform,
  isDismissed,
  isStandalone,
  rememberDismissal,
  type InstallPlatform,
} from "../../lib/pwa/install";

/**
 * The Chrome-only event. Typed here rather than globally because this is the
 * only file that has any business touching it.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    /**
     * Stashed by the boot script in index.html. The event can fire before React
     * has mounted, and it cannot be retrieved afterwards — miss it and the
     * button never appears on a device that would have accepted it.
     */
    __installPromptEvent?: BeforeInstallPromptEvent | null;
  }
}

/** Clears the bottom market tape (2.5rem) plus the phone's home indicator. */
const BOTTOM_OFFSET = "calc(2.5rem + env(safe-area-inset-bottom) + 0.75rem)";

export function InstallButton() {
  const [platform, setPlatform] = useState<InstallPlatform>(null);
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone() || isDismissed()) return;

    const detected = detectInstallPlatform();
    if (!detected) return;

    setPlatform(detected);
    setHidden(false);

    if (detected !== "android") return;

    // Whatever the boot script caught before React existed.
    if (window.__installPromptEvent) setPromptEvent(window.__installPromptEvent);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      window.__installPromptEvent = null;
      setHidden(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    rememberDismissal();
    setHidden(true);
    setShowIosHelp(false);
  }, []);

  const activate = useCallback(async () => {
    if (platform === "ios") {
      setShowIosHelp((open) => !open);
      return;
    }
    if (!promptEvent) return;

    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;

    // The event is single-use either way — Chrome will not let it be replayed.
    window.__installPromptEvent = null;
    setPromptEvent(null);
    if (outcome === "accepted") setHidden(true);
    else dismiss();
  }, [platform, promptEvent, dismiss]);

  // Android without the event means Chrome has not judged the site installable
  // (or it already is). Offering a button that cannot act would be a dead end.
  if (hidden || !platform) return null;
  if (platform === "android" && !promptEvent) return null;

  return (
    <div
      className="fixed right-4 z-40 flex flex-col items-end gap-2 md:hidden"
      style={{ bottom: BOTTOM_OFFSET }}
    >
      {showIosHelp && (
        <div
          role="dialog"
          aria-label="앱 설치 방법"
          className="w-[15rem] rounded-xl border border-[var(--border-strong)] p-3 text-[13px] leading-relaxed text-[var(--text-secondary)]"
          style={{
            backgroundColor: "var(--surface-menu)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
          }}
        >
          <p className="mb-1.5 font-semibold text-[var(--text-primary)]">
            앱으로 설치하기
          </p>
          <p className="flex items-center gap-1.5">
            <span>1. 아래 공유</span>
            <Share className="inline h-3.5 w-3.5" aria-hidden="true" />
            <span>버튼을 누르세요</span>
          </p>
          <p>2. &lsquo;홈 화면에 추가&rsquo;를 선택하세요</p>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={dismiss}
          aria-label="앱 설치 안내 닫기"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-tertiary)]"
          style={{
            backgroundColor: "color-mix(in srgb, var(--surface-2) 92%, transparent)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => void activate()}
          aria-expanded={platform === "ios" ? showIosHelp : undefined}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-white"
          style={{
            background: "linear-gradient(135deg, #8b7cff 0%, #6b5ce7 100%)",
            boxShadow: "0 8px 24px rgba(107,92,231,0.35)",
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          앱 설치
        </button>
      </div>
    </div>
  );
}
