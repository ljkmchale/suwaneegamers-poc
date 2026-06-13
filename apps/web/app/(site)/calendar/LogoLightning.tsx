"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

// Inner edges of each wing — the sides that face each other across the open
// gap above the dragon's back.  x stays in 0.27–0.34 / 0.64–0.72 range.
const LEFT_WING_TIPS: Array<[number, number]> = [
  [0.30, 0.11],
  [0.32, 0.17],
  [0.27, 0.14],
  [0.33, 0.21],
];
const RIGHT_WING_TIPS: Array<[number, number]> = [
  [0.68, 0.10],
  [0.66, 0.16],
  [0.71, 0.13],
  [0.64, 0.20],
];

const BOLT_COLORS = ["#60a5fa", "#8b5cf6", "#ec4899", "#f59e0b", "#ffffff"];

interface Point { x: number; y: number; }

interface LightningStrike {
  main: Point[];
  branches: Point[][];
  color: string;
  born: number;
  duration: number;
  lastJitter: number;
  a: Point;
  b: Point;
}

function rand(min: number, max: number) { return min + Math.random() * (max - min); }
function pick<T>(items: T[]): T { return items[Math.floor(Math.random() * items.length)]; }

function makeBoltPath(a: Point, b: Point, jag: number, bow: number): Point[] {
  const segments = 9 + Math.floor(Math.random() * 5);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny =  dx / len;
  return Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments;
    const falloff = Math.sin(t * Math.PI);
    const offset = i === 0 || i === segments ? 0 : rand(-jag, jag) * falloff;
    return {
      x: a.x + dx * t + nx * offset,
      y: a.y + dy * t + ny * offset - bow * falloff,
    };
  });
}

function makeBranches(path: Point[], cw: number, ch: number): Point[][] {
  return Array.from({ length: 1 + Math.floor(Math.random() * 2) }, () => {
    const anchor = path[2 + Math.floor(Math.random() * Math.max(1, path.length - 4))];
    const end: Point = {
      x: anchor.x + rand(-0.06, 0.06) * cw,
      y: anchor.y - rand(0.01, 0.05) * ch,
    };
    return makeBoltPath(anchor, end, ch * 0.028, 0);
  });
}

function strokePath(ctx: CanvasRenderingContext2D, points: Point[]) {
  ctx.beginPath();
  points.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
  ctx.stroke();
}

function drawLightningStrike(ctx: CanvasRenderingContext2D, strike: LightningStrike, now: number): boolean {
  const age = (now - strike.born) / strike.duration;
  if (age >= 1) return false;

  if (now - strike.lastJitter > 55) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    strike.main = makeBoltPath(strike.a, strike.b, h * 0.028, h * rand(0.005, 0.022));
    strike.branches = makeBranches(strike.main, w, h);
    strike.lastJitter = now;
  }

  const h = ctx.canvas.height;
  const fade = Math.pow(1 - age, 1.6) * rand(0.7, 1);
  const scale = h / 220;

  const mid = strike.main[Math.floor(strike.main.length / 2)];
  const fr = ctx.canvas.height * 0.22;
  const flash = ctx.createRadialGradient(mid.x, mid.y, 0, mid.x, mid.y, fr);
  flash.addColorStop(0, strike.color);
  flash.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = fade * 0.22;
  ctx.fillStyle = flash;
  ctx.fillRect(mid.x - fr, mid.y - fr, fr * 2, fr * 2);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const { path, ws, alpha } of [
    { path: strike.main, ws: 1, alpha: 1 },
    ...strike.branches.map((b) => ({ path: b, ws: 0.55, alpha: 0.6 })),
  ]) {
    ctx.shadowColor = strike.color;
    ctx.shadowBlur  = 14 * scale;
    ctx.strokeStyle = strike.color;
    ctx.globalAlpha = fade * 0.85 * alpha;
    ctx.lineWidth   = 4 * scale * ws;
    strokePath(ctx, path);

    ctx.shadowBlur  = 4 * scale;
    ctx.strokeStyle = "#ffffff";
    ctx.globalAlpha = Math.min(1, fade * 1.25) * alpha;
    ctx.lineWidth   = 1.4 * scale * ws;
    strokePath(ctx, path);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;
  return true;
}

export interface LogoLightningProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}

export function LogoLightning({ src, alt, width, height, className, priority }: LogoLightningProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas  = canvasRef.current;
    if (!wrapper || !canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let disposed = false;
    let frame    = 0;
    let currentStrike: LightningStrike | null = null;
    let lightningTimer: number;

    function fitCanvas() {
      const rect = wrapper!.getBoundingClientRect();
      const dpr  = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width  = Math.max(1, Math.round(rect.width  * dpr));
      canvas!.height = Math.max(1, Math.round(rect.height * dpr));
    }

    function loop(now: number) {
      if (disposed || !canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (currentStrike) {
        const alive = drawLightningStrike(ctx, currentStrike, now);
        if (!alive) currentStrike = null;
      }

      if (currentStrike !== null) {
        frame = requestAnimationFrame(loop);
      } else {
        frame = 0;
      }
    }

    function ensureLoop() {
      if (frame === 0 && !disposed) frame = requestAnimationFrame(loop);
    }

    function spawnLightning() {
      if (disposed || !canvas) return;
      fitCanvas();
      const w = canvas.width;
      const h = canvas.height;
      const left  = pick(LEFT_WING_TIPS);
      const right = pick(RIGHT_WING_TIPS);
      const a: Point = { x: left[0]  * w, y: left[1]  * h };
      const b: Point = { x: right[0] * w, y: right[1] * h };
      const main = makeBoltPath(a, b, h * 0.028, h * rand(0.005, 0.022));
      currentStrike = {
        main,
        branches:     makeBranches(main, w, h),
        color:        pick(BOLT_COLORS),
        born:         performance.now(),
        duration:     rand(380, 620),
        lastJitter:   0,
        a, b,
      };
      ensureLoop();
      lightningTimer = window.setTimeout(spawnLightning, rand(3500, 8000));
    }

    lightningTimer = window.setTimeout(spawnLightning, rand(2000, 5000));

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      clearTimeout(lightningTimer);
    };
  }, []);

  return (
    <div ref={wrapperRef} className={`relative ${className ?? ""}`} style={{ width, height }}>
      <Image src={src} alt={alt} width={width} height={height} priority={priority} />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ mixBlendMode: "screen" }}
      />
    </div>
  );
}
