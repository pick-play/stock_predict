/**
 * Chat advertised "로그인 시 닉네임 고정" with no way to log in from the room.
 * This is the control that closes that, shared with the community page so both
 * behave the same.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountButton } from "../AccountButton";
import type { UseAuthReturn } from "../../../hooks/useAuth";

function auth(overrides: Partial<UseAuthReturn> = {}): UseAuthReturn {
  return {
    status: "unauthenticated",
    nickname: null,
    token: null,
    error: null,
    isLoading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    resetPassword: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  } as UseAuthReturn;
}

describe("AccountButton", () => {
  it("invites a signed-out reader to log in", () => {
    render(<AccountButton auth={auth()} onOpen={() => {}} />);
    expect(screen.getByRole("button", { name: "로그인 또는 가입" })).toBeTruthy();
  });

  it("shows the nickname once signed in", () => {
    render(
      <AccountButton
        auth={auth({ status: "authenticated", nickname: "국장의전설", token: "t" })}
        onOpen={() => {}}
      />
    );
    expect(screen.getByText("국장의전설")).toBeTruthy();
  });

  it("opens the account panel when pressed", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<AccountButton auth={auth()} onOpen={onOpen} />);

    await user.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("shows no login control while the session is still being checked", () => {
    render(<AccountButton auth={auth({ status: "checking" })} onOpen={() => {}} />);
    expect(screen.getByRole("button").textContent).toBe("");
  });
});
