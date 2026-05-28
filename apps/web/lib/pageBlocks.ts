/**
 * Asset block types, their prop schemas, and field definitions.
 * No fs calls — safe to import in client components.
 */

export type BlockType =
  // ── Generic content blocks ──
  | "divider"
  | "card"
  | "image"
  | "text"
  | "callout"
  | "section-heading"
  | "button-link"
  | "link-list"
  | "gallery"
  | "embed"
  | "spacer"
  | "quote"
  // ── Site-specific layout blocks ──
  | "page-header"
  | "hero-banner"
  | "portal-links"
  | "founders"
  | "calendar-embed"
  // ── Live data blocks (render from content/*.json) ──
  | "campaigns-grid"
  | "players-grid"
  | "dms-grid"
  | "bestiary-grid"
  // ── Single-item live data blocks ──
  | "campaign-card"
  | "player-card"
  | "creature-card"
  // ── Composable profile card & grid ──
  | "profile-card"
  | "layout-card"
  | "card-grid";

// ── Unified page item types ───────────────────────────────────────────────────

export interface PageGridMeta {
  columns: number;        // 1–6
  gap: "sm" | "md" | "lg";
}

export interface SectionItem {
  kind: "section";
  id: string;
}

export interface BlockItem {
  kind: "block";
  id: string;
  type: BlockType;
  props: Record<string, unknown>;
  col?: number;           // page-level grid column start (1-based)
  colSpan?: number;       // page-level grid column span
}

export type PageItem = SectionItem | BlockItem;

// ── Profile card inner elements ───────────────────────────────────────────────

export type ProfileCardItemType =
  | "portrait"
  | "image"
  | "heading"
  | "eyebrow"
  | "description"
  | "stat"
  | "character-count"
  | "badge"
  | "link"
  | "divider"
  | "item-list"
  | "character-list"
  | "next-session"
  | "campaign-info";

export interface ProfileCardItem {
  id: string;
  type: ProfileCardItemType;
  props: Record<string, unknown>;
}

export interface ProfileCardItemField {
  key: string;
  label: string;
  type: "text" | "textarea" | "url" | "image" | "select" | "characters" | "entries";
  options?: { value: string; label: string }[];
}

export interface ProfileCardItemDef {
  type: ProfileCardItemType;
  label: string;
  icon: string;
  fields: ProfileCardItemField[];
}

export type CardLayoutItemType =
  | "grid"
  | "header"
  | "text"
  | "inner-card"
  | "image"
  | "divider";

export interface CardLayoutItem {
  id: string;
  type: CardLayoutItemType;
  props: Record<string, unknown>;
}

export interface CardLayoutItemField {
  key: string;
  label: string;
  type: "text" | "textarea" | "image" | "select" | "card-layout-items";
  options?: { value: string; label: string }[];
  hint?: string;
}

export interface CardLayoutItemDef {
  type: CardLayoutItemType;
  label: string;
  icon: string;
  fields: CardLayoutItemField[];
}

