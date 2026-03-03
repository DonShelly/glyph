// All 7 algorithms ported from generate.py

// --- Helpers ---
function laplacian(f, rows, cols) {
  const L = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      L[i] = -4 * f[i];
      if (r > 0) L[i] += f[(r-1)*cols+c];
      if (r < rows-1) L[i] += f[(r+1)*cols+c];
      if (c > 0) L[i] += f[r*cols+c-1];
      if (c < cols-1) L[i] += f[r*cols+c+1];
    }
  }
  return L;
}

function blur(f, rows, cols, iters) {
  let buf = new Float32Array(f);
  for (let it = 0; it < iters; it++) {
    const out = new Float32Array(buf);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        let sum = buf[i];
        let n = 1;
        if (r > 0) { sum += buf[(r-1)*cols+c]; n++; }
        if (r < rows-1) { sum += buf[(r+1)*cols+c]; n++; }
        if (c > 0) { sum += buf[r*cols+c-1]; n++; }
        if (c < cols-1) { sum += buf[r*cols+c+1]; n++; }
        out[i] = sum / n;
      }
    }
    buf = out;
  }
  return buf;
}

// --- 1. Matrix Rain ---
class MatrixRain {
  static label = 'Matrix Rain';
  static desc = 'Digital rain — cascading columns of glyphs';
  static prefPalette = 'matrix';
  static prefRamp = 'digital';
  static params = [
    { key: 'density', label: 'Stream Density', min: 0.2, max: 1.0, step: 0.05, def: 0.65 },
    { key: 'maxSpeed', label: 'Max Speed', min: 0.5, max: 3, step: 0.1, def: 1.4 },
    { key: 'fadeRate', label: 'Fade Rate', min: 0.8, max: 0.99, step: 0.01, def: 0.90 },
  ];

  constructor(rows, cols, rng, nChars, params) {
    this.rows = rows; this.cols = cols; this.rng = rng; this.nChars = nChars;
    const p = params || {};
    const density = p.density || 0.65;
    const nStreams = Math.floor(cols * density);
    this.fadeRate = p.fadeRate || 0.90;
    this.maxSpeed = p.maxSpeed || 1.4;
    this.streamCols = []; this.streamY = []; this.streamSpeed = []; this.streamLen = [];
    const used = new Set();
    for (let i = 0; i < nStreams; i++) {
      let c; do { c = rng.int(0, cols); } while (used.has(c) && used.size < cols);
      used.add(c);
      this.streamCols.push(c);
      this.streamY.push(rng.uniform(-rows * 1.5, 0));
      this.streamSpeed.push(rng.uniform(0.25, this.maxSpeed));
      this.streamLen.push(rng.int(6, Math.max(7, Math.floor(rows / 2))));
    }
    this.chars = new Int32Array(rows * cols);
    this.brightness = new Float32Array(rows * cols);
    for (let i = 0; i < rows * cols; i++) this.chars[i] = rng.int(0, nChars);
  }

  step() {
    const { rows, cols, rng, nChars, fadeRate } = this;
    for (let i = 0; i < rows * cols; i++) this.brightness[i] *= fadeRate;
    for (let s = 0; s < this.streamCols.length; s++) {
      const c = this.streamCols[s];
      const head = Math.floor(this.streamY[s]);
      const len = this.streamLen[s];
      if (head >= 0 && head < rows) this.brightness[head * cols + c] = 1.0;
      for (let t = 1; t < len; t++) {
        const ty = head - t;
        if (ty >= 0 && ty < rows) {
          const trail = Math.max(0, 1 - t / len) * 0.6;
          const idx = ty * cols + c;
          this.brightness[idx] = Math.max(this.brightness[idx], trail);
        }
      }
      this.streamY[s] += this.streamSpeed[s];
      if (head - len > rows) {
        this.streamY[s] = rng.uniform(-rows, -3);
        this.streamSpeed[s] = rng.uniform(0.25, this.maxSpeed);
        this.streamLen[s] = rng.int(6, Math.max(7, Math.floor(rows / 2)));
      }
    }
    // Flicker
    for (let i = 0; i < rows * cols; i++) {
      if (this.brightness[i] > 0.05 && rng.random() < 0.04) {
        this.chars[i] = rng.int(0, nChars);
      }
    }
  }

  getState() { return { chars: this.chars, brightness: this.brightness }; }
}

// --- 2. Fluid Smoke ---
class FluidSmoke {
  static label = 'Fluid Smoke';
  static desc = 'Rising smoke wisps curling through air';
  static prefPalette = null;
  static prefRamp = 'standard';
  static params = [
    { key: 'emitters', label: 'Emitters', min: 1, max: 6, step: 1, def: 3 },
    { key: 'strength', label: 'Strength', min: 0.2, max: 1.0, step: 0.05, def: 0.7 },
    { key: 'turbulence', label: 'Turbulence', min: 0.01, max: 0.12, step: 0.01, def: 0.04 },
  ];

