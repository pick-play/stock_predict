import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BoardPost } from "../../../types/board";
import { COMMUNITY_HOT_COUNT } from "../../../config/community";

const mockTicker = vi.hoisted(() => ({ posts: [] as BoardPost[] }));

vi.mock("../../../hooks/usePopularTicker", () => ({
  usePopularTicker: () => ({
    posts: mockTicker.posts,
    isLoading: false,
    error: null,
  }),
}));

const { CommunityHotList } = await import("../CommunityHotList");

function posts(n: number): BoardPost[] {
  return Array.from({ length: n }, (_, i) => ({
    id: String(i + 1),
    body: `인기글 ${i + 1}`,
    authorTag: "국장의전설",
    isMember: true,
    createdAt: "2026-08-12T02:00:00.000Z",
    reportCount: 0,
    likeCount: 10 - i,
    commentCount: 0,
  })) as BoardPost[];
}

describe("CommunityHotList", () => {
  beforeEach(() => {
    mockTicker.posts = posts(8);
  });

  it("renders nothing when the feed is empty", () => {
    mockTicker.posts = [];
    const { container } = render(<CommunityHotList />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows at most the configured count, however many arrive", () => {
    render(<CommunityHotList />);
    expect(screen.getAllByRole("listitem")).toHaveLength(COMMUNITY_HOT_COUNT);
    expect(screen.queryByText(`인기글 ${COMMUNITY_HOT_COUNT + 1}`)).toBeNull();
  });

  it("copes with fewer posts than the limit", () => {
    mockTicker.posts = posts(1);
    render(<CommunityHotList />);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  // Every row shows on every screen: the list is full width, so four fit on a
  // phone. An earlier version hid two below md while it shared a row with the
  // chat strip.
  it("shows every row on every screen size", () => {
    render(<CommunityHotList />);
    screen.getAllByRole("listitem").forEach((row) => {
      expect(row.className).toContain("flex");
      expect(row.className).not.toContain("hidden");
    });
  });

  it("numbers the rows and shows each like count", () => {
    render(<CommunityHotList />);
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("인기글 1")).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
  });

  it("says 커뮤니티, never 토론방", () => {
    render(<CommunityHotList />);
    expect(screen.getByText("커뮤니티")).toBeTruthy();
    expect(screen.queryByText(/토론방/)).toBeNull();
  });

  it("opens the community when the card is activated", async () => {
    const user = userEvent.setup();
    const onNavigateBoard = vi.fn();
    render(<CommunityHotList onNavigateBoard={onNavigateBoard} />);

    await user.click(
      screen.getByRole("button", { name: /눌러서 열기/ })
    );
    expect(onNavigateBoard).toHaveBeenCalledOnce();
  });

  it("is reachable by keyboard", async () => {
    const user = userEvent.setup();
    const onNavigateBoard = vi.fn();
    render(<CommunityHotList onNavigateBoard={onNavigateBoard} />);

    screen.getByRole("button", { name: /눌러서 열기/ }).focus();
    await user.keyboard("{Enter}");
    expect(onNavigateBoard).toHaveBeenCalledOnce();
  });

  it("stays a plain section when given no destination", () => {
    render(<CommunityHotList />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(
      screen.getByRole("region", { name: "커뮤니티 주간 인기글" })
    ).toBeTruthy();
  });
});
