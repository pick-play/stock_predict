import { useState, useEffect, useRef } from "react";
import type { BoardPost } from "../types/board";
import { fetchPopularPosts, isBoardConfigured } from "../lib/board/api";

const POPULAR_LIMIT = 8;
const REFRESH_INTERVAL_MS = 5 * 60 * 1_000; // 5 minutes — matches GH Actions cadence

/**
 * Fetches the popular posts list for the dashboard ticker.
 * Refreshes every 5 minutes while the tab is visible; pauses when hidden.
 * Does nothing when isBoardConfigured is false.
 */
export function usePopularTicker() {
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!isBoardConfigured) return;

    let cancelled = false;
    /** The in-flight request's controller, so cleanup can abort it. */
    let controller: AbortController | null = null;

    const load = async () => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      controller = new AbortController();
      const signal = controller.signal;
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchPopularPosts({ limit: POPULAR_LIMIT, signal });
        if (!cancelled && !signal.aborted) setPosts(result);
      } catch (e) {
        if (!cancelled && !signal.aborted) {
          setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
        }
      } finally {
        loadingRef.current = false;
        if (!cancelled) setIsLoading(false);
      }
    };

    // Initial load
    void load();

    // Periodic refresh (only when tab is visible)
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_INTERVAL_MS);

    // Resume on tab restore
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      // Whatever request is in flight, not just the initial one — the refresh
      // controllers used to be created inline and never reached this cleanup.
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return { posts, isLoading, error };
}
