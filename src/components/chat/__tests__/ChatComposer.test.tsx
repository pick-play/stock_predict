/**
 * What the composer is allowed to say, and when.
 *
 * A reader typing a message has not asked for a verdict on it yet. The rule
 * that fired hardest was the length floor: one character produced "2자 이상
 * 입력해주세요" before the writer had a chance to type the second, which reads
 * as being told off for typing. It waits for the send now.
 *
 * The other rules keep their live warning — a blocked word or an over-long
 * paste is worth knowing before pressing send rather than after.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatComposer } from "../ChatComposer";

function renderComposer(onSend = vi.fn(() => true)) {
  render(
    <ChatComposer
      onSend={onSend}
      notice={null}
      onClearNotice={() => {}}
      isConnected
    />
  );
  return {
    onSend,
    input: screen.getByRole("textbox"),
  };
}

const tooShort = () => screen.queryByText(/2자 이상 입력해주세요/);

describe("ChatComposer", () => {
  it("says nothing while the message is still being typed", () => {
    const { input } = renderComposer();

    fireEvent.change(input, { target: { value: "ㅇ" } });

    expect(tooShort()).toBeNull();
  });

  it("states the rule when the writer tries to send", () => {
    const { input, onSend } = renderComposer();
    fireEvent.change(input, { target: { value: "ㅇ" } });

    fireEvent.keyDown(input, { key: "Enter" });

    expect(tooShort()).toBeInTheDocument();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("clears the warning once the message is long enough", () => {
    const { input } = renderComposer();
    fireEvent.change(input, { target: { value: "ㅇ" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(tooShort()).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "안녕" } });

    expect(tooShort()).toBeNull();
  });

  it("still warns live about content it will not send", () => {
    const { input } = renderComposer();

    // Long enough to be judged, and blocked on its content.
    fireEvent.change(input, { target: { value: "010-1234-5678 로 연락주세요" } });

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("sends a valid message", () => {
    const { input, onSend } = renderComposer();
    fireEvent.change(input, { target: { value: "안녕하세요" } });

    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSend).toHaveBeenCalledWith("안녕하세요");
  });
});
