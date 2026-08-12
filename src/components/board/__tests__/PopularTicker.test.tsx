import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BoardPost } from "../../../types/board";

const mockTicker = vi.hoisted(() => ({
  posts: [] as BoardPost[],
}));

const mockApi = vi.hoisted(() => ({
  likePost: vi.fn(),
}));

vi.mock("../../../hooks/usePopularTicker", () => ({
  usePopularTicker: () => ({
    posts: mockTicker.posts,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("../../../lib/board/api", () => ({
  isBoardConfigured: true,
  likePost: mockApi.likePost,
}));

const { PopularTicker } = await import("../PopularTicker");

function post(overrides: Partial<BoardPost> = {}): BoardPost {
  return {
    id: "1",
    body: "반도체 오늘 어떻게 보세요",
    authorTag: "국장의전설",
    isMember: true,
    createdAt: "2026-08-10T13:00:00.000Z",
    reportCount: 0,
    likeCount: 2,
    commentCount: 0,
    ...overrides,
  } as BoardPost;
}

describe("PopularTicker", () => {
  beforeEach(() => {
    mockTicker.posts = [post()];
    mockApi.likePost.mockReset();
    mockApi.likePost.mockResolvedValue({ likeCount: 3, liked: true });
  });

  it("shows the post body as text", () => {
    render(<PopularTicker />);
    expect(screen.getByText("반도체 오늘 어떻게 보세요")).toBeTruthy();
  });

  it("opens the board when the strip is activated", async () => {
    const user = userEvent.setup();
    const onNavigateBoard = vi.fn();
    render(<PopularTicker onNavigateBoard={onNavigateBoard} />);

    await user.click(
      screen.getByRole("button", { name: /눌러서 커뮤니티 열기/ })
    );

    expect(onNavigateBoard).toHaveBeenCalledOnce();
  });

  /*
   * The regression this file exists for. The like button sits inside a strip
   * that now navigates, so without stopPropagation a tap on the heart would
   * like the post and then throw the reader onto the board.
   */
  it("does not navigate when the like button is pressed", async () => {
    const user = userEvent.setup();
    const onNavigateBoard = vi.fn();
    render(<PopularTicker onNavigateBoard={onNavigateBoard} />);

    await user.click(screen.getByRole("button", { name: /공감/ }));

    expect(mockApi.likePost).toHaveBeenCalledOnce();
    expect(onNavigateBoard).not.toHaveBeenCalled();
    // Let the optimistic update reconcile so the async setState lands inside
    // the test rather than after it.
    await waitFor(() => expect(screen.getByText("3")).toBeTruthy());
  });

  it("is reachable by keyboard", async () => {
    const user = userEvent.setup();
    const onNavigateBoard = vi.fn();
    render(<PopularTicker onNavigateBoard={onNavigateBoard} />);

    screen.getByRole("button", { name: /눌러서 커뮤니티 열기/ }).focus();
    await user.keyboard("{Enter}");

    expect(onNavigateBoard).toHaveBeenCalledOnce();
  });

  // A keypress that bubbled up from the like button must not also navigate.
  it("ignores keys that originated inside the strip", async () => {
    const user = userEvent.setup();
    const onNavigateBoard = vi.fn();
    render(<PopularTicker onNavigateBoard={onNavigateBoard} />);

    screen.getByRole("button", { name: /공감/ }).focus();
    await user.keyboard("{Enter}");

    expect(onNavigateBoard).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("3")).toBeTruthy());
  });

  it("stays a plain region when given no destination", () => {
    render(<PopularTicker />);
    expect(
      screen.queryByRole("button", { name: /눌러서 커뮤니티 열기/ })
    ).toBeNull();
    expect(screen.getByRole("region", { name: "커뮤니티 인기글" })).toBeTruthy();
  });
});
