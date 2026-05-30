"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export function HeroSection() {
  return (
    <section
      className="art-bg-bronze relative min-h-screen flex items-center justify-center overflow-hidden bg-black"
    >
      <div className="absolute inset-0 z-0 bg-black/20" />

      <div
        className="absolute inset-0 z-1"
        style={{
          background:
            "linear-gradient(90deg, rgba(8,5,15,0.82) 0%, rgba(8,5,15,0.48) 44%, rgba(8,5,15,0.14) 100%), linear-gradient(0deg, rgba(8,5,15,0.96) 0%, rgba(8,5,15,0.2) 35%, rgba(8,5,15,0.34) 100%)",
        }}
      />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-8 pb-20">
        <motion.div
          className="max-w-3xl text-center lg:text-left"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        >
          <motion.p
            className="font-cinzel text-sm tracking-[0.4em] uppercase mb-6"
            style={{ color: "var(--color-accent-arcane)" }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            The World of Myrdae · Year 1246 AF
          </motion.p>

          <motion.h1
            className="font-cinzel font-bold tracking-wide leading-tight mb-6 shimmer-text"
            style={{ fontSize: "var(--font-size-hero)" }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.9 }}
          >
            Suwanee Gamers
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl leading-relaxed mb-10 max-w-2xl mx-auto lg:mx-0"
            style={{ color: "#f3ead7", textShadow: "0 2px 18px rgba(0,0,0,0.8)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
          >
            Many campaigns. Five Dungeon Masters. One living world. Welcome to Myrdae
            in the era of The Awakening — where the old gods have gone silent and the world
            holds its breath while welcoming the new gods.
          </motion.p>

          <motion.div
            className="flex flex-wrap gap-4 justify-center lg:justify-start"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.7 }}
          >
            <Link
              href="/campaigns"
              className="px-8 py-3 rounded-lg font-cinzel tracking-widest uppercase text-sm transition-all duration-300 hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
                color: "#e8dfc8",
                boxShadow: "var(--glow-arcane)",
              }}
            >
              Enter the Realm
            </Link>
            <Link
              href="/calendar"
              className="px-8 py-3 rounded-lg font-cinzel tracking-widest uppercase text-sm border transition-all duration-300 hover:scale-105"
              style={{
                borderColor: "var(--color-accent-gold)",
                color: "var(--color-accent-gold)",
              }}
            >
              View Calendar
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll hint */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        style={{ color: "var(--color-text-muted)" }}
      >
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" d="M19 9l-7 7-7-7" />
        </svg>
      </motion.div>
    </section>
  );
}
