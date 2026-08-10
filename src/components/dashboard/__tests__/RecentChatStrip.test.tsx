import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RecentChat } from "../../../lib/chat/recentApi";

const mockFetch = vi.hoisted(() => ({
  result: null as RecentChat | null,
}));

vi.mock("../../../lib/chat/recentApi", () => ({
  fetchRecentChat: () => Promise.resolve(mockFetch.result),
}));

vi.mock("../../../lib/chat/api", () => ({
  isChatConfigured: true,
}));

const { RecentChatStrip } = await import("../RecentChatStrip");

function payload(count = 2): RecentChat {
  return {
    participants: 3,
    messages: Array.from({ length: count }, (_, i) => ({
      id: String(i),
      body: `메시지 ${i}`,
      handle: "느긋한 수달",
      createdAt: new Date(Date.now() - i * 1_000).toISOString(),
    })),
  };
}

describe("RecentChatStrip", () => {
  beforeEach(() => {
    mockFetch.result = null;
  });

  it("renders nothing when the preview is empty", async () => {
    mockFetch.result = { participants: 0, messages: [] };
    const { container } = render(<RecentChatStrip />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("shows the head count and the recent lines", async () => {
    mockFetch.result = payload();
    render(<RecentChatStrip />);

    expect(await screen.findByText("3명 접속")).toBeTruthy();
    expect(screen.getByText("메시지 0")).toBeTruthy();
    expect(screen.getByText("메시지 1")).toBeTruthy();
  });

  // The whole card is the tap target, not a small corner link.
  it("opens the room when the card is activated", async () => {
    const user = userEvent.setup();
    const onNavigateChat = vi.fn();
    mockFetch.result = payload();
    render(<RecentChatStrip onNavigateChat={onNavigateChat} />);

    const card = await screen.findByRole("button", {
      name: /눌러서 실시간 채팅 열기/,
    });
    await user.click(card);

    expect(onNavigateChat).toHaveBeenCalledOnce();
  });

  it("is reachable by keyboard", async () => {
    const user = userEvent.setup();
    const onNavigateChat = vi.fn();
    mockFetch.result = payload();
    render(<RecentChatStrip onNavigateChat={onNavigateChat} />);

    const card = await screen.findByRole("button", {
      name: /눌러서 실시간 채팅 열기/,
    });
    card.focus();
    await user.keyboard("{Enter}");

    expect(onNavigateChat).toHaveBeenCalledOnce();
  });

  // Without a destination it must not advertise itself as pressable.
  it("stays a plain region when given no destination", async () => {
    mockFetch.result = payload();
    render(<RecentChatStrip />);

    await screen.findByText("메시지 0");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the newest line first, unlike the room itself", async () => {
    mockFetch.result = {
      participants: 1,
      messages: [
        { id: "1", body: "먼저", handle: "맑은 파도", createdAt: "2026-08-10T13:00:00.000Z" },
        { id: "2", body: "나중", handle: "맑은 파도", createdAt: "2026-08-10T13:01:00.000Z" },
      ],
    };
    render(<RecentChatStrip />);

    const items = await screen.findAllByRole("listitem");
    expect(items[0].textContent).toContain("나중");
  });
});
