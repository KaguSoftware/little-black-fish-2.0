"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Box3, Color, Group, Material, Mesh, Object3D, Vector3, type MeshStandardMaterial } from "three";
import { MOODS } from "@/shared/content/moods";
import type { TellerId } from "@/shared/content/types";
import { clamp, smoothstep } from "@/shared/lib/math";
import { runtime } from "@/shared/lib/runtime";
import { makeRigInputs, usePuppetRig } from "@/shared/puppets/rig/usePuppetRig";
import { useTellerPuppet } from "@/shared/puppets/rig/useTellerPuppet";
import type { RigInputs } from "@/shared/puppets/types";
import { useSeries, useUI } from "@/shared/state/store";

/**
 * THE DAY: a vast, faint, furious copy of the hero's face looming in the sky behind the stage,
 * chomping. It is a DEDICATED puppet instance (so the hero is untouched) with everything
 * outside `rig.face` hidden and every face material swapped for a transparent ghost clone.
 * Built ahead of time during MY WORLD..WHAT I DID so THE DAY has no hitch; visible only while
 * fx.day > 0.01, opacity 0.06..0.15 growing with fx.day.
 */

/** Height of the face on screen-space terms: metres tall at the giant's distance. */
const FACE_HEIGHT = 6.5;
const POS_Y = 6;
const POS_Z = -18;

export function GiantFace() {
  const teller = useSeries((s) => s.teller);
  const chapter = useSeries((s) => s.chapter);
  const armed = chapter === "world" || chapter === "day" || chapter === "did";
  return armed ? <Giant key={teller} id={teller} /> : null;
}

function Giant({ id }: { id: TellerId }) {
  const puppet = useTellerPuppet(id, { quality: "low" });
  const group = useRef<Group>(null);
  const ghosts = useRef<Material[]>([]);
  const faceLocal = useRef(new Vector3());
  const faceSize = useRef(0.3);
  const ready = useRef(false);

  const inputs = useMemo<RigInputs>(() => {
    const i = makeRigInputs();
    i.mood = MOODS.angry;
    i.hero = false;
    i.quality = "low";
    i.lookAt = runtime.frame.camera.pos;
    return i;
  }, []);

  // Isolate the face and swap in ghost materials.
  useEffect(() => {
    if (!puppet) return;
    const face = puppet.rig.face;
    const keep = new Set<Object3D>();
    face.traverse((o) => keep.add(o));
    const created: Material[] = [];
    const tint = new Color(runtime.frame.accent[0], runtime.frame.accent[1], runtime.frame.accent[2]);
    puppet.object.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      if (!keep.has(o)) {
        mesh.visible = false;
        return;
      }
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = -4;
      const swap = (m: Material): Material => {
        const g = m.clone() as MeshStandardMaterial;
        g.transparent = true;
        g.opacity = 0;
        g.depthWrite = false;
        g.alphaTest = 0;
        g.clippingPlanes = null;
        if (g.color) g.color.multiplyScalar(0.8);
        if (g.emissive) {
          g.emissive.copy(tint).multiplyScalar(0.9);
          g.emissiveIntensity = Math.max(g.emissiveIntensity ?? 0, 0.55);
        }
        created.push(g);
        return g;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    });
    ghosts.current = created;
    // measure the face once, at rest
    puppet.object.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(face);
    box.getCenter(faceLocal.current);
    faceSize.current = Math.max(box.max.y - box.min.y, 0.05);
    ready.current = true;
    return () => {
      ready.current = false;
      created.forEach((m) => m.dispose());
      ghosts.current = [];
    };
  }, [puppet]);

  usePuppetRig(puppet, () => {
    const f = runtime.frame;
    const ui = useUI.getState();
    const i = inputs;
    const day = f.fx.day;
    const g = group.current;
    // face the camera
    const gx = g ? g.position.x : 0;
    i.rotY = Math.atan2(f.camera.pos.x - gx, f.camera.pos.z - POS_Z) * 0.8;
    i.x = 0;
    i.z = 0;
    i.walk = 0;
    i.stride = 0;
    i.anger = clamp(Math.max(0.85, day), 0, 1);
    i.surprise = 0;
    i.talking = 0;
    i.wave = 0;
    i.pupils.x = 0;
    i.pupils.y = 0;
    i.frozen = ui.paused || ui.reducedMotion || day < 0.01;
    return i;
  }, () => group.current?.visible === true);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const f = runtime.frame;
    const day = f.fx.day;
    const show = !!puppet && ready.current && day > 0.01;
    g.visible = show;
    if (!show || !puppet) return;
    const opacity = (0.06 + 0.09 * clamp(day, 0, 1)) * smoothstep(0, 0.12, day);
    const gh = ghosts.current;
    for (let k = 0; k < gh.length; k++) gh[k].opacity = opacity;
    const breathe = 1 + Math.sin(f.time * 0.55) * 0.03 + day * 0.04;
    const s = (FACE_HEIGHT / faceSize.current) * breathe;
    g.scale.setScalar(s);
    const fl = faceLocal.current;
    g.position.set(f.hero.x * 0.42 - fl.x * s, POS_Y - fl.y * s, POS_Z - fl.z * s);
  }, -30);

  return <group ref={group}>{puppet ? <primitive object={puppet.object} /> : null}</group>;
}
