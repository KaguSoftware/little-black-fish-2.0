/**
 * Smoothed hero stage position shared by the light rig pieces (lights, cone, pool,
 * blob shadow) so they all move as one. Written once per frame by StageLights.
 */
export const stageState = {
  x: 0,
  z: 0,
  /** True after the first frame snapped to the hero. */
  init: false,
};
