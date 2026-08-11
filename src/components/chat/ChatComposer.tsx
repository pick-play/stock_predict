/**
 * The send box.
 *
 * validateChatMessage() runs here purely as a courtesy so the sender sees the
 * reason before the round trip. The room re-runs the identical check and its
 * answer is the one that counts.
 */

import { useCallback, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { CHAT_MESSAGE_MAX_LENGTH } from "../../lib/chat/config";
import { validateChatMessage } from "../../lib/chat/rules";

interface ChatComposerProps {
  /** Returns false when the socket is not open, so the text is kept. */
  onSend: (body: string) => boolean;
  /** Server refusal for the previous attempt. */
  notice: string | null;
  onClearNotice: () => void;
  isConnected: boolean;
}

export function ChatComposer({
  onSend,
  notice,
  onClearNotice,
  isConnected,
}: ChatComposerProps) {
  const [body, setBody] = useState("");
  const [warning, setWarning] = useState<string | null>(null);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      setBody(next);
      if (notice) onClearNotice();

      if (next.trim().length === 0) {
        setWarning(null);
        return;
      }
      const result = validateChatMessage(next);
      setWarning(result.ok ? null : (result.message ?? null));
    },
    [notice, onClearNotice]
  );

  const submit = useCallback(() => {
    const result = validateChatMessage(body);
    if (!result.ok || result.body === undefined) {
      setWarning(result.message ?? "메시지를 다시 확인해주세요.");
      return;
    }
    if (!onSend(result.body)) {
      setWarning("연결이 끊겼습니다. 다시 연결되면 전송됩니다.");
      return;
    }
    setBody("");
    setWarning(null);
  }, [body, onSend]);

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      submit();
    },
    [submit]
  );

  // Enter sends, Shift+Enter breaks the line — the convention every chat client
  // uses, and the reason this is a textarea rather than an input.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Enter" || e.shiftKey) return;
      // An IME composition commit also arrives as Enter; sending here would
      // eat the last Korean syllable being composed.
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      submit();
    },
    [submit]
  );

  const remaining = CHAT_MESSAGE_MAX_LENGTH - body.length;
  const canSend =
    body.trim().length > 0 && warning === null && remaining >= 0 && isConnected;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="메시지 작성"
      className="shrink-0 border-t border-[var(--border-mid)] bg-[var(--surface-1)] px-4 py-3 md:px-6"
    >
      {(notice ?? warning) && (
        <p
          role="alert"
          aria-live="assertive"
          className="mb-2 rounded-lg border border-[rgba(245,185,66,0.16)] bg-[rgba(245,185,66,0.07)] px-2.5 py-1.5 text-sm leading-relaxed text-[#f5b942]"
        >
          {notice ?? warning}
        </p>
      )}

      <div className="flex items-end gap-2">
        <label htmlFor="chat-body" className="sr-only">
          메시지 (최대 {CHAT_MESSAGE_MAX_LENGTH}자)
        </label>
        <textarea
          id="chat-body"
          value={body}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={CHAT_MESSAGE_MAX_LENGTH + 10}
          placeholder={
            isConnected ? "메시지를 입력하세요" : "연결을 기다리고 있습니다…"
          }
          disabled={!isConnected}
          aria-invalid={warning !== null || remaining < 0}
          aria-describedby="chat-remaining"
          className="min-h-[44px] w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text-primary)] transition-colors duration-150 placeholder-[var(--text-muted)] focus:border-[var(--border-strong)] focus:outline-none focus:ring-1 focus:ring-[rgba(139,124,255,0.3)] disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={!canSend}
          aria-label="메시지 보내기"
          className="min-h-[44px] shrink-0 rounded-lg px-4 text-sm font-semibold transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7cff] disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: canSend
              ? "linear-gradient(135deg, #8b7cff 0%, #6b5ce7 100%)"
              : "rgba(139,124,255,0.15)",
            color: canSend ? "#fff" : "var(--text-muted)",
          }}
        >
          전송
        </button>
      </div>

      <div className="mt-1 flex items-center justify-between px-0.5">
        <span
          id="chat-remaining"
          aria-live="polite"
          className={`text-[12px] tabular-nums ${
            remaining < 0
              ? "text-[#ff5d6c]"
              : remaining < 40
                ? "text-[#f5b942]"
                : "text-[var(--text-muted)]"
          }`}
        >
          {body.length > 0
            ? remaining < 0
              ? `${String(-remaining)}자 초과`
              : `${remaining}자 남음`
            : `최대 ${CHAT_MESSAGE_MAX_LENGTH}자`}
        </span>
        <span className="text-[12px] text-[var(--text-muted)]">
          Enter 전송 · Shift+Enter 줄바꿈
        </span>
      </div>
    </form>
  );
}
