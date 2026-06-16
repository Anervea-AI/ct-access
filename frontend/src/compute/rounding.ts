// Mirror of backend/app/compute/rounding.py — round-half-up so client & server agree.

export const r0 = (x: number): number => Math.floor(x + 0.5);
export const r1 = (x: number): number => Math.floor(x * 10 + 0.5) / 10;
export const r2 = (x: number): number => Math.floor(x * 100 + 0.5) / 100;

export const clamp = (x: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, x));

export const hash01 = (i: number): number => {
  const v = Math.sin(i * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};