  constructor(rows, cols, rng, nChars, params) {
    this.rows = rows; this.cols = cols; this.rng = rng; this.nChars = nChars;
    const p = params || {};
    this.density = new Float32Array(rows * cols);
    this.velX = new Float32Array(rows * cols);
    this.velY = new Float32Array(rows * cols);
    this.turbulence = p.turbulence || 0.04;
    const nE = p.emitters || 3;
    this.emitters = [];
    for (let i = 0; i < nE; i++) {
      this.emitters.push({ x: rng.int(Math.floor(cols*0.2), Math.floor(cols*0.8)), s: p.strength || 0.7 });
    }
    this.t = 0;
  }

  step() {
    const { rows, cols, rng, density, velX, velY, turbulence } = this;
    this.t++;
    // Emit
    for (const e of this.emitters) {
      const w = Math.max(2, Math.floor(cols / 30));
      const wobble = Math.floor(3 * Math.sin(this.t * 0.06 + e.x * 0.5));
      const x0 = Math.max(0, e.x - w + wobble);
      const x1 = Math.min(cols, e.x + w + wobble);
      for (let c = x0; c < x1; c++) {
        density[(rows-2)*cols+c] += e.s * 0.25;
        density[(rows-1)*cols+c] += e.s * 0.15;
        velY[(rows-2)*cols+c] = -0.9;
      }
    }
    // Buoyancy + turbulence
    for (let i = 0; i < rows * cols; i++) {
      velY[i] -= density[i] * 0.018;
      velX[i] += rng.normal(0, turbulence);
    }
    // Simple advection (shift-based approximation for performance)
    const newD = new Float32Array(rows * cols);
    const newVx = new Float32Array(rows * cols);
    const newVy = new Float32Array(rows * cols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const sr = Math.min(rows-1, Math.max(0, r - velY[i]));
        const sc = Math.min(cols-1, Math.max(0, c - velX[i]));
        const r0 = Math.floor(sr), c0 = Math.floor(sc);
        const fr = sr - r0, fc = sc - c0;
        const r1 = Math.min(r0+1, rows-1), c1 = Math.min(c0+1, cols-1);
        newD[i] = density[r0*cols+c0]*(1-fr)*(1-fc) + density[r1*cols+c0]*fr*(1-fc) +
                  density[r0*cols+c1]*(1-fr)*fc + density[r1*cols+c1]*fr*fc;
        newVx[i] = velX[r0*cols+c0]*(1-fr)*(1-fc) + velX[r1*cols+c0]*fr*(1-fc) +
                   velX[r0*cols+c1]*(1-fr)*fc + velX[r1*cols+c1]*fr*fc;
        newVy[i] = velY[r0*cols+c0]*(1-fr)*(1-fc) + velY[r1*cols+c0]*fr*(1-fc) +
                   velY[r0*cols+c1]*(1-fr)*fc + velY[r1*cols+c1]*fr*fc;
      }
    }
    for (let i = 0; i < rows * cols; i++) {
      this.density[i] = Math.min(1, Math.max(0, newD[i] * 0.996));
      this.velX[i] = newVx[i] * 0.99;
      this.velY[i] = newVy[i] * 0.99;
    }
  }

  getState() {
    const { density, rows, cols, nChars } = this;
    const chars = new Int32Array(rows * cols);
    for (let i = 0; i < rows * cols; i++) {
      chars[i] = Math.min(nChars-1, Math.max(0, Math.floor(density[i] * (nChars-1))));
    }
    return { chars, brightness: density };
  }
}

// --- 3. Reaction-Diffusion ---
class ReactionDiffusion {
  static label = 'Reaction-Diffusion';
  static desc = 'Gray-Scott morphogenesis — organic patterns';
  static prefPalette = null;
  static prefRamp = 'dense';
  static params = [
    { key: 'preset', label: 'Pattern', type: 'select', options: ['spots','stripes','worms','coral','mitosis','waves'], def: 'spots' },
    { key: 'stepsPerFrame', label: 'Sim Speed', min: 4, max: 24, step: 2, def: 12 },
  ];

  static PRESETS = {
    spots: [0.035, 0.065], stripes: [0.025, 0.060], worms: [0.040, 0.063],
    coral: [0.055, 0.062], mitosis: [0.028, 0.062], waves: [0.014, 0.045],
  };

  constructor(rows, cols, rng, nChars, params) {
    this.rows = rows; this.cols = cols; this.rng = rng; this.nChars = nChars;
    const p = params || {};
    const preset = p.preset || 'spots';
    const [F, k] = ReactionDiffusion.PRESETS[preset] || ReactionDiffusion.PRESETS.spots;
    this.F = F; this.k = k; this.Du = 0.16; this.Dv = 0.08;
    this.stepsPerFrame = p.stepsPerFrame || 12;
    this.U = new Float32Array(rows * cols).fill(1);
    this.V = new Float32Array(rows * cols);
    const nSeeds = rng.int(3, 8);
    for (let s = 0; s < nSeeds; s++) {
      const sr = rng.int(Math.floor(rows/4), Math.floor(3*rows/4));
      const sc = rng.int(Math.floor(cols/4), Math.floor(3*cols/4));
      const rad = rng.int(2, 5);
      for (let r = Math.max(0,sr-rad); r < Math.min(rows,sr+rad); r++) {
        for (let c = Math.max(0,sc-rad); c < Math.min(cols,sc+rad); c++) {
          this.V[r*cols+c] = 1; this.U[r*cols+c] = 0.5;
        }
      }
    }
  }

