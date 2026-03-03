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
// Matches gen-001-dissolution-v2.py exactly:
//   - Classic X-Z butterfly projection, centred on canvas
//   - Dissolution driven by SCREEN POSITION (top = clean, bottom = noisy)
//   - Multi-pass accumulation (12 passes over 500K trajectory points)
//   - Gamma 0.4 tone curve, 98th-percentile normalisation
class LorenzDissolution {
  static label = 'Lorenz Dissolution';
  static desc = 'Lorenz attractor — dissolution increases toward the bottom';
  static prefPalette = 'warmwhite';
  static prefRamp = 'standard';
  static renderMode = 'pixel';
  static params = [
    { key: 'sigma', label: 'Sigma', min: 5, max: 20, step: 0.5, def: 10 },
    { key: 'rho', label: 'Rho', min: 15, max: 40, step: 0.5, def: 28 },
    { key: 'beta', label: 'Beta', min: 1, max: 5, step: 0.1, def: 2.667 },
    { key: 'dissolutionMax', label: 'Dissolution', min: 5, max: 80, step: 5, def: 35 },
    { key: 'passes', label: 'Passes', min: 1, max: 16, step: 1, def: 12 },
    { key: 'trajectoryK', label: 'Trajectory (K)', min: 100, max: 1000, step: 50, def: 500 },
  ];

  constructor(rows, cols, rng, nChars, params) {
    this.rows = rows; this.cols = cols; this.rng = rng; this.nChars = nChars;
    const p = params || {};
    this.sigma = p.sigma || 10;
    this.rho = p.rho || 28;
    this.beta = p.beta || 2.667;
    this.dissolutionMax = p.dissolutionMax || 35;
    this.numPasses = p.passes || 12;
    this.trajectoryK = (p.trajectoryK || 500) * 1000;
    this.dt = 0.003;

    // Pre-compute the full Lorenz trajectory
    this._computeTrajectory();
    // Project to screen coords (undissolved)
    this._projectToScreen();

    // Accumulation buffer (per-channel for warm→cool gradient)
    this.accumR = new Float32Array(rows * cols);
    this.accumG = new Float32Array(rows * cols);
    this.accumB = new Float32Array(rows * cols);

    // Render state: which pass we're on, which point within that pass
    this.currentPass = 0;
    this.currentPoint = 0;
    this.pointsPerFrame = 8000; // render speed
    this.done = false;
  }

  _computeTrajectory() {
    const { sigma, rho, beta, dt, trajectoryK } = this;
    const n = trajectoryK;
    this.trajX = new Float32Array(n);
    this.trajZ = new Float32Array(n);
    let x = 0.1, y = 0.0, z = 0.0;
    for (let i = 0; i < n; i++) {
      const dx = sigma * (y - x) * dt;
      const dy = (x * (rho - z) - y) * dt;
      const dz = (x * y - beta * z) * dt;
      x += dx; y += dy; z += dz;
      this.trajX[i] = x;
      this.trajZ[i] = z;
    }
  }

