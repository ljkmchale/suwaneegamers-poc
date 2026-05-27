import type { ReactNode } from "react";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import type { BlockItem, PageItem } from "@/lib/pageBlocks";

function isGridChild(item: PageItem): item is BlockItem {
  return item.kind === "block" && (
    item.type === "profile-card" ||
    item.type === "card" ||
    item.type === "campaign-card" ||
    item.type === "player-card" ||
    item.type === "creature-card"
  );
}

export function PageBlockList({
  items,
  sections = {},
}: {
  items: PageItem[];
  sections?: Record<string, ReactNode>;
}) {
  const rendered: ReactNode[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];

    if (item.kind === "section") {
      rendered.push(
        <div key={item.id} data-section-id={item.id}>
          {sections[item.id] ?? null}
        </div>
      );
      continue;
    }

    if (item.type === "card-grid") {
      const cards: BlockItem[] = [];
      let cursor = i + 1;
      while (cursor < items.length && isGridChild(items[cursor])) {
        cards.push(items[cursor] as BlockItem);
        cursor += 1;
      }

      rendered.push(
        <BlockRenderer key={item.id} block={item}>
          {cards.map((card) => (
            <BlockRenderer key={card.id} block={card} variant="grid-item" />
          ))}
        </BlockRenderer>
      );
      i = cursor - 1;
      continue;
    }

    rendered.push(<BlockRenderer key={item.id} block={item} />);
  }

  return <>{rendered}</>;
}
