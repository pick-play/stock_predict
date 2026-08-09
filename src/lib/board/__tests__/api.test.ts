import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BOARD_API_BASE, isBoardConfigured, fetchPosts, submitPost, reportPost, fetchPopularPosts, likePost } from "../api";
import { BoardApiError } from "../../../types/board";

// ─── Config ───────────────────────────────────────────────────────────────────

describe("board api config", () => {
  it("isBoardConfigured is false when VITE_BOARD_API_BASE is not set", () => {
    // In the test environment the env var is absent → base is ""
    expect(isBoardConfigured).toBe(false);
    expect(BOARD_API_BASE).toBe("");
  });
});

// ─── fetchPosts ───────────────────────────────────────────────────────────────

describe("fetchPosts", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws BoardApiError with kind=network on fetch failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network failure"));
    await expect(fetchPosts()).rejects.toBeInstanceOf(BoardApiError);
    await expect(fetchPosts()).rejects.toMatchObject({ kind: "network" });
  });

  it("throws BoardApiError on non-ok HTTP response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "server-error", message: "서버 오류" }),
    } as Response);
    await expect(fetchPosts()).rejects.toBeInstanceOf(BoardApiError);
    await expect(fetchPosts()).rejects.toMatchObject({ message: "서버 오류" });
  });

  it("returns parsed list on 200", async () => {
    const mockData = {
      posts: [
        {
          id: "1",
          body: "hello",
          authorTag: "익명#a3f2",
          createdAt: "2026-08-09T00:00:00.000Z",
          reportCount: 0,
          likeCount: 0,
        },
      ],
      nextCursor: null,
    };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockData),
    } as Response);
    const result = await fetchPosts();
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].authorTag).toBe("익명#a3f2");
    expect(result.nextCursor).toBeNull();
  });

  it("appends cursor and limit as query params", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ posts: [], nextCursor: null }),
    } as Response);
    await fetchPosts({ cursor: "42", limit: 10 });
    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain("cursor=42");
    expect(calledUrl).toContain("limit=10");
  });
});

// ─── submitPost ───────────────────────────────────────────────────────────────

describe("submitPost", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mockPost = {
    id: "42",
    body: "테스트",
    authorTag: "익명#b1c2",
    createdAt: "2026-08-09T00:00:00.000Z",
    reportCount: 0,
    likeCount: 0,
  };

  it("returns the created post on 201", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ post: mockPost }),
    } as Response);
    const post = await submitPost({ body: "테스트", turnstileToken: "tok" });
    expect(post.id).toBe("42");
    expect(post.authorTag).toBe("익명#b1c2");
  });

  it("always sends website as empty string (honeypot)", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ post: mockPost }),
    } as Response);
    await submitPost({ body: "hi", turnstileToken: "tok" });
    const reqInit = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const sent = JSON.parse(reqInit.body as string) as Record<string, unknown>;
    expect(sent.website).toBe("");
  });

  it("throws BoardApiError kind=rejected on 422", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 422,
      json: () =>
        Promise.resolve({ error: "rejected", message: "욕설이 포함됩니다." }),
    } as Response);
    await expect(
      submitPost({ body: "x", turnstileToken: "t" })
    ).rejects.toMatchObject({ kind: "rejected", message: "욕설이 포함됩니다." });
  });

  it("throws BoardApiError kind=rate-limited on 429", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      json: () =>
        Promise.resolve({ error: "rate-limited", message: "잠시 후 다시 시도해주세요." }),
    } as Response);
    await expect(
      submitPost({ body: "x", turnstileToken: "t" })
    ).rejects.toMatchObject({ kind: "rate-limited" });
  });

  it("throws BoardApiError kind=captcha-failed on 403", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
      json: () =>
        Promise.resolve({ error: "captcha-failed", message: "보안 문자 인증 실패" }),
    } as Response);
    await expect(
      submitPost({ body: "x", turnstileToken: "t" })
    ).rejects.toMatchObject({ kind: "captcha-failed" });
  });

  it("throws BoardApiError kind=network on fetch exception", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("disconnected"));
    await expect(
      submitPost({ body: "hi", turnstileToken: "tok" })
    ).rejects.toBeInstanceOf(BoardApiError);
    await expect(
      submitPost({ body: "hi", turnstileToken: "tok" })
    ).rejects.toMatchObject({ kind: "network" });
  });
});

