import {
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
  type WebGLRenderer,
} from "three";
import { TELLERS } from "@/shared/content/characters";
import { stillPlate } from "@/shared/content/stills";
import type { TellerId } from "@/shared/content/types";

const ANISOTROPY = 4;

export interface PlateEntry {
  tex: Texture;
  /** width / height of the loaded image. */
  aspect: number;
}

/**
 * Manual (non-suspense) plate texture cache keyed by URL. Owns the textures it loads
 * and disposes them in `dispose()`.
 */
export class PlateLibrary {
  private loader = new TextureLoader();
  private loaded = new Map<string, PlateEntry>();
  private pending = new Set<string>();
  private failed = new Set<string>();
  private dead = false;

  constructor(private gl: WebGLRenderer | null) {}

  /** Loaded entry or undefined (no allocation). */
  get(url: string): PlateEntry | undefined {
    return this.loaded.get(url);
  }

  request(url: string) {
    if (this.dead || this.loaded.has(url) || this.pending.has(url) || this.failed.has(url)) return;
    this.pending.add(url);
    this.loader.load(
      url,
      (tex) => {
        this.pending.delete(url);
        if (this.dead) {
          tex.dispose();
          return;
        }
        tex.colorSpace = SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = LinearMipmapLinearFilter;
        tex.anisotropy = ANISOTROPY;
        tex.needsUpdate = true;
        const img = tex.image as { width: number; height: number };
        const aspect = img && img.height > 0 ? img.width / img.height : 16 / 9;
        try {
          // Upload now so the first crossfade onto this plate doesn't hitch.
          this.gl?.initTexture(tex);
        } catch {
          /* uploaded lazily on first use */
        }
        this.loaded.set(url, { tex, aspect });
      },
      undefined,
      () => {
        this.pending.delete(url);
        this.failed.add(url);
      },
    );
  }

  /** Request every plate of every teller whose assets have been requested (lazy-load rule). */
  requestForTellers(requested: Partial<Record<TellerId, true>>) {
    for (const t of TELLERS) {
      if (!requested[t.id]) continue;
      for (const id of Object.values(t.plates)) if (id) this.request(stillPlate(id));
    }
  }

  dispose() {
    this.dead = true;
    for (const e of this.loaded.values()) e.tex.dispose();
    this.loaded.clear();
    this.pending.clear();
  }
}
