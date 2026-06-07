import type { ReactNode } from "react";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import type { BlockItem, PageItem, PageGridMeta, CanvasMeta } from "@/lib/pageBlocks";

function isGridChild(item: PageItem): item is BlockItem {
  return item.kind === "block" && (
    item.type === "profile-card" ||
    item.type === "layout-card" ||
    item.type === "card" ||
    item.type === "campaign-card" ||
    item.type === "archived-campaign-card" ||
    item.type === "deity-card" ||
    item.type === "player-card" ||
    item.type === "creature-card"
  );
}

function gridColStyle(block: BlockItem, columns: number): string {
  return block.col
    ? `${block.col} / span ${block.colSpan ?? 1}`
    : `1 / span ${columns}`;
}

function gridRowStyle(block: BlockItem): string | undefined {
  return block.row ? `${block.row} / span ${block.rowSpan ?? 1}` : undefined;
}

// ── Canvas (freeform absolute) rendering ─────────────────────────────────────

function CanvasBlockList({ items, canvas }: { items: PageItem[]; canvas: CanvasMeta }) {
  const blocks = items.filter((i): i is BlockItem => i.kind === "block");

  // Compute canvas height: enough to contain all blocks + breathing room
  const canvasH = Math.max(
    canvas.minHeight ?? 1200,
    ...blocks.map((b) => (b.y ?? 0) + (b.h ?? 200)),
  ) + 120;

  return (
    <div
      data-canvas-area="true"
      style={{
        position: "relative",
        width: "100%",
        height: canvasH,
      }}
    >
      {blocks.map((block) => (
        <div
          key={block.id}
          data-block-id={block.id}
          data-block-type={block.type}
          style={{
            position: "absolute",
            left:   `${block.x ?? 5}%`,
            top:    `${block.y ?? 0}px`,
            width:  `${block.w ?? 50}%`,
            height: block.h != null ? `${block.h}px` : "auto",
            minHeight: 32,
          }}
        >
          <BlockRenderer block={block} />
        </div>
      ))}
    </div>
  );
}

// ── Grid / list rendering ─────────────────────────────────────────────────────

export function PageBlockList({
  items,
  sections = {},
  grid,
  canvas,
}: {
  items: PageItem[];
  sections?: Record<string, ReactNode>;
  grid?: PageGridMeta | null;
  canvas?: CanvasMeta | null;
}) {
  // Canvas mode — freeform absolute positioning
  if (canvas) {
    return <CanvasBlockList items={items} canvas={canvas} />;
  }

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
        const blk = item as BlockItem;
        rendered.push(
          <div key={item.id} style={{ gridColumn: gridColStyle(blk, grid!.columns), gridRow: gridRowStyle(blk) }}>
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
      const blk = item as BlockItem;
      rendered.push(
        <div key={item.id} style={{ gridColumn: gridColStyle(blk, grid!.columns), gridRow: gridRowStyle(blk) }}>
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
          ...(grid!.rows ? { gridTemplateRows: `repeat(${grid!.rows}, minmax(0, auto))` } : {}),
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
