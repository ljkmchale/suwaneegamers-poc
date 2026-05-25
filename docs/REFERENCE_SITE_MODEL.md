# Reference Site Model

Reference: https://sites.google.com/view/suwanee-gamers/

Reviewed: 2026-05-24

## Source Rules

Use the Google Site as the reference source for portal structure, campaign roster details, campaign page links, DM/schedule labels, and public-facing campaign summaries. Do not invent local campaign facts when they can be checked against the reference site.

The Knowledge Base at `http://kb.suwaneegamers.net` remains the destination for deeper table material, but this repo should model portal pages from the Google Site unless the user gives a newer source.

## Structure To Preserve

The Google Site is organized like a simple campaign-world reference library:

- Home
- Bestiary
- Campaigns
- Active campaign detail pages
- Dungeon Masters
- Gazetteer
- History
- Legends & Lore
- Maps of Myrdae
- Pantheon
- Setting
- Territories
- Previous Campaigns
- Previous campaign detail pages

## First Parity Changes Made

- Added `/maps-of-myrdae` as a top-level map hub modeled after the reference page's map variants: Locations, Grid, Hex, Pre-Awakening, Territories, and Clean.
- Added `/previous-campaigns` as a top-level archive page instead of burying previous campaigns only on `/campaigns`.
- Updated the navigation label from `Maps` to `Maps of Myrdae`.
- Moved `Bestiary` into the main Myrdae navigation group.
- Added `Previous Campaigns` to top-level tool/navigation links.
- Updated the home page exploration grid to point to `Maps of Myrdae`.

## Content Gaps Compared With Reference

- The portal should not duplicate KB content. Campaigns, lore, maps, bestiary entries, and archived material should resolve to `http://kb.suwaneegamers.net`.
- The reference Maps of Myrdae page has multiple real map images. The portal should link or embed those map resources once their stable URLs are known.
- The reference Setting and Dungeon Masters pages link out to many external resources. The portal should surface those links without becoming the canonical data store.
