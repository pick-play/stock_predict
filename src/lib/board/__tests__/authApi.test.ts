import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  signupApi,
  loginApi,
  logoutApi,
  getMeApi,
  resetPasswordApi,
  getMyPostsApi,
} from "../authApi";
import { AuthApiError } from "../../../types/board";

// ─── signupApi ────────────────────────────────────────────────────────────────

describe("signupApi", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  const mockResult = {
    token: "tok123",
    nickname: "테스터",
    recoveryCode: "ABCD-1234-EFGH-5678",
  };

  it("returns token, nickname, and recoveryCode on 201", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve(mockResult),
    } as Response);

    const result = await signupApi("테스터", "authkey64hex", "turnstile-tok");
    expect(result.token).toBe("tok123");
    expect(result.nickname).toBe("테스터");
    expect(result.recoveryCode).toBe("ABCD-1234-EFGH-5678");
  });

  it("sends nickname, authKey, and turnstileToken in body", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve(mockResult),
    } as Response);

    await signupApi("닉네임", "hexkey", "ts-tok");
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.nickname).toBe("닉네임");
    expect(body.authKey).toBe("hexkey");
    expect(body.turnstileToken).toBe("ts-tok");
  });

  it("throws AuthApiError kind=nickname-taken on 409", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({ error: "nickname-taken", message: "이미 사용 중인 닉네임입니다." }),
    } as Response);

    await expect(signupApi("닉네임", "key", "tok")).rejects.toMatchObject({
      kind: "nickname-taken",
      message: "이미 사용 중인 닉네임입니다.",
    });
  });

  it("throws AuthApiError kind=invalid-nickname on 422", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 422,
      json: () =>
        Promise.resolve({ error: "invalid-nickname", message: "유효하지 않은 닉네임입니다." }),
    } as Response);

    await expect(signupApi("invalid!", "key", "tok")).rejects.toMatchObject({
      kind: "invalid-nickname",
    });
  });

  it("throws AuthApiError kind=captcha-failed on 403", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
      json: () =>
        Promise.resolve({ error: "captcha-failed", message: "보안 문자 실패" }),
    } as Response);

    await expect(signupApi("닉네임", "key", "bad-tok")).rejects.toMatchObject({
      kind: "captcha-failed",
    });
  });

  it("throws AuthApiError kind=network on fetch failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("disconnected"));

    await expect(signupApi("닉네임", "key", "tok")).rejects.toBeInstanceOf(
      AuthApiError
    );
    await expect(signupApi("닉네임", "key", "tok")).rejects.toMatchObject({
      kind: "network",
    });
  });
});

// ─── loginApi ─────────────────────────────────────────────────────────────────

describe("loginApi", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("returns token and nickname on 200", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ token: "abc", nickname: "사용자" }),
    } as Response);

    const result = await loginApi("사용자", "authkey");
    expect(result.token).toBe("abc");
    expect(result.nickname).toBe("사용자");
  });

  it("sends nickname and authKey in body (not raw password)", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ token: "x", nickname: "u" }),
    } as Response);

    await loginApi("u", "derivedkey");
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.nickname).toBe("u");
    expect(body.authKey).toBe("derivedkey");
    expect(body.password).toBeUndefined();
  });

  it("throws AuthApiError kind=invalid-credentials on 401", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: () =>
        Promise.resolve({ error: "invalid-credentials", message: "닉네임 또는 비밀번호가 맞지 않습니다." }),
    } as Response);

    await expect(loginApi("없는유저", "wrongkey")).rejects.toMatchObject({
      kind: "invalid-credentials",
    });
  });

  it("throws AuthApiError kind=rate-limited on 429", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      json: () =>
        Promise.resolve({ error: "rate-limited", message: "잠시 후 다시 시도해주세요." }),
    } as Response);

    await expect(loginApi("u", "key")).rejects.toMatchObject({
      kind: "rate-limited",
    });
  });

  it("throws AuthApiError kind=network on fetch failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));

    await expect(loginApi("u", "k")).rejects.toBeInstanceOf(AuthApiError);
    await expect(loginApi("u", "k")).rejects.toMatchObject({ kind: "network" });
  });

  it("hits the /api/auth/login endpoint with POST", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ token: "t", nickname: "n" }),
    } as Response);

    await loginApi("n", "k");
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/auth/login");
    expect(init.method).toBe("POST");
  });
});