export const PROFILE_CARD_ITEM_TYPES: ProfileCardItemDef[] = [
  {
    type: "portrait",
    label: "Portrait",
    icon: "🖼",
    fields: [
      { key: "src",  label: "Image",                        type: "image" },
      { key: "name", label: "Fallback name (for initials)", type: "text" },
      {
        key: "position", label: "Position", type: "select",
        options: [
          { value: "fixed", label: "Use card portrait zone" },
          { value: "inline", label: "Inline with card elements" },
        ],
      },
    ],
  },
  {
    type: "image",
    label: "Image",
    icon: "▧",
    fields: [
      { key: "src", label: "Image", type: "image" },
      { key: "alt", label: "Alt text", type: "text" },
      {
        key: "shape", label: "Shape", type: "select",
        options: [
          { value: "wide",     label: "Wide (16:9)" },
          { value: "square",   label: "Square (1:1)" },
          { value: "contain",  label: "Contain (16:9, object-contain)" },
          { value: "creature", label: "Creature (4:3, object-contain)" },
        ],
      },
    ],
  },
  {
    type: "heading",
    label: "Heading",
    icon: "H",
    fields: [
      { key: "value", label: "Text", type: "text" },
      {
        key: "size", label: "Size", type: "select",
        options: [
          { value: "",       label: "Normal (xl)" },
          { value: "large",  label: "Large (2xl)" },
        ],
      },
    ],
  },
  {
    type: "eyebrow",
    label: "Eyebrow",
    icon: "¶",
    fields: [
      { key: "value", label: "Text", type: "text" },
      {
        key: "variant", label: "Style", type: "select",
        options: [
          { value: "",         label: "Label (uppercase, arcane)" },
          { value: "subtitle", label: "Subtitle (gold text, plain)" },
        ],
      },
    ],
  },
  {
    type: "description",
    label: "Description",
    icon: "≡",
    fields: [{ key: "value", label: "Text", type: "textarea" }],
  },
  {
    type: "stat",
    label: "Stat",
    icon: "#",
    fields: [
      { key: "label", label: "Label", type: "text" },
      { key: "value", label: "Value", type: "text" },
    ],
  },
  {
    type: "character-count",
    label: "Character Count",
    icon: "#",
    fields: [],
  },
  {
    type: "badge",
    label: "Badge",
    icon: "◉",
    fields: [
      { key: "value", label: "Text", type: "text" },
      {
        key: "color", label: "Color", type: "select",
        options: [
          { value: "arcane", label: "Arcane (purple)" },
          { value: "gold",   label: "Gold" },
          { value: "muted",  label: "Muted (gray)" },
        ],
      },
    ],
  },
  {
    type: "link",
    label: "Link",
    icon: "↗",
    fields: [
      { key: "href",  label: "URL",   type: "url" },
      { key: "label", label: "Label", type: "text" },
    ],
  },
  {
    type: "divider",
    label: "Divider",
    icon: "—",
    fields: [],
  },
  {
    type: "item-list",
    label: "Item List",
    icon: "☰",
    fields: [
      { key: "title", label: "List title", type: "text" },
      { key: "entries", label: "Entries", type: "entries" },
    ],
  },
  {
    type: "character-list",
    label: "Character List",
    icon: "⚔",
    fields: [
      { key: "characters", label: "Characters", type: "characters" },
    ],
  },
  {
    type: "next-session",
    label: "Next Session Date",
    icon: "📅",
    fields: [
      { key: "campaignName", label: "Campaign name (for calendar match)", type: "text" },
    ],
  },
  {
    type: "campaign-info",
    label: "Campaign Info",
    icon: "⚔",
    fields: [
      { key: "schedule",     label: "Schedule / cadence",                  type: "text" },
      { key: "dm",           label: "Dungeon Master",                       type: "text" },
      { key: "campaignName", label: "Campaign name (for live date lookup)", type: "text" },
    ],
  },
];

const GRID_PLACEMENT_FIELDS: CardLayoutItemField[] = [
  { key: "col", label: "Column start", type: "text", hint: "1 to 6" },
  { key: "row", label: "Row start", type: "text", hint: "1 to 10" },
  { key: "colSpan", label: "Column span", type: "text", hint: "1 to 6" },
  { key: "rowSpan", label: "Row span", type: "text", hint: "1 to 10" },
];

export const CARD_LAYOUT_ITEM_TYPES: CardLayoutItemDef[] = [
  {
    type: "grid",
    label: "Card Grid",
    icon: "#",
    fields: [
      { key: "columns", label: "Columns", type: "text", hint: "Up to 6 columns" },
      { key: "rows", label: "Rows", type: "text", hint: "Up to 10 rows" },
      {
        key: "gap", label: "Gap", type: "select",
        options: [
          { value: "sm", label: "Small" },
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" },
        ],
      },
      { key: "items", label: "Grid contents", type: "card-layout-items" },
      ...GRID_PLACEMENT_FIELDS,
    ],
  },
  {
    type: "header",
    label: "Header",
    icon: "H",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "size", label: "Size", type: "select",
        options: [
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" },
        ],
      },
      ...GRID_PLACEMENT_FIELDS,
    ],
  },
  {
    type: "text",
    label: "Text",
    icon: "T",
    fields: [
      { key: "content", label: "Text", type: "textarea" },
      ...GRID_PLACEMENT_FIELDS,
    ],
  },
  {
    type: "inner-card",
    label: "Inner Card",
    icon: "[]",
    fields: [
      { key: "items", label: "Inner contents", type: "card-layout-items" },
      ...GRID_PLACEMENT_FIELDS,
    ],
  },
  {
    type: "image",
    label: "Image",
    icon: "I",
    fields: [
      { key: "src", label: "Image", type: "image" },
      { key: "alt", label: "Alt text", type: "text" },
      {
        key: "fit", label: "Fit", type: "select",
        options: [
          { value: "cover", label: "Cover" },
          { value: "contain", label: "Contain" },
        ],
      },
      ...GRID_PLACEMENT_FIELDS,
    ],
  },
  {
    type: "divider",
    label: "Divider",
    icon: "--",
    fields: GRID_PLACEMENT_FIELDS,
  },
];

