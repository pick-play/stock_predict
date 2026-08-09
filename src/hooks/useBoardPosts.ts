import { useState, useEffect, useCallback, useRef } from "react";
import type { BoardPost } from "../types/board";
import { BoardApiError } from "../types/board";
import { fetchPosts, isBoardConfigured } from "../lib/board/api";

const PAGE_LIMIT = 20;

/**
 * Manages the board post list including initial load, cursor-based pagination,
 * and prepending a newly submitted post without a full re-fetch.
 *
 * Does nothing when isBoardConfigured is false.
 */
export function useBoardPosts() {
  const [posts, setPosts] = useState<BoardPost[]>([]);
  /** undefined = initial state (not yet attempted); null = no more pages */
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(
    undefined
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ref-based lock prevents concurrent fetches from the same hook instance
  const loadingRef = useRef(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!isBoardConfigured || loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPosts({ limit: PAGE_LIMIT, signal });
      if (signal?.aborted) return;
      setPosts(data.posts);
      setNextCursor(data.nextCursor);
    } catch (e) {
      if (signal?.aborted) return;
      setError(
        e instanceof BoardApiError || e instanceof Error
          ? e.message
          : "오류가 발생했습니다."
      );
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    // nextCursor === null means no more pages; undefined means not loaded yet
    if (!isBoardConfigured || loadingRef.current || !nextCursor) return;
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPosts({ cursor: nextCursor, limit: PAGE_LIMIT });
      setPosts((prev) => [...prev, ...data.posts]);
      setNextCursor(data.nextCursor);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "오류가 발생했습니다."
      );
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, [nextCursor]);

  /** Insert a freshly created post at the top without re-fetching. */
  const prependPost = useCallback((post: BoardPost) => {
    setPosts((prev) => [post, ...prev]);
  }, []);

  // Initial load; abort on unmount
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const hasMore = typeof nextCursor === "string" && nextCursor.length > 0;

  return { posts, isLoading, error, hasMore, loadMore, refresh, prependPost };
}
