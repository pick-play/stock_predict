/**
 * The way back used to be a 32px bordered square holding a bare arrow: under
 * the 44px touch target the rest of the site keeps to, and silent about where
 * it went. These pin the two things that fixed it.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackButton } from "../BackButton";

describe("BackButton", () => {
  it("says where it goes, not just which way", () => {
    render(<BackButton onClick={() => {}} />);
    const button = screen.getByRole("button", { name: /시세 화면으로 돌아가기/ });
    expect(button.textContent).toContain("시세");
  });

  it("takes a destination label", () => {
    render(<BackButton onClick={() => {}} label="대시보드" />);
    expect(screen.getByRole("button", { name: /대시보드/ })).toBeTruthy();
  });

  it("navigates when pressed", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<BackButton onClick={onClick} />);

    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  // 36px tall plus the header's own padding; the old 32px square was below the
  // §19 minimum with nothing around it.
  it("is big enough to hit", () => {
    render(<BackButton onClick={() => {}} />);
    expect(screen.getByRole("button").className).toContain("h-9");
  });
});
