// Main — wires everything together

(function() {
  const canvas = document.getElementById('canvas');
  const engine = new Engine(canvas);
  const ui = new UI();

  // DOM elements
  const artworkSel = document.getElementById('artwork');
  const artworkMeta = document.getElementById('artworkMeta');
  const algoSel = document.getElementById('algo');
  const paletteSel = document.getElementById('palette');
  const rampSel = document.getElementById('ramp');
  const fontSlider = document.getElementById('fontSize');
  const fontVal = document.getElementById('fontSizeVal');
  const speedSlider = document.getElementById('speed');
  const speedVal = document.getElementById('speedVal');
  const seedInput = document.getElementById('seed');
  const randomSeedBtn = document.getElementById('randomSeed');
  const restartBtn = document.getElementById('restart');
  const pauseBtn = document.getElementById('pause');
  const fxScanlines = document.getElementById('fxScanlines');
  const fxVignette = document.getElementById('fxVignette');
  const fxGlow = document.getElementById('fxGlow');
  const fpsDisplay = document.getElementById('fpsDisplay');
  const frameDisplay = document.getElementById('frameDisplay');
  const submitVariantBtn = document.getElementById('submitVariant');
  const submitStatus = document.getElementById('submitStatus');
  const variantComment = document.getElementById('variantComment');
  const glyphNote = document.getElementById('glyphNote');
  const submitNoteBtn = document.getElementById('submitNote');
  const notesList = document.getElementById('notesList');
  const variantsList = document.getElementById('variantsList');

  let artworks = [];
  let currentArtwork = null;
  let algo = null;
  let running = true;
  let frameCount = 0;
  let lastFpsTime = performance.now();
  let fpsFrames = 0;
  let speed = 1.0;
  let stepsAccum = 0;

  function readCurrentConfig() {
    return {
      algo: algoSel.value,
      palette: paletteSel.value,
      ramp: rampSel.value,
      fontSize: parseInt(fontSlider.value),
      speed: parseFloat(speedSlider.value),
      seed: parseInt(seedInput.value) || 42,
      fx: {
        scanlines: fxScanlines.checked,
        vignette: fxVignette.checked,
        glow: fxGlow.checked,
      },
      params: ui.getParams(),
    };
  }

  function applyConfig(config = {}) {
    if (!config) return;

    if (config.algo) algoSel.value = config.algo;
    if (config.palette) paletteSel.value = config.palette;
    if (config.ramp) rampSel.value = config.ramp;
    if (config.fontSize != null) fontSlider.value = config.fontSize;
    if (config.speed != null) speedSlider.value = config.speed;
    if (config.seed != null) seedInput.value = config.seed;

    fontVal.textContent = fontSlider.value;
    speed = parseFloat(speedSlider.value);
    speedVal.textContent = speed.toFixed(1);

    if (config.fx) {
      fxScanlines.checked = !!config.fx.scanlines;
      fxVignette.checked = !!config.fx.vignette;
      fxGlow.checked = !!config.fx.glow;
    }

    const AlgoClass = ALGORITHMS[algoSel.value];
    ui.buildParams(AlgoClass, config.params || null);
  }

  function init() {
    const fontSize = parseInt(fontSlider.value);
    const { rows, cols } = engine.setup(fontSize);

    const algoName = algoSel.value;
    const AlgoClass = ALGORITHMS[algoName];

    if (AlgoClass.prefPalette && !paletteSel._userSet) paletteSel.value = AlgoClass.prefPalette;
    if (AlgoClass.prefRamp && !rampSel._userSet) rampSel.value = AlgoClass.prefRamp;

    if (Object.keys(ui.getParams()).length === 0) {
      ui.buildParams(AlgoClass);
    }

    const seed = parseInt(seedInput.value) || 42;
    const rng = new RNG(seed);
    const ramp = RAMPS[rampSel.value] || RAMPS.standard;

    algo = new AlgoClass(rows, cols, rng, ramp.length, ui.getParams());
    frameCount = 0;
  }

  function frame() {
    if (!running) { requestAnimationFrame(frame); return; }

    stepsAccum += speed;
    const steps = Math.floor(stepsAccum);
    stepsAccum -= steps;

    for (let i = 0; i < steps; i++) {
      algo.step();
      frameCount++;
    }

    if (steps > 0) {
      const { chars, brightness } = algo.getState();
      const fx = {
        scanlines: fxScanlines.checked,
        vignette: fxVignette.checked,
        glow: fxGlow.checked,
      };
      engine.render(chars, brightness, rampSel.value, paletteSel.value, fx);
    }

    fpsFrames++;
    const now = performance.now();
    if (now - lastFpsTime > 1000) {
      fpsDisplay.textContent = `${fpsFrames} fps`;
      fpsFrames = 0;
      lastFpsTime = now;
    }
    frameDisplay.textContent = `frame ${frameCount}`;

    requestAnimationFrame(frame);
  }

  async function loadArtworks() {
    try {
      const data = await Store.getArtworks();
      artworks = data.items || [];
    } catch (err) {
      artworkMeta.textContent = `Could not load artworks: ${err.message}`;
      artworks = [];
    }

    artworkSel.innerHTML = '';
    for (const item of artworks) {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.title;
      artworkSel.appendChild(opt);
    }

    if (artworks.length > 0) {
      setCurrentArtwork(artworks[0].id);
    }
  }

  function setCurrentArtwork(id) {
    const found = artworks.find(a => a.id === id);
    if (!found) return;
    currentArtwork = found;
    artworkSel.value = id;
    const mode = found.presentation?.mode || 'animated';
    artworkMeta.textContent = `${mode.toUpperCase()} • ${found.description || ''}`;
    applyConfig(found.defaultConfig || {});
    init();
    loadVariants();
  }

  function renderFeed(el, items, mapper) {
    el.innerHTML = '';
    if (!items || items.length === 0) {
      el.innerHTML = '<div class="feed-item">No entries yet.</div>';
      return;
    }
    for (const item of items) {
      const d = document.createElement('div');
      d.className = 'feed-item';
      d.innerHTML = mapper(item);
      el.appendChild(d);
    }
  }

  async function loadNotes() {
    try {
      const data = await Store.getComments(20);
      renderFeed(notesList, data.items || [], (item) =>
        `<div class="meta">${new Date(item.created_at).toLocaleString()}</div>${item.comment || ''}`
      );
    } catch (err) {
      notesList.innerHTML = `<div class="feed-item">${err.message}</div>`;
    }
  }

  async function loadVariants() {
    if (!currentArtwork) return;
    try {
      const data = await Store.getVariants(currentArtwork.id);
      renderFeed(variantsList, data.items || [], (item) => {
        const c = item.comment ? `<div>${item.comment}</div>` : '';
        return `<div class="meta">${new Date(item.created_at).toLocaleString()}</div>${c}`;
      });
    } catch (err) {
      variantsList.innerHTML = `<div class="feed-item">${err.message}</div>`;
    }
  }

  artworkSel.addEventListener('change', () => setCurrentArtwork(artworkSel.value));

  algoSel.addEventListener('change', () => {
    paletteSel._userSet = false;
    rampSel._userSet = false;
    ui.buildParams(ALGORITHMS[algoSel.value]);
    init();
  });

  paletteSel.addEventListener('change', () => { paletteSel._userSet = true; });
  rampSel.addEventListener('change', () => { rampSel._userSet = true; });

  fontSlider.addEventListener('input', () => {
    fontVal.textContent = fontSlider.value;
    init();
  });

  speedSlider.addEventListener('input', () => {
    speed = parseFloat(speedSlider.value);
    speedVal.textContent = speed.toFixed(1);
  });

  randomSeedBtn.addEventListener('click', () => {
    seedInput.value = Math.floor(Math.random() * 999999);
    init();
  });

  restartBtn.addEventListener('click', init);

  pauseBtn.addEventListener('click', () => {
    running = !running;
    pauseBtn.textContent = running ? '⏸ Pause' : '▶ Play';
    pauseBtn.classList.toggle('active', !running);
  });

  submitVariantBtn.addEventListener('click', async () => {
    if (!currentArtwork) return;
    submitStatus.textContent = 'Submitting…';
    try {
      await Store.addVariant({
        artworkId: currentArtwork.id,
        comment: variantComment.value.trim(),
        config: readCurrentConfig(),
      });
      submitStatus.textContent = 'Saved. Glyph can now review this param set.';
      variantComment.value = '';
      await loadVariants();
    } catch (err) {
      submitStatus.textContent = `Failed: ${err.message}`;
    }
  });

  submitNoteBtn.addEventListener('click', async () => {
    const text = glyphNote.value.trim();
    if (!text) return;
    try {
      await Store.addComment({ artworkId: currentArtwork?.id || null, comment: text });
      glyphNote.value = '';
      await loadNotes();
    } catch (err) {
      submitStatus.textContent = `Note failed: ${err.message}`;
    }
  });

  ui.on('change', init);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(init, 200);
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === ' ') { e.preventDefault(); pauseBtn.click(); }
    if (e.key === 'r') { restartBtn.click(); }
    if (e.key === 's') { randomSeedBtn.click(); }
  });

  (async function boot() {
    await loadArtworks();
    if (!currentArtwork) {
      ui.buildParams(ALGORITHMS[algoSel.value]);
      init();
    }
    await loadNotes();
    requestAnimationFrame(frame);
  })();
})();
