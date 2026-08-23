/**
 * The room in a panel.
 *
 * The load-bearing property is what happens while it is CLOSED: the dashboard
 * must not open a socket for a visitor who never asked for the room. That is
 * the same rule that keeps the preview strip on polling (§28.3) — a socket per
 * dashboard visitor wakes the Durable Object and makes hibernation pointless.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const room = vi.hoisted(() => ({
  mounts: 0,
  state: {
    status: "open" as const,
    messages: [],
    participants: 3,
    handle: "느긋한 수달",
    notice: null,
    send: () => true,
    clearNotice: () => {},
  },
}));

vi.mock("../../../hooks/useChatRoom", () => ({
  useChatRoom: () => {
    room.mounts += 1;
    return room.state;
  },
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({ token: null, nickname: null }),
}));

// The prices come from the market feed, which this test has no business
// starting; the panel's own contract is only that it asks for them.
vi.mock("../../common/StockMiniCards", () => ({
  StockMiniCards: () => <div data-testid="mini-cards" />,
}));

const { ChatLauncher } = await import("../ChatLauncher");

/**
 * jsdom has no matchMedia, and the launcher branches on it.
 *
 * `wide` is a desktop window, where the panel floats over the dashboard;
 * anything else is the phone path, which opens the full page instead — readers
 * had the sheet closing under them mid-message when a phone keyboard resized
 * the viewport out from under a fixed element.
 */
function setViewport(wide: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: wide && query.includes("min-width"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList
  );
}

const open = async () => {
  fireEvent.click(screen.getByRole("button", { name: "실시간 채팅 열기" }));
  // The panel's code is lazy-loaded on first open, so it appears a tick later.
  await screen.findByRole("dialog", { name: "실시간 채팅" });
};

describe("ChatLauncher", () => {
  beforeEach(() => {
    room.mounts = 0;
    setViewport(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /*
   * The phone never gets the panel. A keyboard resizes the viewport under a
   * fixed element and moves focus as it opens, and the full page has none of
   * that geometry to lose.
   */
  it("sends a phone to the full page instead of opening a panel", () => {
    setViewport(false);
    const onExpand = vi.fn();
    render(<ChatLauncher onExpand={onExpand} />);

    // Not open(): no dialog will ever appear on this path.
    fireEvent.click(screen.getByRole("button", { name: "실시간 채팅 열기" }));

    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(room.mounts).toBe(0);
  });

  it("joins no room until the button is pressed", () => {
    render(<ChatLauncher />);

    expect(room.mounts).toBe(0);
    expect(screen.getByRole("button", { name: "실시간 채팅 열기" })).toBeInTheDocument();
  });

  it("opens the room on press", async () => {
    render(<ChatLauncher />);

    await open();

    expect(room.mounts).toBeGreaterThan(0);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("leaves the room when closed, rather than holding the socket open", async () => {
    render(<ChatLauncher />);
    await open();

    fireEvent.click(screen.getByRole("button", { name: "채팅 닫기" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "실시간 채팅 열기" })).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    render(<ChatLauncher />);
    await open();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  /*
   * A phone sheet covers the whole screen, so the cards the reader came from
   * are gone; the room carries them, as the full page does. The desktop panel
   * floats over a dashboard still showing them, which is why the wrapper is
   * md:hidden rather than the cards being dropped altogether.
   */
  it("brings the prices along, since the sheet covers them", async () => {
    render(<ChatLauncher />);
    await open();

    const cards = screen.getByTestId("mini-cards");
    expect(cards).toBeInTheDocument();
    expect(cards.parentElement).toHaveClass("md:hidden");
  });

  // §28.3: wherever the room appears, it says what it is.
  it("carries the disclaimer", async () => {
    render(<ChatLauncher />);
    await open();

    expect(screen.getByText(/투자 권유가 아닙니다/)).toBeInTheDocument();
  });
});
