SHAHNAMEH CAST, FINAL 3D MODELS
================================

models/        7 game-ready .glb files (+Y up, metres, no Draco, PBR textures embedded,
               losslessly optimized: meshopt geometry + WebP hair/fur maps, see OPTIMIZATION below)
renders/       Cycles turnarounds (front, 3/4, side, back), front images, Eblis mask close-up
threejs/       shahnameh-stage.js (realtime viewer setup) + env/hall.jpg (Eblis mask reflection)
blender-pipeline.zip   all Blender scripts used to build, bake, render and export

MODELS
------
Character         Triangles   Materials
Arnavaz           77,472      FeltVest, HairCards, Linen, Mask, Silver, Skin
Shahrnaz          77,474      Bib, BlackTweed, Bronze, HairCards, Leather, Mask, Skin
Eblis             77,488      ChromeGlass, FurCards, HairCards, Lame, Linen, Skin
Zahhak            77,484      Crown, HairCards, Mask, Skin, Snake, StaffWood, Velvet
Siyamak           77,481      HairCards, Jacket, Mask, SkinLower, SkinUpper
Keyumars          77,492      HairCards, Knit, Leather, Skin, Staff, StoneMask
Jamshid's horse   76,784      FurBody, FurCards, HornEye, Saddle, Skin

Every material has a 2048 texture set: base colour, normal, roughness, metallic, AO.
Hierarchy, object names, joints and left/right separation are kept from the originals.

THREE.JS
--------
import { createStage } from './shahnameh-stage.js';
createStage(el, 'models/eblis.glb', { reflections: { ChromeGlass: { url: 'env/hall.jpg' } } });
Needs: three (0.160 or newer), postprocessing, n8ao.
The loader must have the meshopt decoder set (shahnameh-stage.js already does this):
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)   // from 'three/addons/libs/meshopt_decoder.module.js'
A .glb cannot carry its own reflection image, so the hall is added by the viewer.

LATEST CHANGES (Eblis)
----------------------
- Chrome mask reflects the palace hall.
- Back hair rebuilt: flows from the centre part over the crown and the mask top, lies on the cloak,
  hip length with ragged tapered tips, clumped strands, darker oxblood colour. Same triangle count.

OPTIMIZATION (lossless)
-----------------------
192 MB -> 136 MB total (-29%). Nothing visual changed; every texture pixel and every vertex value is identical
to the Blender export (checked file-by-file, and by rendering original vs optimized side by side).
- Hair/fur base colour PNGs -> lossless WebP (EXT_texture_webp), same pixels incl. colour under transparent areas.
- JPEG textures repacked losslessly (optimised Huffman tables, progressive), same pixels.
- Geometry stored with EXT_meshopt_compression, no quantization, original triangle order.
- Hierarchy, object/material names, transforms and extras unchanged.
Any loader that reads these files needs meshopt support (three.js GLTFLoader + MeshoptDecoder,
Babylon, model-viewer, gltf-transform all support it). WebP works in every current browser.