  step() {
    const { rows, cols, U, V, F, k, Du, Dv, stepsPerFrame } = this;
    for (let s = 0; s < stepsPerFrame; s++) {
      const Lu = laplacian(U, rows, cols);
      const Lv = laplacian(V, rows, cols);
      for (let i = 0; i < rows * cols; i++) {
        const uvv = U[i] * V[i] * V[i];
        U[i] = Math.min(1, Math.max(0, U[i] + Du * Lu[i] - uvv + F * (1 - U[i])));
        V[i] = Math.min(1, Math.max(0, V[i] + Dv * Lv[i] + uvv - (F + k) * V[i]));
      }
    }
  }

  getState() {
    const { V, rows, cols, nChars } = this;
    const chars = new Int32Array(rows * cols);
    for (let i = 0; i < rows * cols; i++) {
      chars[i] = Math.min(nChars-1, Math.max(0, Math.floor(V[i] * (nChars-1))));
    }
    return { chars, brightness: V };
  }
}

// --- 4. Fire ---
class FireEffect {
  static label = 'Fire';
  static desc = 'Classic demoscene fire with rising heat';
  static prefPalette = 'fire';
  static prefRamp = 'dense';
  static params = [
    { key: 'cooling', label: 'Cooling', min: 0.005, max: 0.06, step: 0.005, def: 0.025 },
    { key: 'intensity', label: 'Intensity', min: 0.4, max: 1.0, step: 0.05, def: 0.85 },
  ];

  constructor(rows, cols, rng, nChars, params) {
    this.rows = rows; this.cols = cols; this.rng = rng; this.nChars = nChars;
    const p = params || {};
    this.heat = new Float32Array((rows + 2) * cols);
    this.cooling = p.cooling || 0.025;
    this.intensity = p.intensity || 0.85;
  }

  step() {
    const { rows, cols, rng, heat, cooling, intensity } = this;
    const stride = cols;
    // Sparks
    for (let c = 0; c < cols; c++) {
      heat[(rows+1)*stride+c] = rng.uniform(0.6, 1.0) * intensity;
      heat[rows*stride+c] = rng.uniform(0.4, 0.9) * intensity;
    }
    // Propagate upward
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const below = heat[(r+1)*stride+c];
        const below2 = heat[(r+2)*stride+c];
        const left = heat[(r+1)*stride + ((c-1+cols)%cols)];
        const right = heat[(r+1)*stride + ((c+1)%cols)];
        heat[r*stride+c] = Math.max(0, (below + below2 + left + right) / 4 - cooling);
      }
    }
  }

  getState() {
    const { rows, cols, heat, nChars } = this;
    const chars = new Int32Array(rows * cols);
    const brightness = new Float32Array(rows * cols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = Math.min(1, heat[r * cols + c]);
        chars[r*cols+c] = Math.min(nChars-1, Math.max(0, Math.floor(v * (nChars-1))));
        brightness[r*cols+c] = v;
      }
    }
    return { chars, brightness };
  }
}

// --- 5. Wave Interference ---
class WaveInterference {
  static label = 'Wave Interference';
  static desc = 'Interfering circular waves from point sources';
  static prefPalette = null;
  static prefRamp = 'standard';
  static params = [
    { key: 'sources', label: 'Sources', min: 2, max: 8, step: 1, def: 4 },
    { key: 'freqScale', label: 'Frequency', min: 0.1, max: 1.2, step: 0.05, def: 0.5 },
    { key: 'waveSpeed', label: 'Wave Speed', min: 0.05, max: 0.4, step: 0.02, def: 0.15 },
  ];

  constructor(rows, cols, rng, nChars, params) {
    this.rows = rows; this.cols = cols; this.rng = rng; this.nChars = nChars;
    const p = params || {};
    this.t = 0;
    this.waveSpeed = p.waveSpeed || 0.15;
    const nS = p.sources || 4;
    this.sources = [];
    for (let i = 0; i < nS; i++) {
      this.sources.push({
        x: rng.uniform(cols*0.1, cols*0.9), y: rng.uniform(rows*0.1, rows*0.9),
        freq: (p.freqScale || 0.5) * rng.uniform(0.6, 1.4),
        speed: rng.uniform(1.5, 3.5), phase: rng.uniform(0, Math.PI * 2),
      });
    }
  }

  step() { this.t += this.waveSpeed; }

