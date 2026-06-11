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
  | "fold-header"
  | "timeline"
  | "button-link"
  | "link-list"
  | "gallery"
  | "embed"
  | "media-player"
  | "spacer"
  | "quote"
  | "table"
  | "campaign-hero"
  | "campaign-meta"
  | "campaign-links"
  | "campaign-notes"
  | "campaign-roster"
  | "campaign-sessions"
  // ── Site-specific layout blocks ──
  | "page-header"
  | "page-banner"
  | "portal-links"
  | "calendar-embed"
  // ── Live data blocks (render from content/*.json) ──
  | "campaigns-grid"
  | "players-grid"
  | "dms-grid"
  | "bestiary-grid"
  | "organizations-list"
  | "territories-list"
  // ── Single-item live data blocks ──
  | "campaign-card"
  | "archived-campaign-card"
  | "deity-card"
  | "player-card"
  | "creature-card"
  // ── Composable profile card & grid ──
  | "profile-card"
  | "layout-card"
  | "card-grid"
  | "grid-section";

// ── Unified page item types ───────────────────────────────────────────────────

export interface PageGridMeta {
  columns: number;        // 1–6
  rows?: number;          // explicit row count; if unset, grid auto-flows
  gap: "sm" | "md" | "lg";
}

/** Freeform absolute-position canvas. x/w are % of container width; y/h are px. */
export interface CanvasMeta {
  minHeight?: number;     // px minimum canvas height (default 1200)
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
  // Grid placement (grid mode)
  col?: number;           // page-level grid column start (1-based)
  colSpan?: number;       // page-level grid column span
  row?: number;           // page-level grid row start (1-based)
  rowSpan?: number;       // page-level grid row span
  // Canvas placement (canvas mode) — x/w as % of container, y/h as px
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export type PageItem = SectionItem | BlockItem;

export interface GridSectionChild {
  id: string;
  type: BlockType;
  props: Record<string, unknown>;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

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
  | "link"
  | "audio-link"
  | "media-player"
  | "inner-card"
  | "image"
  | "divider"
  | "person";

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
      {
        key: "cropPosition", label: "Image crop position", type: "select",
        options: [
          { value: "center", label: "Center" },
          { value: "center top", label: "Top center" },
          { value: "center bottom", label: "Bottom center" },
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
  { key: "row", label: "Row start", type: "text", hint: "1 to 40" },
  { key: "colSpan", label: "Column span", type: "text", hint: "1 to 6" },
  { key: "rowSpan", label: "Row span", type: "text", hint: "1 to 40" },
];

export const CARD_LAYOUT_ITEM_TYPES: CardLayoutItemDef[] = [
  {
    type: "grid",
    label: "Card Grid",
    icon: "#",
    fields: [
      { key: "columns", label: "Columns", type: "text", hint: "Up to 6 columns" },
      { key: "rows", label: "Rows", type: "text", hint: "Up to 40 rows" },
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
        key: "color", label: "Title color", type: "select",
        options: [
          { value: "primary", label: "Primary" },
          { value: "gold", label: "Gold" },
        ],
      },
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
    type: "link",
    label: "Link Pill",
    icon: "->",
    fields: [
      { key: "label", label: "Label", type: "text" },
      { key: "href", label: "URL", type: "text" },
      {
        key: "variant", label: "Style", type: "select",
        options: [
          { value: "primary", label: "Primary" },
          { value: "secondary", label: "Secondary" },
        ],
      },
      ...GRID_PLACEMENT_FIELDS,
    ],
  },
  {
    type: "audio-link",
    label: "Recording Link",
    icon: "ear",
    fields: [
      { key: "label", label: "Label", type: "text" },
      { key: "href", label: "Recording URL", type: "text" },
      ...GRID_PLACEMENT_FIELDS,
    ],
  },
  {
    type: "media-player",
    label: "Media Player",
    icon: ">",
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "src", label: "YouTube, audio, video, or Drive URL", type: "text" },
      {
        key: "mediaType", label: "Player type", type: "select",
        options: [
          { value: "auto", label: "Detect automatically" },
          { value: "youtube", label: "YouTube video" },
          { value: "audio", label: "Audio file" },
          { value: "video", label: "Uploaded video" },
        ],
      },
      {
        key: "displayMode", label: "Display", type: "select",
        options: [
          { value: "full", label: "Full player" },
          { value: "image-button", label: "Image button" },
        ],
      },
      { key: "image", label: "Button image", type: "image" },
      { key: "caption", label: "Caption", type: "textarea" },
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
  {
    type: "person",
    label: "Person",
    icon: "◉",
    fields: [
      { key: "name", label: "Name",        type: "text" },
      { key: "role", label: "Role / Title", type: "text" },
      { key: "href", label: "Link URL",     type: "text" },
      { key: "img",  label: "Portrait",     type: "image" },
      {
        key: "variant", label: "Style", type: "select",
        options: [
          { value: "portrait", label: "Portrait" },
          { value: "tile", label: "Campaign roster tile" },
        ],
      },
      ...GRID_PLACEMENT_FIELDS,
    ],
  },
];

// ── Asset field definitions ───────────────────────────────────────────────────

export interface AssetField {
  key: string;
  label: string;
  type: "text" | "textarea" | "url" | "image" | "select" | "json" | "items" | "card-layout-items" | "grid-section-items";
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
}

export interface AssetTypeDef {
  type: BlockType;
  label: string;
  description: string;
  icon: string;
  category: "content" | "layout";
  retired?: boolean;
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
    type: "page-banner",
    label: "Page Banner",
    description: "Full-screen animated hero (title, tagline, CTA buttons) — same as the home page",
    icon: "⬛",
    category: "layout",
    defaultProps: {},
    fields: [],
  },

  {
    type: "organizations-list",
    label: "Organizations List",
    description: "Data-driven organization and faction folds",
    icon: "O",
    category: "layout",
    defaultProps: { helperText: "Click an organization below to expand its details." },
    fields: [
      { key: "helperText", label: "Helper text", type: "text" },
    ],
  },

  {
    type: "territories-list",
    label: "Territories List",
    description: "Data-driven territory folds grouped by region",
    icon: "T",
    category: "layout",
    defaultProps: { helperText: "Click a region below to expand its territories." },
    fields: [
      { key: "helperText", label: "Helper text", type: "text" },
    ],
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
      { key: "eyebrow",     label: "Eyebrow",            type: "text",   placeholder: "e.g. Chronicles" },
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
    defaultProps: { eyebrow: "", title: "New Card", description: "", href: "", linkLabel: "", image: "", imageAlt: "" },
    fields: [
      { key: "eyebrow",     label: "Eyebrow (optional)", type: "text",     placeholder: "e.g. Featured" },
      { key: "title",       label: "Title",              type: "text",     placeholder: "Card title" },
      { key: "description", label: "Description",        type: "textarea", placeholder: "Card body text" },
      { key: "href",        label: "Link URL (optional)", type: "url",     placeholder: "https://…  or  /internal" },
      { key: "linkLabel",   label: "Link label",          type: "text",    placeholder: "e.g. Learn more" },
      { key: "image",       label: "Artwork (optional)",   type: "image",   placeholder: "/images/..." },
      { key: "imageAlt",    label: "Artwork alt text",     type: "text",    placeholder: "Describe the artwork" },
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
        options: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }],
      },
    ],
  },

  {
    type: "fold-header",
    label: "Fold Header",
    description: "Expandable header with optional text and image inside the fold",
    icon: "V",
    category: "content",
    defaultProps: {
      eyebrow: "",
      title: "Expandable Header",
      description: "",
      headerImage: "",
      headerImageAlt: "",
      foldLabel: "View details",
      foldText: "Add text inside the fold, choose an image, or use both.",
      foldImage: "",
      foldImageAlt: "",
      foldImageFit: "cover",
      defaultState: "closed",
    },
    fields: [
      { key: "eyebrow",      label: "Eyebrow (optional)",              type: "text",     placeholder: "e.g. Additional Lore" },
      { key: "title",        label: "Header title",                    type: "text",     placeholder: "Expandable Header" },
      { key: "description",  label: "Intro text (optional)",           type: "textarea", placeholder: "Visible while the fold is closed." },
      { key: "headerImage",  label: "Header image (left, optional)",   type: "image",    placeholder: "/images/example.webp" },
      { key: "headerImageAlt", label: "Header image alt text",         type: "text",     placeholder: "Describe the image" },
      { key: "foldLabel",    label: "Fold button label",               type: "text",     placeholder: "View details" },
      { key: "foldText",     label: "Text inside fold (optional)",     type: "textarea", placeholder: "Text shown after expanding the header." },
      { key: "foldImage",    label: "Image inside fold (optional)",    type: "image",    placeholder: "/images/example.webp" },
      { key: "foldImageAlt", label: "Fold image alt text",             type: "text",     placeholder: "Describe the image" },
      {
        key: "foldImageFit", label: "Fold image fit", type: "select",
        options: [{ value: "cover", label: "Cover" }, { value: "contain", label: "Contain" }],
      },
      {
        key: "defaultState", label: "Default fold state", type: "select",
        options: [{ value: "closed", label: "Closed" }, { value: "open", label: "Open" }],
      },
    ],
  },

  {
    type: "table",
    label: "Table",
    description: "Styled data table with a header row, like doc rank and renown tables",
    icon: "#",
    category: "content",
    defaultProps: {
      eyebrow: "",
      title: "",
      headers: "Rank | Renown | Title",
      rows: "1 | 0 - 1 | Avantee\n2 | 2 - 9 | Venture\n3 | 10 - 24 | Seeker\n4 | 25+ | Savant",
    },
    fields: [
      { key: "eyebrow", label: "Eyebrow (optional)", type: "text",     placeholder: "e.g. Structure & Membership" },
      { key: "title",   label: "Title (optional)",   type: "text",     placeholder: "Ranks" },
      { key: "headers", label: "Column headers",     type: "text",     placeholder: "Rank | Renown | Title" },
      { key: "rows",    label: "Rows (one per line, cells separated by |)", type: "textarea", placeholder: "1 | 0 - 1 | Avantee" },
    ],
  },

  {
    type: "timeline",
    label: "Timeline",
    description: "Collapsible historical timeline with vertical or horizontal layout",
    icon: "|-",
    category: "content",
    defaultProps: {
      eyebrow: "Era",
      title: "Timeline Era",
      description: "",
      orientation: "vertical",
      entries: JSON.stringify([
        { date: "1246", title: "Year of Discovery", description: "Short summary of the year.", events: ["Notable event"] },
      ], null, 2),
    },
    fields: [
      { key: "eyebrow", label: "Eyebrow (optional)", type: "text", placeholder: "e.g. Era" },
      { key: "title", label: "Timeline title", type: "text", placeholder: "Era title" },
      { key: "description", label: "Intro text (optional)", type: "textarea", placeholder: "Visible before the timeline entries." },
      {
        key: "orientation", label: "Timeline orientation", type: "select",
        options: [{ value: "vertical", label: "Vertical" }, { value: "horizontal", label: "Horizontal" }],
      },
      {
        key: "entries",
        label: "Timeline nodes",
        type: "json",
        hint: "Add, remove, and reorder the visible points on the timeline.",
      },
    ],
  },

  {
    type: "button-link",
    label: "Button Link",
    description: "One prominent call-to-action button",
    icon: "↗",
    category: "content",
    defaultProps: { label: "Open Link", href: "", align: "left", variant: "primary", arrow: "auto" },
    fields: [
      { key: "label", label: "Button label", type: "text" },
      { key: "href", label: "URL", type: "url" },
      {
        key: "align", label: "Alignment", type: "select",
        options: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }],
      },
      {
        key: "variant", label: "Style", type: "select",
        options: [
          { value: "primary", label: "Primary" },
          { value: "secondary", label: "Secondary" },
          { value: "text", label: "Text link" },
        ],
      },
      {
        key: "arrow", label: "Arrow", type: "select",
        options: [
          { value: "auto", label: "Auto" },
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
          { value: "none", label: "None" },
        ],
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
    defaultProps: { title: "", content: "Add your callout message here.", variant: "gold", href: "", image: "" },
    fields: [
      { key: "title",   label: "Title (optional)", type: "text",     placeholder: "Callout heading" },
      { key: "href",    label: "Title link (optional)", type: "text", placeholder: "/path or https://..." },
      { key: "image",   label: "Image (optional)", type: "image",    placeholder: "/images/pantheon/deity.webp" },
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
    type: "campaign-hero",
    label: "Campaign Hero",
    description: "Campaign detail hero with editable title, eyebrow, and header image",
    icon: "H",
    category: "content",
    defaultProps: { eyebrow: "Campaign", title: "Campaign Name", image: "", imagePosition: "center" },
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "image", label: "Header image", type: "image" },
      { key: "imagePosition", label: "Image position", type: "text", placeholder: "center or center top" },
    ],
  },

  {
    type: "campaign-meta",
    label: "Campaign Meta",
    description: "Campaign schedule, Dungeon Master, and live next-session date",
    icon: "i",
    category: "content",
    defaultProps: { schedule: "", dm: "", campaignName: "" },
    fields: [
      { key: "schedule", label: "Schedule", type: "text" },
      { key: "dm", label: "Dungeon Master", type: "text" },
      { key: "campaignName", label: "Campaign name for calendar lookup", type: "text" },
    ],
  },

  {
    type: "campaign-links",
    label: "Campaign Links",
    description: "Editable resource buttons for a campaign detail page",
    icon: "L",
    category: "content",
    retired: true,
    defaultProps: {
      links: JSON.stringify([{ label: "Resource", url: "https://example.com" }], null, 2),
    },
    fields: [
      { key: "links", label: "Links", type: "json", hint: 'Each item: { "label": "", "url": "" }' },
    ],
  },

  {
    type: "campaign-notes",
    label: "Campaign Notes",
    description: "Editable notes card for a campaign detail page",
    icon: "N",
    category: "content",
    retired: true,
    defaultProps: { title: "Notes", content: "" },
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "content", label: "Content", type: "textarea" },
    ],
  },

  {
    type: "campaign-roster",
    label: "Campaign Roster",
    description: "Editable character roster with optional player names and links",
    icon: "R",
    category: "content",
    retired: true,
    defaultProps: {
      title: "Roster",
      members: JSON.stringify([{ name: "Character", player: "", url: "" }], null, 2),
    },
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "members", label: "Roster members", type: "json", hint: 'Each item: { "name": "", "player": "", "url": "" }' },
    ],
  },

  {
    type: "campaign-sessions",
    label: "Campaign Sessions",
    description: "Editable campaign session summaries with optional audio links",
    icon: "S",
    category: "content",
    retired: true,
    defaultProps: {
      title: "Session Summaries",
      sessions: JSON.stringify([{ title: "Session", summary: "", audioLinks: [] }], null, 2),
    },
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "sessions", label: "Sessions", type: "json", hint: 'Each item: { "title": "", "summary": "", "audioLinks": [{ "label": "", "url": "" }] }' },
    ],
  },

  {
    type: "archived-campaign-card",
    label: "Archived Campaign Card",
    description: "Editable previous-campaign card with status, DM, optional image, and detail link",
    icon: "◇",
    category: "content",
    defaultProps: {
      id: "archived-campaign",
      title: "Archived Campaign",
      status: "Completed",
      dm: "",
      image: "",
      description: "",
      referenceUrl: "",
      resources: "[]",
      party: "[]",
      sections: "[]",
    },
    fields: [
      { key: "id",     label: "Detail page slug",      type: "text",  placeholder: "archived-campaign" },
      { key: "title",  label: "Campaign title",       type: "text",  placeholder: "Campaign name" },
      {
        key: "status", label: "Archive status", type: "select",
        options: [
          { value: "Completed", label: "Completed" },
          { value: "On Hiatus", label: "On Hiatus" },
        ],
      },
      { key: "dm",     label: "Dungeon Master",       type: "text",  placeholder: "DM name" },
      { key: "image",  label: "Header image (optional)", type: "image", placeholder: "/images/campaigns/archive.jpg" },
      { key: "description", label: "Campaign summary", type: "textarea", placeholder: "Archive summary" },
      { key: "referenceUrl", label: "Detail link", type: "url", placeholder: "https://..." },
      { key: "resources", label: "Resource links", type: "json", hint: 'Each item: { "label": "", "url": "" }' },
      { key: "party", label: "Roster", type: "json", hint: 'Each item: { "name": "", "player": "", "url": "" }' },
      { key: "sections", label: "Archive detail sections", type: "json", hint: 'Each item: { "title": "", "content": "", "entries": [] }' },
    ],
  },

  {
    type: "media-player",
    label: "Media Player",
    description: "Play a YouTube video, uploaded video, or audio file directly on the page",
    icon: "▶",
    category: "content",
    defaultProps: { src: "", title: "", mediaType: "auto", displayMode: "full", image: "/images/dragon-ears.png", caption: "" },
    fields: [
      { key: "src", label: "YouTube, audio, or video URL", type: "url", placeholder: "https://youtu.be/... or /images/media/file.mp4" },
      { key: "title", label: "Title (optional)", type: "text", placeholder: "Session recording" },
      {
        key: "mediaType",
        label: "Player type",
        type: "select",
        options: [
          { value: "auto", label: "Detect automatically" },
          { value: "youtube", label: "YouTube video" },
          { value: "audio", label: "Audio file" },
          { value: "video", label: "Uploaded video" },
        ],
      },
      {
        key: "displayMode",
        label: "Display",
        type: "select",
        options: [
          { value: "full", label: "Full player" },
          { value: "image-button", label: "Image button" },
        ],
      },
      { key: "image", label: "Button image", type: "image", placeholder: "/images/dragon-ears.png" },
      { key: "caption", label: "Caption (optional)", type: "textarea" },
    ],
  },

  {
    type: "deity-card",
    label: "Deity Card",
    description: "Editable Pantheon image card with divine title, domain, and optional reference link",
    icon: "*",
    category: "content",
    defaultProps: {
      title: "Deity",
      domain: "",
      href: "",
      image: "",
    },
    fields: [
      { key: "title",  label: "Divine title",             type: "text",  placeholder: 'Addan - "Eternal Guardian"' },
      { key: "domain", label: "Domain",                   type: "text",  placeholder: "Order & Protection" },
      { key: "href",   label: "Reference link (optional)", type: "url",   placeholder: "https://..." },
      { key: "image",  label: "Deity image",              type: "image", placeholder: "/images/pantheon/deity.webp" },
    ],
  },

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
          { value: "campaign", label: "Campaign detail" },
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
    type: "grid-section",
    label: "Grid Section",
    description: "Transparent layout grid — place any block into specific columns and rows",
    icon: "⊞",
    category: "layout",
    defaultProps: {
      columns: "2",
      rows: "2",
      gap: "md",
      items: "[]",
    },
    fields: [
      {
        key: "columns", label: "Columns", type: "select",
        options: [
          { value: "1", label: "1 column" },
          { value: "2", label: "2 columns" },
          { value: "3", label: "3 columns" },
          { value: "4", label: "4 columns" },
          { value: "5", label: "5 columns" },
          { value: "6", label: "6 columns" },
        ],
      },
      { key: "rows", label: "Rows", type: "text", hint: "Number of rows (1–20)" },
      {
        key: "gap", label: "Gap", type: "select",
        options: [
          { value: "sm", label: "Small" },
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" },
        ],
      },
      {
        key: "items",
        label: "Grid cells",
        type: "grid-section-items",
        hint: "Click cells in the page preview to add or edit blocks.",
      },
    ],
  },

];

