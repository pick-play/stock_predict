/**
 * The room's live lines, shared with whatever else on the page shows them.
 *
 * The dashboard strip polls, and the Worker caches the preview on top of that,
 * so a line sent from the popup could take the better part of half a minute to
 * appear a few hundred pixels above it — two views of one room, visibly out of
 * step. The popup already has the messages over its socket; this hands them to
 * the strip directly.
 *
 * A module store rather than a context: the publisher and the reader are in
 * different subtrees, and threading a provider between them would put the
 * room's data in the dashboard's render path for every visitor who never opens
 * the chat.
 *
 * Nothing is cleared on close. The strip's own polling catches up within a
 * cycle, and blanking back to a cached copy the moment the panel closes would
 * make the freshest lines on the page disappear as a reward for closing it.
 */

import { useSyncExternalStore } from "react";
import type { ChatMessage } from "../../types/chat";

interface LivePreview {
  messages: ChatMessage[];
  participants: number | null;
}

/**
 * Stable between publishes.
 *
 * useSyncExternalStore compares snapshots by identity, so returning a fresh
 * object per read is an infinite render loop rather than a performance note.
 */
let snapshot: LivePreview = { messages: [], participants: null };

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishLivePreview(
  messages: ChatMessage[],
  participants: number
): void {
  if (
    snapshot.messages === messages &&
    snapshot.participants === participants
  ) {
    return;
  }
  snapshot = { messages, participants };
  for (const listener of listeners) listener();
}

/** Test seam, so one file's publish cannot leak into the next file's render. */
export function resetLivePreview(): void {
  snapshot = { messages: [], participants: null };
  for (const listener of listeners) listener();
}

export function useLivePreview(): LivePreview {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}