  getState() {
    const { rows, cols, nChars, sources, t } = this;
    const chars = new Int32Array(rows * cols);
    const brightness = new Float32Array(rows * cols);
    const total = new Float32Array(rows * cols);
    let lo = Infinity, hi = -Infinity;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let v = 0;
        for (const s of sources) {
          const dist = Math.sqrt((c - s.x) ** 2 + (r - s.y) ** 2);
          const wave = Math.sin(dist * s.freq - t * s.speed + s.phase);
          v += wave / (1 + dist * 0.04);
        }
        total[r*cols+c] = v;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    const range = hi - lo || 1;
    for (let i = 0; i < rows * cols; i++) {
      const d = (total[i] - lo) / range;
      chars[i] = Math.min(nChars-1, Math.max(0, Math.floor(d * (nChars-1))));
      brightness[i] = d;
    }
    return { chars, brightness };
  }
}

// --- 6. Cellular Automata ---
class CellularCascade {
  static label = 'Cellular Automata';
  static desc = '1D cellular automata — cascading structures';
  static prefPalette = null;
  static prefRamp = 'blocks';
  static params = [
    { key: 'rule', label: 'Rule', min: 0, max: 255, step: 1, def: 110 },
    { key: 'stepsPerFrame', label: 'Scroll Speed', min: 1, max: 5, step: 1, def: 2 },
  ];

  constructor(rows, cols, rng, nChars, params) {
    this.rows = rows; this.cols = cols; this.rng = rng; this.nChars = nChars;
    const p = params || {};
    this.ruleNum = p.rule != null ? p.rule : 110;
    this.ruleBits = new Uint8Array(8);
    for (let i = 0; i < 8; i++) this.ruleBits[i] = (this.ruleNum >> i) & 1;
    this.stepsPerFrame = p.stepsPerFrame || 2;
    this.grid = new Float32Array(rows * cols);
    this.current = new Uint8Array(cols);
    if (rng.random() < 0.5) { this.current[Math.floor(cols/2)] = 1; }
    else { for (let c = 0; c < cols; c++) this.current[c] = rng.int(0, 2); }
    for (let c = 0; c < cols; c++) this.grid[(rows-1)*cols+c] = this.current[c];
  }

  step() {
    const { rows, cols, stepsPerFrame } = this;
    for (let s = 0; s < stepsPerFrame; s++) {
      // Scroll up
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols; c++) this.grid[r*cols+c] = this.grid[(r+1)*cols+c];
      }
      // Apply rule
      const next = new Uint8Array(cols);
      for (let c = 0; c < cols; c++) {
        const l = this.current[(c-1+cols)%cols];
        const m = this.current[c];
        const r2 = this.current[(c+1)%cols];
        next[c] = this.ruleBits[(l<<2)|(m<<1)|r2];
      }
      this.current = next;
      for (let c = 0; c < cols; c++) this.grid[(rows-1)*cols+c] = this.current[c];
    }
  }

  getState() {
    const { grid, rows, cols, nChars } = this;
    const chars = new Int32Array(rows * cols);
    for (let i = 0; i < rows * cols; i++) {
      chars[i] = Math.min(nChars-1, Math.max(0, Math.floor(grid[i] * (nChars-1))));
    }
    return { chars, brightness: grid };
  }
}

// --- 7. Particle Swirl ---
class ParticleSwirl {
  static label = 'Particle Swirl';
  static desc = 'Particles spiralling around gravitational attractors';
  static prefPalette = null;
  static prefRamp = 'dots';
  static params = [
    { key: 'particles', label: 'Particles', min: 500, max: 8000, step: 500, def: 4000 },
    { key: 'attractors', label: 'Attractors', min: 1, max: 5, step: 1, def: 2 },
    { key: 'tangential', label: 'Tangential Force', min: 0.1, max: 1.5, step: 0.1, def: 0.6 },
  ];

  constructor(rows, cols, rng, nChars, params) {
    this.rows = rows; this.cols = cols; this.rng = rng; this.nChars = nChars;
    const p = params || {};
    const nP = p.particles || 4000;
    this.px = new Float32Array(nP); this.py = new Float32Array(nP);
    this.vx = new Float32Array(nP); this.vy = new Float32Array(nP);
    for (let i = 0; i < nP; i++) {
      this.px[i] = rng.uniform(0, cols); this.py[i] = rng.uniform(0, rows);
      this.vx[i] = rng.normal(0, 0.3); this.vy[i] = rng.normal(0, 0.3);
    }
    this.tangential = p.tangential || 0.6;
    const nA = p.attractors || 2;
    this.atts = [];
    for (let i = 0; i < nA; i++) {
      this.atts.push({ x: rng.uniform(cols*0.25, cols*0.75), y: rng.uniform(rows*0.25, rows*0.75), mass: rng.uniform(6, 18) });
    }
    this.prevDensity = new Float32Array(rows * cols);
  }

  step() {
    const { px, py, vx, vy, atts, tangential, rng, rows, cols } = this;
    const nP = px.length;
    for (const a of atts) {
      for (let i = 0; i < nP; i++) {
        const dx = a.x - px[i], dy = a.y - py[i];
        const dist = Math.sqrt(dx*dx + dy*dy) + 0.5;
        const force = Math.min(a.mass / (dist*dist), 2.5);
        vx[i] += dx/dist * force * 0.08;
        vy[i] += dy/dist * force * 0.08;
        vx[i] += -dy/dist * force * 0.04 * tangential;
        vy[i] += dx/dist * force * 0.04 * tangential;
      }
    }
    for (let i = 0; i < nP; i++) {
      vx[i] *= 0.997; vy[i] *= 0.997;
      px[i] += vx[i]; py[i] += vy[i];
      if (px[i] < -5 || px[i] >= cols+5 || py[i] < -5 || py[i] >= rows+5) {
        px[i] = rng.uniform(0, cols); py[i] = rng.uniform(0, rows);
        vx[i] = rng.normal(0, 0.2); vy[i] = rng.normal(0, 0.2);
      }
    }
  }

