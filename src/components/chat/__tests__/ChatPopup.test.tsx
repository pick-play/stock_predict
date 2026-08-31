/**
 * The room in a panel.
 *
 * The load-bearing property is what happens while it is CLOSED: the dashboard
 * must not open a socket for a visitor who never asked for the room. That is
 * the same rule that keeps the preview strip on polling (§28.3) — a socket per
 * dashboard visitor wakes the Durable Object and makes hibernation pointless.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const room = vi.hoisted(() => ({
  mounts: 0,
  state: {
    status: "open",
    messages: [] as unknown[],
    participants: 3,
    handle: "느긋한 수달" as string | null,
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

/*
 * The strip's shared store, recorded rather than real: the panel's contract is
 * only when it publishes, and the store's own behaviour has its own tests.
 */
const preview = vi.hoisted(() => ({
  published: [] as { participants: number }[],
}));

vi.mock("../../../lib/chat/livePreview", () => ({
  publishLivePreview: (_messages: unknown[], participants: number) => {
    preview.published.push({ participants });
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
const media = {
  wide: true,
  listeners: new Set<(event: { matches: boolean }) => void>(),
};

function setViewport(wide: boolean) {
  media.wide = wide;
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        get matches() {
          return media.wide && query.includes("min-width");
        },
        media: query,
        addEventListener: (
          _type: string,
          listener: (event: { matches: boolean }) => void
        ) => media.listeners.add(listener),
        removeEventListener: (
          _type: string,
          listener: (event: { matches: boolean }) => void
        ) => media.listeners.delete(listener),
      }) as unknown as MediaQueryList
  );
}

/** A window resize crossing the breakpoint, delivered to mounted listeners. */
function resizeViewport(wide: boolean) {
  media.wide = wide;
  media.listeners.forEach((listener) => listener({ matches: wide }));
}

const open = async () => {
  fireEvent.click(screen.getByRole("button", { name: "실시간 채팅 열기" }));
  // The panel's code is lazy-loaded on first open, so it appears a tick later.
  await screen.findByRole("dialog", { name: "실시간 채팅" });
};

describe("ChatLauncher", () => {
  beforeEach(() => {
    room.mounts = 0;
    room.state.status = "open";
    room.state.messages = [];
    room.state.participants = 3;
    room.state.handle = "느긋한 수달";
    preview.published = [];
    media.listeners.clear();
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
   * The panel only exists while the viewport can float it. When the window
   * narrows below the breakpoint mid-conversation the panel unmounts — and
   * `open` staying true used to hide the launcher too, leaving no way back
   * into the chat until a reload. The button must come back; navigating away
   * on a resize would be worse than either outcome.
   */
  it("restores the launcher when the viewport narrows while open", async () => {
    render(<ChatLauncher />);
    await open();

    act(() => resizeViewport(false));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByRole("button", { name: "실시간 채팅 열기" })
    ).toBeInTheDocument();
  });

  /*
   * The hook mounts with participants=0, and the strip behind the panel
   * prefers live values over its polled copy — publishing before the hello
   * frame flashed "0명 접속" over a count that was right a moment ago. The
   * handle only arrives with hello, so it is the mark the room has answered.
   */
  it("publishes no preview before the hello frame", async () => {
    room.state.status = "connecting";
    room.state.handle = null;
    room.state.participants = 0;
    render(<ChatLauncher />);
    await open();

    expect(preview.published).toHaveLength(0);
  });

  it("publishes the room to the strip once hello has arrived", async () => {
    render(<ChatLauncher />);
    await open();

    expect(preview.published.length).toBeGreaterThan(0);
    expect(preview.published[0].participants).toBe(3);
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
