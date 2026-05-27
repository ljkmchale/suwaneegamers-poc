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
  | "spacer"
  // ── Site-specific layout blocks ──
  | "page-header"
  | "hero-banner"
  | "portal-links"
  | "calendar-embed"
  // ── Live data blocks (render from content/*.json) ──
  | "campaigns-grid"
  | "players-grid"
  | "dms-grid"
  | "bestiary-grid";

// ── Unified page item types ───────────────────────────────────────────────────

export interface SectionItem {
  kind: "section";
  id: string;
}

export interface BlockItem {
  kind: "block";
  id: string;
  type: BlockType;
  props: Record<string, unknown>;
}

export type PageItem = SectionItem | BlockItem;

// ── Asset field definitions ───────────────────────────────────────────────────

export interface AssetField {
  key: string;
  label: string;
  type: "text" | "textarea" | "url" | "select" | "json";
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
      { key: "src",     label: "Image URL",          type: "url",  placeholder: "/images/my-image.webp" },
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

  // ── Live data blocks ──────────────────────────────────────────────────────────

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
