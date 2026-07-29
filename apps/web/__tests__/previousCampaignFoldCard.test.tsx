import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PreviousCampaignFoldCard } from "@/app/(site)/campaigns/PreviousCampaignFoldCard";
import type { RosterCharacter } from "@/lib/campaignRoster";

const roster: RosterCharacter[] = [
  {
    character: "Fenwick Gearspark",
    player: "Larry McHale",
    species: "Gnome",
    class: "Artificer",
    subclass: "Alchemist",
    level: 6,
  },
  {
    character: "Orel Neutruval",
    player: "Larry McHale",
    species: "Half-Elf",
    class: "Cleric",
    level: 16,
    status: "Deceased",
    deathDate: "4/21/2023",
    notes: "died in Beer & Dice III",
  },
];

const baseProps = {
  id: "imminent-domain",
  name: "Imminent Domain",
  dm: "Chip Poole",
  status: "On Hiatus",
};

describe("PreviousCampaignFoldCard roster", () => {
  it("shows the roster inside the fold with status and death date", () => {
    render(
      <PreviousCampaignFoldCard
        {...baseProps}
        description="A kingdom-building archive."
        roster={roster}
      />
    );

    // Fold is closed by default
    expect(screen.queryByText("The Party")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "View campaign details" }));

    expect(screen.getByText("The Party")).toBeTruthy();
    expect(screen.getByText("Fenwick Gearspark")).toBeTruthy();
    expect(screen.getByText("Larry McHale · Gnome Artificer (Alchemist) · Lv 6")).toBeTruthy();
    expect(screen.getByText("Deceased 4/21/2023")).toBeTruthy();
    expect(screen.getByText("died in Beer & Dice III")).toBeTruthy();
    expect(screen.getByText("A kingdom-building archive.")).toBeTruthy();
  });

  it("offers the fold when there is a roster but no description", () => {
    render(<PreviousCampaignFoldCard {...baseProps} roster={roster} />);

    fireEvent.click(screen.getByRole("button", { name: "View campaign details" }));
    expect(screen.getByText("The Party")).toBeTruthy();
    expect(screen.queryByText("About This Campaign")).toBeNull();
  });

  it("renders no fold toggle without description or roster", () => {
    render(<PreviousCampaignFoldCard {...baseProps} />);
    expect(screen.queryByRole("button", { name: "View campaign details" })).toBeNull();
  });
});
