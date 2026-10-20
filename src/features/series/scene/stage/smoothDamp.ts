/**
 * Critically damped spring follower (Unity-style SmoothDamp). Allocation-free:
 * one instance per scalar, `step` returns the new value.
 */
export class Damper {
  v = 0;

  step(current: number, target: number, smoothTime: number, dt: number): number {
    if (dt <= 0) return current;
    const st = Math.max(0.0001, smoothTime);
    const omega = 2 / st;
    const x = omega * dt;
    const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = current - target;
    const temp = (this.v + omega * change) * dt;
    this.v = (this.v - omega * temp) * e;
    return target + (change + temp) * e;
  }

  reset() {
    this.v = 0;
  }
}
