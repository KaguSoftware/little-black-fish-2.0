import {
  CapsuleGeometry, Color, ConeGeometry, Group, Mesh, MeshStandardMaterial, Object3D, SphereGeometry,
  BoxGeometry,
} from "three";
import type { TellerId } from "../../content/types";
import type { BuildOptions, Puppet } from "../types";

/**
 * TEMPORARY placeholder puppet used until the wave-2 builders replace each file
 * in `builds/`. It honours the full rig contract so every system can be developed
 * against it: robe cone, torso, head with a flat mask, eyes with pupils + lids, jaw.
 */
export function placeholderPuppet(id: TellerId, opts: BuildOptions, tint = "#888"): Puppet {
  const object = new Group();
  object.name = `puppet-${id}`;
  const root = new Group();
  object.add(root);

  const robeMat = new MeshStandardMaterial({ color: new Color(tint).multiplyScalar(0.35), roughness: 0.85 });
  const maskMat = new MeshStandardMaterial({ color: new Color(tint), roughness: 0.45, metalness: 0.1 });
  const eyeWhite = new MeshStandardMaterial({ color: "#d9d4c7", roughness: 0.3 });
  const pupilMat = new MeshStandardMaterial({ color: "#080808", roughness: 0.2 });
  const skin = new MeshStandardMaterial({ color: "#8a6f5c", roughness: 0.7 });

  const robe = new Mesh(new ConeGeometry(0.42, 1.25, 24, 1, true), robeMat);
  robe.position.y = 0.62;
  root.add(robe);

  const body = new Group();
  body.position.y = 0.95;
  root.add(body);
  const torso = new Mesh(new CapsuleGeometry(0.2, 0.45, 6, 16), robeMat);
  torso.position.y = 0.25;
  body.add(torso);

  const head = new Group();
  head.position.y = 0.62;
  body.add(head);
  const skull = new Mesh(new SphereGeometry(0.15, 24, 16), skin);
  skull.position.y = 0.14;
  head.add(skull);

  const face = new Group();
  face.position.set(0, 0.14, 0.12);
  head.add(face);
  const mask = new Mesh(new BoxGeometry(0.26, 0.32, 0.04), maskMat);
  face.add(mask);

  const makeEye = (x: number) => {
    const g = new Group();
    g.position.set(x, 0.04, 0.02);
    face.add(g);
    const white = new Mesh(new SphereGeometry(0.03, 16, 12), eyeWhite);
    g.add(white);
    const pupil = new Mesh(new SphereGeometry(0.014, 12, 8), pupilMat);
    pupil.position.z = 0.022;
    g.add(pupil);
    const lid = new Mesh(new SphereGeometry(0.033, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), maskMat);
    lid.rotation.x = 0.4;
    g.add(lid);
    const anchor = new Object3D();
    anchor.position.z = 0.03;
    g.add(anchor);
    return { pupil, lid, anchor };
  };
  const L = makeEye(0.06);
  const R = makeEye(-0.06);

  const jaw = new Group();
  jaw.position.set(0, -0.06, 0.02);
  face.add(jaw);
  const chin = new Mesh(new BoxGeometry(0.2, 0.08, 0.04), maskMat);
  chin.position.y = -0.05;
  jaw.add(chin);

  const handMat = skin;
  const handL = new Mesh(new SphereGeometry(0.05, 12, 8), handMat);
  handL.position.set(0.32, 0.95, 0.05);
  root.add(handL);
  const handR = handL.clone();
  handR.position.x = -0.32;
  root.add(handR);
  const footL = new Mesh(new BoxGeometry(0.1, 0.06, 0.2), robeMat);
  footL.position.set(0.12, 0.03, 0.05);
  root.add(footL);
  const footR = footL.clone();
  footR.position.x = -0.12;
  root.add(footR);

  return {
    id,
    object,
    rig: {
      root, body, head, jaw, handL, handR, footL, footR,
      pupilL: L.pupil, pupilR: R.pupil, lidL: L.lid, lidR: R.lid,
      eyeAnchorL: L.anchor, eyeAnchorR: R.anchor, face,
    },
    limits: {
      headYaw: 0.6, headPitch: 0.35, pupil: { x: 0.012, y: 0.008 },
      lidNeutral: 0, lidOpen: -0.6, lidClosed: 1.1, jawOpen: 0.5, gait: "biped", stride: 0.45,
    },
    height: 1.8,
    waistY: 0.95,
    update() {},
    dispose() {
      object.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
      [robeMat, maskMat, eyeWhite, pupilMat, skin].forEach((m) => m.dispose());
    },
  };
}
