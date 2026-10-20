import type { TellerId } from "../content/types";
import type { PuppetBuilder } from "./types";

/**
 * Code-split puppet builders. Only the requested teller's builder is downloaded.
 * Each module default-exports a PuppetBuilder.
 */
export const PUPPET_LOADERS: Record<TellerId, () => Promise<{ default: PuppetBuilder }>> = {
  child: () => import("./builds/child"),
  elder: () => import("./builds/elder"),
  "snake-king": () => import("./builds/snakeKing"),
  "silver-one": () => import("./builds/silverOne"),
  "masked-lady": () => import("./builds/maskedLady"),
  creature: () => import("./builds/creature"),
};