  _projectToScreen() {
    const { rows, cols, trajX, trajZ } = this;
    const n = trajX.length;
    // Find bounds
    let xMin = Infinity, xMax = -Infinity, zMin = Infinity, zMax = -Infinity;
    for (let i = 0; i < n; i++) {
      if (trajX[i] < xMin) xMin = trajX[i];
      if (trajX[i] > xMax) xMax = trajX[i];
      if (trajZ[i] < zMin) zMin = trajZ[i];
      if (trajZ[i] > zMax) zMax = trajZ[i];
    }
    const margin = 0.06; // 6% margin on each side
    const marginX = cols * margin;
    const marginY = rows * margin;
    const scaleX = (cols - 2 * marginX) / (xMax - xMin || 1);
    const scaleY = (rows - 2 * marginY) / (zMax - zMin || 1);
    const scale = Math.min(scaleX, scaleY);
    const ox = (xMax + xMin) / 2;
    const oy = (zMax + zMin) / 2;
    const cx = cols / 2;
    const cy = rows / 2;

    this.screenX = new Float32Array(n);
    this.screenY = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.screenX[i] = (trajX[i] - ox) * scale + cx;
      this.screenY[i] = -(trajZ[i] - oy) * scale + cy; // flip so high Z = top
    }
  }

  step() {
    if (this.done) return;
    const { rows, cols, rng, screenX, screenY, numPasses, dissolutionMax,
            accumR, accumG, accumB } = this;
    const n = screenX.length;
    const brightnessPerPass = 0.15 / numPasses;
    let budget = this.pointsPerFrame;

    while (budget > 0 && !this.done) {
      const end = Math.min(this.currentPoint + budget, n);
      for (let i = this.currentPoint; i < end; i++) {
        let sx = screenX[i];
        let sy = screenY[i];

        // Dissolution based on screen Y position (0=top, 1=bottom)
        const t = Math.max(0, Math.min(1, sy / rows));
        const dissolution = Math.pow(t, 2.5) * dissolutionMax;

        if (dissolution > 0.01) {
          sx += rng.normal(0, dissolution);
          sy += rng.normal(0, dissolution);
        }

        const px = Math.floor(sx);
        const py = Math.floor(sy);
        if (px >= 0 && px < cols && py >= 0 && py < rows) {
          const idx = py * cols + px;
          // Warm white at top, cooling to blue-grey at bottom
          const warmth = 1.0 - t * 0.6;
          accumR[idx] += brightnessPerPass * (0.95 + 0.05 * warmth);
          accumG[idx] += brightnessPerPass * (0.90 + 0.05 * warmth);
          accumB[idx] += brightnessPerPass * (0.85 + 0.15 * (1 - warmth));
        }
      }
      budget -= (end - this.currentPoint);
      this.currentPoint = end;

      if (this.currentPoint >= n) {
        this.currentPass++;
        this.currentPoint = 0;
        if (this.currentPass >= numPasses) {
          this.done = true;
        }
      }
    }
  }

  getState() {
    const { accumR, accumG, accumB, rows, cols, nChars } = this;
    const brightness = new Float32Array(rows * cols);
    const chars = new Int32Array(rows * cols);
    const rgb = new Uint8Array(rows * cols * 3);

    // Find 98th percentile for each channel
    const findP98 = (arr) => {
      const vals = [];
      for (let i = 0; i < arr.length; i++) if (arr[i] > 0) vals.push(arr[i]);
      if (vals.length === 0) return 1;
      vals.sort((a, b) => a - b);
      return vals[Math.floor(vals.length * 0.98)] || 1;
    };
    const p98R = findP98(accumR);
    const p98G = findP98(accumG);
    const p98B = findP98(accumB);
    const gamma = 0.4;

    for (let i = 0; i < rows * cols; i++) {
      const r = Math.pow(Math.min(1, accumR[i] / p98R), gamma);
      const g = Math.pow(Math.min(1, accumG[i] / p98G), gamma);
      const b = Math.pow(Math.min(1, accumB[i] / p98B), gamma);
      // Luminance for character/brightness selection
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      brightness[i] = lum;
      chars[i] = Math.min(nChars - 1, Math.max(0, Math.floor(lum * (nChars - 1))));
      // Background: (5, 5, 12) blended with accumulation
      rgb[i * 3]     = Math.floor(Math.min(255, 5 + r * 250));
      rgb[i * 3 + 1] = Math.floor(Math.min(255, 5 + g * 250));
      rgb[i * 3 + 2] = Math.floor(Math.min(255, 12 + b * 243));
    }
    return { chars, brightness, rgb };
  }
}

