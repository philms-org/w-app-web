export const ACTIVITY_TARGET = 3;

export function meterFill(picked: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(1, picked / target));
}
