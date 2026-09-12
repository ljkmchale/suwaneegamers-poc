# Admin reporting review and proposed organization

Reviewed and implemented September 12, 2026. Production activation remains separate.

## Main finding

The admin reporting needs a clearer hierarchy and consistent metric definitions. Preserve every report, but give each a primary home. Start with a short overview, then let the administrator investigate by audience, content, map activity, or operational problem.

The existing style is suitable: retain Cinzel headings, dark plum backgrounds (#08050f and #0f0a1a), parchment text (#e8dfc8), violet highlights (#8b5cf6), amber emphasis (#f59e0b), and bordered cards. Improve spacing, table readability, contrast, and chart labeling within that theme.

## Evidence and limitations

- `apps/web/app/admin/analytics/page.tsx` displays 11 summary cards and more than 20 report sections. It combines analytics, live presence, performance, and job health.
- `apps/web/app/admin/layout.tsx` places Usage & Connections and Members under Security, while most content tools remain individual links. The dashboard largely repeats navigation and adds a source resync action.
- The visitor directory, recent visits, visitor/page activity, page audiences, and Members repeat identity and activity information, though their aggregation levels differ. These should become connected views, not be deleted or indiscriminately combined.
- Myra combines usage, estimated provider cost, remediation, tuning, personalities, questions, and capability gaps. Keep it a dedicated domain with internal tabs separating reporting from controls.
- The redesigned overview and map report were visually verified through an authenticated, isolated local preview backed by a database snapshot. The active production bundle was not changed.
- A concurrent set of campaign and Gazetteer content changes was left untouched.

## Proposed sidebar

| Group | Destinations and purpose |
| --- | --- |
| Overview | What changed, what needs attention, and links to investigate |
| Site Insights | Audience & Acquisition; Content & Journeys; Maps of Myrdae; Live Activity |
| Members | Existing member directory, roster status, join dates, links to activity |
| Myra | Usage & Cost; Questions & Quality; Tuning & Voices; existing Health, Feedback, Pronunciations |
| Operations | Site Performance; Source Managed with job status and run history |
| Security | Threat overview, blocks, requests, sign-in audit, enforcement controls |
| Content & Design | Pages, Navigation Layout, Appearance, Media, Map Editor, Advents Guide moderation |
| Store | Existing products, inventory, orders, and readiness |

Keep existing URLs working. Initially these can be grouped navigation and query-selected views at the existing analytics route. Do not create conflicting map routes while Claude is building the map reporting. Map editing, map usage analysis, and review moderation have different jobs and should have distinct labels.

## Overview layout

1. A shared date range (7/30/90 days), explicit timezone and last-updated timestamp. Preserve the selection when opening a detailed report.
2. Four primary cards: recorded visitors, new recorded visitors, visits, and engaged time. Provide plain-language definitions and a previous equal-period comparison when sufficient history exists.
3. One traffic trend with selectable metric and exact daily values. Pair it with a short list of noteworthy changes supported by counts and denominators.
4. A prominent Maps of Myrdae summary: distinct visitors, share of the selected audience, visits with a recorded map interaction, and tracking coverage. Link to the full map report.
5. A compact attention list for failed jobs, browser problems, Myra issues, and security incidents, linking to their owning tools.

Do not place complete visitor lists or complete job histories on the overview. Live presence belongs in a small separately labeled live panel and a dedicated detail view; it is not a 30-day metric.

## Preserve every existing analytics report

| Existing information | Primary home and presentation |
| --- | --- |
| At a glance; page views, visitors, visits, engaged time; traffic trend | Overview summary, with full trends in Audience & Acquisition |
| New visitor names and acquisition breakdown | Audience & Acquisition; cohort counts and a linked visitor table |
| Who is on now; active-now card | Live Activity; current page, device, last signal, and activity details |
| Who's been on the site | Audience directory: one row per recorded visitor, sortable and paginated |
| Recent visitors | Rename to Recent visits: one row per visit, accessible from Audience and visitor details |
| What each visitor viewed | Expandable visitor detail: visits, pages, actions, and engagement |
| Who viewed each page | Page detail: audience list, reachable from the content table |
| Audience mix; devices | Audience & Acquisition: clearly labeled visitor/visit counts and percentages |
| Traffic sources; source, campaign, entry page | Audience & Acquisition: consistent first-acquisition and visit-source views |
| Most visited pages; most read/opened | Content & Journeys: page table and content opens, with clearly separated measures |
| Most listened/watched; media-play total | Content & Journeys: media tab, plays and recorded listening/watching time |
| Clicked actions; click types; action-click total | Content & Journeys: actions tab with target and type filters |
| Search terms; gaps; result choices; search total | Content & Journeys: search tab with searches, empty results, and selected results |
| Campaign engagement; session interest | Content & Journeys: campaign filters and session details; keep opens and plays distinct |
| Page depth; exits; top paths | Content & Journeys: page details and a navigable previous/next-page table |
| Map page views, visitors, time, locations and regions | Maps of Myrdae: dedicated report, with a small overview summary |
| Slow-load total and pages; client-error total and labels | Operations / Site Performance: severity and affected-page tables |
| Automation status, next run, duration, messages, recent history | Operations / Source Managed: status table with expandable runs and existing controls |

## Maps of Myrdae: the priority investigation

Read-only snapshot over a rolling 30-day interval: `/maps-of-myrdae` had **171 page views from 13 distinct recorded visitor keys**. It ranked third by page views after home and campaigns in that query. These figures include internal activity; they do not establish a surge of new people. The query uses the existing email/visitor/session identity fallback, not a census of humans.

The same database contained no `content_view` events with `map location` or `map region` content types at review time. Existing map records describe the containing page, its navigation, and related site events. They cannot reconstruct historical clicks inside the map.

The source now contains a receiver for `map:location-click` in `apps/web/app/(site)/maps-of-myrdae/AdventsGuideMap.tsx`, checking both iframe origin and source window. It records location/region opens through the existing analytics event pipeline. The external map sender, deployed receiver, and successful end-to-end ingestion still need verification with Claude's work. Absence of stored clicks is not proof nobody clicked.

The map report should answer these questions in order:

| Question | Display | Data readiness |
| --- | --- | --- |
| Who uses it? | New/returning recorded visitors, members/unidentified, internal activity toggle | Existing identities and events support much of this; unify definitions first |
| How did they arrive? | Acquisition source, entry page, previous site page; new-visitor cohort filter | Existing attribution and page events; historical source gaps remain |
| Did they explore? | Map visits with at least one location/region interaction divided by eligible map visits | Requires verified click collection and a collection-start/coverage boundary |
| What did they explore? | Ranked locations/regions with distinct visitors, interacting visits, and total clicks | New click events; aggregate by stable location ID and kind, display name separately |
| What sequence did they follow? | Visit timeline: entry, map opens, location selections, onward page | Join existing page events with verified map events; paginate details |
| What happens next? | Next site destinations, return visits, guide use where instrumented | Page events exist; additional map-specific actions require verified instrumentation |
| Is the report complete? | First and last received interaction, coverage status, known collection start | Add explicit reporting; do not present an empty chart as zero interest |

Use an explicit internal-activity filter and show its state on every chart. Start with location rankings and timelines. A geographic heatmap should wait for reliable stable IDs/coordinates and sufficient events. Raw pan/zoom counts are secondary; a single person can generate many such events without opening any content.

Keep first acquisition separate from the page immediately preceding the map. In the snapshot, sources associated with map visits were same-site, Google sign-in, unknown/direct, and localhost. That evidence does not establish which external community sent new visitors or why they came. Label missing attribution as unknown/direct rather than asserting deliberate direct navigation.

## Chart and metric corrections

- **Traffic:** the current static SVG puts views and visitors on one scale and lacks an inspectable data table. Offer a metric selector, daily values on pointer and keyboard interaction, and an accessible table. Label incomplete days and missing history.
- **Rankings:** replace the repeated violet-to-amber bars with simple consistent bars, units, readable labels, and counts. A gradient currently carries no additional meaning. Avoid drawing a nonzero bar for a zero value.
- **Devices:** the current device donut counts sessions. Label these as visits, with counts and percentages; a compact horizontal comparison is easier to read.
- **Depth:** current SQL uses maximum recorded scroll depth. Rename the existing measure to Deepest recorded scroll, retain it in detail, and add a visit-level depth distribution before calling it typical reading depth. Use a fixed 0–100% scale.
- **Search/media/session activity:** searches, opens, clicks, and plays are different units. Do not sum opens and plays into an unlabeled interest score; show separate columns or series.
- **Performance:** show affected events, average timing, and worst timing with milliseconds/seconds. Introduce p95 only with an explicit calculation and sufficient observations.
- **Sources:** the referrer chart currently groups raw `referrer_host`, while recent visits and growth use acquisition data including UTM fields. Use one attribution formatter and distinguish first acquisition from per-visit source.
- **New people:** growth currently means earliest retained analytics session; Members uses its membership record; First time badges use a single retained lifetime session. Name these separately or establish a durable first-seen record. Analytics retention is 90 days, so retained-session history is not lifetime history.
- **Completeness:** recent visits are limited to 12 rows, people to 50, active records to 20, and many rankings to 12. Label top-N results and add server-side pagination for complete details. Do not describe a capped table as all recorded visitors.
- **Inferred purpose:** the purpose signal storage and metric reader exist, but the inspected analytics page does not display them. If surfaced, label this as inferred activity, show confidence, and count distinct visits per purpose. A map page view alone does not prove the visitor's motivation.
- **Refreshing:** refresh live presence independently. Preserve filters, expanded rows, keyboard focus, and table position. Historical reports need a visible update time and manual refresh rather than an entire long page updating every 30 seconds.

## Implementation sequence and acceptance

1. Agree the map report boundary with Claude's completed changes; verify sender → trusted iframe receiver → analytics endpoint → database → authenticated admin display. Do not replace the tracking work as part of navigation cleanup.
2. Reorganize the sidebar and divide the existing analytics renderer into focused views using the preservation table above. Reuse current theme and URLs. Keep Myra controls and security actions in their owning tools.
3. Consolidate visitor and page details, add pagination and persistent filters, then correct metric labels and attribution. Compare totals to SQL using identical date and audience filters.
4. Add the compact overview, map cohort reporting, accessible charts, and meaningful equal-period comparisons. Mark unsupported comparisons and pre-tracking periods as unavailable.
5. Verify every existing field and action remains reachable; check desktop and narrow layouts, keyboard operation, zero/one-row data, long labels, empty tracking, filter persistence, and authenticated access. Run architecture preflight and relevant analytics/navigation tests. Build and activate only as a separately requested release, verifying the active version and rendered result.

Runtime tracing: analytics flows from client tracking and the map receiver through `/api/analytics/events` into SQLite `analytics_sessions`, `analytics_events`, and `analytics_purpose_signals`, then through `apps/web/lib/analytics.ts` into the admin renderer. Analytics retention is another writer to account for. The map URL comes from DB-first source-managed configuration with a fallback, and the external iframe is a separate deployment. Reporting changes do not require image or content regeneration; existing theme and assets can be reused.
