/**
 * The room in a panel.
 *
 * The load-bearing property is what happens while it is CLOSED: the dashboard
 * must not open a socket for a visitor who never asked for the room. That is
 * the same rule that keeps the preview strip on polling (§28.3) — a socket per
 * dashboard visitor wakes the Durable Object and makes hibernation pointless.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

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

const { ChatLauncher } = await import("../ChatPopup");

describe("ChatLauncher", () => {
  beforeEach(() => {
    room.mounts = 0;
  });

  it("joins no room until the button is pressed", () => {
    render(<ChatLauncher />);

    expect(room.mounts).toBe(0);
    expect(screen.getByRole("button", { name: "실시간 채팅 열기" })).toBeInTheDocument();
  });

  it("opens the room on press", () => {
    render(<ChatLauncher />);

    fireEvent.click(screen.getByRole("button", { name: "실시간 채팅 열기" }));

    expect(room.mounts).toBeGreaterThan(0);
    expect(screen.getByRole("dialog", { name: "실시간 채팅" })).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("leaves the room when closed, rather than holding the socket open", () => {
    render(<ChatLauncher />);
    fireEvent.click(screen.getByRole("button", { name: "실시간 채팅 열기" }));

    fireEvent.click(screen.getByRole("button", { name: "채팅 닫기" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "실시간 채팅 열기" })).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<ChatLauncher />);
    fireEvent.click(screen.getByRole("button", { name: "실시간 채팅 열기" }));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  /*
   * A phone sheet covers the whole screen, so the cards the reader came from
   * are gone; the room carries them, as the full page does. The desktop panel
   * floats over a dashboard still showing them, which is why the wrapper is
   * md:hidden rather than the cards being dropped altogether.
   */
  it("brings the prices along, since the sheet covers them", () => {
    render(<ChatLauncher />);
    fireEvent.click(screen.getByRole("button", { name: "실시간 채팅 열기" }));

    const cards = screen.getByTestId("mini-cards");
    expect(cards).toBeInTheDocument();
    expect(cards.parentElement).toHaveClass("md:hidden");
  });

  // §28.3: wherever the room appears, it says what it is.
  it("carries the disclaimer", () => {
    render(<ChatLauncher />);
    fireEvent.click(screen.getByRole("button", { name: "실시간 채팅 열기" }));

    expect(screen.getByText(/투자 권유가 아닙니다/)).toBeInTheDocument();
  });
});