  getState() {
    const { px, py, rows, cols, nChars, prevDensity } = this;
    const density = new Float32Array(rows * cols);
    for (let i = 0; i < px.length; i++) {
      const r = Math.floor(py[i]), c = Math.floor(px[i]);
      if (r >= 0 && r < rows && c >= 0 && c < cols) density[r*cols+c]++;
    }
    let maxD = 1;
    for (let i = 0; i < rows * cols; i++) if (density[i] > maxD) maxD = density[i];
    const scale = 1 / Math.max(maxD * 0.25, 1);
    const blurred = blur(density, rows, cols, 1);
    const brightness = new Float32Array(rows * cols);
    const chars = new Int32Array(rows * cols);
    for (let i = 0; i < rows * cols; i++) {
      const v = Math.min(1, blurred[i] * scale * 0.7 + prevDensity[i] * 0.3);
      brightness[i] = v;
      chars[i] = Math.min(nChars-1, Math.max(0, Math.floor(v * (nChars-1))));
      this.prevDensity[i] = v;
    }
    return { chars, brightness };
  }
}

// --- 8. Lorenz Dissolution ---
class LorenzDissolution {
  static label = 'Lorenz Dissolution';
  static desc = 'Lorenz attractor dissolving into noise over time';
  static prefPalette = 'warmwhite';
  static prefRamp = 'standard';
  static renderMode = 'pixel';
  static params = [
    { key: 'sigma', label: 'Sigma', min: 5, max: 20, step: 0.5, def: 10 },
    { key: 'rho', label: 'Rho', min: 15, max: 40, step: 0.5, def: 28 },
    { key: 'beta', label: 'Beta', min: 1, max: 5, step: 0.1, def: 2.667 },
    { key: 'noiseMax', label: 'Max Noise', min: 5, max: 80, step: 5, def: 40 },
    { key: 'pointsPerFrame', label: 'Points/Frame', min: 500, max: 5000, step: 500, def: 2000 },
  ];

  constructor(rows, cols, rng, nChars, params) {
    this.rows = rows; this.cols = cols; this.rng = rng; this.nChars = nChars;
    const p = params || {};
    this.sigma = p.sigma || 10;
    this.rho = p.rho || 28;
    this.beta = p.beta || 2.667;
    this.noiseMax = p.noiseMax || 40;
    this.pointsPerFrame = p.pointsPerFrame || 2000;
    this.dt = 0.005;
    this.x = 0.1; this.y = 0.0; this.z = 0.0;
    this.totalPoints = 0;
    this.maxPoints = 300000;
    this.accum = new Float32Array(rows * cols);
    // Phase: 0 = building the attractor, 1 = dissolving, 2 = done/looping
    this.phase = 0;
  }

  step() {
    const { rows, cols, rng, sigma, rho, beta, dt, noiseMax, accum } = this;

    if (this.totalPoints >= this.maxPoints) {
      // Dissolution complete — slow fade and restart
      for (let i = 0; i < rows * cols; i++) accum[i] *= 0.992;
      let sum = 0;
      for (let i = 0; i < rows * cols; i++) sum += accum[i];
      if (sum < 0.1) {
        // Reset for next cycle
        this.x = 0.1; this.y = 0.0; this.z = 0.0;
        this.totalPoints = 0;
        for (let i = 0; i < rows * cols; i++) accum[i] = 0;
      }
      return;
    }

    for (let p = 0; p < this.pointsPerFrame; p++) {
      if (this.totalPoints >= this.maxPoints) break;

      const dx = sigma * (this.y - this.x);
      const dy = this.x * (rho - this.z) - this.y;
      const dz = this.x * this.y - beta * this.z;
      this.x += dx * dt;
      this.y += dy * dt;
      this.z += dz * dt;
      this.totalPoints++;

      const t = this.totalPoints / this.maxPoints;
      const noiseScale = Math.pow(t, 3) * noiseMax;

      const nx = this.x + rng.normal(0, noiseScale);
      const nz = this.z + rng.normal(0, noiseScale);

      // Classic butterfly view: X → horizontal, Z → vertical (inverted)
      // Lorenz X range: roughly -20 to 20, Z range: roughly 5 to 48
      const scaleX = cols / 50;
      const scaleZ = rows / 55;
      const px = Math.floor(cols / 2 + nx * scaleX);
      const py = Math.floor(rows - 5 - nz * scaleZ);

      if (px >= 0 && px < cols && py >= 0 && py < rows) {
        const brightness = Math.max(0.05, 1.0 - t * 0.7);
        accum[py * cols + px] += brightness * 0.08;
      }
    }
  }

