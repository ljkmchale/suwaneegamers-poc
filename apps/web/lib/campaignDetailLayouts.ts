import { findCampaign, getActiveCampaigns, type CampaignPartyMember, type PortalCampaign } from "@/lib/campaigns";
import { findRosterCharacter, rosterDescriptor, rosterStatusLabel } from "@/lib/campaignRoster";
import { getCampaignRoster } from "@/lib/campaignRosterData";
import { readContent } from "@/lib/contentFiles";
import type { PageItem } from "@/lib/pageBlocks";

interface CharacterIntroduction {
  campaignId: string;
  character: string;
  image: string;
  video?: string;
  audio: string;
  transcript: string;
}

function characterIntroduction(campaignId: string, character: string) {
  let introductions: CharacterIntroduction[] = [];
  try {
    introductions = readContent<CharacterIntroduction[]>("character-introductions.json");
  } catch {
    return undefined;
  }
  return introductions.find((entry) =>
    entry.campaignId.localeCompare(campaignId, undefined, { sensitivity: "base" }) === 0
      && entry.character.localeCompare(character, undefined, { sensitivity: "base" }) === 0
  );
}

function resourceLinks(campaign: PortalCampaign) {
  return [...(campaign.resources ?? [])];
}

function slugPart(value: string, fallback: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

function cardLayoutItems(items: unknown[]) {
  return JSON.stringify(items, null, 2);
}

function partyLinks(member: CampaignPartyMember) {
  const links = [...(member.links ?? [])];
  if (member.url && !links.some((link) => link.url === member.url)) {
    links.unshift({
      label: "Background Sheet",
      type: "background" as const,
      url: member.url,
    });
  }
  return links;
}

export function getCampaignDetailPath(campaignId: string) {
  return `/campaigns/${campaignId}`;
}

export function getManagedCampaignDetailPaths() {
  return getActiveCampaigns().map((campaign) => getCampaignDetailPath(campaign.id));
}

export function findCampaignForDetailPath(pageId: string) {
  const match = pageId.match(/^\/campaigns\/([^/]+)$/);
  return match ? findCampaign(decodeURIComponent(match[1])) : undefined;
}

function layoutCard(id: string, internalItems: unknown[]): PageItem {
  return {
    kind: "block",
    id,
    type: "layout-card",
    props: {
      width: "campaign",
      items: cardLayoutItems(internalItems),
    },
  };
}

export function buildCampaignSessionsCard(campaign: PortalCampaign): PageItem | null {
  if (!campaign.sessionSummaries?.length) return null;

  const sessionItems: unknown[] = [
    {
      id: "sessions_header",
      type: "header",
      props: {
        title: "Session Summaries",
        color: "primary",
        size: "md",
        col: "1",
        row: "1",
        colSpan: "1",
        rowSpan: "1",
      },
    },
  ];
  let row = 2;

  for (const [sessionIndex, session] of campaign.sessionSummaries.entries()) {
    const sessionSlug = slugPart(session.title, `session-${sessionIndex + 1}`);
    sessionItems.push(
      {
        id: `${sessionSlug}_title`,
        type: "header",
        props: {
          title: session.title,
          color: "gold",
          size: "md",
          audioLinks: cardLayoutItems(session.audioLinks ?? []),
          col: "1",
          row: String(row),
          colSpan: "1",
          rowSpan: "1",
        },
      },
      {
        id: `${sessionSlug}_summary`,
        type: "text",
        props: {
          content: session.summary,
          col: "1",
          row: String(row + 1),
          colSpan: "1",
          rowSpan: "1",
        },
      },
    );
    row += 2;
  }

  return layoutCard(`${campaign.id}-sessions-card`, [
    {
      id: "sessions_grid",
      type: "grid",
      props: {
        columns: "1",
        rows: String(row - 1),
        gap: "md",
        items: cardLayoutItems(sessionItems),
      },
    },
  ]);
}

export function replaceCampaignSessionsCard(items: PageItem[], campaign: PortalCampaign): PageItem[] {
  const sessions = buildCampaignSessionsCard(campaign);
  const sessionsCardId = `${campaign.id}-sessions-card`;
  const withoutStoredSessions = items.filter((item) => item.id !== sessionsCardId);

  return sessions ? [...withoutStoredSessions, sessions] : withoutStoredSessions;
}

/**
 * Enriches the person tiles on the notes/roster card with synced roster data
 * (species, class, level, status) from content/campaign-roster.json. Applied at
 * render time so both fresh layouts and saved page-layout overrides pick up
 * spreadsheet changes without touching the stored layout.
 */
export function enrichCampaignRosterCard(items: PageItem[], campaign: PortalCampaign): PageItem[] {
  const roster = getCampaignRoster(campaign.id);
  if (roster.length === 0) return items;

  const rosterCardId = `${campaign.id}-notes-roster-card`;

  function enrichCardItems(json: string): string {
    let cardItems: unknown;
    try { cardItems = JSON.parse(json); } catch { return json; }
    if (!Array.isArray(cardItems)) return json;

    const next = cardItems.map((cardItem) => {
      const record = cardItem as { type?: string; props?: Record<string, unknown> };
      if (record.type === "grid" && typeof record.props?.items === "string") {
        return { ...record, props: { ...record.props, items: enrichCardItems(record.props.items) } };
      }
      if (record.type !== "person" || typeof record.props?.name !== "string") return cardItem;

      const match = findRosterCharacter(roster, record.props.name);
      if (!match) return cardItem;
      const partyMember = campaign.party?.find(
        (member) => member.name.localeCompare(record.props!.name as string, undefined, { sensitivity: "base" }) === 0,
      );
      const introduction = characterIntroduction(campaign.id, record.props.name);

      const role = [record.props.role || match.player, rosterDescriptor(match), rosterStatusLabel(match)]
        .filter(Boolean)
        .join(" · ");
      return {
        ...record,
        props: {
          ...record.props,
          role,
          ...(introduction ? {
            campaignName: campaign.name,
            img: introduction.image,
            introductionVideo: introduction.video,
            introductionAudio: introduction.audio,
            introductionText: introduction.transcript,
          } : {}),
          ...(partyMember ? {
            href: partyLinks(partyMember).find((link) => link.type === "background")?.url ?? "",
            links: cardLayoutItems(partyLinks(partyMember)),
          } : {}),
        },
      };
    });

    return JSON.stringify(next, null, 2);
  }

  return items.map((item) => {
    if (item.kind !== "block" || item.id !== rosterCardId) return item;
    if (typeof item.props.items !== "string") return item;
    return { ...item, props: { ...item.props, items: enrichCardItems(item.props.items) } };
  });
}

function buildCampaignResourcesCard(campaign: PortalCampaign): PageItem {
  const resourceCardId = `${campaign.id}-resources-card`;
  const links = resourceLinks(campaign);
  return layoutCard(resourceCardId, [
    {
      id: "resources_grid",
      type: "grid",
      props: {
        columns: String(Math.max(links.length, 1)),
        rows: "1",
        gap: "md",
        items: cardLayoutItems(links.map((link, index) => ({
          id: `resource_${slugPart(link.label, "link")}_${index + 1}`,
          type: "link",
          props: {
            label: link.label,
            href: link.url,
            variant: index === links.length - 1 ? "secondary" : "primary",
            col: String(index + 1),
            row: "1",
            colSpan: "1",
            rowSpan: "1",
          },
        }))),
      },
    },
  ]);
}

export function replaceCampaignResourcesCard(items: PageItem[], campaign: PortalCampaign): PageItem[] {
  const resourceCardId = `${campaign.id}-resources-card`;
  const replacement = buildCampaignResourcesCard(campaign);
  return items.map((item) => item.id === resourceCardId ? replacement : item);
}

/**
 * Sends a signed-in player from the campaign's D&D Beyond button directly to
 * their own character. Anonymous visitors, DMs who are not playing, and players
 * without exactly one mapped sheet keep the ordinary campaign destination.
 */
export function personalizeCampaignDndBeyondLink(
  items: PageItem[],
  campaign: PortalCampaign,
  playerName?: string,
): PageItem[] {
  if (!playerName) return items;

  const sheetLinks = (campaign.party ?? [])
    .filter((member) => member.player?.localeCompare(playerName, undefined, { sensitivity: "base" }) === 0)
    .flatMap((member) => partyLinks(member).filter((link) => link.type === "sheet"));
  if (sheetLinks.length !== 1) return items;

  const campaignUrls = new Set(
    (campaign.resources ?? [])
      .map((resource) => resource.url)
      .filter((url) => /^https:\/\/www\.dndbeyond\.com\/campaigns\/\d+\/?$/.test(url)),
  );
  const sheetUrl = sheetLinks[0].url;

  function personalizeCardItems(json: string): string {
    let cardItems: unknown;
    try { cardItems = JSON.parse(json); } catch { return json; }
    if (!Array.isArray(cardItems)) return json;

    return JSON.stringify(cardItems.map((cardItem) => {
      const record = cardItem as { type?: string; props?: Record<string, unknown> };
      const props = record.props ?? {};
      const nested = typeof props.items === "string"
        ? { items: personalizeCardItems(props.items) }
        : {};
      const href = typeof props.href === "string" ? props.href : "";
      const isCampaignLink = campaignUrls.has(href)
        || (props.label === "D&D Beyond" && /^https:\/\/www\.dndbeyond\.com\/campaigns\//.test(href));
      return {
        ...record,
        props: {
          ...props,
          ...nested,
          ...(record.type === "link" && isCampaignLink ? { href: sheetUrl } : {}),
        },
      };
    }), null, 2);
  }

  return items.map((item) => {
    if (item.kind !== "block" || typeof item.props.items !== "string") return item;
    return { ...item, props: { ...item.props, items: personalizeCardItems(item.props.items) } };
  });
}

export function buildCampaignDetailLayout(campaign: PortalCampaign): PageItem[] {
  function notesRosterCard(): PageItem {
    const roster = (campaign.party ?? []).map((member, index) => ({
      id: `member_${slugPart(member.name, "member")}_${index + 1}`,
      type: "person",
      props: {
        name: member.name,
        role: member.player ?? "",
        href: partyLinks(member).find((link) => link.type === "background")?.url ?? "",
        links: cardLayoutItems(partyLinks(member)),
        variant: "tile",
        col: String((index % 3) + 1),
        row: String(Math.floor(index / 3) + 3),
        colSpan: "1",
        rowSpan: "1",
      },
    }));

    return layoutCard(`${campaign.id}-notes-roster-card`, [
      {
        id: "notes_roster_grid",
        type: "grid",
        props: {
          columns: "3",
          rows: String(2 + Math.ceil(roster.length / 3)),
          gap: "md",
          items: cardLayoutItems([
            {
              id: "notes_header",
              type: "header",
              props: {
                title: "Notes",
                color: "primary",
                size: "md",
                col: "1",
                row: "1",
                colSpan: "3",
                rowSpan: "1",
              },
            },
            {
              id: "notes_text",
              type: "text",
              props: {
                content: campaign.description,
                col: "1",
                row: "2",
                colSpan: "3",
                rowSpan: "1",
              },
            },
            ...roster,
          ]),
        },
      },
    ]);
  }

  const items: PageItem[] = [
    {
      kind: "block",
      id: `${campaign.id}-back`,
      type: "button-link",
      props: {
        label: "Campaigns",
        href: "/campaigns",
        align: "left",
        variant: "text",
        arrow: "left",
        width: "campaign",
      },
    },
    {
      kind: "block",
      id: `${campaign.id}-hero`,
      type: "campaign-hero",
      props: {
        eyebrow: "Campaign",
        title: campaign.name,
        image: campaign.headerImage ?? "",
        imagePosition: campaign.headerImagePosition ?? "center",
      },
    },
    {
      kind: "block",
      id: `${campaign.id}-meta`,
      type: "campaign-meta",
      props: {
        schedule: campaign.schedule,
        dm: campaign.dm,
        campaignName: campaign.name,
      },
    },
    buildCampaignResourcesCard(campaign),
    notesRosterCard(),
  ];

  const sessions = buildCampaignSessionsCard(campaign);
  if (sessions) items.push(sessions);

  return items;
}
