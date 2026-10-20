"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { AdaptiveDpr } from "@/shared/lib/AdaptiveDpr";
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
import { StageEnvironment } from "@/shared/puppets/kit";

/**
 * The single persistent full-screen canvas behind the series page.
 * Composition only; each child owns one concern and reads `runtime.frame`.
 */
export default function SeriesStage() {
  const quality = useUI((s) => s.quality);
  const maxDpr = quality === "low" ? 1.25 : 1.5;
  // MSAA only pays off on 1x screens; on dense displays the extra pixels already smooth edges.
  const msaa = quality === "high" && typeof window !== "undefined" && window.devicePixelRatio < 1.5;
  return (
    <div className="fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        dpr={[1, maxDpr]}
        gl={{ antialias: msaa, powerPreference: "high-performance", alpha: false }}
        camera={{ position: [0, 1.6, 0.6], fov: 26, near: 0.01, far: 200 }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.outputColorSpace = SRGBColorSpace;
        }}
      >
        <AdaptiveDpr min={1} max={maxDpr} />
        <SeriesDirector />
        <CameraRig />
        <StageLights />
        <Suspense fallback={null}>
          {/* Reflections for chrome / lamé / bronze puppets (Lightformers only, no HDR download). */}
          <StageEnvironment />
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
