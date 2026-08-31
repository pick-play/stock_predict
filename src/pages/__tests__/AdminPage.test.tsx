/**
 * The gate has to be the server's answer, not the page's opinion.
 *
 * These tests pin that: nothing is fetched before a password is accepted, the
 * password is exchanged for a token rather than used as one, and a token the
 * Worker stops accepting drops the console straight back to the form.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminApiError } from "../../lib/admin/api";

const api = vi.hoisted(() => ({
  adminLogin: vi.fn<(password: string) => Promise<string>>(),
  fetchChatLines: vi.fn(),
  fetchAdminPosts: vi.fn(),
  fetchAdminComments: vi.fn(),
  deleteChatLines: vi.fn(),
  deletePost: vi.fn(),
  hidePost: vi.fn(),
  unhidePost: vi.fn(),
  deleteComment: vi.fn(),
}));

vi.mock("../../lib/admin/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/admin/api")>(
    "../../lib/admin/api"
  );
  return { ...actual, ...api, isAdminConfigured: true };
});

const { AdminPage } = await import("../AdminPage");

const TOKEN = "long-random-token";

function renderPage() {
  return render(<AdminPage onNavigateDashboard={() => {}} />);
}

describe("AdminPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    Object.values(api).forEach((fn) => fn.mockReset());
    api.adminLogin.mockResolvedValue(TOKEN);
    api.fetchChatLines.mockResolvedValue({
      messages: [
        {
          id: "9",
          body: "테스트 발언",
          handle: "빠른 별자리",
          createdAt: "2026-08-12T13:00:00.000Z",
        },
      ],
      participants: 3,
    });
    api.deleteChatLines.mockResolvedValue({ deleted: ["9"] });
  });

  it("asks for a password and fetches nothing yet", () => {
    renderPage();
    expect(screen.getByLabelText("비밀번호")).toBeTruthy();
    expect(api.fetchChatLines).not.toHaveBeenCalled();
    expect(api.fetchAdminPosts).not.toHaveBeenCalled();
  });

  it("keeps the field masked", () => {
    renderPage();
    expect(screen.getByLabelText("비밀번호").getAttribute("type")).toBe(
      "password"
    );
  });

  it("exchanges the password for a token and opens the console", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("비밀번호"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "확인" }));

    await waitFor(() => screen.getByRole("tab", { name: "실시간 채팅" }));
    expect(api.adminLogin).toHaveBeenCalledWith("correct-horse");

    // The stored credential is the token the server returned, never the password.
    expect(sessionStorage.getItem("kospinow:admin-token")).toBe(TOKEN);
    expect(api.fetchChatLines).toHaveBeenCalledWith(TOKEN, expect.any(Number));
  });

  it("reports a wrong password and stores nothing", async () => {
    api.adminLogin.mockRejectedValueOnce(
      new AdminApiError("unauthorized", "비밀번호가 올바르지 않습니다.")
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("비밀번호"), "000000");
    await user.click(screen.getByRole("button", { name: "확인" }));

    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alert").textContent).toContain("올바르지 않습니다");
    expect(sessionStorage.getItem("kospinow:admin-token")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("resumes an unlocked session from sessionStorage", async () => {
    sessionStorage.setItem("kospinow:admin-token", TOKEN);
    renderPage();

    await waitFor(() => screen.getByRole("tab", { name: "실시간 채팅" }));
    expect(api.adminLogin).not.toHaveBeenCalled();
  });

  it("deletes one chat line", async () => {
    sessionStorage.setItem("kospinow:admin-token", TOKEN);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /이 줄 삭제/ }));
    expect(api.deleteChatLines).toHaveBeenCalledWith(TOKEN, { ids: ["9"] });
  });

  /*
   * The by-handle sweep must ask first: anonymous aliases come from 1,600
   * adjective+noun combinations, so the same handle can be several people and
   * a moderator needs to see that warning before the lines vanish.
   */
  it("deletes every line from one sender after confirming", async () => {
    sessionStorage.setItem("kospinow:admin-token", TOKEN);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: /이 사용자 전체 삭제/ })
    );
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining("같은 별칭")
    );
    expect(api.deleteChatLines).toHaveBeenCalledWith(TOKEN, {
      handle: "빠른 별자리",
    });
    confirmSpy.mockRestore();
  });

  it("does not delete by handle when the confirm is declined", async () => {
    sessionStorage.setItem("kospinow:admin-token", TOKEN);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: /이 사용자 전체 삭제/ })
    );
    expect(api.deleteChatLines).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  /*
   * The token was rotated, or the session outlived it. Staying on a console whose
   * every button 401s would read as the site being broken.
   */
  it("locks back to the form when the token stops being accepted", async () => {
    sessionStorage.setItem("kospinow:admin-token", TOKEN);
    api.fetchChatLines.mockRejectedValueOnce(
      new AdminApiError("unauthorized", "비밀번호가 올바르지 않습니다.")
    );
    renderPage();

    await waitFor(() => screen.getByLabelText("비밀번호"));
    expect(sessionStorage.getItem("kospinow:admin-token")).toBeNull();
  });

  it("shows the reported filter first on the 게시글 tab", async () => {
    sessionStorage.setItem("kospinow:admin-token", TOKEN);
    api.fetchAdminPosts.mockResolvedValue({ posts: [] });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "게시글" }));
    await waitFor(() =>
      expect(api.fetchAdminPosts).toHaveBeenCalledWith(TOKEN, "reported")
    );
  });
});

/**
 * The locked page should not advertise what it guards. The password remains the
 * boundary; this is only about not handing a curious visitor a signpost.
 */
describe("AdminPage while locked", () => {
  beforeEach(() => {
    sessionStorage.clear();
    Object.values(api).forEach((fn) => fn.mockReset());
    api.adminLogin.mockResolvedValue(TOKEN);
  });

  it("names nothing and shows no console", () => {
    renderPage();
    expect(screen.queryByText("관리")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByText(/삭제/)).toBeNull();
  });

  it("labels the field neutrally", () => {
    renderPage();
    expect(screen.getByLabelText("비밀번호")).toBeTruthy();
    expect(screen.queryByLabelText(/관리자/)).toBeNull();
  });
});