// --- 9. Zone Plate Moiré ("Between Three Stones") ---
// Exact port of gen-003-v3.py: 4 circle sources, binary XOR, colour-tinted
class ZonePlateMoire {
  static renderMode = 'pixel';
  static label = 'Zone Plate Moiré';
  static desc = 'Binary XOR moiré — 4 circle sources with colour tinting';
  static prefPalette = 'ice';
  static prefRamp = 'standard';
  static params = [
    { key: 'sources', label: 'Sources', min: 2, max: 6, step: 1, def: 4 },
    { key: 'freqBase', label: 'Frequency', min: 20, max: 100, step: 1, def: 32 },
    { key: 'drift', label: 'Drift Speed', min: 0, max: 0.02, step: 0.001, def: 0.003 },
  ];

  constructor(rows, cols, rng, nChars, params) {
    this.rows = rows; this.cols = cols; this.rng = rng; this.nChars = nChars;
    const p = params || {};
    this.drift = p.drift ?? 0.003;
    // Original piece: 4 specific sources with exact positions and frequencies
    const defaultSources = [
      { cx: -0.44, cy: -0.32, freq: 28 },
      { cx:  0.40, cy: -0.12, freq: 35 },
      { cx: -0.12, cy:  0.46, freq: 31 },
      { cx:  0.18, cy: -0.42, freq: 33 },
    ];
    const nS = p.sources ?? 4;
    const freqBase = p.freqBase ?? 32;
    this.sources = [];
    for (let i = 0; i < nS; i++) {
      if (i < defaultSources.length && nS === 4 && freqBase === 32) {
        // Use exact original positions
        this.sources.push({
          cx: defaultSources[i].cx, cy: defaultSources[i].cy,
          freq: defaultSources[i].freq,
          dx: rng.uniform(-1, 1), dy: rng.uniform(-1, 1),
        });
      } else {
        this.sources.push({
          cx: rng.uniform(-0.5, 0.5), cy: rng.uniform(-0.5, 0.5),
          freq: freqBase + rng.uniform(-5, 5),
          dx: rng.uniform(-1, 1), dy: rng.uniform(-1, 1),
        });
      }
    }
    this.t = 0;
  }

  step() {
    this.t++;
    const drift = this.drift;
    for (const s of this.sources) {
      s.cx += s.dx * drift;
      s.cy += s.dy * drift;
      if (Math.abs(s.cx) > 0.6) s.dx *= -1;
      if (Math.abs(s.cy) > 0.6) s.dy *= -1;
    }
  }

  getState() {
    const { rows, cols, nChars, sources } = this;
    const brightness = new Float32Array(rows * cols);
    const chars = new Int32Array(rows * cols);
    const rgb = new Uint8Array(rows * cols * 3);
    const CR = 1.5;

    // Colour endpoints matching original Python
    const WARM  = [58, 30, 12];   // dark amber
    const COOL  = [12, 22, 52];   // dark indigo
    const PAPER = [248, 240, 225]; // warm cream

    for (let r = 0; r < rows; r++) {
      const ny = -CR + (2 * CR * r) / rows;
      for (let c = 0; c < cols; c++) {
        const nx = -CR + (2 * CR * c) / cols;
        const idx = r * cols + c;

        // Compute smooth field (for colour tinting) and binary XOR
        let smooth = 0;
        let xorVal = 0;
        for (const s of sources) {
          const dx = nx - s.cx, dy = ny - s.cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          smooth += Math.cos(2 * Math.PI * s.freq * dist);
          // Binary ring pattern: floor(r * freq * 2) % 2
          const ring = Math.floor(dist * s.freq * 2) % 2;
          xorVal ^= ring;
        }

        // Normalize smooth field per-frame (accumulate min/max)
        // For simplicity, use tanh to map to [0,1]
        const fn = 0.5 + 0.5 * Math.tanh(smooth * 0.3);
        const fnTint = Math.pow(fn, 0.7);

        if (xorVal === 1) {
          // Ink: interpolate warm→cool based on smooth field
          for (let ch = 0; ch < 3; ch++) {
            rgb[idx * 3 + ch] = Math.floor(WARM[ch] + fnTint * (COOL[ch] - WARM[ch]));
          }
          brightness[idx] = 0.15; // dark ink
        } else {
          // Paper: warm cream
          rgb[idx * 3]     = PAPER[0];
          rgb[idx * 3 + 1] = PAPER[1];
          rgb[idx * 3 + 2] = PAPER[2];
          brightness[idx] = 0.95;
        }
        chars[idx] = Math.min(nChars - 1, Math.max(0, Math.floor(brightness[idx] * (nChars - 1))));
      }
    }
    return { chars, brightness, rgb };
  }
}

