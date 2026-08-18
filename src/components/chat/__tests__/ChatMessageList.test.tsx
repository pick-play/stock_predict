/**
 * Members and anonymous senders sit in the same list, so the list has to say
 * which is which.
 *
 * A member nickname cannot be identical to an anonymous alias — the signup rule
 * forbids spaces and every alias is "형용사 명사" — but "국장의전설" and
 * "느긋한 수달" still look equally like names to a reader. The badge is the only
 * thing that distinguishes a name someone chose and kept from one the server
 * made up for the day.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatMessageList } from "../ChatMessageList";
import type { ChatMessage } from "../../../types/chat";

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "1",
    body: "안녕하세요",
    handle: "느긋한 수달",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("ChatMessageList member badge", () => {
  it("marks a member's line", () => {
    render(
      <ChatMessageList
        messages={[message({ handle: "국장의전설", isMember: true })]}
        ownHandle={null}
      />
    );

    expect(screen.getByText("국장의전설")).toBeTruthy();
    expect(screen.getByText("회원")).toBeTruthy();
  });

  it("leaves an anonymous line unmarked", () => {
    render(<ChatMessageList messages={[message()]} ownHandle={null} />);

    expect(screen.getByText("느긋한 수달")).toBeTruthy();
    expect(screen.queryByText("회원")).toBeNull();
  });

  // Old rows predate the flag entirely.
  it("treats a message with no flag as anonymous", () => {
    render(
      <ChatMessageList
        messages={[message({ isMember: undefined })]}
        ownHandle={null}
      />
    );
    expect(screen.queryByText("회원")).toBeNull();
  });

  it("badges only the lines that earned it", () => {
    render(
      <ChatMessageList
        messages={[
          message({ id: "1", handle: "국장의전설", isMember: true }),
          message({ id: "2" }),
          message({ id: "3", handle: "밝은아침", isMember: true }),
        ]}
        ownHandle={null}
      />
    );

    expect(screen.getAllByText("회원")).toHaveLength(2);
  });
});
