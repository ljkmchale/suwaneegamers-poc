import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LandscapeBackdrop } from "@/app/(site)/wow-forever/LandscapeBackdrop";

let reduced = false;
let observe: IntersectionObserverCallback;
const play = vi.fn(() => Promise.resolve());
const pause = vi.fn();
beforeEach(() => {
  reduced = false;
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { observe = callback; }
    observe() {} disconnect() {}
  });
  vi.stubGlobal("matchMedia", () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pause);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); play.mockClear(); pause.mockClear(); });
function visibility(visible: boolean) {
  act(() => observe([{ isIntersecting: visible } as IntersectionObserverEntry], {} as IntersectionObserver));
}

it("defers video loading, pauses offscreen, and honors the pause button", () => {
  const { container } = render(<LandscapeBackdrop />);
  const video = container.querySelector("video")!;
  expect(video).not.toHaveAttribute("src");
  visibility(true);
  expect(video).toHaveAttribute("src", expect.stringContaining("zephras-landscape.mp4"));
  expect(play).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Pause landscape" }));
  expect(screen.getByRole("button", { name: "Play landscape" })).toHaveAttribute("aria-pressed", "false");
  play.mockClear();
  visibility(false); visibility(true);
  expect(play).not.toHaveBeenCalled();
});

it("keeps reduced-motion visitors on the poster without fetching the video", () => {
  reduced = true;
  const { container } = render(<LandscapeBackdrop />);
  visibility(true);
  expect(container.querySelector("video")).not.toHaveAttribute("src");
  expect(container.querySelector("video")).toHaveAttribute("poster", expect.stringContaining("poster.webp"));
  expect(screen.getByRole("button", { name: "Play landscape" })).toHaveAttribute("aria-pressed", "false");
  expect(play).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Play landscape" }));
  expect(container.querySelector("video")).toHaveAttribute("src", expect.stringContaining("zephras-landscape.mp4"));
  expect(play).toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Pause landscape" })).toHaveAttribute("aria-pressed", "true");
});

it("falls back to the poster on playback failure", () => {
  const { container } = render(<LandscapeBackdrop />);
  visibility(true);
  fireEvent.error(container.querySelector("video")!);
  expect(container.querySelector("video")).not.toHaveAttribute("src");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
