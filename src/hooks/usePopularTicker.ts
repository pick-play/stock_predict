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

    const load = async (signal: AbortSignal) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
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
    const initController = new AbortController();
    void load(initController.signal);

    // Periodic refresh (only when tab is visible)
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        const ctrl = new AbortController();
        void load(ctrl.signal);
      }
    }, REFRESH_INTERVAL_MS);

    // Resume on tab restore
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        const ctrl = new AbortController();
        void load(ctrl.signal);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      initController.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return { posts, isLoading, error };
}
