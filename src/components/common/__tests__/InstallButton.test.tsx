/**
 * The button must never appear where it cannot do anything: on a desktop, on an
 * Android device Chrome has not judged installable, or on a site already running
 * from the home screen. Offering an install that does nothing is worse than
 * offering none.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstallButton } from "../InstallButton";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36";
const DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

function setAgent(ua: string, maxTouchPoints = 0) {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: ua,
  });
  Object.defineProperty(navigator, "maxTouchPoints", {
    configurable: true,
    value: maxTouchPoints,
  });
}

function setStandalone(value: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("standalone") ? value : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

/** The Chrome event, minimally faked. */
function fakePromptEvent(outcome: "accepted" | "dismissed" = "accepted") {
  return {
    preventDefault: vi.fn(),
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome }),
  } as unknown as Event;
}

const BUTTON = { name: "앱 설치" };

describe("InstallButton", () => {
  beforeEach(() => {
    localStorage.clear();
    window.__installPromptEvent = null;
    setStandalone(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stays away from desktop", () => {
    setAgent(DESKTOP);
    render(<InstallButton />);
    expect(screen.queryByRole("button", BUTTON)).toBeNull();
  });

  it("appears on iOS, where there is no prompt API to wait for", () => {
    setAgent(IPHONE);
    render(<InstallButton />);
    expect(screen.getByRole("button", BUTTON)).toBeTruthy();
  });

  it("treats an iPad reporting itself as a Mac as iOS", () => {
    setAgent(DESKTOP, 5);
    render(<InstallButton />);
    expect(screen.getByRole("button", BUTTON)).toBeTruthy();
  });

  it("shows the manual steps on iOS instead of claiming it can install", async () => {
    setAgent(IPHONE);
    const user = userEvent.setup();
    render(<InstallButton />);

    await user.click(screen.getByRole("button", BUTTON));
    // The card must quote Safari's own menu wording, not the button's label.
    expect(screen.getByRole("dialog").textContent).toContain("공유");
    expect(screen.getByRole("dialog").textContent).toContain("홈 화면에 추가");
  });

  // Chrome withholds beforeinstallprompt when the site does not qualify, or when
  // it is already installed. Either way the button would be a dead end.
  it("waits for Chrome's event on Android", () => {
    setAgent(ANDROID);
    render(<InstallButton />);
    expect(screen.queryByRole("button", BUTTON)).toBeNull();
  });

  it("appears on Android once the event has been caught before mount", () => {
    setAgent(ANDROID);
    window.__installPromptEvent = fakePromptEvent() as never;
    render(<InstallButton />);
    expect(screen.getByRole("button", BUTTON)).toBeTruthy();
  });

  it("appears when the event arrives after mount", () => {
    setAgent(ANDROID);
    render(<InstallButton />);

    act(() => {
      window.dispatchEvent(
        Object.assign(new Event("beforeinstallprompt"), {
          prompt: async () => {},
          userChoice: Promise.resolve({ outcome: "accepted" }),
        })
      );
    });

    expect(screen.getByRole("button", BUTTON)).toBeTruthy();
  });

  it("triggers Chrome's prompt and then retires", async () => {
    setAgent(ANDROID);
    const event = fakePromptEvent("accepted");
    window.__installPromptEvent = event as never;
    const user = userEvent.setup();
    render(<InstallButton />);

    await user.click(screen.getByRole("button", BUTTON));

    expect(
      (event as unknown as { prompt: ReturnType<typeof vi.fn> }).prompt
    ).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", BUTTON)).toBeNull();
  });

  it("says nothing on a site already opened from the home screen", () => {
    setAgent(IPHONE);
    setStandalone(true);
    render(<InstallButton />);
    expect(screen.queryByRole("button", BUTTON)).toBeNull();
  });

  it("stays dismissed across visits", async () => {
    setAgent(IPHONE);
    const user = userEvent.setup();
    const { unmount } = render(<InstallButton />);

    await user.click(screen.getByRole("button", { name: /안내 닫기/ }));
    expect(screen.queryByRole("button", BUTTON)).toBeNull();

    unmount();
    render(<InstallButton />);
    expect(screen.queryByRole("button", BUTTON)).toBeNull();
  });

  // A month, not forever: someone who swipes it away today may want it later.
  it("returns after the dismissal window passes", () => {
    setAgent(IPHONE);
    const longAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    localStorage.setItem("kospinow:install-dismissed", String(longAgo));

    render(<InstallButton />);
    expect(screen.getByRole("button", BUTTON)).toBeTruthy();
  });
});
