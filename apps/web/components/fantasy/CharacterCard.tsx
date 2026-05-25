"use client";

import { motion } from "framer-motion";

interface Character {
  id: string;
  name: string;
  race: string;
  class: string;
  level: number;
  description?: string | null;
  imageUrl?: string | null;
  isAlive: boolean;
  isNpc: boolean;
  campaign?: { name: string };
}

interface CharacterCardProps {
  character: Character;
}

const CLASS_COLORS: Record<string, string> = {
  Paladin: "#fbbf24",
  Wizard: "#a78bfa",
  Fighter: "#f87171",
  Rogue: "#34d399",
  Ranger: "#6ee7b7",
  Cleric: "#fde68a",
  Barbarian: "#fb7185",
  Druid: "#86efac",
  Bard: "#f9a8d4",
  Warlock: "#c084fc",
  Sorcerer: "#818cf8",
  Monk: "#fcd34d",
};

export function CharacterCard({ character }: CharacterCardProps) {
  const classColor = CLASS_COLORS[character.class] ?? "var(--color-accent-arcane)";

  return (
    <motion.div
      className="fantasy-card p-6 flex flex-col gap-3"
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25 }}
    >
      {/* Avatar / placeholder */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mb-2 border"
        style={{
          background: "rgba(139, 92, 246, 0.1)",
          borderColor: classColor,
          boxShadow: `0 0 12px ${classColor}40`,
        }}
      >
        {character.isNpc ? "🎭" : "⚔️"}
      </div>

      {/* Name + class badge */}
      <div>
        <h3
          className="font-cinzel text-lg leading-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          {character.name}
        </h3>
        <p className="text-sm mt-1" style={{ color: classColor }}>
          {character.race} {character.class}
          {!character.isNpc && (
            <span style={{ color: "var(--color-text-muted)" }}> · Lvl {character.level}</span>
          )}
        </p>
      </div>

      {/* Description */}
      {character.description && (
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
          {character.description.length > 120
            ? character.description.slice(0, 117) + "..."
            : character.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center gap-3 mt-auto pt-3 border-t"
        style={{ borderColor: "var(--color-bg-border)" }}>
        {!character.isAlive && (
          <span className="text-xs font-cinzel uppercase tracking-widest"
            style={{ color: "var(--color-blood-600, #dc2626)" }}>
            Fallen
          </span>
        )}
        {character.campaign && (
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {character.campaign.name}
          </span>
        )}
      </div>
    </motion.div>
  );
}
