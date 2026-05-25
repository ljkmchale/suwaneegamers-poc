"use client";

import { useState } from "react";

interface Location {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  mapX?: number | null;
  mapY?: number | null;
}

const TYPE_ICONS: Record<string, string> = {
  city: "🏰",
  dungeon: "💀",
  wilderness: "🌲",
  tavern: "🍺",
  ruin: "🗿",
  custom: "📍",
};

export function WorldMapClient({ locations }: { locations: Location[] }) {
  const [selected, setSelected] = useState<Location | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Map area */}
      <div
        className="lg:col-span-2 fantasy-card relative overflow-hidden"
        style={{ minHeight: "480px" }}
      >
        {/* Placeholder world map — replace with actual map image */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(30,20,60,0.8) 0%, rgba(8,5,15,0.95) 100%)",
          }}
        >
          <div className="text-center">
            <p className="text-6xl mb-4">🗺️</p>
            <p className="font-cinzel tracking-widest" style={{ color: "var(--color-text-muted)" }}>
              Map of Myrdae
            </p>
            <p className="text-sm mt-2" style={{ color: "var(--color-text-muted)" }}>
              Add a world map image to /public/images/world-map.jpg
            </p>
          </div>
        </div>

        {/* Location pins */}
        {locations
          .filter((l) => l.mapX !== null && l.mapY !== null)
          .map((loc) => (
            <button
              key={loc.id}
              onClick={() => setSelected(loc)}
              className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-lg hover:scale-125 transition-transform"
              style={{
                left: `${loc.mapX}%`,
                top: `${loc.mapY}%`,
              }}
              title={loc.name}
            >
              {TYPE_ICONS[loc.type] ?? "📍"}
            </button>
          ))}
      </div>

      {/* Location list / detail */}
      <div className="flex flex-col gap-3">
        {selected ? (
          <div className="fantasy-card p-6">
            <button
              onClick={() => setSelected(null)}
              className="text-xs mb-4 flex items-center gap-1 transition-colors"
              style={{ color: "var(--color-text-muted)" }}
            >
              ← Back to list
            </button>
            <div className="text-3xl mb-3">{TYPE_ICONS[selected.type] ?? "📍"}</div>
            <h3 className="font-cinzel text-xl mb-2"
              style={{ color: "var(--color-accent-gold)" }}>
              {selected.name}
            </h3>
            <p className="text-sm mb-3 capitalize"
              style={{ color: "var(--color-accent-arcane)" }}>
              {selected.type}
            </p>
            {selected.description && (
              <p style={{ color: "var(--color-text-secondary)" }}>{selected.description}</p>
            )}
          </div>
        ) : (
          <>
            <h3 className="font-cinzel text-sm tracking-widest uppercase"
              style={{ color: "var(--color-text-muted)" }}>
              Known Locations
            </h3>
            {locations.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                No locations yet. Add them via the database.
              </p>
            ) : (
              locations.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => setSelected(loc)}
                  className="fantasy-card p-4 text-left flex items-center gap-3 group"
                >
                  <span className="text-xl">{TYPE_ICONS[loc.type] ?? "📍"}</span>
                  <div>
                    <p className="font-cinzel text-sm group-hover:text-amber-400 transition-colors"
                      style={{ color: "var(--color-text-primary)" }}>
                      {loc.name}
                    </p>
                    <p className="text-xs capitalize"
                      style={{ color: "var(--color-text-muted)" }}>
                      {loc.type}
                    </p>
                  </div>
                </button>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
