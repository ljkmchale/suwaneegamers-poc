import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WarcraftChronicles } from "@/app/(site)/wow-forever/WarcraftChronicles";

vi.mock("@/app/(site)/wow-forever/actions", () => ({ deleteWarcraftNight: vi.fn() }));
vi.mock("next/image", () => ({ default: () => null }));

describe("Warcraft Chronicles", () => {
  it("returns from the standalone reader to the primary game-night page", () => {
    render(<WarcraftChronicles nights={[]} admin={false} standalone />);
    expect(screen.getByRole("link", { name: "← Back to game night" })).toHaveAttribute("href", "/wow-forever");
    expect(screen.getByRole("heading", { level: 1, name: "The Azeroth Chronicles" })).toBeInTheDocument();
  });
  it("opens an unwritten chronicle without inventing sessions", () => {
    render(<WarcraftChronicles nights={[]} admin={false} />);
    expect(screen.getByText("The first chapter is still ahead.")).toBeInTheDocument();
    expect(screen.queryByText("Begin reading →")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Warcraft chronicle chapters" }).querySelectorAll("li")).toHaveLength(0);
  });

  it("reads saved nights chronologically with working chapter anchors and safe prose", () => {
    const nights = [
      { id: "later", date: "2026-11-12", title: "The second journey", notes: "A later adventure." },
      { id: "first", date: "2026-11-05", title: "First steps", notes: "We gathered at the inn.\n\n<script>bad()</script>" },
    ];
    const { container } = render(<WarcraftChronicles nights={nights} admin={false} />);
    const chapters = container.querySelectorAll("article");
    expect(chapters[0].id).toBe("chapter-first");
    expect(chapters[1].id).toBe("chapter-later");
    expect(screen.getByText("Begin reading →")).toHaveAttribute("href", "#chapter-first");
    expect(within(chapters[0] as HTMLElement).getByText("Next chapter →")).toHaveAttribute("href", "#chapter-later");
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("<script>bad()</script>")).toBeInTheDocument();
    expect(screen.queryByText("Remove chapter")).not.toBeInTheDocument();
    expect(nights[0].id).toBe("later");
  });
});
