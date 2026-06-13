"use client";

/* eslint-disable react-hooks/immutability -- three.js objects are mutated imperatively inside the useFrame render loop, which is the standard react-three-fiber pattern */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Sparkles } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  CatmullRomCurve3,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  RepeatWrapping,
  Sprite,
  SpriteMaterial,
  Texture,
  TubeGeometry,
  Vector3,
} from "three";

type RuneHue = "cyan" | "blue" | "violet" | "pink" | "gold" | "emerald";

interface RuneModel {
  id: string;
  position: [number, number, number];
  scale: number;
  opacity: number;
  blur: number;
  color: string;
  phase: number;
  drift: [number, number, number];
  spin: number;
  pulseSpeed: number;
  texture: Texture;
}

interface BoltState {
  boltIndex: number;
  born: number;
  duration: number;
  color: string;
  endpointA: [number, number, number];
  endpointB: [number, number, number];
}

interface BoltTube {
  glow: Mesh<TubeGeometry, MeshBasicMaterial>;
  core: Mesh<TubeGeometry, MeshBasicMaterial>;
}

interface BoltMeshSet extends BoltTube {
  branches: BoltTube[];
  flash: Sprite;
}

const RUNE_COLORS: Record<RuneHue, string> = {
  cyan: "#22d3ee",
  blue: "#60a5fa",
  violet: "#8b5cf6",
  pink: "#ec4899",
  gold: "#f59e0b",
  emerald: "#34d399",
};

const LIGHTNING_COLORS = ["#60a5fa", "#8b5cf6", "#ec4899", "#ffffff", "#f59e0b"];

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rand(min: number, max: number, random = Math.random) {
  return min + random() * (max - min);
}

function pick<T>(items: T[], random = Math.random): T {
  return items[Math.floor(random() * items.length)];
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.stroke();
}

function drawArcaneMotif(
  ctx: CanvasRenderingContext2D,
  random: () => number,
  cx: number,
  cy: number,
  radius: number,
  glyph: string,
  motif: number,
  pass: number,
) {
  if (motif === 0) {
    ctx.save();
    ctx.translate(cx + rand(-4, 4, random), cy + rand(-3, 3, random));
    ctx.rotate(rand(-0.16, 0.16, random));
    ctx.strokeText(glyph, 0, 3);
    if (pass === 2) ctx.fillText(glyph, 0, 3);
    ctx.restore();
    return;
  }

  if (motif === 1) {
    const arms = 5 + Math.floor(random() * 3);
    for (let i = 0; i < arms; i += 1) {
      const angle = (i / arms) * Math.PI * 2 + rand(-0.18, 0.18, random);
      const inner = radius * rand(0.14, 0.26, random);
      const outer = radius * rand(0.54, 0.82, random);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
      ctx.stroke();
      if (random() > 0.45) {
        const cross = angle + Math.PI / 2;
        const cap = outer * rand(0.08, 0.16, random);
        const tipX = cx + Math.cos(angle) * outer;
        const tipY = cy + Math.sin(angle) * outer;
        ctx.beginPath();
        ctx.moveTo(tipX + Math.cos(cross) * cap, tipY + Math.sin(cross) * cap);
        ctx.lineTo(tipX - Math.cos(cross) * cap, tipY - Math.sin(cross) * cap);
        ctx.stroke();
      }
    }
    drawDiamond(ctx, cx, cy, radius * 0.16);
    return;
  }

  if (motif === 2) {
    const sides = 3 + Math.floor(random() * 4);
    ctx.beginPath();
    for (let i = 0; i <= sides; i += 1) {
      const angle = (i / sides) * Math.PI * 2 + rand(-0.12, 0.12, random);
      const r = radius * rand(0.48, 0.78, random);
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    for (let i = 0; i < sides; i += 1) {
      const angle = (i / sides) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * radius * 0.55, cy + Math.sin(angle) * radius * 0.55);
      ctx.stroke();
    }
    return;
  }

  const spineTilt = rand(-0.55, 0.55, random);
  ctx.beginPath();
  ctx.moveTo(cx + Math.sin(spineTilt) * 14, cy - radius * 0.74);
  ctx.lineTo(cx - Math.sin(spineTilt) * 18, cy + radius * 0.74);
  ctx.stroke();

  const arms = 4 + Math.floor(random() * 4);
  for (let i = 0; i < arms; i += 1) {
    const y = cy - radius * 0.62 + ((i + 1) / (arms + 1)) * radius * 1.24;
    const dir = random() > 0.5 ? 1 : -1;
    const len = rand(24, 54, random);
    const rise = rand(-25, 25, random);
    ctx.beginPath();
    ctx.moveTo(cx + rand(-9, 9, random), y);
    ctx.lineTo(cx + dir * len, y + rise);
    if (random() > 0.45) {
      ctx.lineTo(cx + dir * (len * 0.5), y + rise + dir * rand(14, 24, random));
    }
    ctx.stroke();
  }
}

