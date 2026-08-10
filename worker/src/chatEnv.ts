import type { Env } from './types';

/**
 * Env plus the chat room's Durable Object binding.
 *
 * Kept separate from types.ts because the binding is optional in practice: a
 * deployment whose wrangler configuration has not yet declared CHAT_ROOM must
 * answer the chat endpoints with a clean 503 rather than throw on an undefined
 * namespace, exactly as the front end degrades when VITE_BOARD_API_BASE is unset.
 */
export interface ChatEnv extends Env {
  CHAT_ROOM: DurableObjectNamespace;
}

export function getChatRoomNamespace(env: Env): DurableObjectNamespace | null {
  return (env as Partial<ChatEnv>).CHAT_ROOM ?? null;
}
