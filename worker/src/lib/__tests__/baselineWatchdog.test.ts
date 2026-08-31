/**
 * The watchdog exists because GitHub's cron skipped whole trading days
 * (2026-08-27 and -31). What is worth pinning is its decision table: when it
 * stays quiet, which workflow it wakes, and that a missing token degrades to a
 * log line instead of a throw — a watchdog that crashes the worker would trade
 * a stale anchor for a dead chat API.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ensureBaselineFresh,
  lastTradingDayKST,
} from "../baselineWatchdog";
import type { Env } from "../../types";

const env = (token?: string) =>
  ({ GITHUB_DISPATCH_TOKEN: token } as unknown as Env);

/** Stub fetch: baseline reads answer from the map, dispatches are recorded. */
function stubNetwork(closeDates: {
  site: string | null;
  git?: string | null;
}) {
  const dispatched: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.github.com")) {
        dispatched.push(url.match(/workflows\/([^/]+)\/dispatches/)![1]);
        return new Response(null, { status: 204 });
      }
      const date = url.includes("raw.githubusercontent")
        ? closeDates.git ?? closeDates.site
        : closeDates.site;
      if (date === null) return new Response("gone", { status: 404 });
      return new Response(JSON.stringify({ close: { marketDate: date } }), {
        status: 200,
      });
    })
  );
  return dispatched;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lastTradingDayKST", () => {
  it("targets Friday from anywhere in the weekend, in Korean time", () => {
    // Saturday 01:00 KST is Friday 16:00 UTC — the calendar must be Seoul's.
    expect(lastTradingDayKST(new Date("2026-08-28T16:00:00.000Z"))).toBe(
      "2026-08-28"
    );
    // Sunday afternoon KST.
    expect(lastTradingDayKST(new Date("2026-08-30T05:00:00.000Z"))).toBe(
      "2026-08-28"
    );
  });

  it("targets today on a weekday", () => {
    expect(lastTradingDayKST(new Date("2026-08-31T11:00:00.000Z"))).toBe(
      "2026-08-31"
    );
  });
});

describe("ensureBaselineFresh", () => {
  // Monday 20:45 KST — well past the close, the 2026-08-31 incident hour.
  const evening = new Date("2026-08-31T11:45:00.000Z");

  it("does nothing when the published site already has the target close", async () => {
    const dispatched = stubNetwork({ site: "2026-08-31" });
    await ensureBaselineFresh(env("tok"), evening);
    expect(dispatched).toEqual([]);
  });

  it("waits before 15:45 KST instead of chasing an unsettled bar", async () => {
    const dispatched = stubNetwork({ site: "2026-08-28" });
    // Monday 10:00 KST: today is the target but the close doesn't exist yet.
    await ensureBaselineFresh(env("tok"), new Date("2026-08-31T01:00:00.000Z"));
    expect(dispatched).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("dispatches the baseline workflow when git is stale too", async () => {
    const dispatched = stubNetwork({ site: "2026-08-28", git: "2026-08-28" });
    await ensureBaselineFresh(env("tok"), evening);
    expect(dispatched).toEqual(["update-baseline.yml"]);
  });

  it("dispatches only the deploy when the anchor is committed but unpublished", async () => {
    const dispatched = stubNetwork({ site: "2026-08-28", git: "2026-08-31" });
    await ensureBaselineFresh(env("tok"), evening);
    expect(dispatched).toEqual(["deploy-pages.yml"]);
  });

  it("treats an unreadable site as stale, not as fresh", async () => {
    const dispatched = stubNetwork({ site: null, git: null });
    await ensureBaselineFresh(env("tok"), evening);
    expect(dispatched).toEqual(["update-baseline.yml"]);
  });

  it("stands down without a token instead of throwing", async () => {
    const dispatched = stubNetwork({ site: "2026-08-28" });
    await expect(
      ensureBaselineFresh(env(undefined), evening)
    ).resolves.toBeUndefined();
    expect(dispatched).toEqual([]);
  });
});
