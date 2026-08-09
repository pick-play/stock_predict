import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchComments, submitComment, reportComment } from "../api";
import { BoardApiError } from "../../../types/board";

// ─── Shared fixture ───────────────────────────────────────────────────────────

const mockComment = {
  id: "10",
  postId: "2",
  body: "좋은 글 감사합니다.",
  authorTag: "테스터",
  createdAt: "2026-08-09T12:00:00.000Z",
  reportCount: 0,
};

// ─── fetchComments ────────────────────────────────────────────────────────────

describe("fetchComments", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns comments array and nextCursor on 200", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ comments: [mockComment], nextCursor: null }),
    } as Response);

    const result = await fetchComments("2");
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].authorTag).toBe("테스터");
    expect(result.nextCursor).toBeNull();
  });

  it("returns empty array when there are no comments", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ comments: [], nextCursor: null }),
    } as Response);

    const result = await fetchComments("99");
    expect(result.comments).toHaveLength(0);
  });

  it("hits /api/posts/:id/comments with correct URL", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ comments: [], nextCursor: null }),
    } as Response);

    await fetchComments("42");
    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain("/api/posts/42/comments");
  });

  it("appends cursor and limit as query params", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ comments: [], nextCursor: null }),
    } as Response);

    await fetchComments("2", { cursor: "5", limit: 10 });
    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain("cursor=5");
    expect(calledUrl).toContain("limit=10");
  });

  it("throws BoardApiError with kind=network on fetch failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network failure"));
    await expect(fetchComments("1")).rejects.toBeInstanceOf(BoardApiError);
    await expect(fetchComments("1")).rejects.toMatchObject({ kind: "network" });
  });

  it("throws BoardApiError on non-ok HTTP response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: () =>
        Promise.resolve({ error: "not-found", message: "게시글을 찾을 수 없습니다." }),
    } as Response);

    await expect(fetchComments("999")).rejects.toBeInstanceOf(BoardApiError);
    await expect(fetchComments("999")).rejects.toMatchObject({
      message: "게시글을 찾을 수 없습니다.",
    });
  });
});

// ─── submitComment ────────────────────────────────────────────────────────────

describe("submitComment", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the created comment on 201", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ comment: mockComment }),
    } as Response);

    const comment = await submitComment("2", {
      body: "좋은 글 감사합니다.",
      authToken: "tok-abc",
    });
    expect(comment.id).toBe("10");
    expect(comment.authorTag).toBe("테스터");
    expect(comment.postId).toBe("2");
  });

  it("sends Authorization header with Bearer token", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ comment: mockComment }),
    } as Response);

    await submitComment("2", { body: "hi", authToken: "secret-token" });
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer secret-token"
    );
  });

  it("sends body as JSON", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ comment: mockComment }),
    } as Response);

    await submitComment("2", { body: "test body", authToken: "tok" });
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sent.body).toBe("test body");
  });

  it("uses POST method and correct URL", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ comment: mockComment }),
    } as Response);

    await submitComment("7", { body: "hi", authToken: "tok" });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/posts/7/comments");
    expect(init.method).toBe("POST");
  });

  it("throws BoardApiError kind=rejected on 422", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 422,
      json: () =>
        Promise.resolve({ error: "rejected", message: "욕설이 포함됩니다." }),
    } as Response);

    await expect(
      submitComment("2", { body: "x", authToken: "tok" })
    ).rejects.toMatchObject({ kind: "rejected", message: "욕설이 포함됩니다." });
  });

  it("throws BoardApiError kind=rate-limited on 429", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      json: () =>
        Promise.resolve({
          error: "rate-limited",
          message: "잠시 후 다시 시도해주세요.",
        }),
    } as Response);

    await expect(
      submitComment("2", { body: "x", authToken: "tok" })
    ).rejects.toMatchObject({ kind: "rate-limited" });
  });

  it("throws BoardApiError kind=network on fetch exception", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("disconnected"));

    await expect(
      submitComment("2", { body: "hi", authToken: "tok" })
    ).rejects.toBeInstanceOf(BoardApiError);
    await expect(
      submitComment("2", { body: "hi", authToken: "tok" })
    ).rejects.toMatchObject({ kind: "network" });
  });
});

// ─── reportComment ────────────────────────────────────────────────────────────

describe("reportComment", () => {
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

    await expect(reportComment("10")).resolves.toBeUndefined();
  });

  it("hits /api/comments/:id/report with POST", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    } as Response);

    await reportComment("10");
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/comments/10/report");
    expect(init.method).toBe("POST");
  });

  it("throws BoardApiError on network failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("fail"));

    await expect(reportComment("10")).rejects.toBeInstanceOf(BoardApiError);
    await expect(reportComment("10")).rejects.toMatchObject({ kind: "network" });
  });

  it("throws BoardApiError on non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ message: "신고 한도 초과" }),
    } as Response);

    await expect(reportComment("10")).rejects.toBeInstanceOf(BoardApiError);
    await expect(reportComment("10")).rejects.toMatchObject({
      message: "신고 한도 초과",
    });
  });
});
