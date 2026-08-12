/**
 * The image must be seen before it is sent.
 *
 * The earlier flow generated the PNG and immediately handed it to the OS share
 * sheet or the download folder, so the first look at it came after it had
 * already left. These tests pin the preview step and both exits from it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { StockSnapshot } from "../../../types/market";

const mockImage = vi.hoisted(() => ({
  generate: vi.fn(async () => new Blob(["png"], { type: "image/png" })),
}));

vi.mock("../../../lib/shareCard", () => ({
  generateShareImage: mockImage.generate,
}));

const { ShareCardButton } = await import("../ShareCardButton");

function snapshot(): StockSnapshot {
  return {
    displayName: "삼성전자",
    koreanTicker: "005930",
    binanceSymbol: "SAMSUNGUSDT",
    krxClose: 230000,
    baselineBinancePrice: 182.63,
    currentBinancePrice: 165.31,
    referencePriceMode: "mark",
    bidPrice: 165.31,
    askPrice: 165.33,
    spreadPercent: 0.012,
    confidenceScore: 90,
    eventTime: "2026-08-12T13:00:00.000Z",
    rawEstimatedPrice: 208200.5,
    estimatedPrice: 208000,
    changeAmount: -22000,
    changeRate: -0.0948,
    status: "healthy",
  } as StockSnapshot;
}

/** jsdom has neither of these; the component owns the URL's lifetime. */
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;
let anchorClick: ReturnType<typeof vi.spyOn>;

function setShareSupport(supported: boolean) {
  if (!supported) {
    // Delete rather than return false: desktop Chrome has no canShare at all.
    delete (navigator as unknown as Record<string, unknown>).canShare;
    delete (navigator as unknown as Record<string, unknown>).share;
    return;
  }
  Object.defineProperty(navigator, "canShare", {
    configurable: true,
    writable: true,
    value: vi.fn(() => true),
  });
  Object.defineProperty(navigator, "share", {
    configurable: true,
    writable: true,
    value: vi.fn(async () => undefined),
  });
}

async function openPreview() {
  const user = userEvent.setup();
  render(<ShareCardButton snapshot={snapshot()} />);
  await user.click(screen.getByRole("button", { name: /이미지 만들기/ }));
  await waitFor(() => screen.getByRole("dialog"));
  return user;
}

describe("ShareCardButton", () => {
  beforeEach(() => {
    mockImage.generate.mockClear();
    createObjectURL = vi.fn(() => "blob:preview");
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });
    anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    setShareSupport(true);
  });

  afterEach(() => {
    anchorClick.mockRestore();
    setShareSupport(false);
  });

  it("shows no dialog before the button is pressed", () => {
    render(<ShareCardButton snapshot={snapshot()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mockImage.generate).not.toHaveBeenCalled();
  });

  it("opens a preview of the generated image", async () => {
    await openPreview();
    const img = screen.getByRole("img", { name: /참고 예상가 이미지/ });
    expect(img.getAttribute("src")).toBe("blob:preview");
  });

  // The regression this whole change exists for.
  it("does not send or download anything on its own", async () => {
    await openPreview();
    expect(anchorClick).not.toHaveBeenCalled();
    expect(navigator.share).not.toHaveBeenCalled();
  });

  it("shares the PNG file when the preview's 공유하기 is pressed", async () => {
    const user = await openPreview();
    await user.click(screen.getByRole("button", { name: /공유하기/ }));

    expect(navigator.share).toHaveBeenCalledOnce();
    const data = vi.mocked(navigator.share).mock.calls[0][0] as ShareData;
    expect(data.files?.[0].type).toBe("image/png");
    expect(data.files?.[0].name).toContain("삼성전자");
  });

  it("keeps a save action alongside sharing", async () => {
    const user = await openPreview();
    await user.click(screen.getByRole("button", { name: /사진 저장/ }));
    expect(anchorClick).toHaveBeenCalledOnce();
  });

  it("offers only saving where files cannot be shared", async () => {
    setShareSupport(false);
    const user = await openPreview();

    expect(screen.queryByRole("button", { name: /공유하기/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: /사진 저장/ }));
    expect(anchorClick).toHaveBeenCalledOnce();
  });

  it("treats a dismissed share sheet as no action, not an error", async () => {
    const abort = new Error("cancelled");
    abort.name = "AbortError";
    vi.mocked(navigator.share).mockRejectedValueOnce(abort);

    const user = await openPreview();
    await user.click(screen.getByRole("button", { name: /공유하기/ }));

    expect(screen.queryByText(/실패/)).toBeNull();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("closes on Escape and releases the object URL", async () => {
    const user = await openPreview();
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("closes when the backdrop is tapped", async () => {
    const user = await openPreview();
    await user.click(screen.getByRole("dialog"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("stays open when the sheet itself is tapped", async () => {
    const user = await openPreview();
    await user.click(screen.getByRole("img", { name: /참고 예상가 이미지/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("reports a generation failure instead of opening an empty preview", async () => {
    mockImage.generate.mockRejectedValueOnce(new Error("no canvas"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();

    render(<ShareCardButton snapshot={snapshot()} />);
    await user.click(screen.getByRole("button", { name: /이미지 만들기/ }));

    await waitFor(() => screen.getByText("오류"));
    expect(screen.queryByRole("dialog")).toBeNull();
    consoleError.mockRestore();
  });
});