function createRuneTexture(seed: number, color: string, blur = 0) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new CanvasTexture(canvas);

  // Softly defocus close-to-camera runes for depth-of-field.
  if (blur > 0 && "filter" in ctx) ctx.filter = `blur(${blur}px)`;

  const random = mulberry32(seed);
  const cx = size / 2;
  const cy = size / 2;
  const radius = rand(58, 82, random);
  const strokeColor = new Color(color);
  const hotCore = "#f8fbff";
  const glyph = String.fromCodePoint(0x16a0 + Math.floor(random() * 80));
  const motif = Math.floor(random() * 4);

  ctx.clearRect(0, 0, size, size);
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  ctx.miterLimit = 8;

  for (let pass = 0; pass < 3; pass += 1) {
    const glow = [16, 7, 0][pass];
    const alpha = [0.24, 0.46, 1][pass];
    ctx.shadowBlur = glow;
    ctx.shadowColor = color;
    ctx.strokeStyle = pass === 2 ? hotCore : color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = [7, 3.4, 1.35][pass];
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${pass === 2 ? 84 : 90}px 'Segoe UI Historic', 'Noto Sans Runic', Georgia, serif`;
    ctx.fillStyle = pass === 2 ? hotCore : color;
    ctx.strokeStyle = pass === 2 ? hotCore : color;
    drawArcaneMotif(ctx, random, cx, cy, radius, glyph, motif, pass);

    const cuts = 2 + Math.floor(random() * 4);
    for (let i = 0; i < cuts; i += 1) {
      const angle = rand(-1.2, 1.2, random);
      const x = cx + rand(-58, 58, random);
      const y = cy + rand(-64, 64, random);
      const len = rand(13, 34, random);
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(angle) * len, y - Math.sin(angle) * len);
      ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      ctx.stroke();
    }

    for (let i = 0; i < 4; i += 1) {
      const markX = cx + rand(-70, 70, random);
      const markY = cy + rand(-74, 74, random);
      const mark = rand(4, 8, random);
      ctx.beginPath();
      ctx.moveTo(markX, markY - mark);
      ctx.lineTo(markX + mark, markY);
      ctx.lineTo(markX, markY + mark);
      ctx.lineTo(markX - mark, markY);
      ctx.closePath();
      ctx.fillStyle = pass === 2 ? hotCore : color;
      ctx.fill();
    }
  }

  ctx.globalAlpha = 0.22;
  ctx.shadowBlur = 4;
  ctx.shadowColor = color;
  ctx.strokeStyle = strokeColor.lerp(new Color("#ffffff"), 0.25).getStyle();
  ctx.lineWidth = 1.2;
  if (motif !== 2) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.84, 0, Math.PI * 2);
    ctx.stroke();
  }

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createGlowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new CanvasTexture(canvas);

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0.85)");
  gradient.addColorStop(0.32, "rgba(255,255,255,0.32)");
  gradient.addColorStop(0.7, "rgba(255,255,255,0.07)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createMistTexture(seed: number) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new CanvasTexture(canvas);

  const random = mulberry32(seed);
  const blobs = 26;

  for (let i = 0; i < blobs; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const r = rand(60, 190, random);
    const alpha = rand(0.05, 0.14, random);
    // Re-draw each blob at the 8 wrapped offsets so the texture tiles seamlessly.
    for (let ox = -1; ox <= 1; ox += 1) {
      for (let oy = -1; oy <= 1; oy += 1) {
        const bx = x + ox * size;
        const by = y + oy * size;
        if (bx + r < 0 || bx - r > size || by + r < 0 || by - r > size) continue;
        const gradient = ctx.createRadialGradient(bx, by, 0, bx, by, r);
        gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
        gradient.addColorStop(0.6, `rgba(255,255,255,${alpha * 0.45})`);
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(bx - r, by - r, r * 2, r * 2);
      }
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

interface MistLayerModel {
  texture: Texture;
  material: MeshBasicMaterial;
  z: number;
  speed: number;
  sway: number;
  phase: number;
  size: [number, number];
}

const MIST_TINTS = ["#4c1d95", "#1e1b4b", "#86198f", "#155e75"];

function MistLayers({ reducedMotion }: { reducedMotion: boolean }) {
  const layers = useMemo<MistLayerModel[]>(
    () =>
      Array.from({ length: 4 }, (_, index) => {
        const random = mulberry32(900 + index * 67);
        const texture = createMistTexture(431 + index * 53);
        return {
          texture,
          material: new MeshBasicMaterial({
            map: texture,
            color: MIST_TINTS[index % MIST_TINTS.length],
            transparent: true,
            opacity: rand(0.16, 0.27, random),
            blending: NormalBlending,
            depthWrite: false,
          }),
          z: -21.5 + index * 4.6,
          speed: rand(0.004, 0.011, random) * (index % 2 === 0 ? 1 : -1),
          sway: rand(0.25, 0.6, random),
          phase: rand(0, Math.PI * 2, random),
          size: [rand(58, 76, random), rand(26, 34, random)],
        };
      }),
    [],
  );

  useEffect(
    () => () => {
      layers.forEach((layer) => {
        layer.texture.dispose();
        layer.material.dispose();
      });
    },
    [layers],
  );

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const drift = reducedMotion ? 0.12 : 1;
    layers.forEach((layer) => {
      layer.texture.offset.x = elapsed * layer.speed * drift;
      layer.texture.offset.y = Math.sin(elapsed * 0.03 + layer.phase) * 0.04 * drift;
    });
  });

  return (
    <>
      {layers.map((layer, index) => (
        <mesh key={`mist-${index}`} position={[0, Math.sin(layer.phase) * 2.4, layer.z]} material={layer.material}>
          <planeGeometry args={layer.size} />
        </mesh>
      ))}
    </>
  );
}

function makeJaggedVectors(a: [number, number, number], b: [number, number, number], scale = 1) {
  const segments = 12 + Math.floor(Math.random() * 9);
  const points: number[] = [];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const falloff = Math.sin(t * Math.PI);
    const jag = i === 0 || i === segments ? 0 : rand(-0.62, 0.62) * falloff * scale;
    points.push(
      a[0] + dx * t + nx * jag,
      a[1] + dy * t + ny * jag,
      a[2] + (b[2] - a[2]) * t + rand(-0.24, 0.24) * falloff * scale,
    );
  }

  const vectors: Vector3[] = [];
  for (let i = 0; i < points.length; i += 3) {
    vectors.push(new Vector3(points[i], points[i + 1], points[i + 2]));
  }
  return vectors;
}

function updateBoltTube(tube: BoltTube, vectors: Vector3[], glowRadius: number, coreRadius: number) {
  const curve = new CatmullRomCurve3(vectors, false, "catmullrom", 0.05);
  const segments = Math.max(12, vectors.length * 3);
  tube.glow.geometry.dispose();
  tube.core.geometry.dispose();
  tube.glow.geometry = new TubeGeometry(curve, segments, glowRadius, 9, false);
  tube.core.geometry = new TubeGeometry(curve, segments, coreRadius, 7, false);
}

function makeBoltTube(glowRadius: number, coreRadius: number): BoltTube {
  const baseCurve = new CatmullRomCurve3([new Vector3(0, 0, -10), new Vector3(0.01, 0, -10)]);
  return {
    glow: new Mesh(
      new TubeGeometry(baseCurve, 2, glowRadius, 8, false),
      new MeshBasicMaterial({
        color: "#60a5fa",
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    ),
    core: new Mesh(
      new TubeGeometry(baseCurve, 2, coreRadius, 6, false),
      new MeshBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    ),
  };
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

function RuneScene({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<Group>(null);
  const runeRefs = useRef<Array<Sprite | null>>([]);
  const bolts = useRef<BoltState[]>([]);
  const nextStrike = useRef(2.4);
  const pointer = useRef({ x: 0, y: 0 });
  const smoothPointer = useRef({ x: 0, y: 0 });
  const { viewport } = useThree();

  const runeModels = useMemo<RuneModel[]>(() => {
    const count = 42;
    return Array.from({ length: count }, (_, index) => {
      const random = mulberry32(1200 + index * 31);
      const z = rand(-20, -3.2, random);
      const centerBias = random();
      let x = rand(-22, 22, random);
      let y = rand(-12, 12, random);

      if (centerBias < 0.58 && Math.abs(x) < 5.8 && Math.abs(y) < 3.4) {
        x += x < 0 ? -8.2 : 8.2;
        y += y < 0 ? -2.4 : 2.4;
      }

      const near = z > -6;
      const far = z < -14;
      const hue = pick(Object.keys(RUNE_COLORS) as RuneHue[], random);
      const scale = near ? rand(0.68, 1.08, random) : far ? rand(0.24, 0.48, random) : rand(0.42, 0.86, random);
      const opacity = near ? rand(0.2, 0.34, random) : far ? rand(0.18, 0.36, random) : rand(0.5, 0.82, random);
      const blur = near ? rand(1.6, 3.2, random) : 0;
      const color = RUNE_COLORS[hue];

      return {
        id: `rune-${index}`,
        position: [x, y, z],
        scale,
        opacity,
        blur,
        color,
        phase: rand(0, Math.PI * 2, random),
        drift: [rand(-0.08, 0.08, random), rand(-0.06, 0.08, random), rand(-0.025, 0.025, random)],
        spin: rand(-0.1, 0.1, random),
        pulseSpeed: rand(0.18, 0.55, random),
        texture: createRuneTexture(index + 1, color, blur),
      };
    });
  }, []);

  const flashTexture = useMemo(() => createGlowTexture(), []);

  const boltMeshes = useMemo<BoltMeshSet[]>(
    () =>
      Array.from({ length: 4 }, () => ({
        ...makeBoltTube(0.032, 0.006),
        branches: Array.from({ length: 3 }, () => makeBoltTube(0.014, 0.003)),
        flash: new Sprite(
          new SpriteMaterial({
            map: flashTexture,
            transparent: true,
            opacity: 0,
            blending: AdditiveBlending,
            depthWrite: false,
          }),
        ),
      })),
    [flashTexture],
  );

  useEffect(
    () => () => {
      runeModels.forEach((rune) => rune.texture.dispose());
      boltMeshes.forEach(({ glow, core }) => {
        glow.geometry.dispose();
        core.geometry.dispose();
        const glowMaterial = glow.material;
        const coreMaterial = core.material;
        if (Array.isArray(glowMaterial)) glowMaterial.forEach((item) => item.dispose());
        else glowMaterial.dispose();
        if (Array.isArray(coreMaterial)) coreMaterial.forEach((item) => item.dispose());
        else coreMaterial.dispose();
      });
      boltMeshes.forEach(({ branches, flash }) => {
        flash.material.dispose();
        branches.forEach(({ glow, core }) => {
          glow.geometry.dispose();
          core.geometry.dispose();
          glow.material.dispose();
          core.material.dispose();
        });
      });
      flashTexture.dispose();
    },
    [boltMeshes, runeModels, flashTexture],
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.current.y = (event.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onPointerMove);
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, []);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const parallaxStrength = reducedMotion ? 0 : 0.24;
    smoothPointer.current.x += (pointer.current.x - smoothPointer.current.x) * 0.035;
    smoothPointer.current.y += (pointer.current.y - smoothPointer.current.y) * 0.035;

    if (group.current) {
      group.current.position.x = smoothPointer.current.x * parallaxStrength;
      group.current.position.y = -smoothPointer.current.y * parallaxStrength * 0.55;
      group.current.rotation.y = smoothPointer.current.x * 0.025;
      group.current.rotation.x = smoothPointer.current.y * 0.012;
    }

    runeModels.forEach((rune, index) => {
      const sprite = runeRefs.current[index];
      if (!sprite) return;

      const pulse = 0.72 + Math.sin(elapsed * rune.pulseSpeed + rune.phase) * 0.28;
      const fade = 0.84 + Math.sin(elapsed * 0.12 + rune.phase * 1.9) * 0.16;
      const driftScale = reducedMotion ? 0.08 : 1;

      sprite.position.set(
        rune.position[0] + Math.sin(elapsed * 0.09 + rune.phase) * rune.drift[0] * 16 * driftScale,
        rune.position[1] + Math.cos(elapsed * 0.075 + rune.phase) * rune.drift[1] * 18 * driftScale,
        rune.position[2] + Math.sin(elapsed * 0.06 + rune.phase) * rune.drift[2] * 18 * driftScale,
      );
      sprite.material.opacity = rune.opacity * fade * pulse;
      sprite.material.rotation = rune.phase + elapsed * rune.spin * (reducedMotion ? 0.1 : 1);
    });

    if (!reducedMotion && elapsed > nextStrike.current) {
      const visible = runeModels
        .map((rune, index) => ({ rune, sprite: runeRefs.current[index], index }))
        .filter((item) => item.sprite && item.rune.position[2] < -4.5 && item.rune.position[2] > -18);
      const first = pick(visible);
      let candidates = visible.filter((item) => {
        if (!first?.sprite || !item.sprite || item.index === first.index) return false;
        const d = first.sprite.position.distanceTo(item.sprite.position);
        const midpointX = (first.sprite.position.x + item.sprite.position.x) / 2;
        const midpointY = (first.sprite.position.y + item.sprite.position.y) / 2;
        const crossesQuietCenter = Math.abs(midpointX) < 3.8 && Math.abs(midpointY) < 2.35;
        return d > 4.2 && d < 19 && !crossesQuietCenter;
      });
      if (first && candidates.length === 0) {
        candidates = visible.filter((item) => item.index !== first.index);
      }
      const second = candidates.length ? pick(candidates) : undefined;
      const boltIndex = bolts.current.length % 4;

      if (first?.sprite && second?.sprite) {
        const endpointA = first.sprite.position.toArray() as [number, number, number];
        const endpointB = second.sprite.position.toArray() as [number, number, number];
        const pair = boltMeshes[boltIndex];
        const vectors = makeJaggedVectors(endpointA, endpointB, 1.05);
        updateBoltTube(pair, vectors, 0.032, 0.006);

        pair.branches.forEach((branch, branchIndex) => {
          const anchor = vectors[2 + Math.floor(Math.random() * Math.max(1, vectors.length - 4))];
          const outward = new Vector3(
            rand(-1.6, 1.6),
            rand(-1.35, 1.35),
            rand(-0.42, 0.42),
          ).normalize();
          const branchLength = rand(0.9, 2.35) * (branchIndex % 2 === 0 ? 1 : -1);
          const end = anchor.clone().add(outward.multiplyScalar(branchLength));
          updateBoltTube(branch, makeJaggedVectors(anchor.toArray() as [number, number, number], end.toArray() as [number, number, number], 0.65), 0.014, 0.003);
        });

        pair.flash.position.set(
          (endpointA[0] + endpointB[0]) / 2,
          (endpointA[1] + endpointB[1]) / 2,
          (endpointA[2] + endpointB[2]) / 2 + 0.4,
        );
        const flashSize = rand(7, 11);
        pair.flash.scale.set(flashSize, flashSize, 1);

        bolts.current[boltIndex] = {
          boltIndex,
          born: elapsed,
          duration: rand(0.65, 1.15),
          color: pick(LIGHTNING_COLORS),
          endpointA,
          endpointB,
        };
      }
      nextStrike.current = elapsed + rand(3.2, 6.4);
    }

    for (const bolt of bolts.current) {
      const pair = boltMeshes[bolt.boltIndex];
      if (!pair) continue;
      const age = (elapsed - bolt.born) / bolt.duration;
      const glowMaterial = pair.glow.material;
      const coreMaterial = pair.core.material;

      if (age >= 1) {
        glowMaterial.opacity = 0;
        coreMaterial.opacity = 0;
        pair.flash.material.opacity = 0;
        pair.branches.forEach((branch) => {
          branch.glow.material.opacity = 0;
          branch.core.material.opacity = 0;
        });
        continue;
      }

      const crackle = 0.62 + Math.random() * 0.38;
      const opacity = Math.pow(1 - age, 1.8) * crackle;
      glowMaterial.color.set(bolt.color);
      coreMaterial.color.set("#ffffff");
      glowMaterial.opacity = opacity * 0.9;
      coreMaterial.opacity = Math.min(0.92, opacity * 1.35);
      // Brief wash of light over nearby mist and runes while the bolt lives.
      pair.flash.material.color.set(bolt.color);
      pair.flash.material.opacity = Math.pow(1 - age, 2.6) * 0.4;
      pair.branches.forEach((branch, branchIndex) => {
        const branchFalloff = branchIndex % 2 === 0 ? 0.58 : 0.42;
        branch.glow.material.color.set(bolt.color);
        branch.core.material.color.set("#ffffff");
        branch.glow.material.opacity = opacity * branchFalloff * 0.72;
        branch.core.material.opacity = opacity * branchFalloff;
      });
    }
  });

  return (
    <>
      <color attach="background" args={["#030714"]} />
      <fog attach="fog" args={["#09021c", 8, 28]} />
      <ambientLight color="#5b21b6" intensity={0.28} />
      <pointLight color="#ec4899" intensity={1.25} distance={24} position={[-8, 5, -5]} />
      <pointLight color="#22d3ee" intensity={1.15} distance={26} position={[7, -3, -8]} />
      <pointLight color="#f59e0b" intensity={0.75} distance={18} position={[0, 5, -9]} />

      <group ref={group}>
        {runeModels.map((rune, index) => (
          <sprite
            key={rune.id}
            ref={(node) => {
              runeRefs.current[index] = node;
            }}
            position={rune.position}
            scale={[rune.scale, rune.scale, 1]}
          >
            <spriteMaterial
              map={rune.texture}
              color={rune.color}
              transparent
              opacity={rune.opacity}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </sprite>
        ))}

        {boltMeshes.flatMap(({ glow, core, flash }, index) => (
          [
            <primitive key={`bolt-glow-${index}`} object={glow} />,
            <primitive key={`bolt-core-${index}`} object={core} />,
            <primitive key={`bolt-flash-${index}`} object={flash} />,
          ]
        ))}
        {boltMeshes.flatMap(({ branches }, index) =>
          branches.flatMap((branch, branchIndex) => [
            <primitive key={`bolt-branch-glow-${index}-${branchIndex}`} object={branch.glow} />,
            <primitive key={`bolt-branch-core-${index}-${branchIndex}`} object={branch.core} />,
          ]),
        )}
      </group>

      <MistLayers reducedMotion={reducedMotion} />

      <Sparkles count={110} scale={[24, 13, 16]} size={1.25} speed={0.18} opacity={0.45} color="#67e8f9" />
      <Sparkles count={55} scale={[20, 10, 14]} size={1.8} speed={0.12} opacity={0.36} color="#f59e0b" />

      <mesh position={[0, 0, -24]} scale={[viewport.width * 1.8, viewport.height * 1.8, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#070118" transparent opacity={0.7} depthWrite={false} />
      </mesh>

      <EffectComposer multisampling={0}>
        <Bloom intensity={1.75} luminanceThreshold={0.08} luminanceSmoothing={0.42} mipmapBlur />
      </EffectComposer>
    </>
  );
}

export function RunicBackground() {
  const reducedMotion = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
      style={{
        background:
          "radial-gradient(circle at 20% 18%, rgba(14,116,144,.08), transparent 44%), radial-gradient(circle at 82% 76%, rgba(91,33,182,.07), transparent 48%), linear-gradient(135deg, #020617 0%, #050214 48%, #0b0314 100%)",
      }}
    >
      {mounted && (
        <Canvas
          camera={{ position: [0, 0, 9.5], fov: 72 }}
          dpr={[1, 1.75]}
          gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
          style={{ height: "100%", width: "100%" }}
        >
          <Suspense fallback={null}>
            <RuneScene reducedMotion={reducedMotion} />
          </Suspense>
        </Canvas>
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 44%, rgba(2,6,23,0) 0%, rgba(2,6,23,.04) 44%, rgba(2,6,23,.36) 100%), linear-gradient(180deg, rgba(2,6,23,.04), rgba(2,6,23,.26))",
        }}
      />
    </div>
  );
}
