"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { useUI } from "@/shared/state/store";
import { SeriesDirector } from "./SeriesDirector";
import { CameraRig } from "./CameraRig";
import { StageLights } from "./StageLights";
import { Backdrop } from "./Backdrop";
import { ChapterWord } from "./ChapterWord";
import { IrisOverlay } from "./IrisOverlay";
import { Hero } from "./Hero";
import { Cast } from "./Cast";
import { GiantFace } from "./GiantFace";
import { ParticleRings } from "./ParticleRings";
import { Starfield } from "./Starfield";
import { RippleGrid } from "./RippleGrid";
import { Shockwave } from "./Shockwave";

/**
 * The single persistent full-screen canvas behind the series page.
 * Composition only; each child owns one concern and reads `runtime.frame`.
 */
export default function SeriesStage() {
  const quality = useUI((s) => s.quality);
  const paused = useUI((s) => s.paused);
  return (
    <div className="fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        dpr={[1, quality === "low" ? 1.5 : 2]}
        gl={{ antialias: quality === "high", powerPreference: "high-performance", alpha: false }}
        camera={{ position: [0, 1.6, 0.6], fov: 26, near: 0.01, far: 200 }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.outputColorSpace = SRGBColorSpace;
        }}
        frameloop={paused ? "demand" : "always"}
      >
        <SeriesDirector />
        <CameraRig />
        <StageLights />
        <Suspense fallback={null}>
          <Backdrop />
          <ChapterWord />
        </Suspense>
        <Starfield />
        <Hero />
        <Cast />
        <GiantFace />
        <ParticleRings />
        <RippleGrid />
        <Shockwave />
        <IrisOverlay />
      </Canvas>
    </div>
  );
}
