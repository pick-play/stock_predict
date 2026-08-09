import { useState, useEffect, useCallback, useRef } from "react";
import type { BoardComment } from "../types/board";
import { BoardApiError } from "../types/board";
import { fetchComments, isBoardConfigured } from "../lib/board/api";

const PAGE_LIMIT = 20;

/**
 * Manages the comment list for a single post.
 *
 * Fetches lazily: nothing happens until `enabled` becomes true (i.e. the
 * user opens the comment section). Once loaded, toggling `enabled` off and
 * back on reuses the cached result rather than re-fetching.
 *
 * Does nothing when isBoardConfigured is false.
 */
export function usePostComments(postId: string, enabled: boolean) {
  const [comments, setComments] = useState<BoardComment[]>([]);
  /** undefined = not yet attempted; null = no more pages */
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(
    undefined
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const loadedRef = useRef(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!isBoardConfigured || loadingRef.current) return;
      loadingRef.current = true;
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchComments(postId, { limit: PAGE_LIMIT, signal });
        if (signal?.aborted) return;
        setComments(data.comments);
        setNextCursor(data.nextCursor);
        loadedRef.current = true;
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
    },
    [postId]
  );

  const loadMore = useCallback(async () => {
    if (!isBoardConfigured || loadingRef.current || !nextCursor) return;
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchComments(postId, {
        cursor: nextCursor,
        limit: PAGE_LIMIT,
      });
      setComments((prev) => [...prev, ...data.comments]);
      setNextCursor(data.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, [postId, nextCursor]);

  /** Append a freshly created comment at the end without re-fetching. */
  const appendComment = useCallback((comment: BoardComment) => {
    setComments((prev) => [...prev, comment]);
  }, []);

  // Fetch on first enable; ignore subsequent enable toggles (cache reuse).
  useEffect(() => {
    if (!enabled || loadedRef.current) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [enabled, load]);

  const hasMore = typeof nextCursor === "string" && nextCursor.length > 0;

  return { comments, isLoading, error, hasMore, loadMore, appendComment };
}
