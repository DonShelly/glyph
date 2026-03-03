(async function () {
  const gallery = document.getElementById('gallery');

  function getArtworkMedia(item) {
    const candidates = [
      item?.original?.url,
      item?.originalUrl,
      item?.output?.url,
      item?.outputUrl,
      item?.image?.url,
      item?.imageUrl,
      item?.render?.url,
      item?.renderUrl,
      item?.assets?.full,
      item?.assets?.image,
      item?.assets?.preview,
      item?.previewUrl,
      item?.thumbnailUrl,
    ].filter(Boolean);

    const url = candidates.find(Boolean) || null;
    const mw = Number(item?.original?.width || item?.output?.width || item?.image?.width || item?.presentation?.width || 0);
    const mh = Number(item?.original?.height || item?.output?.height || item?.image?.height || item?.presentation?.height || 0);
    return { url, width: mw, height: mh };
  }

  function makeCard(item) {
    const a = document.createElement('a');
    a.className = 'card';
    a.href = `/detail.html?id=${encodeURIComponent(item.id)}`;

    const media = getArtworkMedia(item);
    const w = media.width || 1280;
    const h = media.height || 720;
    a.style.aspectRatio = `${w} / ${h}`;

    let visual;
    if (media.url) {
      const img = document.createElement('img');
      img.className = 'thumb';
      img.src = media.url;
      img.alt = item.title || item.id;
      img.loading = 'lazy';
      visual = img;
    } else {
      const canvas = document.createElement('canvas');
      canvas.className = 'thumb';
      canvas.width = w;
      canvas.height = h;
      visual = canvas;
    }

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    const sourceLabel = item.source === 'original' ? 'Original' : 'Canvas Render';
    const sourceClass = item.source === 'original' ? 'source-original' : 'source-render';
    overlay.innerHTML = `
      <h3>${item.title || item.id}</h3>
      <p>${item.description || 'No description yet.'}</p>
      <span class="source-badge ${sourceClass}">${sourceLabel}</span>
    `;

    a.appendChild(visual);
    a.appendChild(overlay);
    return { a, canvas: visual.tagName === 'CANVAS' ? visual : null };
  }

  function renderThumb(canvas, item) {
    const cfg = item.defaultConfig || {};
    const algoName = cfg.algo || 'matrix';
    const AlgoClass = ALGORITHMS[algoName] || ALGORITHMS.matrix;
    const rampName = cfg.ramp || AlgoClass.prefRamp || 'standard';
    const ramp = RAMPS[rampName] || RAMPS.standard;
    const paletteName = cfg.palette || AlgoClass.prefPalette || 'matrix';
    const paletteFn = PALETTES[paletteName] || PALETTES.matrix;

    const ctx = canvas.getContext('2d');
    const fontSize = Math.max(8, Math.min(14, cfg.fontSize || 12));
    const charW = Math.ceil(fontSize * 0.62);
    const charH = Math.ceil(fontSize * 1.2);
    const cols = Math.max(16, Math.floor(canvas.width / charW));
    const rows = Math.max(12, Math.floor(canvas.height / charH));

    const rng = new RNG(cfg.seed || 42);
    const algo = new AlgoClass(rows, cols, rng, ramp.length, cfg.params || {});

    for (let i = 0; i < 36; i++) algo.step();

    const fx = {
      scanlines: cfg.fx?.scanlines !== false,
      vignette: cfg.fx?.vignette !== false,
    };

    const { chars, brightness } = algo.getState();

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${fontSize}px 'DejaVu Sans Mono','Fira Code','Courier New',monospace`;
    ctx.textBaseline = 'top';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const b = brightness[idx];
        if (b < 0.02) continue;
        const ch = ramp[Math.min(ramp.length - 1, Math.max(0, chars[idx]))] || ' ';
        if (ch === ' ') continue;
        const [cr, cg, cb] = paletteFn(b);
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx.fillText(ch, c * charW, r * charH);
      }
    }

    if (fx.scanlines) {
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      for (let y = 1; y < canvas.height; y += 2) ctx.fillRect(0, y, canvas.width, 1);
    }

    if (fx.vignette) {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const r = Math.max(cx, cy) * 1.18;
      const g = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  try {
    const data = await Store.getArtworks();
    let items = data.items || [];

    const byId = new Map();
    for (const it of items) byId.set(it.id, it);
    items = [...byId.values()].sort((a, b) => {
      const ta = Date.parse(a.generated || a.created_at || 0) || 0;
      const tb = Date.parse(b.generated || b.created_at || 0) || 0;
      return tb - ta;
    });

    if (!items.length) {
      gallery.innerHTML = '<p style="color:#777">No artworks yet.</p>';
      return;
    }

    const cards = items.map(makeCard);
    cards.forEach(({ a }) => gallery.appendChild(a));
    cards.forEach(({ canvas }, i) => {
      if (canvas) renderThumb(canvas, items[i]);
    });
  } catch (err) {
    gallery.innerHTML = `<p style="color:#d77">Could not load artworks: ${err.message}</p>`;
  }
})();