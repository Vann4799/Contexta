// Both dashboard charts plot counts, so their axes share one rule: whole-number ticks, three or
// four of them, and a ceiling that never sits exactly on the peak (the line would touch the frame).
const NICE_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];

export function axisScale(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 4, ticks: [4, 2, 0] };
  const rawStep = Math.ceil(max / 3);
  const step = NICE_STEPS.find((s) => s >= rawStep) ?? Math.ceil(rawStep / 1000) * 1000;
  let top = Math.ceil(max / step) * step;
  if (top === max) top += step;
  const ticks: number[] = [];
  for (let v = top; v >= 0; v -= step) ticks.push(v);
  return { top, ticks };
}
