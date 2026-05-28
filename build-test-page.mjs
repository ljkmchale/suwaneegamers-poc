import fs from "fs";

const path = "C:/Users/Larry McHale/Desktop/suwaneegamers-poc/content/page-layouts.json";
const all = JSON.parse(fs.readFileSync(path, "utf-8"));

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

const layoutCardItems = JSON.stringify([{
  id: "grid_root", type: "grid", props: {
    columns: "3", rows: "2", gap: "md",
    items: JSON.stringify([
      { id: "header_1", type: "header", props: { title: "Card Layout", eyebrow: "Test Asset", col: "1", row: "1", colSpan: "3", rowSpan: "1", size: "lg" } },
      { id: "text_1",   type: "text",   props: { content: "Use the grid controls to arrange card internals up to 6 columns by 10 rows.", col: "1", row: "2", colSpan: "2", rowSpan: "1" } },
      { id: "inner_1",  type: "inner-card", props: { col: "3", row: "2", colSpan: "1", rowSpan: "1", items: JSON.stringify([{ id: "inner_text_1", type: "text", props: { content: "Inner card" } }]) } },
    ])
  }
}]);

const profileItems = JSON.stringify([
  { id: "heading_1", type: "heading",     props: { value: "Test Profile" } },
  { id: "role_1",    type: "description", props: { value: "Role or character class" } },
  { id: "badge_1",   type: "badge",       props: { label: "Active", color: "arcane" } },
  { id: "link_1",    type: "link",        props: { label: "Character Sheet", href: "/" } },
]);

const portalLinks = JSON.stringify([
  { title: "Campaigns",    description: "Active campaigns list.",           href: "/campaigns",  label: "View" },
  { title: "Players",      description: "Player roster and characters.",    href: "/players",    label: "Browse" },
  { title: "Knowledge Base", description: "Lore and setting reference.",   href: "http://kb.suwaneegamers.net", label: "Open" },
]);

const founders = JSON.stringify([
  { name: "Chip Poole",    role: "Co-Founder", img: "" },
  { name: "Larry McHale",  role: "Co-Founder", img: "" },
]);

const linkListLinks = JSON.stringify([
  { label: "Home",           href: "/",               description: "Site home" },
  { label: "Campaigns",      href: "/campaigns",      description: "Active campaigns" },
  { label: "Knowledge Base", href: "http://kb.suwaneegamers.net", description: "External lore reference" },
]);

const galleryImages = JSON.stringify([
  { src: "", alt: "Gallery slot 1 — add an image from the media library", caption: "Caption 1" },
  { src: "", alt: "Gallery slot 2", caption: "Caption 2" },
  { src: "", alt: "Gallery slot 3", caption: "Caption 3" },
]);

