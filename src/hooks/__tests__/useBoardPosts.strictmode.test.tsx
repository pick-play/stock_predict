/**
 * The board showed "아직 글이 없습니다" on the dev server while six posts sat in
 * the database.
 *
 * StrictMode mounts an effect, tears it down and mounts it again. The first run
 * started a fetch and took the lock; the cleanup aborted its signal; the second
 * run found the lock still held and returned; the first then resolved, saw
 * `aborted`, and stored nothing. Nobody loaded the list.
 *
 * Production never remounts, so it only broke in development — and the tests
 * rendered without StrictMode, so they never saw it. This one does.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({ fetchPosts: vi.fn(), isBoardConfigured: true }));

vi.mock("../../lib/board/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/board/api")>(
    "../../lib/board/api"
  );
  return { ...actual, ...api };
});

const { useBoardPosts } = await import("../useBoardPosts");

function Probe() {
  const { posts, isLoading } = useBoardPosts();
  return (
    <div>
      <span data-testid="count">{posts.length}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      {posts.map((p) => (
        <p key={p.id}>{p.body}</p>
      ))}
    </div>
  );
}

const PAGE = {
  posts: [
    {
      id: "6",
      body: "회장님 감사합니다",
      authorTag: "삼성전자서비스",
      isMember: true,
      createdAt: "2026-08-17T14:42:14.692Z",
      reportCount: 0,
      likeCount: 1,
      commentCount: 0,
    },
  ],
  nextCursor: null,
};

describe("useBoardPosts under StrictMode", () => {
  beforeEach(() => {
    api.fetchPosts.mockReset();
  });

  it("loads the list even though the first effect run is aborted", async () => {
    // A real network takes time; the remount lands while the first is in flight.
    api.fetchPosts.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(PAGE), 20))
    );

    render(
      <StrictMode>
        <Probe />
      </StrictMode>
    );

    await waitFor(() =>
      expect(screen.getByTestId("count").textContent).toBe("1")
    );
    expect(screen.getByText("회장님 감사합니다")).toBeTruthy();
  });

  it("finishes loading rather than leaving the skeleton up", async () => {
    api.fetchPosts.mockResolvedValue(PAGE);

    render(
      <StrictMode>
        <Probe />
      </StrictMode>
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(screen.getByTestId("count").textContent).toBe("1");
  });
});
