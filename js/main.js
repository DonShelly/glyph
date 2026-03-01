// Main — wires everything together

(function() {
  const canvas = document.getElementById('canvas');
  const engine = new Engine(canvas);
  const ui = new UI();

  // DOM elements
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

  let algo = null;
  let running = true;
  let frameCount = 0;
  let lastFpsTime = performance.now();
  let fpsFrames = 0;
  let speed = 1.0;
  let stepsAccum = 0;

  function init() {
    const fontSize = parseInt(fontSlider.value);
    const { rows, cols } = engine.setup(fontSize);

    const algoName = algoSel.value;
    const AlgoClass = ALGORITHMS[algoName];

    // Set preferred palette/ramp if algo has a preference
    if (AlgoClass.prefPalette && !paletteSel._userSet) {
      paletteSel.value = AlgoClass.prefPalette;
    }
    if (AlgoClass.prefRamp && !rampSel._userSet) {
      rampSel.value = AlgoClass.prefRamp;
    }

    ui.buildParams(AlgoClass);

    const seed = parseInt(seedInput.value) || 42;
    const rng = new RNG(seed);
    const ramp = RAMPS[rampSel.value] || RAMPS.standard;

    algo = new AlgoClass(rows, cols, rng, ramp.length, ui.getParams());
    frameCount = 0;
  }

  function frame(ts) {
    if (!running) { requestAnimationFrame(frame); return; }

    // Speed control: accumulate fractional steps
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

    // FPS counter
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

  // --- Event handlers ---

  algoSel.addEventListener('change', () => {
    paletteSel._userSet = false;
    rampSel._userSet = false;
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

  ui.on('change', init);

  // Resize handling
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(init, 200);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === ' ') { e.preventDefault(); pauseBtn.click(); }
    if (e.key === 'r') { restartBtn.click(); }
    if (e.key === 's') { randomSeedBtn.click(); }
  });

  // Boot
  init();
  requestAnimationFrame(frame);
})();