// ─── reportPost ───────────────────────────────────────────────────────────────

describe("reportPost", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves without value on 200", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    } as Response);
    await expect(reportPost("1", "spam")).resolves.toBeUndefined();
  });

  it("truncates reason to 200 chars in the request body", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    } as Response);
    const longReason = "x".repeat(300);
    await reportPost("1", longReason);
    const reqInit = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const sent = JSON.parse(reqInit.body as string) as { reason: string };
    expect(sent.reason.length).toBe(200);
  });

  it("throws BoardApiError on network failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("fail"));
    await expect(reportPost("1", "spam")).rejects.toBeInstanceOf(BoardApiError);
    await expect(reportPost("1", "spam")).rejects.toMatchObject({
      kind: "network",
    });
  });

  it("throws BoardApiError on non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ message: "신고 한도 초과" }),
    } as Response);
    await expect(reportPost("1", "spam")).rejects.toBeInstanceOf(BoardApiError);
  });
});

// ─── fetchPopularPosts ────────────────────────────────────────────────────────

describe("fetchPopularPosts", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const popularPost = {
    id: "1",
    body: "인기 글 본문",
    authorTag: "익명#a1b2",
    createdAt: "2026-08-09T00:00:00.000Z",
    reportCount: 0,
    likeCount: 5,
  };

  it("returns posts array on 200", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ posts: [popularPost] }),
    } as Response);
    const result = await fetchPopularPosts();
    expect(result).toHaveLength(1);
    expect(result[0].likeCount).toBe(5);
  });

  it("hits /api/posts/popular endpoint", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ posts: [] }),
    } as Response);
    await fetchPopularPosts({ limit: 5 });
    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain("/api/posts/popular");
    expect(calledUrl).toContain("limit=5");
  });

  it("throws BoardApiError on network failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("fail"));
    await expect(fetchPopularPosts()).rejects.toBeInstanceOf(BoardApiError);
    await expect(fetchPopularPosts()).rejects.toMatchObject({ kind: "network" });
  });

  it("throws BoardApiError on non-ok HTTP response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: "서버 오류" }),
    } as Response);
    await expect(fetchPopularPosts()).rejects.toMatchObject({ message: "서버 오류" });
  });
});

// ─── likePost ─────────────────────────────────────────────────────────────────

describe("likePost", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns likeCount and alreadyLiked on 200", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true, likeCount: 3, alreadyLiked: false }),
    } as Response);
    const result = await likePost("1");
    expect(result.likeCount).toBe(3);
    expect(result.alreadyLiked).toBe(false);
  });

  it("returns alreadyLiked: true when same IP re-likes", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true, likeCount: 3, alreadyLiked: true }),
    } as Response);
    const result = await likePost("1");
    expect(result.alreadyLiked).toBe(true);
  });

  it("uses POST method and correct URL", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true, likeCount: 1, alreadyLiked: false }),
    } as Response);
    await likePost("42");
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/posts/42/like");
    expect(init.method).toBe("POST");
  });

  it("throws BoardApiError on network failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("fail"));
    await expect(likePost("1")).rejects.toBeInstanceOf(BoardApiError);
    await expect(likePost("1")).rejects.toMatchObject({ kind: "network" });
  });

  it("throws BoardApiError on 404 not-found", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ message: "글을 찾을 수 없습니다." }),
    } as Response);
    await expect(likePost("99")).rejects.toMatchObject({
      message: "글을 찾을 수 없습니다.",
    });
  });
});
