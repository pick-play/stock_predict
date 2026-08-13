/**
 * Everything the install button needs to know about the device it is on.
 *
 * Kept out of the component so the platform rules can be tested without a DOM
 * tree, and so the one piece of user-agent sniffing in the codebase lives in a
 * single named place.
 *
 * Sniffing is unavoidable here. The two platforms do not merely look different —
 * they work differently: Android hands the page a prompt it can trigger, while
 * iOS has no such API at all and can only be told where the menu item is. There
 * is no feature to detect that distinguishes "no prompt yet" from "never".
 */

export type InstallPlatform = "android" | "ios" | null;

const DISMISS_KEY = "kospinow:install-dismissed";

/**
 * How long a dismissal lasts.
 *
 * Not forever: someone who swipes it away on the way to a price should still be
 * able to find it next month. Not a day either — re-offering something already
 * refused is how a prompt becomes an advert.
 */
const DISMISS_DAYS = 30;
const DISMISS_MS = DISMISS_DAYS * 24 * 60 * 60 * 1000;

/**
 * Which mobile platform this is, or null for anything else.
 *
 * Desktop returns null: a floating install button belongs on the device where
 * a home-screen icon means something.
 */
export function detectInstallPlatform(
  userAgent: string = navigator.userAgent,
  maxTouchPoints: number = navigator.maxTouchPoints ?? 0,
): InstallPlatform {
  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";

  /*
   * iPadOS 13+ reports itself as "Macintosh". The touch points are what give it
   * away — a desktop Mac reports 0 even with a trackpad. Without this branch an
   * iPad gets no button at all, which is the device most likely to want one.
   */
  if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";

  return null;
}

/** True once the site is running from the home screen rather than a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;

  const displayMode = window.matchMedia?.("(display-mode: standalone)").matches;
  // iOS Safari never implemented display-mode; it has its own flag instead.
  const iosStandalone = (
    window.navigator as Navigator & { standalone?: boolean }
  ).standalone;

  return Boolean(displayMode || iosStandalone);
}

export function isDismissed(now: number = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    // A corrupt value is treated as no dismissal rather than a permanent one.
    if (!Number.isFinite(at)) return false;
    return now - at < DISMISS_MS;
  } catch {
    return false;
  }
}

export function rememberDismissal(now: number = Date.now()): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(now));
  } catch {
    // Private mode: the button reappears on the next visit. Acceptable.
  }
}