  getState() {
    const { accum, rows, cols, nChars } = this;
    const brightness = new Float32Array(rows * cols);
    const chars = new Int32Array(rows * cols);
    let maxV = 0;
    for (let i = 0; i < rows * cols; i++) if (accum[i] > maxV) maxV = accum[i];
    const scale = maxV > 0 ? 1 / maxV : 1;
    for (let i = 0; i < rows * cols; i++) {
      const v = Math.min(1, Math.pow(Math.min(1, accum[i] * scale), 0.35));
      brightness[i] = v;
      chars[i] = Math.min(nChars - 1, Math.max(0, Math.floor(v * (nChars - 1))));
    }
    return { chars, brightness };
  }
}

// --- 9. Zone Plate Moiré ---
class ZonePlateMoire {
  static renderMode = 'pixel';
  static label = 'Zone Plate Moiré';
  static desc = 'Fresnel zone plate interference — phantom topography';
  static prefPalette = 'ice';
  static prefRamp = 'standard';
  static params = [
    { key: 'sources', label: 'Sources', min: 2, max: 6, step: 1, def: 3 },
    { key: 'freqBase', label: 'Frequency', min: 30, max: 150, step: 5, def: 85 },
    { key: 'drift', label: 'Drift Speed', min: 0, max: 0.02, step: 0.001, def: 0.003 },
  ];

  constructor(rows, cols, rng, nChars, params) {
    this.rows = rows; this.cols = cols; this.rng = rng; this.nChars = nChars;
    const p = params || {};
    this.drift = p.drift || 0.003;
    const nS = p.sources || 3;
    const freqBase = p.freqBase || 85;
    this.sources = [];
    for (let i = 0; i < nS; i++) {
      this.sources.push({
        cx: rng.uniform(-0.4, 0.4),
        cy: rng.uniform(-0.4, 0.4),
        freq: freqBase + rng.uniform(-8, 8),
        dx: rng.uniform(-1, 1),
        dy: rng.uniform(-1, 1),
      });
    }
    this.t = 0;
  }

  step() {
    this.t++;
    const drift = this.drift;
    for (const s of this.sources) {
      s.cx += s.dx * drift;
      s.cy += s.dy * drift;
      // Bounce off edges
      if (Math.abs(s.cx) > 0.6) s.dx *= -1;
      if (Math.abs(s.cy) > 0.6) s.dy *= -1;
    }
  }

  getState() {
    const { rows, cols, nChars, sources } = this;
    const brightness = new Float32Array(rows * cols);
    const chars = new Int32Array(rows * cols);
    const cr = 1.5; // coordinate range

    let lo = Infinity, hi = -Infinity;
    const field = new Float32Array(rows * cols);

    for (let r = 0; r < rows; r++) {
      const ny = -cr + (2 * cr * r) / rows;
      for (let c = 0; c < cols; c++) {
        const nx = -cr + (2 * cr * c) / cols;
        let v = 0;
        for (const s of sources) {
          const dx = nx - s.cx, dy = ny - s.cy;
          v += Math.cos(s.freq * (dx * dx + dy * dy));
        }
        field[r * cols + c] = v;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }

    const range = hi - lo || 1;
    for (let i = 0; i < rows * cols; i++) {
      const d = (field[i] - lo) / range;
      brightness[i] = d;
      chars[i] = Math.min(nChars - 1, Math.max(0, Math.floor(d * (nChars - 1))));
    }
    return { chars, brightness };
  }
}

// --- 10. Flow Field (Prismatic Current) ---
class FlowField {
  static renderMode = 'pixel';
  static label = 'Flow Field';
  static desc = 'Particle traces through a vector field — colour encodes direction';
  static prefPalette = 'solar';
  static prefRamp = 'dots';
  static params = [
    { key: 'particles', label: 'Particles', min: 1000, max: 10000, step: 500, def: 4000 },
    { key: 'stepSize', label: 'Step Size', min: 0.5, max: 5, step: 0.5, def: 2.5 },
    { key: 'complexity', label: 'Field Complexity', min: 1, max: 5, step: 0.5, def: 3 },
    { key: 'fadeRate', label: 'Trail Fade', min: 0.95, max: 0.999, step: 0.001, def: 0.995 },
  ];

  constructor(rows, cols, rng, nChars, params) {
    this.rows = rows; this.cols = cols; this.rng = rng; this.nChars = nChars;
    const p = params || {};
    this.stepSize = p.stepSize || 2.5;
    this.fadeRate = p.fadeRate || 0.995;
    const complexity = p.complexity || 3;
    const nP = p.particles || 4000;

    // Generate flow field coefficients
    this.fieldCoeffs = [];
    const nOctaves = Math.ceil(complexity * 2);
    for (let i = 0; i < nOctaves; i++) {
      this.fieldCoeffs.push({
        ax: rng.uniform(2, 18), ay: rng.uniform(2, 18),
        bx: rng.uniform(-2, 2), by: rng.uniform(-2, 2),
        amp: 1.0 / (1 + i * 0.6),
        phase: rng.uniform(0, Math.PI * 2),
      });
    }

    this.px = new Float32Array(nP);
    this.py = new Float32Array(nP);
    for (let i = 0; i < nP; i++) {
      this.px[i] = rng.uniform(0, cols);
      this.py[i] = rng.uniform(0, rows);
    }
    this.accum = new Float32Array(rows * cols);
  }

