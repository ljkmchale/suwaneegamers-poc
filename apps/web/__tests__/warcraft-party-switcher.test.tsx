import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PartySwitcher } from "@/app/(site)/wow-forever/PartySwitcher";
import type { WarcraftGroup } from "@/lib/wowForever";
const groups: WarcraftGroup[] = [
  { id: "group-a", name: "Group A", partyName: "Azeroth Adventurers", discordUrl: "", members: {}, players: [], nights: [] },
  { id: "group-b", name: "Group B", partyName: "Azeroth Explorers", discordUrl: "", members: {}, players: [], nights: [] },
];
describe("Warcraft party switching", () => {
  it("hides the switch for a single-party member", () => {
    const { container } = render(<PartySwitcher groups={[groups[0]]} selected="group-a" admin={false} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("shows party names and keeps the selected reader for multi-party members", () => {
    render(<PartySwitcher groups={groups} selected="group-b" admin={false} chronicles />);
    expect(screen.queryByText("Group A")).not.toBeInTheDocument();
    expect(screen.queryByText("Group B")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Azeroth Explorers" })).toHaveAttribute("href", "/wow-forever/chronicles?group=group-b");
    expect(screen.getByRole("link", { name: "Azeroth Explorers" })).toHaveAttribute("aria-current", "page");
  });
  it("keeps internal group names for admins", () => {
    render(<PartySwitcher groups={groups} selected="group-a" admin />);
    expect(screen.getByRole("link", { name: "Group A" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Group B" })).toBeInTheDocument();
  });
});
