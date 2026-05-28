import type { ReactNode } from "react";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import type { BlockItem, PageItem, PageGridMeta } from "@/lib/pageBlocks";

function isGridChild(item: PageItem): item is BlockItem {
  return item.kind === "block" && (
    item.type === "profile-card" ||
    item.type === "layout-card" ||
    item.type === "card" ||
    item.type === "campaign-card" ||
    item.type === "player-card" ||
    item.type === "creature-card"
  );
}

function gridColStyle(block: BlockItem, columns: number): string {
  return block.col
    ? `${block.col} / span ${block.colSpan ?? 1}`
    : `1 / span ${columns}`;
}

export function PageBlockList({
  items,
  sections = {},
  grid,
}: {
  items: PageItem[];
  sections?: Record<string, ReactNode>;
  grid?: PageGridMeta | null;
}) {
  const useGrid = !!(grid && grid.columns > 1);
  const gapCss = grid?.gap === "sm" ? "0.75rem" : grid?.gap === "lg" ? "1.5rem" : "1.125rem";
  const rendered: ReactNode[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];

    if (item.kind === "section") {
      rendered.push(
        useGrid ? (
          <div key={item.id} style={{ gridColumn: `1 / span ${grid!.columns}` }}>
            <div data-section-id={item.id}>{sections[item.id] ?? null}</div>
          </div>
        ) : (
          <div key={item.id} data-section-id={item.id}>
            {sections[item.id] ?? null}
          </div>
        )
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

      if (useGrid) {
        rendered.push(
          <div key={item.id} style={{ gridColumn: gridColStyle(item as BlockItem, grid!.columns) }}>
            <BlockRenderer block={item}>
              {cards.map((card) => (
                <BlockRenderer key={card.id} block={card} variant="grid-item" />
              ))}
            </BlockRenderer>
          </div>
        );
      } else {
        rendered.push(
          <BlockRenderer key={item.id} block={item}>
            {cards.map((card) => (
              <BlockRenderer key={card.id} block={card} variant="grid-item" />
            ))}
          </BlockRenderer>
        );
      }
      i = cursor - 1;
      continue;
    }

    if (useGrid) {
      rendered.push(
        <div key={item.id} style={{ gridColumn: gridColStyle(item as BlockItem, grid!.columns) }}>
          <BlockRenderer block={item} />
        </div>
      );
    } else {
      rendered.push(<BlockRenderer key={item.id} block={item} />);
    }
  }

  if (useGrid) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${grid!.columns}, minmax(0, 1fr))`,
          gap: gapCss,
          padding: "0 1.5rem",
          maxWidth: "90rem",
          margin: "0 auto",
        }}
      >
        {rendered}
      </div>
    );
  }

  return <>{rendered}</>;
}