// --- 10. Flow Field ("Prismatic Current") ---
// Exact port of gen-004-prismatic-current.py: sinusoidal flow field, spectral colour = direction
class FlowField {
  static renderMode = 'pixel';
  static label = 'Flow Field';
  static desc = 'Particle traces through a vector field — spectral colour encodes flow direction';
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
    const nP = p.particles || 4000;

    // Pre-compute flow field on grid (exact sinusoidal octaves from original Python)
    const GRID_RES = Math.min(200, Math.max(cols, rows));
    this.gridRes = GRID_RES;
    this.flowGrid = new Float32Array(GRID_RES * GRID_RES);
    for (let gy = 0; gy < GRID_RES; gy++) {
      const ny = gy / GRID_RES;
      for (let gx = 0; gx < GRID_RES; gx++) {
        const nx = gx / GRID_RES;
        // Exact octaves from gen-004-prismatic-current.py
        let angle = 0;
        angle += 2.0 * Math.sin(nx * 3.7 + 0.3) * Math.cos(ny * 2.9 - 0.7);
        angle += 1.2 * Math.sin(nx * 7.1 - ny * 5.3 + 1.2);
        angle += 0.8 * Math.cos(nx * 4.8 + ny * 6.7 - 0.5);
        angle += 0.5 * Math.sin(nx * 13.3 + ny * 11.7 + 2.1);
        angle += 0.3 * Math.cos(nx * 17.9 - ny * 15.1 - 0.9);
        angle += 0.4 * Math.sin(nx * 9.2 - ny * 8.4 + nx * ny * 3.0);
        this.flowGrid[gy * GRID_RES + gx] = angle;
      }
    }

