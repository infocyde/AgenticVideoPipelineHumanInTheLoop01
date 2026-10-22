// Beat grid helpers for music videos (npm run lyrics). Pure.

/**
 * Extend a detected beat grid to the whole song at its median spacing: beat trackers often start late (an intro with
 * no drums) or stop early, which would leave those passages with no beat to cut on. Detected beats are kept as they are.
 */
export const extendBeats = (beats: number[], duration: number): number[] => {
  if (beats.length < 2) return beats;
  const gaps = beats.slice(1).map((b, i) => b - beats[i]).sort((a, b) => a - b);
  const period = gaps[Math.floor(gaps.length / 2)];
  if (!(period > 0)) return beats;
  const before: number[] = [];
  for (let t = beats[0] - period; t >= -1e-9; t -= period) before.unshift(+Math.max(0, t).toFixed(3));
  const after: number[] = [];
  for (let t = beats[beats.length - 1] + period; t <= duration + 1e-9; t += period) after.push(+t.toFixed(3));
  return [...before, ...beats, ...after];
};
