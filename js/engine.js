// Rendering engine — draws ASCII characters on Canvas

const RAMPS = {
  standard:  ' .·:;+=xX$#@'.split(''),
  blocks:    ' ░▒▓█'.split(''),
  minimal:   ' .-=+*#@'.split(''),
  digital:   '0123456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz!@#$%&*<>{}[]|/~'.split(''),
  dense:     ' .:;+=x#@█'.split(''),
  dots:      ' ·∘○●◉'.split(''),
};

const PALETTES = {
  matrix:   b => [Math.floor(30*b), Math.floor(255*b), Math.floor(50*b)],
  cyan:     b => [Math.floor(20*b), Math.floor(200*b), Math.floor(255*b)],
  amber:    b => [Math.floor(255*b), Math.floor(160*b), Math.floor(20*b)],
  phosphor: b => [Math.floor(80*b), Math.floor(255*b), Math.floor(60*b)],
  lavender: b => [Math.floor(140*b), Math.floor(80*b), Math.floor(255*b)],
  fire:     b => [Math.min(255,Math.floor(280*b)), Math.max(0,Math.floor(180*b-40)), Math.max(0,Math.floor(60*b-80))],
  ice:      b => [Math.floor(160*b), Math.floor(210*b), Math.floor(255*b)],
  rose:     b => [Math.floor(255*b), Math.floor(80*b), Math.floor(120*b)],
  solar:    b => [Math.floor(255*b), Math.floor(200*b), Math.max(0,Math.floor(100*b-30))],
  warmwhite: b => [Math.floor(245*b), Math.floor(235*b), Math.floor(215*b)],
};

class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.fontFamily = "'DejaVu Sans Mono', 'Fira Code', 'Courier New', monospace";
  }

  setup(fontSize, options = {}) {
    this.fontSize = fontSize;
    this.pixelMode = !!options.pixelMode;
    if (this.pixelMode) {
      // Use algorithm-preferred pixel size, default 1 for full resolution
      const pxSize = options.pixelSize || 1;
      this.charW = pxSize;
      this.charH = pxSize;
    } else {
      this.ctx.font = `${fontSize}px ${this.fontFamily}`;
      const m = this.ctx.measureText('M');
      this.charW = Math.ceil(m.width) || Math.ceil(fontSize * 0.6);
      this.charH = Math.ceil(fontSize * 1.2);
    }

    const rect = this.canvas.parentElement.getBoundingClientRect();
    const availW = Math.max(1, Math.floor(rect.width || this.canvas.clientWidth || window.innerWidth));
    const availH = Math.max(1, Math.floor(rect.height || this.canvas.clientHeight || window.innerHeight));

    let targetW = availW;
    let targetH = availH;
    const ratio = Number(options.aspectRatio || 0);
    if (Number.isFinite(ratio) && ratio > 0) {
      if (availW / availH > ratio) {
        targetH = availH;
        targetW = Math.floor(targetH * ratio);
      } else {
        targetW = availW;
        targetH = Math.floor(targetW / ratio);
      }
    }

    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    this.viewW = targetW;
    this.viewH = targetH;
    this.canvas.style.width = `${targetW}px`;
    this.canvas.style.height = `${targetH}px`;
    this.canvas.width = Math.max(1, Math.floor(targetW * dpr));
    this.canvas.height = Math.max(1, Math.floor(targetH * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.cols = Math.max(1, Math.floor(targetW / this.charW));
    this.rows = Math.max(1, Math.floor(targetH / this.charH));

    // Pre-render character tiles as offscreen canvases for each brightness level
    this._tileCache = null; // Invalidate
    return { rows: this.rows, cols: this.cols };
  }

  render(chars, brightness, rampName, paletteName, fx) {
    const { ctx, canvas, rows, cols, charW, charH, fontSize, fontFamily } = this;
    const ramp = RAMPS[rampName] || RAMPS.standard;
    const paletteFn = PALETTES[paletteName] || PALETTES.matrix;
    const nChars = ramp.length;

    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.viewW || canvas.width, this.viewH || canvas.height);

    // Draw characters
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'top';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const b = brightness[idx];
        if (b < 0.01) continue;

        const ci = Math.min(nChars - 1, Math.max(0, chars[idx]));
        const ch = ramp[ci];
        if (ch === ' ') continue;

        const [cr, cg, cb] = paletteFn(b);
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx.fillText(ch, c * charW, r * charH);
      }
    }

    // Post-processing
    if (fx.glow) this._applyGlow(ctx, canvas);
    if (fx.scanlines) this._applyScanlines(ctx, canvas);
    if (fx.vignette) this._applyVignette(ctx, canvas);
  }

  renderPixels(brightness, paletteName, fx, rgb) {
    const { ctx, rows, cols, charW, charH } = this;
    const paletteFn = PALETTES[paletteName] || PALETTES.matrix;

    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.viewW || this.canvas.width, this.viewH || this.canvas.height);

    // Draw filled rectangles (pixel blocks) instead of characters
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const b = brightness[idx];
        if (b < 0.005) continue;

        let cr, cg, cb;
        if (rgb) {
          cr = rgb[idx * 3];
          cg = rgb[idx * 3 + 1];
          cb = rgb[idx * 3 + 2];
        } else {
          [cr, cg, cb] = paletteFn(b);
        }
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx.fillRect(c * charW, r * charH, charW, charH);
      }
    }

    // Post-processing
    if (fx.glow) this._applyGlow(ctx, this.canvas);
    if (fx.scanlines) this._applyScanlines(ctx, this.canvas);
    if (fx.vignette) this._applyVignette(ctx, this.canvas);
  }

  _applyScanlines(ctx, canvas) {
    const w = this.viewW || canvas.width;
    const h = this.viewH || canvas.height;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 1; y < h; y += 2) {
      ctx.fillRect(0, y, w, 1);
    }
  }

  _applyVignette(ctx, canvas) {
    const w = this.viewW || canvas.width;
    const h = this.viewH || canvas.height;
    const cx = w / 2, cy = h / 2;
    const r = Math.max(cx, cy) * 1.2;
    const grad = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  _applyGlow(ctx, canvas) {
    // Cheap glow: draw a blurred copy of the canvas additively
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.12;
    ctx.filter = 'blur(4px)';
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();
    ctx.filter = 'none';
  }
}

window.Engine = Engine;
window.RAMPS = RAMPS;
window.PALETTES = PALETTES;
