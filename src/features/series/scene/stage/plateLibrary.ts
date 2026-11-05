import {
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
  type WebGLRenderer,
} from "three";
import { TELLERS } from "@/shared/content/characters";
import { tellerView } from "@/shared/content/roster";
import { plateSrc, stillPlate } from "@/shared/content/stills";
import { isImageRef } from "@/shared/lib/imageUrl";
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
  /** Built-in plate to show instead of a custom one that failed to load. */
  private fallbacks = new Map<string, string | null>();
  private dead = false;

  constructor(private gl: WebGLRenderer | null) {}

  /** Loaded entry or undefined (no allocation). */
  get(url: string): PlateEntry | undefined {
    const e = this.loaded.get(url);
    if (e || !this.failed.has(url)) return e;
    const fb = this.fallbackFor(url);
    if (!fb) return undefined;
    this.request(fb);
    return this.loaded.get(fb);
  }

  /** The teller's own built-in still for a custom plate that cannot be loaded (broken or unreachable link). */
  private fallbackFor(url: string): string | null {
    const known = this.fallbacks.get(url);
    if (known !== undefined) return known;
    let found: string | null = null;
    for (const t of TELLERS) {
      for (const [chapter, ref] of Object.entries(tellerView(t.id).plates)) {
        if (!ref || !isImageRef(ref) || plateSrc(ref) !== url) continue;
        const base = (t.plates as Record<string, string | undefined>)[chapter];
        if (base) found = stillPlate(base as Parameters<typeof stillPlate>[0]);
      }
    }
    this.fallbacks.set(url, found);
    return found;
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
      for (const ref of Object.values(tellerView(t.id).plates)) if (ref) this.request(plateSrc(ref));
    }
  }

  dispose() {
    this.dead = true;
    for (const e of this.loaded.values()) e.tex.dispose();
    this.loaded.clear();
    this.pending.clear();
  }
}
