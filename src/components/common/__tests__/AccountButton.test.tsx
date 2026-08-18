/**
 * Chat advertised "로그인 시 닉네임 고정" with no way to log in from the room.
 * This is the control that closes that, shared with the community page so both
 * behave the same.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UseAuthReturn } from "../../../hooks/useAuth";

/*
 * The backend flag is mocked rather than inherited from the environment.
 *
 * It is derived from VITE_BOARD_API_BASE, which exists in the local .env and
 * not in CI — so these tests passed here and failed there, asserting on a
 * button that had been replaced by "준비 중". A test about how the control looks
 * must not depend on whether the machine running it has a .env.
 */
const board = vi.hoisted(() => ({ isBoardConfigured: true }));

vi.mock("../../../lib/board/api", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/board/api")>(
    "../../../lib/board/api"
  );
  return { ...actual, get isBoardConfigured() { return board.isBoardConfigured; } };
});

const { AccountButton } = await import("../AccountButton");

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
  beforeEach(() => {
    board.isBoardConfigured = true;
  });

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

describe("AccountButton without a backend", () => {
  it("offers no login it cannot deliver", () => {
    board.isBoardConfigured = false;
    render(<AccountButton auth={auth()} onOpen={() => {}} />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("준비 중")).toBeTruthy();
  });
});