// ─── logoutApi ────────────────────────────────────────────────────────────────

describe("logoutApi", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("sends Authorization header with Bearer token", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    } as Response);

    await logoutApi("mytoken");
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer mytoken"
    );
  });

  it("does not throw on network failure (best-effort)", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    await expect(logoutApi("tok")).resolves.toBeUndefined();
  });

  it("does not throw on server error (best-effort)", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "server-error" }),
    } as Response);
    await expect(logoutApi("tok")).resolves.toBeUndefined();
  });
});

// ─── getMeApi ─────────────────────────────────────────────────────────────────

describe("getMeApi", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("returns user info on 200", async () => {
    const user = {
      nickname: "내닉네임",
      createdAt: "2026-08-01T00:00:00.000Z",
      postCount: 5,
    };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(user),
    } as Response);

    const result = await getMeApi("validtoken");
    expect(result.nickname).toBe("내닉네임");
    expect(result.postCount).toBe(5);
  });

  it("throws AuthApiError kind=unauthorized on 401", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: () =>
        Promise.resolve({ error: "unauthorized", message: "인증이 필요합니다." }),
    } as Response);

    await expect(getMeApi("expiredtoken")).rejects.toMatchObject({
      kind: "unauthorized",
    });
  });

  it("sends Authorization header", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ nickname: "u", createdAt: "2026-01-01T00:00:00.000Z", postCount: 0 }),
    } as Response);

    await getMeApi("tok");
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer tok"
    );
  });
});

// ─── resetPasswordApi ─────────────────────────────────────────────────────────

describe("resetPasswordApi", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("resolves on 200", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    } as Response);

    await expect(
      resetPasswordApi("닉네임", "RECOVERY-CODE", "newauthkey")
    ).resolves.toBeUndefined();
  });

  it("sends nickname, recoveryCode, and authKey (not raw password)", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    } as Response);

    await resetPasswordApi("u", "CODE", "hexkey");
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.nickname).toBe("u");
    expect(body.recoveryCode).toBe("CODE");
    expect(body.authKey).toBe("hexkey");
    expect(body.password).toBeUndefined();
  });

  it("throws AuthApiError kind=invalid-recovery on 401", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: () =>
        Promise.resolve({ error: "invalid-recovery", message: "복구 코드가 올바르지 않습니다." }),
    } as Response);

    await expect(
      resetPasswordApi("u", "WRONG", "key")
    ).rejects.toMatchObject({ kind: "invalid-recovery" });
  });

  it("throws AuthApiError kind=network on fetch failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("fail"));

    await expect(resetPasswordApi("u", "c", "k")).rejects.toBeInstanceOf(
      AuthApiError
    );
  });
});

// ─── getMyPostsApi ────────────────────────────────────────────────────────────

describe("getMyPostsApi", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  const myPost = {
    id: "10",
    body: "내 글",
    authorTag: "내닉네임",
    isMember: true,
    createdAt: "2026-08-09T00:00:00.000Z",
    reportCount: 0,
    likeCount: 0,
    hiddenAt: null,
  };

  it("returns posts and nextCursor on 200", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ posts: [myPost], nextCursor: null }),
    } as Response);

    const result = await getMyPostsApi("tok");
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].isMember).toBe(true);
    expect(result.nextCursor).toBeNull();
  });

  it("appends cursor and limit as query params", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ posts: [], nextCursor: null }),
    } as Response);

    await getMyPostsApi("tok", { cursor: "5", limit: 10 });
    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain("cursor=5");
    expect(url).toContain("limit=10");
  });

  it("hits /api/me/posts endpoint", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ posts: [], nextCursor: null }),
    } as Response);

    await getMyPostsApi("tok");
    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain("/api/me/posts");
  });

  it("throws AuthApiError kind=unauthorized on 401", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: () =>
        Promise.resolve({ error: "unauthorized", message: "인증이 필요합니다." }),
    } as Response);

    await expect(getMyPostsApi("expiredtok")).rejects.toMatchObject({
      kind: "unauthorized",
    });
  });

  it("throws AuthApiError kind=network on fetch failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    await expect(getMyPostsApi("tok")).rejects.toBeInstanceOf(AuthApiError);
    await expect(getMyPostsApi("tok")).rejects.toMatchObject({ kind: "network" });
  });
});