  _flowAngle(nx, ny) {
    let angle = 0;
    for (const c of this.fieldCoeffs) {
      angle += c.amp * Math.sin(nx * c.ax + ny * c.ay + c.bx + c.phase);
      angle += c.amp * 0.5 * Math.cos(nx * c.ay + ny * c.ax + c.by);
    }
    return angle;
  }

  step() {
    const { rows, cols, rng, px, py, accum, stepSize, fadeRate } = this;
    const nP = px.length;

    // Fade
    for (let i = 0; i < rows * cols; i++) accum[i] *= fadeRate;

    for (let i = 0; i < nP; i++) {
      const nx = px[i] / cols;
      const ny = py[i] / rows;
      const angle = this._flowAngle(nx, ny);

      px[i] += Math.cos(angle) * stepSize;
      py[i] += Math.sin(angle) * stepSize;

      // Wrap
      if (px[i] < 0) px[i] += cols;
      if (px[i] >= cols) px[i] -= cols;
      if (py[i] < 0) py[i] += rows;
      if (py[i] >= rows) py[i] -= rows;

      const ix = Math.floor(px[i]) % cols;
      const iy = Math.floor(py[i]) % rows;
      if (ix >= 0 && iy >= 0 && ix < cols && iy < rows) {
        accum[iy * cols + ix] += 0.04;
      }
    }
  }

  getState() {
    const { accum, rows, cols, nChars } = this;
    const brightness = new Float32Array(rows * cols);
    const chars = new Int32Array(rows * cols);
    let maxV = 0;
    for (let i = 0; i < rows * cols; i++) if (accum[i] > maxV) maxV = accum[i];
    const scale = maxV > 0 ? 1 / maxV : 1;
    for (let i = 0; i < rows * cols; i++) {
      const v = Math.min(1, Math.pow(Math.min(1, accum[i] * scale), 0.5));
      brightness[i] = v;
      chars[i] = Math.min(nChars - 1, Math.max(0, Math.floor(v * (nChars - 1))));
    }
    return { chars, brightness };
  }
}

// --- 11. Taxonomy (Spatially Varying Reaction-Diffusion) ---
class TaxonomyRD {
  static renderMode = 'pixel';
  static pixelSize = 2;
  static label = 'Taxonomy RD';
  static desc = 'Gray-Scott with spatially varying parameters — a map of morphogenesis';
  static prefPalette = 'amber';
  static prefRamp = 'dense';
  static params = [
    { key: 'fMin', label: 'Feed min', min: 0.005, max: 0.04, step: 0.005, def: 0.01 },
    { key: 'fMax', label: 'Feed max', min: 0.04, max: 0.09, step: 0.005, def: 0.08 },
    { key: 'kMin', label: 'Kill min', min: 0.03, max: 0.055, step: 0.005, def: 0.045 },
    { key: 'kMax', label: 'Kill max', min: 0.055, max: 0.08, step: 0.005, def: 0.07 },
    { key: 'stepsPerFrame', label: 'Sim Speed', min: 4, max: 30, step: 2, def: 16 },
  ];

  constructor(rows, cols, rng, nChars, params) {
    this.rows = rows; this.cols = cols; this.rng = rng; this.nChars = nChars;
    const p = params || {};
    this.Du = 1.0; this.Dv = 0.5;
    this.stepsPerFrame = p.stepsPerFrame || 16;

    const fMin = p.fMin || 0.01, fMax = p.fMax || 0.08;
    const kMin = p.kMin || 0.045, kMax = p.kMax || 0.07;

    this.F = new Float32Array(rows * cols);
    this.K = new Float32Array(rows * cols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        this.F[i] = fMin + (fMax - fMin) * (r / rows) + rng.normal(0, 0.0005);
        this.K[i] = kMin + (kMax - kMin) * (c / cols) + rng.normal(0, 0.0003);
      }
    }

    this.U = new Float32Array(rows * cols).fill(1);
    this.V = new Float32Array(rows * cols);

    // Seed patches
    const nSeeds = rng.int(8, 20);
    for (let s = 0; s < nSeeds; s++) {
      const sr = rng.int(10, rows - 10);
      const sc = rng.int(10, cols - 10);
      const rad = rng.int(2, 5);
      for (let r = Math.max(0, sr - rad); r < Math.min(rows, sr + rad); r++) {
        for (let c2 = Math.max(0, sc - rad); c2 < Math.min(cols, sc + rad); c2++) {
          this.V[r * cols + c2] = 1;
          this.U[r * cols + c2] = 0;
        }
      }
    }
  }