    this.px = new Float32Array(nP);
    this.py = new Float32Array(nP);
    for (let i = 0; i < nP; i++) {
      this.px[i] = rng.uniform(0, cols);
      this.py[i] = rng.uniform(0, rows);
    }
    // RGB accumulation buffers (not just brightness)
    this.accumR = new Float32Array(rows * cols);
    this.accumG = new Float32Array(rows * cols);
    this.accumB = new Float32Array(rows * cols);
    this.stepCount = new Float32Array(nP); // track age per particle
    this.maxSteps = 200;
  }

  _getFlow(px, py) {
    const gx = Math.min(this.gridRes - 1, Math.max(0, Math.floor(px / this.cols * this.gridRes)));
    const gy = Math.min(this.gridRes - 1, Math.max(0, Math.floor(py / this.rows * this.gridRes)));
    return this.flowGrid[gy * this.gridRes + gx];
  }

  _hsvToRgb(h, s, v) {
    const i = Math.floor(h * 6) % 6;
    const f = h * 6 - Math.floor(h * 6);
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    let r, g, b;
    if (i === 0) { r = v; g = t; b = p; }
    else if (i === 1) { r = q; g = v; b = p; }
    else if (i === 2) { r = p; g = v; b = t; }
    else if (i === 3) { r = p; g = q; b = v; }
    else if (i === 4) { r = t; g = p; b = v; }
    else { r = v; g = p; b = q; }
    return [r, g, b];
  }

  step() {
    const { rows, cols, px, py, accumR, accumG, accumB, stepSize, stepCount, maxSteps, rng } = this;
    const nP = px.length;

    for (let i = 0; i < nP; i++) {
      if (stepCount[i] >= maxSteps) {
        // Reset particle
        px[i] = rng.uniform(0, cols);
        py[i] = rng.uniform(0, rows);
        stepCount[i] = 0;
      }

      const angle = this._getFlow(px[i], py[i]);

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
        // Spectral colour from direction (hue = angle)
        const hue = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI);
        const sat = 0.75 + 0.2 * Math.sin(stepCount[i] * 0.05);
        const [r, g, b] = this._hsvToRgb(hue, sat, 1.0);
        const ageFactor = 1.0 - (stepCount[i] / maxSteps) * 0.3;
        const bright = 0.012 * ageFactor;
        const idx = iy * cols + ix;
        accumR[idx] += r * bright * 255;
        accumG[idx] += g * bright * 255;
        accumB[idx] += b * bright * 255;
      }
      stepCount[i]++;
    }
  }

  getState() {
    const { accumR, accumG, accumB, rows, cols, nChars } = this;
    const brightness = new Float32Array(rows * cols);
    const chars = new Int32Array(rows * cols);
    const rgb = new Uint8Array(rows * cols * 3);

    // Find 97th percentile for tone mapping (matching Python)
    const findP97 = (arr) => {
      const vals = [];
      for (let i = 0; i < arr.length; i++) if (arr[i] > 0) vals.push(arr[i]);
      if (vals.length === 0) return 1;
      vals.sort((a, b) => a - b);
      return vals[Math.floor(vals.length * 0.97)] || 1;
    };
    const p97R = findP97(accumR), p97G = findP97(accumG), p97B = findP97(accumB);
    const gamma = 0.45;
    const BG = [3, 3, 8];

    for (let i = 0; i < rows * cols; i++) {
      const r = Math.pow(Math.min(1, accumR[i] / p97R), gamma);
      const g = Math.pow(Math.min(1, accumG[i] / p97G), gamma);
      const b = Math.pow(Math.min(1, accumB[i] / p97B), gamma);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      brightness[i] = lum;
      chars[i] = Math.min(nChars - 1, Math.max(0, Math.floor(lum * (nChars - 1))));
      rgb[i * 3]     = Math.floor(Math.min(255, BG[0] + r * (255 - BG[0])));
      rgb[i * 3 + 1] = Math.floor(Math.min(255, BG[1] + g * (255 - BG[1])));
      rgb[i * 3 + 2] = Math.floor(Math.min(255, BG[2] + b * (255 - BG[2])));
    }
    return { chars, brightness, rgb };
  }
}

// --- 11. Taxonomy ("Taxonomy of Possible Forms") ---
// Exact port of gen-002-taxonomy-v3.py: tight parameter range, weighted 9-neighbor laplacian, gold-on-navy
class TaxonomyRD {
  static renderMode = 'pixel';
  static pixelSize = 2;
  static label = 'Taxonomy RD';
  static desc = 'Gray-Scott with spatially varying parameters — spots → worms → labyrinths';
  static prefPalette = 'amber';
  static prefRamp = 'dense';
  static params = [
    { key: 'fMin', label: 'Feed min', min: 0.005, max: 0.05, step: 0.005, def: 0.030 },
    { key: 'fMax', label: 'Feed max', min: 0.03, max: 0.09, step: 0.005, def: 0.055 },
    { key: 'kMin', label: 'Kill min', min: 0.04, max: 0.065, step: 0.001, def: 0.057 },
    { key: 'kMax', label: 'Kill max', min: 0.055, max: 0.08, step: 0.001, def: 0.067 },
    { key: 'stepsPerFrame', label: 'Sim Speed', min: 4, max: 30, step: 2, def: 16 },
  ];