all["/test-page"] = {
  grid: { columns: 2, gap: "md" },
  items: [

    // ── Page header ───────────────────────────────────────────────────────────
    { kind: "block", id: "test-page-header", type: "page-header", props: {
      eyebrow: "Internal Lab", title: "Test Page",
      description: "A working space for testing every asset type and layout feature before it moves into production pages.",
      align: "center",
    }},

    // ── Content blocks ────────────────────────────────────────────────────────
    { kind: "block", id: uid("divider"), type: "divider", props: { variant: "ornate", label: "Content Blocks" } },

    { kind: "block", id: uid("sec"), type: "section-heading", props: {
      eyebrow: "Test", title: "Section Heading Block",
      description: "Eyebrow, heading, and intro copy for any page section.",
      align: "left",
    }},

    { kind: "block", id: uid("text"), type: "text", props: {
      content: "This is a Text Block. It renders a styled paragraph of body text. You can set alignment to left or center and type as much content as needed. This block is great for lore entries, announcements, or any descriptive copy.",
      align: "left",
    }},

    { kind: "block", id: uid("callout_gold"), type: "callout", props: {
      title: "Gold Callout", content: "This is a highlighted callout in Gold. Try switching the accent to Arcane or Blood in the props panel.", variant: "gold",
    }},

    { kind: "block", id: uid("callout_arc"), type: "callout", props: {
      title: "Arcane Callout", content: "This callout uses the Arcane purple accent.", variant: "arcane",
    }},

    { kind: "block", id: uid("btn_primary"), type: "button-link", props: {
      label: "Primary Button Link", href: "/", align: "left", variant: "primary",
    }},

    { kind: "block", id: uid("btn_secondary"), type: "button-link", props: {
      label: "Secondary Button Link", href: "/campaigns", align: "center", variant: "secondary",
    }},

    { kind: "block", id: uid("linklist"), type: "link-list", props: {
      title: "Link List Block",
      links: linkListLinks,
    }},

    { kind: "block", id: uid("spacer"), type: "spacer", props: { size: "md" } },

    // ── Cards ─────────────────────────────────────────────────────────────────
    { kind: "block", id: uid("divider"), type: "divider", props: { variant: "ornate", label: "Cards" } },

    { kind: "block", id: "test-single-card", type: "card", props: {
      eyebrow: "Test Card", title: "Card — Column 1",
      description: "This card is assigned to column 1 of the 2-column page grid. Use the Column Placement picker in Edit Block to move it.",
      href: "", linkLabel: "",
    }, col: 1, colSpan: 1 },

    { kind: "block", id: uid("card2"), type: "card", props: {
      eyebrow: "Test Card", title: "Card — Column 2",
      description: "This card is assigned to column 2. Both cards demonstrate side-by-side placement using the page grid.",
      href: "", linkLabel: "",
    }, col: 2, colSpan: 1 },

    { kind: "block", id: "test-single-card-layout", type: "layout-card", props: {
      width: "wide",
      items: layoutCardItems,
    }},

    { kind: "block", id: uid("profile"), type: "profile-card", props: {
      layout: "side",
      items: profileItems,
    }},

    // ── Images + media ────────────────────────────────────────────────────────
    { kind: "block", id: uid("divider"), type: "divider", props: { variant: "ornate", label: "Media" } },

    { kind: "block", id: uid("image"), type: "image", props: {
      src: "", alt: "Test image — pick one from the media library in the Edit Block panel", caption: "Image caption (optional)", size: "large",
    }},

    { kind: "block", id: uid("gallery"), type: "gallery", props: {
      columns: "3",
      images: galleryImages,
    }},

    { kind: "block", id: uid("embed"), type: "embed", props: {
      src: "", title: "Embed Block — paste an iframe URL to test", height: "400",
    }},

    // ── Layout blocks ─────────────────────────────────────────────────────────
    { kind: "block", id: uid("divider"), type: "divider", props: { variant: "ornate", label: "Layout Blocks" } },

    { kind: "block", id: uid("portal"), type: "portal-links", props: {
      eyebrow: "Quick Links", title: "Portal Links Grid",
      description: "A 1–4 column grid of link cards with title, description, and a call-to-action button.",
      links: portalLinks,
    }},

    { kind: "block", id: uid("founders"), type: "founders", props: {
      heading: "Founded By",
      bio: "A short story about the founders goes here. This block supports a heading, optional bio paragraph, and a list of founder cards with name, role, and portrait.",
      founders: founders,
    }},

    // ── Card grids ────────────────────────────────────────────────────────────
    { kind: "block", id: uid("divider"), type: "divider", props: { variant: "ornate", label: "Card Grids" } },

    { kind: "block", id: uid("cg"), type: "card-grid", props: { columns: "3", gap: "md" } },
    { kind: "block", id: uid("cc1"), type: "campaign-card",  props: { id: "a-new-adventure" } },
    { kind: "block", id: uid("cc2"), type: "campaign-card",  props: { id: "bloody-endeavor" } },
    { kind: "block", id: uid("pc1"), type: "player-card",    props: { id: "sean-poole" } },

    // ── Live data grids ───────────────────────────────────────────────────────
    { kind: "block", id: uid("divider"), type: "divider", props: { variant: "ornate", label: "Live Data Grids" } },

    { kind: "block", id: uid("campaigns"),  type: "campaigns-grid",  props: {} },
    { kind: "block", id: uid("players"),    type: "players-grid",    props: {} },
    { kind: "block", id: uid("dms"),        type: "dms-grid",        props: {} },
    { kind: "block", id: uid("bestiary"),   type: "bestiary-grid",   props: {} },
    { kind: "block", id: uid("cal"),        type: "calendar-embed",  props: {} },

    // ── Hero banner (full screen — keep last) ─────────────────────────────────
    { kind: "block", id: uid("divider"), type: "divider", props: { variant: "ornate", label: "Hero Banner" } },
    { kind: "block", id: uid("hero"), type: "hero-banner", props: {} },
  ],
};

fs.writeFileSync(path, JSON.stringify(all, null, 2) + "\n", "utf-8");
console.log("Written.", all["/test-page"].items.length, "blocks on /test-page");
