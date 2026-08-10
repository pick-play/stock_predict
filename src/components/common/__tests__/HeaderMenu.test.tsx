import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockTheme = vi.hoisted(() => ({
  theme: "dark" as "dark" | "light",
  toggle: vi.fn(),
}));

vi.mock("../../../hooks/useTheme", () => ({
  useTheme: () => mockTheme,
}));

const { HeaderMenu } = await import("../HeaderMenu");

describe("HeaderMenu", () => {
  beforeEach(() => {
    mockTheme.theme = "dark";
    mockTheme.toggle.mockClear();
  });

  it("keeps the menu closed until pressed", () => {
    render(<HeaderMenu onNavigateBoard={() => {}} onNavigateChat={() => {}} />);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "메뉴" })).toBeTruthy();
  });

  it("offers the three controls the header dropped on small screens", async () => {
    const user = userEvent.setup();
    render(<HeaderMenu onNavigateBoard={() => {}} onNavigateChat={() => {}} />);

    await user.click(screen.getByRole("button", { name: "메뉴" }));

    expect(screen.getByRole("menuitem", { name: /토론방/ })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /실시간 채팅/ })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /라이트 모드/ })).toBeTruthy();
  });

  it("navigates and closes on a menu choice", async () => {
    const user = userEvent.setup();
    const onNavigateChat = vi.fn();
    render(<HeaderMenu onNavigateChat={onNavigateChat} />);

    await user.click(screen.getByRole("button", { name: "메뉴" }));
    await user.click(screen.getByRole("menuitem", { name: /실시간 채팅/ }));

    expect(onNavigateChat).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  // A reader flipping the theme wants to see the result, and may flip back.
  it("stays open after a theme flip", async () => {
    const user = userEvent.setup();
    render(<HeaderMenu onNavigateBoard={() => {}} />);

    await user.click(screen.getByRole("button", { name: "메뉴" }));
    await user.click(screen.getByRole("menuitem", { name: /라이트 모드/ }));

    expect(mockTheme.toggle).toHaveBeenCalledOnce();
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("names the theme it will switch to, not the current one", async () => {
    const user = userEvent.setup();
    mockTheme.theme = "light";
    render(<HeaderMenu onNavigateBoard={() => {}} />);

    await user.click(screen.getByRole("button", { name: "메뉴" }));

    expect(screen.getByRole("menuitem", { name: /다크 모드/ })).toBeTruthy();
  });

  // Without either dismissal a menu on a phone is a trap: no hover hints that
  // tapping elsewhere would close it.
  it("closes on an outside press", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <HeaderMenu onNavigateBoard={() => {}} />
        <button type="button">밖</button>
      </div>
    );

    await user.click(screen.getByRole("button", { name: "메뉴" }));
    expect(screen.getByRole("menu")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "밖" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<HeaderMenu onNavigateBoard={() => {}} />);

    await user.click(screen.getByRole("button", { name: "메뉴" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).toBeNull();
  });

  /*
   * The panel is painted with a dedicated opaque token. It previously used
   * --surface-2, which sits close enough to --bg in both themes that the menu
   * read as see-through and the page text behind it appeared to bleed in.
   */
  it("paints the panel on the dedicated opaque surface", async () => {
    const user = userEvent.setup();
    render(<HeaderMenu onNavigateBoard={() => {}} />);

    await user.click(screen.getByRole("button", { name: "메뉴" }));

    const panel = screen.getByRole("menu");
    expect(panel.style.backgroundColor).toBe("var(--surface-menu)");
    // A transparent panel is the bug; anything alpha-capable must not creep back.
    expect(panel.style.backgroundColor).not.toContain("transparent");
    expect(panel.style.backgroundColor).not.toContain("rgba");
  });

  it("omits an entry it was given no destination for", async () => {
    const user = userEvent.setup();
    render(<HeaderMenu onNavigateBoard={() => {}} />);

    await user.click(screen.getByRole("button", { name: "메뉴" }));

    expect(screen.queryByRole("menuitem", { name: /실시간 채팅/ })).toBeNull();
  });
});
