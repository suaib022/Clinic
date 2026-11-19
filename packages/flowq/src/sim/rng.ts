const HOUR = 3_600_000;

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  normal(mean: number, sd: number): number;
  /** Log-normal with the given median and coefficient of variation. */
  lognormalMin(medianMin: number, cv: number): number;
  bernoulli(p: number): boolean;
  /** Arrival instants of a Poisson process with ratePerHour between fromMs and toMs. */
  poissonTimes(ratePerHour: number, fromMs: number, toMs: number): number[];
  pick<T>(xs: readonly T[]): T;
  /** Index chosen with probability proportional to weights. */
  weighted(weights: readonly number[]): number;
  int(min: number, max: number): number;
}

/** Seeded generator (mulberry32). Same seed, same sequence on every platform. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = (mean: number, sd: number) => {
    const u = 1 - next(), v = next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return {
    next,
    normal,
    lognormalMin: (median, cv) => {
      const sigma = Math.sqrt(Math.log(1 + cv * cv));
      return Math.exp(Math.log(median) + sigma * normal(0, 1));
    },
    bernoulli: (p) => next() < p,
    poissonTimes: (rate, from, to) => {
      const out: number[] = [];
      if (rate <= 0) return out;
      let t = from;
      for (;;) {
        t += (-Math.log(1 - next()) / rate) * HOUR;
        if (t >= to) return out;
        out.push(Math.round(t));
      }
    },
    pick: (xs) => xs[Math.floor(next() * xs.length)],
    weighted: (w) => {
      const total = w.reduce((x, y) => x + y, 0);
      let r = next() * total;
      for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; }
      return w.length - 1;
    },
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
  };
}