// ── Asset field definitions ───────────────────────────────────────────────────

export interface AssetField {
  key: string;
  label: string;
  type: "text" | "textarea" | "url" | "image" | "select" | "json" | "items" | "card-layout-items";
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
}

export interface AssetTypeDef {
  type: BlockType;
  label: string;
  description: string;
  icon: string;
  category: "content" | "layout" | "data";
  defaultProps: Record<string, unknown>;
  fields: AssetField[];
}

// ── Asset type registry ───────────────────────────────────────────────────────

export const ASSET_TYPES: AssetTypeDef[] = [

  // ── Generic content ──────────────────────────────────────────────────────────

  {
    type: "page-header",
    label: "Page Header",
    description: "Centred eyebrow + title + description — the standard page intro",
    icon: "Ħ",
    category: "layout",
    defaultProps: { eyebrow: "", title: "Page Title", description: "", align: "center" },
    fields: [
      { key: "eyebrow",     label: "Eyebrow (small text above title)", type: "text",   placeholder: "e.g. Table Roster" },
      { key: "title",       label: "Title",                            type: "text",   placeholder: "Page Title" },
      { key: "description", label: "Description",                      type: "textarea", placeholder: "One or two sentences." },
      {
        key: "align", label: "Alignment", type: "select",
        options: [{ value: "center", label: "Center" }, { value: "left", label: "Left" }],
      },
    ],
  },

  {
    type: "hero-banner",
    label: "Hero Banner",
    description: "Full-screen animated hero (title, tagline, CTA buttons) — same as the home page",
    icon: "⬛",
    category: "layout",
    defaultProps: {},
    fields: [],
  },

  {
    type: "portal-links",
    label: "Portal Links Grid",
    description: "A 1–4 col grid of link cards with title, description, and a button — same pattern as the Myrdae lore pages",
    icon: "⊞",
    category: "layout",
    defaultProps: {
      eyebrow: "",
      title: "",
      description: "",
      links: JSON.stringify([
        { title: "Link Title", description: "Short description of what this links to.", href: "https://example.com", label: "Open" },
      ], null, 2),
    },
    fields: [
      { key: "eyebrow",     label: "Eyebrow",            type: "text",   placeholder: "e.g. Knowledge Base" },
      { key: "title",       label: "Section title",      type: "text",   placeholder: "Optional heading above the grid" },
      { key: "description", label: "Section description", type: "textarea", placeholder: "Optional description above the grid" },
      {
        key: "links",
        label: "Links (JSON array)",
        type: "json",
        hint: 'Each item: { "title": "", "description": "", "href": "", "label": "" }',
        placeholder: '[{"title":"...","description":"...","href":"https://...","label":"Open"}]',
      },
    ],
  },

  {
    type: "founders",
    label: "Founders",
    description: "Founder profile cards with portraits, names, roles, and an optional bio blurb",
    icon: "👑",
    category: "layout",
    defaultProps: {
      heading: "Founded By",
      bio: "",
      founders: JSON.stringify([
        { name: "Founder Name", role: "Co-Founder", img: "/images/placeholder.png" },
      ], null, 2),
    },
    fields: [
      { key: "heading",  label: "Section heading",  type: "text",     placeholder: "e.g. Founded By" },
      { key: "bio",      label: "Bio blurb (optional)", type: "textarea", placeholder: "A short story about the founders." },
      {
        key: "founders",
        label: "Founders (JSON array)",
        type: "json",
        hint: 'Each item: { "name": "", "role": "", "img": "/images/..." }',
        placeholder: '[{"name":"...","role":"...","img":"/images/..."}]',
      },
    ],
  },

  {
    type: "divider",
    label: "Divider",
    description: "Decorative horizontal separator",
    icon: "—",
    category: "content",
    defaultProps: { variant: "ornate", label: "" },
    fields: [
      { key: "label", label: "Label (optional)", type: "text", placeholder: "e.g. More Info" },
      {
        key: "variant", label: "Style", type: "select",
        options: [
          { value: "ornate", label: "Ornate  (✦ centred rule)" },
          { value: "simple", label: "Simple  (plain line)" },
        ],
      },
    ],
  },

  {
    type: "card",
    label: "Card",
    description: "Fantasy-styled content card with title and optional link",
    icon: "▭",
    category: "content",
    defaultProps: { eyebrow: "", title: "New Card", description: "", href: "", linkLabel: "" },
    fields: [
      { key: "eyebrow",     label: "Eyebrow (optional)", type: "text",     placeholder: "e.g. Featured" },
      { key: "title",       label: "Title",              type: "text",     placeholder: "Card title" },
      { key: "description", label: "Description",        type: "textarea", placeholder: "Card body text" },
      { key: "href",        label: "Link URL (optional)", type: "url",     placeholder: "https://…  or  /internal" },
      { key: "linkLabel",   label: "Link label",          type: "text",    placeholder: "e.g. Learn more" },
    ],
  },

  {
    type: "image",
    label: "Image",
    description: "Standalone image block with optional caption",
    icon: "⬜",
    category: "content",
    defaultProps: { src: "", alt: "", caption: "", size: "large" },
    fields: [
      { key: "src",     label: "Image",              type: "image", placeholder: "/images/my-image.webp" },
      { key: "alt",     label: "Alt text",           type: "text", placeholder: "Describe the image" },
      { key: "caption", label: "Caption (optional)", type: "text", placeholder: "Image caption" },
      {
        key: "size", label: "Size", type: "select",
        options: [
          { value: "full",   label: "Full width" },
          { value: "large",  label: "Large (centred)" },
          { value: "medium", label: "Medium (centred)" },
        ],
      },
    ],
  },

  {
    type: "section-heading",
    label: "Section Heading",
    description: "Eyebrow, heading, and intro copy for a page section",
    icon: "H",
    category: "content",
    defaultProps: { eyebrow: "", title: "Section Title", description: "", align: "left" },
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      {
        key: "align", label: "Alignment", type: "select",
        options: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }],
      },
    ],
  },

  {
    type: "button-link",
    label: "Button Link",
    description: "One prominent call-to-action button",
    icon: "↗",
    category: "content",
    defaultProps: { label: "Open Link", href: "", align: "left", variant: "primary" },
    fields: [
      { key: "label", label: "Button label", type: "text" },
      { key: "href", label: "URL", type: "url" },
      {
        key: "align", label: "Alignment", type: "select",
        options: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }],
      },
      {
        key: "variant", label: "Style", type: "select",
        options: [{ value: "primary", label: "Primary" }, { value: "secondary", label: "Secondary" }],
      },
    ],
  },

  {
    type: "link-list",
    label: "Link List",
    description: "A compact list of editable links",
    icon: "☰",
    category: "content",
    defaultProps: {
      title: "",
      links: JSON.stringify([{ label: "Link label", href: "https://example.com", description: "" }], null, 2),
    },
    fields: [
      { key: "title", label: "Title", type: "text" },
      {
        key: "links",
        label: "Links (JSON array)",
        type: "json",
        hint: 'Each item: { "label": "", "href": "", "description": "" }',
      },
    ],
  },

  {
    type: "gallery",
    label: "Gallery",
    description: "A responsive image gallery",
    icon: "▦",
    category: "content",
    defaultProps: {
      columns: "3",
      images: JSON.stringify([{ src: "/images/placeholder.png", alt: "", caption: "" }], null, 2),
    },
    fields: [
      {
        key: "columns", label: "Desktop columns", type: "select",
        options: [{ value: "2", label: "2 columns" }, { value: "3", label: "3 columns" }, { value: "4", label: "4 columns" }],
      },
      {
        key: "images",
        label: "Images (JSON array)",
        type: "json",
        hint: 'Each item: { "src": "/images/...", "alt": "", "caption": "" }',
      },
    ],
  },

  {
    type: "embed",
    label: "Embed",
    description: "Embed an iframe by URL",
    icon: "<>",
    category: "content",
    defaultProps: { src: "", title: "Embedded content", height: "520" },
    fields: [
      { key: "src", label: "Embed URL", type: "url" },
      { key: "title", label: "Title", type: "text" },
      { key: "height", label: "Height in pixels", type: "text" },
    ],
  },

  {
    type: "text",
    label: "Text Block",
    description: "A styled paragraph of body text",
    icon: "¶",
    category: "content",
    defaultProps: { content: "Enter your text here.", align: "left" },
    fields: [
      { key: "content", label: "Content", type: "textarea", placeholder: "Your text…" },
      {
        key: "align", label: "Alignment", type: "select",
        options: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }],
      },
    ],
  },

  {
    type: "callout",
    label: "Callout",
    description: "Highlighted announcement or note with accent colour",
    icon: "◈",
    category: "content",
    defaultProps: { title: "", content: "Add your callout message here.", variant: "gold" },
    fields: [
      { key: "title",   label: "Title (optional)", type: "text",     placeholder: "Callout heading" },
      { key: "content", label: "Content",          type: "textarea", placeholder: "Your message…" },
      {
        key: "variant", label: "Accent colour", type: "select",
        options: [
          { value: "gold",   label: "Gold" },
          { value: "arcane", label: "Arcane (purple)" },
          { value: "blood",  label: "Blood (red)" },
        ],
      },
    ],
  },

  {
    type: "spacer",
    label: "Spacer",
    description: "Vertical whitespace between sections",
    icon: "↕",
    category: "content",
    defaultProps: { size: "md" },
    fields: [
      {
        key: "size", label: "Size", type: "select",
        options: [
          { value: "sm", label: "Small  (32px)" },
          { value: "md", label: "Medium (64px)" },
          { value: "lg", label: "Large  (96px)" },
        ],
      },
    ],
  },

  {
    type: "quote",
    label: "Quote",
    description: "Pull-quote or flavor text — styled citation with optional attribution and accent colour",
    icon: "❝",
    category: "content",
    defaultProps: { text: "", attribution: "", variant: "gold" },
    fields: [
      { key: "text",          label: "Quote text",              type: "textarea", placeholder: "The words of the ancient scroll…" },
      { key: "attribution",   label: "Attribution (optional)",  type: "text",     placeholder: "— Source or character name" },
      {
        key: "variant", label: "Accent colour", type: "select",
        options: [
          { value: "gold",   label: "Gold" },
          { value: "arcane", label: "Arcane (purple)" },
          { value: "muted",  label: "Muted (dim)" },
        ],
      },
    ],
  },

  // ── Live data blocks ──────────────────────────────────────────────────────────

  {
    type: "profile-card",
    label: "Profile Card",
    description: "Composable profile card — add portrait, heading, text, badges, links, and more",
    icon: "🪪",
    category: "content",
    defaultProps: {
      layout: "side",
      items: JSON.stringify([
        { id: "heading_1", type: "heading",     props: { value: "Name" } },
        { id: "desc_1",    type: "description", props: { value: "Description" } },
      ]),
    },
    fields: [
      {
        key: "layout", label: "Portrait position", type: "select",
        options: [
          { value: "side",   label: "Side panel (left column)" },
          { value: "top",    label: "Top banner (full width)" },
          { value: "none",   label: "No portrait zone" },
        ],
      },
      { key: "items", label: "Card elements", type: "items", hint: "Add and reorder portrait, heading, text, badge, link, and more." },
    ],
  },

  {
    type: "layout-card",
    label: "Card Layout",
    description: "Composable card with an internal grid, nested grids, headers, text, images, inner cards, and dividers",
    icon: "[]",
    category: "content",
    defaultProps: {
      width: "wide",
      items: JSON.stringify([
        {
          id: "grid_root",
          type: "grid",
          props: {
            columns: "3",
            rows: "2",
            gap: "md",
            items: JSON.stringify([
              { id: "header_1", type: "header", props: { title: "Card Layout", eyebrow: "Test Asset", col: "1", row: "1", colSpan: "3", rowSpan: "1", size: "lg" } },
              { id: "text_1", type: "text", props: { content: "Use the grid controls to arrange card internals up to 6 columns by 10 rows.", col: "1", row: "2", colSpan: "2", rowSpan: "1" } },
              { id: "inner_1", type: "inner-card", props: { col: "3", row: "2", colSpan: "1", rowSpan: "1", items: JSON.stringify([{ id: "inner_text_1", type: "text", props: { content: "Inner card" } }]) } },
            ]),
          },
        },
      ]),
    },
    fields: [
      {
        key: "width", label: "Card width", type: "select",
        options: [
          { value: "wide", label: "Wide" },
          { value: "medium", label: "Medium" },
          { value: "full", label: "Full" },
        ],
      },
      { key: "items", label: "Card layout elements", type: "card-layout-items", hint: "Add grids, nested grids, headers, text, inner cards, images, and dividers." },
    ],
  },

  {
    type: "card-grid",
    label: "Card Grid",
    description: "Groups the following profile cards into a responsive card grid",
    icon: "▦",
    category: "layout",
    defaultProps: {
      columns: "2",
      gap: "md",
    },
    fields: [
      {
        key: "columns", label: "Desktop columns", type: "select",
        options: [
          { value: "2", label: "2 columns" },
          { value: "3", label: "3 columns" },
        ],
      },
      {
        key: "gap", label: "Card spacing", type: "select",
        options: [
          { value: "sm", label: "Small" },
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" },
        ],
      },
    ],
  },

  {
    type: "campaigns-grid",
    label: "Campaigns Grid",
    description: "Live grid of all active campaigns (reads from campaigns.json)",
    icon: "⚔",
    category: "data",
    defaultProps: {},
    fields: [],
  },

  {
    type: "players-grid",
    label: "Players Grid",
    description: "Live grid of all player profiles (reads from players.json)",
    icon: "👤",
    category: "data",
    defaultProps: {},
    fields: [],
  },

  {
    type: "dms-grid",
    label: "Dungeon Masters Grid",
    description: "Live grid of all DM profiles (reads from dungeon-masters.json)",
    icon: "🎲",
    category: "data",
    defaultProps: {},
    fields: [],
  },

  {
    type: "bestiary-grid",
    label: "Bestiary Grid",
    description: "Live grid of all creature cards (reads from bestiary.json)",
    icon: "🐉",
    category: "data",
    defaultProps: {},
    fields: [],
  },

  {
    type: "campaign-card",
    label: "Campaign Card",
    description: "Single campaign card pulled live from campaigns.json — place inside a Card Grid",
    icon: "⚔",
    category: "data",
    defaultProps: { id: "" },
    fields: [
      { key: "id", label: "Campaign ID", type: "text", hint: "e.g. a-new-adventure" },
    ],
  },

  {
    type: "player-card",
    label: "Player Card",
    description: "Single player profile card pulled live from players.json — place inside a Card Grid",
    icon: "👤",
    category: "data",
    defaultProps: { id: "" },
    fields: [
      { key: "id", label: "Player ID", type: "text", hint: "e.g. sean-poole" },
    ],
  },

  {
    type: "creature-card",
    label: "Creature Card",
    description: "Single creature card pulled live from bestiary.json — place inside a Card Grid",
    icon: "🐉",
    category: "data",
    defaultProps: { name: "" },
    fields: [
      { key: "name", label: "Creature name", type: "text", hint: "e.g. Bulas" },
    ],
  },

  {
    type: "calendar-embed",
    label: "Calendar Embed",
    description: "Embedded Google Calendar iframe",
    icon: "📅",
    category: "data",
    defaultProps: {},
    fields: [],
  },
];

export function getAssetDef(type: BlockType): AssetTypeDef | undefined {
  return ASSET_TYPES.find((a) => a.type === type);
}
