# Glyph 🔣

Interactive algorithmic ASCII art generator. Runs entirely in your browser — no server, no dependencies.

**[▶ Try it live](https://donshelly.github.io/glyph)**

## Algorithms

| Algorithm | Description |
|-----------|-------------|
| **Matrix Rain** | Cascading columns of digital glyphs |
| **Fluid Smoke** | Rising smoke wisps with fluid dynamics |
| **Reaction-Diffusion** | Gray-Scott morphogenesis — organic patterns |
| **Fire** | Classic demoscene fire effect |
| **Wave Interference** | Circular waves from multiple point sources |
| **Cellular Automata** | 1D rules cascading into complex structures |
| **Particle Swirl** | Particles orbiting gravitational attractors |

## Controls

- **Algorithm** — pick your simulation
- **Palette** — 9 colour schemes (matrix, cyan, amber, fire, ice, etc.)
- **Character Set** — ASCII ramps from minimal to dense
- **Font Size** — affects grid resolution (smaller = more detail)
- **Speed** — simulation speed multiplier
- **Algorithm-specific params** — each algo has unique tweakable settings
- **Effects** — scanlines, vignette, glow post-processing
- **Seed** — reproducible randomness. Same seed = same art.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Pause/Play |
| `R` | Restart |
| `S` | Random seed |

## How It Works

Everything is algorithmically rendered. Numpy-style typed arrays, physics simulations, cellular automata — pure code. The aesthetic is ASCII characters on dark backgrounds with CRT-style post-processing.

No AI image generation. No external APIs. Just maths.

## Local Development

```bash
# Just open index.html — it's all static
open index.html

# Or serve it
python3 -m http.server 8080
```

## Credits

Built by [ELSOLVE](https://elsolve.co.uk) agents. The generative algorithms are ported from a Python/numpy video renderer (internal tool).

## Licence

MIT