  constructor(rows, cols, rng, nChars, params) {
    this.rows = rows; this.cols = cols; this.rng = rng; this.nChars = nChars;
    const p = params || {};
    this.Du = 1.0; this.Dv = 0.5;
    this.stepsPerFrame = p.stepsPerFrame || 16;

    // Tight range matching v3 Python — entire canvas in pattern-forming zone
    const fMin = p.fMin ?? 0.030, fMax = p.fMax ?? 0.055;
    const kMin = p.kMin ?? 0.057, kMax = p.kMax ?? 0.067;

    this.F = new Float32Array(rows * cols);
    this.K = new Float32Array(rows * cols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        // f varies vertically, k varies horizontally (matching Python)
        this.F[i] = fMin + (fMax - fMin) * (r / rows) + rng.normal(0, 0.0002);
        this.K[i] = kMin + (kMax - kMin) * (c / cols) + rng.normal(0, 0.0001);
      }
    }

    this.U = new Float32Array(rows * cols).fill(1);
    this.V = new Float32Array(rows * cols);

    // Seed ~80 circular patches (matching Python seed=13 with 80 patches, radius 3-7)
    const nSeeds = 80;
    for (let s = 0; s < nSeeds; s++) {
      const sr = rng.int(15, rows - 15);
      const sc = rng.int(15, cols - 15);
      const rad = rng.int(3, 8);
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          if (dr * dr + dc * dc <= rad * rad) {
            const nr = sr + dr, nc = sc + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              const idx = nr * cols + nc;
              this.V[idx] = 1;
              this.U[idx] = 0;
            }
          }
        }
      }
    }
  }

  // Weighted 9-neighbor Laplacian matching Python's version
  _laplacian9(field) {
    const { rows, cols } = this;
    const L = new Float32Array(rows * cols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const rp = r > 0 ? r - 1 : rows - 1;
        const rn = r < rows - 1 ? r + 1 : 0;
        const cp = c > 0 ? c - 1 : cols - 1;
        const cn = c < cols - 1 ? c + 1 : 0;
        // -1*center + 0.2*cardinal + 0.05*diagonal
        L[i] = -field[i]
          + 0.2 * (field[rp * cols + c] + field[rn * cols + c] + field[r * cols + cp] + field[r * cols + cn])
          + 0.05 * (field[rp * cols + cp] + field[rp * cols + cn] + field[rn * cols + cp] + field[rn * cols + cn]);
      }
    }
    return L;
  }

  step() {
    const { rows, cols, U, V, F, K, Du, Dv, stepsPerFrame } = this;
    for (let s = 0; s < stepsPerFrame; s++) {
      const Lu = this._laplacian9(U);
      const Lv = this._laplacian9(V);
      for (let i = 0; i < rows * cols; i++) {
        const uvv = U[i] * V[i] * V[i];
        U[i] = Math.min(1, Math.max(0, U[i] + Du * Lu[i] - uvv + F[i] * (1 - U[i])));
        V[i] = Math.min(1, Math.max(0, V[i] + Dv * Lv[i] + uvv - (F[i] + K[i]) * V[i]));
      }
    }
  }

  getState() {
    const { V, rows, cols, nChars } = this;
    const brightness = new Float32Array(rows * cols);
    const chars = new Int32Array(rows * cols);
    const rgb = new Uint8Array(rows * cols * 3);

    // Gold-on-navy colour matching Python v3
    // Deep indigo background: (5, 4, 18) ~ base * 255
    // Structure: cool silver-blue → warm amber across diagonal
    let vMax = 0;
    for (let i = 0; i < rows * cols; i++) if (V[i] > vMax) vMax = V[i];
    if (vMax < 0.001) vMax = 1;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const lum = V[i] / vMax;
        const lumG = Math.pow(Math.min(1, lum), 0.8); // gamma matching Python

        // Diagonal warmth gradient
        const warmth = (r / rows + c / cols) / 2.0;
        const sr = 0.70 + 0.25 * warmth;
        const sg = 0.68 + 0.10 * warmth;
        const sb = 0.62 - 0.35 * warmth;

        // Base (deep indigo)
        const br = 0.02, bg = 0.015, bb = 0.07;

        const finalR = br + lumG * sr;
        const finalG = bg + lumG * sg;
        const finalB = bb + lumG * sb;

        brightness[i] = lumG;
        chars[i] = Math.min(nChars - 1, Math.max(0, Math.floor(lumG * (nChars - 1))));
        rgb[i * 3]     = Math.floor(Math.min(255, finalR * 255));
        rgb[i * 3 + 1] = Math.floor(Math.min(255, finalG * 255));
        rgb[i * 3 + 2] = Math.floor(Math.min(255, finalB * 255));
      }
    }
    return { chars, brightness, rgb };
  }
}

