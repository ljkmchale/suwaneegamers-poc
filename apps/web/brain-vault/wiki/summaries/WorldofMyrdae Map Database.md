---
campaign: World
---

# WorldofMyrdae Map Database

## Scope

World-source summary for `raw/worldofmyrdae-map-database.md`. This is structured map metadata from the WorldofMyrdae map editor, not campaign event prose.

## Summary

The WorldofMyrdae map database contributes the continent map's structured geography layer: 425 locations, 322 roads/routes, 39 tagged regions, location types, map coordinates, optional city-map links, optional Gazetteer links, biome tags, and route connectivity.

The campaign brain uses this source to maintain map metadata on `wiki/world/locations/` pages and to generate stubs for map locations that do not yet have dedicated prose pages. Rich Gazetteer or campaign-derived prose remains on the existing world or campaign pages; generated map metadata is additive.

## Key Extracted Pages

- [[World Map Location Index]] - navigable index of map locations by region and type.
- `wiki/world/locations/` - individual world location pages and generated stubs.

## Source Notes

- Source path: `C:\Users\Larry McHale\Desktop\WorldofMyrdae\js\locations-db.js`.
- Active map image context includes `C:\Users\Larry McHale\Desktop\WorldofMyrdae\images\Myrdae_locations.jpg` and `images/map-layers/Myrdae-layered-preview.jpg`.
- Generated metadata blocks are bounded by `WORLD_MAP_METADATA_START` / `WORLD_MAP_METADATA_END` comments so future imports can refresh map data without replacing prose.
