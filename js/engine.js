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
};

class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.fontFamily = "'DejaVu Sans Mono', 'Fira Code', 'Courier New', monospace";
  }

  setup(fontSize) {
    this.fontSize = fontSize;
    this.ctx.font = `${fontSize}px ${this.fontFamily}`;
    const m = this.ctx.measureText('M');
    this.charW = Math.ceil(m.width) || Math.ceil(fontSize * 0.6);
    this.charH = Math.ceil(fontSize * 1.2);

    const rect = this.canvas.parentElement.getBoundingClientRect();
    const panelW = 280;
    const availW = window.innerWidth - panelW;
    const availH = window.innerHeight;
    this.canvas.width = availW;
    this.canvas.height = availH;

    this.cols = Math.floor(availW / this.charW);
    this.rows = Math.floor(availH / this.charH);

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
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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

  _applyScanlines(ctx, canvas) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 1; y < canvas.height; y += 2) {
      ctx.fillRect(0, y, canvas.width, 1);
    }
  }

  _applyVignette(ctx, canvas) {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const r = Math.max(cx, cy) * 1.2;
    const grad = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
