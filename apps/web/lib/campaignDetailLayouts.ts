import { findCampaign, getActiveCampaigns, type CampaignPartyMember, type PortalCampaign } from "@/lib/campaigns";
import type { PageItem } from "@/lib/pageBlocks";

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

export function buildCampaignDetailLayout(campaign: PortalCampaign): PageItem[] {
  function resourceCard(): PageItem {
    const links = resourceLinks(campaign);
    return layoutCard(`${campaign.id}-resources-card`, [
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
    resourceCard(),
    notesRosterCard(),
  ];

  const sessions = buildCampaignSessionsCard(campaign);
  if (sessions) items.push(sessions);

  return items;
}