  step() {
    const { rows, cols, U, V, F, K, Du, Dv, stepsPerFrame } = this;
    for (let s = 0; s < stepsPerFrame; s++) {
      const Lu = laplacian(U, rows, cols);
      const Lv = laplacian(V, rows, cols);
      for (let i = 0; i < rows * cols; i++) {
        const uvv = U[i] * V[i] * V[i];
        U[i] = Math.min(1, Math.max(0, U[i] + Du * Lu[i] - uvv + F[i] * (1 - U[i])));
        V[i] = Math.min(1, Math.max(0, V[i] + Dv * Lv[i] + uvv - (F[i] + K[i]) * V[i]));
      }
    }
  }

  getState() {
    const { V, rows, cols, nChars } = this;
    const chars = new Int32Array(rows * cols);
    for (let i = 0; i < rows * cols; i++) {
      chars[i] = Math.min(nChars - 1, Math.max(0, Math.floor(V[i] * (nChars - 1))));
    }
    return { chars, brightness: V };
  }
}

// --- 12. DLA Filament ---
class DLAFilament {
  static renderMode = 'pixel';
  static label = 'DLA Filament';
  static desc = 'Diffusion-limited aggregation — dendritic growth from a seed';
  static prefPalette = 'fire';
  static prefRamp = 'dense';
  static params = [
    { key: 'walkersPerFrame', label: 'Walkers/Frame', min: 50, max: 500, step: 50, def: 200 },
    { key: 'stickProb', label: 'Stick Probability', min: 0.1, max: 1.0, step: 0.05, def: 0.6 },
    { key: 'glowRadius', label: 'Glow Radius', min: 1, max: 6, step: 1, def: 3 },
  ];

  constructor(rows, cols, rng, nChars, params) {
    this.rows = rows; this.cols = cols; this.rng = rng; this.nChars = nChars;
    const p = params || {};
    this.walkersPerFrame = p.walkersPerFrame || 200;
    this.stickProb = p.stickProb || 0.6;
    this.glowRadius = p.glowRadius || 3;

    this.grid = new Uint8Array(rows * cols); // 1 = occupied
    this.order = new Float32Array(rows * cols); // arrival order for colouring
    this.totalStuck = 0;

    // Seed at centre
    const cr = Math.floor(rows / 2), cc = Math.floor(cols / 2);
    this.grid[cr * cols + cc] = 1;
    this.order[cr * cols + cc] = 0;
    this.totalStuck = 1;

    this.brightness = new Float32Array(rows * cols);
  }

  _isAdjacentToOccupied(r, c) {
    const { grid, rows, cols } = this;
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr * cols + nc]) return true;
    }
    return false;
  }

  step() {
    const { rows, cols, rng, grid, order, walkersPerFrame, stickProb, glowRadius } = this;

    for (let w = 0; w < walkersPerFrame; w++) {
      // Start from random edge
      let r, c;
      if (rng.random() < 0.5) {
        r = rng.int(0, rows);
        c = rng.random() < 0.5 ? 0 : cols - 1;
      } else {
        r = rng.random() < 0.5 ? 0 : rows - 1;
        c = rng.int(0, cols);
      }

      // Random walk max steps
      for (let s = 0; s < 500; s++) {
        const dir = rng.int(0, 4);
        if (dir === 0) r--;
        else if (dir === 1) r++;
        else if (dir === 2) c--;
        else c++;

        if (r < 0 || r >= rows || c < 0 || c >= cols) break;
        if (grid[r * cols + c]) break; // landed on occupied, try again

        if (this._isAdjacentToOccupied(r, c) && rng.random() < stickProb) {
          grid[r * cols + c] = 1;
          this.totalStuck++;
          order[r * cols + c] = this.totalStuck;

          // Add glow around new particle
          for (let dr = -glowRadius; dr <= glowRadius; dr++) {
            for (let dc = -glowRadius; dc <= glowRadius; dc++) {
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                const dist = Math.sqrt(dr * dr + dc * dc);
                const glow = 1.0 / (1.0 + dist * 0.8);
                const idx = nr * cols + nc;
                this.brightness[idx] = Math.min(1, this.brightness[idx] + glow * 0.3);
              }
            }
          }
          break;
        }
      }
    }

    // Slow fade so structure accumulates visually
    for (let i = 0; i < rows * cols; i++) {
      if (grid[i]) {
        this.brightness[i] = Math.min(1, this.brightness[i] + 0.02);
      } else {
        this.brightness[i] *= 0.997;
      }
    }
  }

  getState() {
    const { brightness, rows, cols, nChars } = this;
    const chars = new Int32Array(rows * cols);
    for (let i = 0; i < rows * cols; i++) {
      chars[i] = Math.min(nChars - 1, Math.max(0, Math.floor(brightness[i] * (nChars - 1))));
    }
    return { chars, brightness };
  }
}

window.ALGORITHMS = {
  matrix: MatrixRain, smoke: FluidSmoke, reaction: ReactionDiffusion,
  fire: FireEffect, waves: WaveInterference, automata: CellularCascade, swirl: ParticleSwirl,
  lorenz: LorenzDissolution, zoneplate: ZonePlateMoire, flowfield: FlowField,
  taxonomy: TaxonomyRD, dla: DLAFilament,
};
