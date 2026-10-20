"use client";

import { Environment, Lightformer } from "@react-three/drei";

/**
 * A dark studio built from Lightformers only (no HDR download). It exists so chrome,
 * lamé, bronze and wet-looking surfaces reflect something interesting: one big soft
 * key panel overhead, a thin strip for a long chrome streak, and faint warm / cool rims.
 *
 * Mount ONE of these per canvas (the stage owner and PuppetLab do; Hero/Cast do not).
 * `intensity` scales how much the environment lights everything (keep it low: the
 * stage lights do the real work).
 */
export function StageEnvironment({ intensity = 0.55, resolution = 256 }: { intensity?: number; resolution?: number }) {
  return (
    <Environment resolution={resolution} frames={1} environmentIntensity={intensity}>
      <color attach="background" args={["#07070a"]} />
      {/* soft key panel above and slightly front */}
      <Lightformer form="rect" intensity={3.2} color="#fff4e6" position={[0, 7, 2]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 5, 1]} />
      {/* thin strip: long vertical streak in chrome */}
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[-4.5, 2.5, 3]} rotation={[0, Math.PI / 3.2, 0]} scale={[0.5, 7, 1]} />
      {/* faint warm rim, back left */}
      <Lightformer form="rect" intensity={1.6} color="#ff9a5e" position={[-6, 2.5, -5]} rotation={[0, Math.PI / 4, 0]} scale={[3, 6, 1]} />
      {/* faint cool rim, back right */}
      <Lightformer form="rect" intensity={1.6} color="#6fa4ff" position={[6, 2.5, -5]} rotation={[0, -Math.PI / 4, 0]} scale={[3, 6, 1]} />
      {/* dim floor bounce */}
      <Lightformer form="rect" intensity={0.35} color="#8a7f73" position={[0, -3.5, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[12, 12, 1]} />
      {/* a small hot ring for a pinpoint highlight */}
      <Lightformer form="ring" intensity={4} color="#ffffff" position={[3, 3.5, 4]} scale={0.9} target={[0, 1, 0]} />
    </Environment>
  );
}