export const ACTIVE_ASSET_TYPES = ASSET_TYPES.filter((asset) => !asset.retired);

export function getAssetDef(type: BlockType): AssetTypeDef | undefined {
  return ASSET_TYPES.find((a) => a.type === type);
}

export type MediaPlayerSource =
  | { kind: "youtube"; src: string }
  | { kind: "audio"; src: string }
  | { kind: "video"; src: string }
  | { kind: "iframe"; src: string };

function youtubeVideoId(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] ?? null;
    if (host !== "youtube.com" && host !== "m.youtube.com") return null;
    if (url.pathname === "/watch") return url.searchParams.get("v");
    const [first, id] = url.pathname.split("/").filter(Boolean);
    return ["embed", "shorts", "live"].includes(first) ? (id ?? null) : null;
  } catch {
    return null;
  }
}

function googleDrivePreviewUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.hostname !== "drive.google.com") return null;
    const match = url.pathname.match(/^\/file\/d\/([^/]+)/);
    return match ? `https://drive.google.com/file/d/${match[1]}/preview` : null;
  } catch {
    return null;
  }
}

export function resolveMediaPlayerSource(raw: string, mediaType = "auto"): MediaPlayerSource | null {
  const src = raw.trim();
  if (!src) return null;

  const videoId = youtubeVideoId(src);
  if (videoId && mediaType !== "audio") {
    return { kind: "youtube", src: `https://www.youtube-nocookie.com/embed/${videoId}` };
  }

  if (mediaType === "youtube") return null;

  const drivePreview = googleDrivePreviewUrl(src);
  if (drivePreview) return { kind: "iframe", src: drivePreview };

  if (mediaType === "video" || (mediaType === "auto" && /\.(mp4|m4v|mov|ogv|webm)(?:[?#].*)?$/i.test(src))) {
    return { kind: "video", src };
  }

  return { kind: "audio", src };
}

export function parseGridSectionItems(raw: unknown): GridSectionChild[] {
  if (Array.isArray(raw)) return raw as GridSectionChild[];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? (parsed as GridSectionChild[]) : [];
  } catch {
    return [];
  }
}
