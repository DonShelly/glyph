// Seedable PRNG (xoshiro128**)
class RNG {
  constructor(seed) {
    this.s = new Uint32Array(4);
    // Splitmix32 to init state from single seed
    let s = seed >>> 0;
    for (let i = 0; i < 4; i++) {
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = (z ^ (z >>> 16)) >>> 0; z = Math.imul(z, 0x45d9f3b); z = (z ^ (z >>> 16)) >>> 0;
      z = Math.imul(z, 0x45d9f3b); z = (z ^ (z >>> 16)) >>> 0;
      this.s[i] = z;
    }
  }

  _rotl(x, k) { return ((x << k) | (x >>> (32 - k))) >>> 0; }

  nextU32() {
    const s = this.s;
    const result = (Math.imul(this._rotl(Math.imul(s[1], 5), 7), 9)) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
    s[2] ^= t; s[3] = this._rotl(s[3], 11);
    return result;
  }

  random() { return this.nextU32() / 4294967296; }
  uniform(lo, hi) { return lo + this.random() * (hi - lo); }
  int(lo, hi) { return lo + (this.nextU32() % (hi - lo)); }
  normal(mean, std) {
    const u1 = this.random() || 1e-10;
    const u2 = this.random();
    return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  choice(arr) { return arr[this.int(0, arr.length)]; }
}

window.RNG = RNG;
