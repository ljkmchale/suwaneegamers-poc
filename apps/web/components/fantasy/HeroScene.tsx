"use client";

import { Canvas } from "@react-three/fiber";
import { Stars, Float, Sparkles } from "@react-three/drei";
import { Suspense } from "react";

function FloatingRune({ position }: { position: [number, number, number] }) {
  return (
    <Float speed={2} rotationIntensity={1.5} floatIntensity={2}>
      <mesh position={position}>
        <torusGeometry args={[0.3, 0.05, 8, 32]} />
        <meshStandardMaterial
          color="#8b5cf6"
          emissive="#8b5cf6"
          emissiveIntensity={0.8}
          transparent
          opacity={0.6}
        />
      </mesh>
    </Float>
  );
}

function Scene() {
  return (
    <>
      {/* Ambient light */}
      <ambientLight intensity={0.2} color="#4a0080" />

      {/* Key light from above — warm arcane glow */}
      <pointLight position={[0, 10, 0]} color="#8b5cf6" intensity={2} distance={50} />

      {/* Fill from below — ghostly blue */}
      <pointLight position={[0, -8, 4]} color="#1e3a8a" intensity={1} distance={30} />

      {/* Stars background */}
      <Stars
        radius={80}
        depth={50}
        count={3000}
        factor={4}
        saturation={0.4}
        fade
        speed={0.3}
      />

      {/* Gold sparkles */}
      <Sparkles
        count={80}
        scale={[20, 12, 12]}
        size={1.5}
        speed={0.3}
        opacity={0.5}
        color="#f59e0b"
      />

      {/* Purple sparkles */}
      <Sparkles
        count={60}
        scale={[16, 10, 10]}
        size={1.2}
        speed={0.4}
        opacity={0.4}
        color="#8b5cf6"
      />

      {/* Floating rune rings */}
      <FloatingRune position={[-4, 2, -5]} />
      <FloatingRune position={[4, -1, -6]} />
      <FloatingRune position={[0, 3, -8]} />

      {/* Ground fog plane */}
      <mesh position={[0, -5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial
          color="#120a2e"
          transparent
          opacity={0.3}
        />
      </mesh>
    </>
  );
}

export function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 60 }}
      style={{ background: "transparent" }}
      gl={{ alpha: true, antialias: true }}
    >
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  );
}
