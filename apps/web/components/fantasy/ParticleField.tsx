"use client";

import { useEffect, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

const DENSITY_COUNT: Record<string, number> = {
  low: 25,
  medium: 60,
  high: 120,
};

interface ParticleFieldProps {
  density?: "low" | "medium" | "high";
}

export function ParticleField({ density = "medium" }: ParticleFieldProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => {
      setReady(true);
    });
  }, []);

  if (!ready) return null;

  return (
    <Particles
      id="tsparticles"
      className="fixed inset-0 z-0 pointer-events-none"
      options={{
        background: { color: { value: "transparent" } },
        fpsLimit: 60,
        particles: {
          color: {
            value: ["#8b5cf6", "#f59e0b", "#a78bfa", "#fcd34d"],
          },
          links: { enable: false },
          move: {
            enable: true,
            direction: "top",
            random: true,
            speed: { min: 0.2, max: 0.8 },
            straight: false,
            outModes: { default: "out" },
          },
          number: { value: DENSITY_COUNT[density] ?? 60, density: { enable: true } },
          opacity: {
            value: { min: 0.1, max: 0.5 },
            animation: {
              enable: true,
              speed: 0.5,
            },
          },
          shape: { type: ["circle", "triangle"] },
          size: {
            value: { min: 1, max: 3 },
          },
        },
        detectRetina: true,
      }}
    />
  );
}