// --- 12. DLA Filament ("Filament") ---
// Port of gen-005-filament.py: DLA with ember chronology colour + distance field glow
class DLAFilament {
  static renderMode = 'pixel';
  static label = 'DLA Filament';
  static desc = 'Diffusion-limited aggregation — ember core to incandescent tips';
  static prefPalette = 'fire';
  static prefRamp = 'dense';
  static params = [
    { key: 'walkersPerFrame', label: 'Walkers/Frame', min: 50, max: 500, step: 50, def: 200 },
    { key: 'stickProb', label: 'Stick Probability', min: 0.1, max: 1.0, step: 0.05, def: 0.6 },
    { key: 'glowRadius', label: 'Glow Radius', min: 1, max: 6, step: 1, def: 3 },
  ];

  // Ember palette matching gen-005-filament.py
  // t=0 (core, oldest) → t=1 (tips, newest)
  static _emberStops = {
    t: [0.00, 0.08, 0.20, 0.35, 0.50, 0.65, 0.78, 0.88, 0.95, 1.00],
    h: [0.000, 0.002, 0.005, 0.010, 0.025, 0.050, 0.080, 0.110, 0.125, 0.130],
    s: [0.80, 0.82, 0.85, 0.88, 0.90, 0.88, 0.80, 0.60, 0.35, 0.15],
    v: [0.35, 0.40, 0.48, 0.56, 0.65, 0.76, 0.86, 0.93, 0.97, 1.00],
  };

  static _interpEmber(t) {
    const s = DLAFilament._emberStops;
    t = Math.max(0, Math.min(1, t));
    // Find segment
    let idx = 0;
    for (let i = 0; i < s.t.length - 1; i++) {
      if (t >= s.t[i] && t <= s.t[i + 1]) { idx = i; break; }
      if (i === s.t.length - 2) idx = i;
    }
    const frac = (t - s.t[idx]) / (s.t[idx + 1] - s.t[idx] || 1);
    const h = (s.h[idx] + frac * (s.h[idx + 1] - s.h[idx])) % 1;
    const sat = s.s[idx] + frac * (s.s[idx + 1] - s.s[idx]);
    const val = s.v[idx] + frac * (s.v[idx + 1] - s.v[idx]);

    // HSV → RGB
    const c = val * sat;
    const h6 = h * 6;
    const x = c * (1 - Math.abs(h6 % 2 - 1));
    const m = val - c;
    let r, g, b;
    const i = Math.floor(h6) % 6;
    if (i === 0) { r = c; g = x; b = 0; }
    else if (i === 1) { r = x; g = c; b = 0; }
    else if (i === 2) { r = 0; g = c; b = x; }
    else if (i === 3) { r = 0; g = x; b = c; }
    else if (i === 4) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }

