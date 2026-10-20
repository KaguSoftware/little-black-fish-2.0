/**
 * The one global pointer, written by Providers. Lives apart from `runtime.ts` (which pulls in
 * three.js) so pages without a 3D scene don't ship three just to track the cursor.
 * `runtime.pointer` is this same object. `fine` is false while the last input was a touch.
 */
export const pointer = { x: 0, y: 0, px: 0, py: 0, active: false, lastMove: 0, fine: true };
