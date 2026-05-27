/**
 * Asset block types, their prop schemas, and field definitions.
 * No fs calls — safe to import in client components.
 */

export type BlockType = "divider" | "card" | "image" | "text" | "callout" | "spacer";

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

// ── Asset field definitions (used to auto-generate edit forms) ────────────────

export interface AssetField {
  key: string;
  label: string;
  type: "text" | "textarea" | "url" | "select";
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export interface AssetTypeDef {
  type: BlockType;
  label: string;
  description: string;
  icon: string;
  defaultProps: Record<string, unknown>;
  fields: AssetField[];
}

// ── Asset type registry ───────────────────────────────────────────────────────

export const ASSET_TYPES: AssetTypeDef[] = [
  {
    type: "divider",
    label: "Divider",
    description: "Decorative horizontal separator",
    icon: "—",
    defaultProps: { variant: "ornate", label: "" },
    fields: [
      { key: "label", label: "Label (optional)", type: "text", placeholder: "e.g. More Info" },
      {
        key: "variant", label: "Style", type: "select",
        options: [
          { value: "ornate", label: "Ornate (✦ centered rule)" },
          { value: "simple", label: "Simple (plain line)" },
        ],
      },
    ],
  },
  {
    type: "card",
    label: "Card",
    description: "Fantasy-styled content card with title and optional link",
    icon: "▭",
    defaultProps: { eyebrow: "", title: "New Card", description: "", href: "", linkLabel: "" },
    fields: [
      { key: "eyebrow",   label: "Eyebrow text (optional)", type: "text",     placeholder: "e.g. Featured" },
      { key: "title",     label: "Title",                   type: "text",     placeholder: "Card title" },
      { key: "description", label: "Description",           type: "textarea", placeholder: "Card body text" },
      { key: "href",      label: "Link URL (optional)",     type: "url",      placeholder: "https://…  or  /internal" },
      { key: "linkLabel", label: "Link label",              type: "text",     placeholder: "e.g. Learn more" },
    ],
  },
  {
    type: "image",
    label: "Image",
    description: "Standalone image block with optional caption",
    icon: "⬜",
    defaultProps: { src: "", alt: "", caption: "", size: "large" },
    fields: [
      { key: "src",     label: "Image URL",         type: "url",  placeholder: "/images/my-image.webp" },
      { key: "alt",     label: "Alt text",          type: "text", placeholder: "Describe the image" },
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
    defaultProps: { content: "Enter your text here.", align: "left" },
    fields: [
      { key: "content", label: "Content", type: "textarea", placeholder: "Your text…" },
      {
        key: "align", label: "Alignment", type: "select",
        options: [
          { value: "left",   label: "Left" },
          { value: "center", label: "Center" },
        ],
      },
    ],
  },
  {
    type: "callout",
    label: "Callout",
    description: "Highlighted announcement or note with accent colour",
    icon: "◈",
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
];

export function getAssetDef(type: BlockType): AssetTypeDef | undefined {
  return ASSET_TYPES.find((a) => a.type === type);
}
