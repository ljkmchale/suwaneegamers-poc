"use client";

import { useState } from "react";
import { ACTIVE_ASSET_TYPES } from "@/lib/pageBlocks";
import type { BlockType } from "@/lib/pageBlocks";

type Category = "content" | "layout" | "data";

const CATEGORY_LABELS: Record<Category, string> = {
  content: "Content",
  layout:  "Layout",
  data:    "Live Data",
};

export function BlockPicker({
  onPick,
  onClose,
}: {
  onPick: (type: BlockType) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Category>("content");

  const blocks = ACTIVE_ASSET_TYPES.filter((a) => a.category === tab);

  return (
    // Backdrop
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(4,2,10,0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 24px 24px calc(24px + 288px)",
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 680,
          maxHeight: "80vh",
          background: "#08050f",
          border: "1px solid #2a2a35",
          borderRadius: 10,
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "16px 20px 0",
          borderBottom: "1px solid #2a2a35",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{
              fontFamily: "var(--font-cinzel, serif)",
              fontSize: 13,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "#e8dfc8",
            }}>
              Add Block
            </span>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 28, height: 28,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", border: "none", cursor: "pointer",
                color: "rgba(255,255,255,0.4)", fontSize: 18, borderRadius: 4,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
            >
              ×
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0 }}>
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setTab(cat)}
                style={{
                  padding: "7px 16px",
                  fontSize: 10,
                  fontFamily: "var(--font-cinzel, serif)",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  background: "transparent",
                  border: "none",
                  borderBottom: tab === cat ? "2px solid #8b5cf6" : "2px solid transparent",
                  color: tab === cat ? "#a78bfa" : "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                  transition: "color 0.12s, border-color 0.12s",
                  marginBottom: -1,
                }}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div style={{
          overflowY: "auto",
          padding: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 10,
        }}>
          {blocks.map((def) => (
            <button
              key={def.type}
              type="button"
              onClick={() => onPick(def.type)}
              style={{
                textAlign: "left",
                background: "#0f0a1a",
                border: "1px solid #2a2a35",
                borderRadius: 8,
                padding: "12px 14px",
                cursor: "pointer",
                transition: "border-color 0.12s, background 0.12s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "#8b5cf6";
                (e.currentTarget as HTMLElement).style.background = "#150d28";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "#2a2a35";
                (e.currentTarget as HTMLElement).style.background = "#0f0a1a";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{
                  fontSize: 16,
                  width: 28, height: 28,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "#1a0d30",
                  borderRadius: 5,
                  flexShrink: 0,
                  color: "#a78bfa",
                }}>
                  {def.icon}
                </span>
                <span style={{
                  fontFamily: "var(--font-cinzel, serif)",
                  fontSize: 10,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "#e8dfc8",
                  lineHeight: 1.3,
                }}>
                  {def.label}
                </span>
              </div>
              <p style={{
                margin: 0,
                fontSize: 10,
                color: "rgba(255,255,255,0.38)",
                lineHeight: 1.5,
              }}>
                {def.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