  constructor(rows, cols, rng, nChars, params) {
    this.rows = rows; this.cols = cols; this.rng = rng; this.nChars = nChars;
    const p = params || {};
    this.walkersPerFrame = p.walkersPerFrame || 200;
    this.stickProb = p.stickProb || 0.6;
    this.glowRadius = p.glowRadius || 3;

    this.grid = new Uint8Array(rows * cols);
    this.order = new Float32Array(rows * cols);
    this.totalStuck = 0;

    // Seed at centre
    const cr = Math.floor(rows / 2), cc = Math.floor(cols / 2);
    this.grid[cr * cols + cc] = 1;
    this.order[cr * cols + cc] = 0;
    this.totalStuck = 1;

    this.brightness = new Float32Array(rows * cols);
    // Per-pixel nearest-aggregate order (for colour) and distance (for glow)
    this.nearestOrder = new Float32Array(rows * cols);
    this.nearestDist = new Float32Array(rows * cols).fill(9999);
    // Set seed distance to 0
    this.nearestDist[cr * cols + cc] = 0;
    this.nearestOrder[cr * cols + cc] = 0;
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
    const { rows, cols, rng, grid, order, walkersPerFrame, stickProb, glowRadius,
            nearestOrder, nearestDist } = this;
    const DECAY = 0.22;

    for (let w = 0; w < walkersPerFrame; w++) {
      let r, c;
      if (rng.random() < 0.5) {
        r = rng.int(0, rows);
        c = rng.random() < 0.5 ? 0 : cols - 1;
      } else {
        r = rng.random() < 0.5 ? 0 : rows - 1;
        c = rng.int(0, cols);
      }

      for (let s = 0; s < 500; s++) {
        const dir = rng.int(0, 4);
        if (dir === 0) r--; else if (dir === 1) r++; else if (dir === 2) c--; else c++;
        if (r < 0 || r >= rows || c < 0 || c >= cols) break;
        if (grid[r * cols + c]) break;

        if (this._isAdjacentToOccupied(r, c) && rng.random() < stickProb) {
          grid[r * cols + c] = 1;
          this.totalStuck++;
          order[r * cols + c] = this.totalStuck;

          // Update distance field around new particle
          const updateR = glowRadius + 8;
          for (let dr = -updateR; dr <= updateR; dr++) {
            for (let dc = -updateR; dc <= updateR; dc++) {
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                const dist = Math.sqrt(dr * dr + dc * dc);
                const idx = nr * cols + nc;
                if (dist < nearestDist[idx]) {
                  nearestDist[idx] = dist;
                  nearestOrder[idx] = this.totalStuck;
                }
              }
            }
          }
          break;
        }
      }
    }

    // Update brightness from distance field
    const AMBIENT = 0.06;
    for (let i = 0; i < rows * cols; i++) {
      const d = nearestDist[i];
      let b = 1.0 / (1.0 + d * DECAY);
      const ambient = AMBIENT * Math.max(0, 1.0 - d * 0.03);
      b = Math.max(b, ambient);
      this.brightness[i] = Math.pow(Math.min(1, b), 0.85);
    }
  }

  getState() {
    const { brightness, nearestOrder, totalStuck, rows, cols, nChars, grid } = this;
    const chars = new Int32Array(rows * cols);
    const rgb = new Uint8Array(rows * cols * 3);
    const BG = [3, 3, 8];
    const maxOrder = Math.max(1, totalStuck);

    for (let i = 0; i < rows * cols; i++) {
      const b = brightness[i];
      chars[i] = Math.min(nChars - 1, Math.max(0, Math.floor(b * (nChars - 1))));

      // Chronology colour: t=0 core (oldest), t=1 tips (newest)
      const t = nearestOrder[i] / maxOrder;
      const [er, eg, eb] = DLAFilament._interpEmber(t);

      // Blend ember colour with brightness
      const bgW = Math.max(0, 1.0 - b);
      rgb[i * 3]     = Math.floor(Math.min(255, BG[0] * bgW + er * b));
      rgb[i * 3 + 1] = Math.floor(Math.min(255, BG[1] * bgW + eg * b));
      rgb[i * 3 + 2] = Math.floor(Math.min(255, BG[2] * bgW + eb * b));
    }
    return { chars, brightness, rgb };
  }
}

window.ALGORITHMS = {
  matrix: MatrixRain, smoke: FluidSmoke, reaction: ReactionDiffusion,
  fire: FireEffect, waves: WaveInterference, automata: CellularCascade, swirl: ParticleSwirl,
  lorenz: LorenzDissolution, zoneplate: ZonePlateMoire, flowfield: FlowField,
  taxonomy: TaxonomyRD, dla: DLAFilament,
};
