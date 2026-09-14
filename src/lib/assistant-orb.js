/* ==========================================================================
   assistant-orb.js — the Siri-style liquid orb the assistant wears.

   Two states, and the whole point of the file is the distance between them:

     idle      slow, desaturated, barely breathing — a machine at rest
     thinking  seven times faster, saturated, brighter — a machine composing

   The orb is a port of the reference WebGPU "Glass Liquid" shader's Siri
   preset (style 9) with its glass shell on, rendered here in Canvas 2D. The
   band model, the cos² envelope, the dominance-weighted spectrum, the rim
   refraction and the two-lobe shell lighting are the shader's own
   expressions, evaluated per pixel in JavaScript.

   WHY NOT WEBGPU. The reference needs `navigator.gpu` and stops dead with
   "WebGPU is not supported" without it. This prototype has to demo offline
   from two static hosts onto whatever browser is in the room, and the orb is
   44px across — at that size the shader's five-octave noise, its chromatic
   dispersion and its 221k-instance particle pipeline resolve to about six
   pixels of difference. So: one renderer, no adapter negotiation, and no
   blank circle on a machine without a GPU adapter. What is kept is the part
   you can see at 44px — the wave, its colour, and the glass around it.

   The one deliberate cut is the chromatic channel split: three fluid
   evaluations per pixel to produce a fringe of 0.14 · gloss · profile ball
   radii, which here is under a third of a pixel. One evaluation, not three.

   PALETTE. The reference's thinking state opens on gold. This console
   reserves violet #a78bfa for machine inference (FR-91) and puts amber
   #ffb224 in the rating ramp, so a gold orb would read as a measurement on
   the same screen as the measurements it is describing. Cyan, magenta and
   violet below are the reference's exactly; its gold becomes the console's
   own violet, and idle drops the reference's warm sand for the same reason.
   ========================================================================== */

/* The ball's radius in the canvas's [-1, 1] space. The reference sits at 0.72
   because it renders full-bleed and wants room around the ball; here the orb
   IS the button, so it very nearly fills its box. */
const BALL_RADIUS = 0.92;

/* Above this the buffer is upscaled by CSS rather than evaluated. The wave is
   smooth, so the cap costs nothing visible — it only stops a large orb from
   costing what a large orb would cost. */
const MAX_BUFFER = 96;

/* The reference's own transition timings. Waking is a cubic ease-out so the
   orb snaps to attention; settling is a smoothstep so it drifts back down
   over a beat and a half rather than switching off. */
const WAKE_MS = 800;
const SETTLE_MS = 2000;

const HALF_PI = Math.PI / 2;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/* ---------- The two states ----------
   Scalars are the reference's seeds verbatim: they carry the motion, and the
   gap between the two columns is the whole effect. Colours are re-keyed to
   the violet lane — see the header. */

const SCALAR_KEYS = [
  'speed', 'zoom', 'warp', 'ridgeAmt', 'shade', 'sheen', 'gloss',
  'shellMidAlpha', 'shellEdgeAlpha', 'exposure', 'glassOpacity',
];
const COLOR_KEYS = [
  'colorA', 'colorB', 'colorC', 'colorD', 'highlight',
  'shellInner', 'shellMid', 'shellEdge', 'sheenColor', 'specColor', 'canvas',
];

const SEEDS = {
  idle: {
    speed: 0.246, zoom: 0.3384, warp: 1.664, ridgeAmt: 0.24, shade: 0.12,
    sheen: 1.8, gloss: 0.24, shellMidAlpha: 0.11, shellEdgeAlpha: 0.13,
    /* The reference idles at 1.36, rendering full-bleed at ~600px where a
       faint crest still spans a hundred pixels. At 44px it spans six, and at
       1.36 the resting orb reads as an unlit circle — which is wrong for the
       one control that has to invite a click. Lifted until the wave is legible
       at rest, still well under thinking's 2.0. */
    exposure: 1.6, glassOpacity: 0.95,
    colorA: '#6b6488', colorB: '#5a7f93', colorC: '#8a6a99', colorD: '#5b5490',
    highlight: '#b6c4d2',
    shellInner: '#ffffff', shellMid: '#9bf4ff', shellEdge: '#c5a9ff',
    sheenColor: '#eaf4ff', specColor: '#dceaff', canvas: '#030409',
  },
  thinking: {
    speed: 1.69, zoom: 0.36, warp: 3.2, ridgeAmt: 0.5, shade: 0.12,
    sheen: 1.8, gloss: 0.24, shellMidAlpha: 0.11, shellEdgeAlpha: 0.13,
    exposure: 2.0, glassOpacity: 0.95,
    colorA: '#a78bfa', colorB: '#82f4ff', colorC: '#ff7bd5', colorD: '#8e6cff',
    highlight: '#ffffff',
    shellInner: '#ffffff', shellMid: '#9bf4ff', shellEdge: '#c5a9ff',
    sheenColor: '#eaf4ff', specColor: '#dceaff', canvas: '#030409',
  },
};

/* ---------- Interpolating between them ----------
   Scalars lerp straight. Colours lerp in LINEAR light, because sRGB is a
   perceptual encoding: lerping violet→cyan in it drags the midpoint through
   a muddy grey that neither endpoint contains. Every colour is therefore held
   linear everywhere except the moment before it is written to a pixel. */

const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

const linearRGB = (hex) => [
  toLinear(parseInt(hex.slice(1, 3), 16) / 255),
  toLinear(parseInt(hex.slice(3, 5), 16) / 255),
  toLinear(parseInt(hex.slice(5, 7), 16) / 255),
];

/** A blendable snapshot: scalars, and colours in linear light. */
function lightBag() {
  const bag = { scalars: {}, colors: {} };
  for (const key of SCALAR_KEYS) bag.scalars[key] = 0;
  for (const key of COLOR_KEYS) bag.colors[key] = [0, 0, 0];
  return bag;
}

/** What the renderer reads: the same values, colours back in sRGB. */
function renderBag() {
  const bag = {};
  for (const key of SCALAR_KEYS) bag[key] = 0;
  for (const key of COLOR_KEYS) bag[key] = [0, 0, 0];
  return bag;
}

const STATES = {};
for (const [name, seed] of Object.entries(SEEDS)) {
  const bag = lightBag();
  for (const key of SCALAR_KEYS) bag.scalars[key] = seed[key];
  for (const key of COLOR_KEYS) bag.colors[key] = linearRGB(seed[key]);
  STATES[name] = bag;
}

/**
 * Blend the orb's `from` snapshot toward its `to` state and leave the result
 * in both bags — `light` so an interruption can be snapshotted without a
 * round trip through sRGB, `uniforms` so the renderer can read it directly.
 */
function blend(orb, progress) {
  const { from, to, light, uniforms } = orb;
  for (const key of SCALAR_KEYS) {
    const v = from.scalars[key] + (to.scalars[key] - from.scalars[key]) * progress;
    light.scalars[key] = v;
    uniforms[key] = v;
  }
  for (const key of COLOR_KEYS) {
    const a = from.colors[key];
    const b = to.colors[key];
    const lin = light.colors[key];
    const out = uniforms[key];
    for (let i = 0; i < 3; i += 1) {
      lin[i] = a[i] + (b[i] - a[i]) * progress;
      out[i] = toSrgb(lin[i]);
    }
  }
}

function copyBag(target, source) {
  for (const key of SCALAR_KEYS) target.scalars[key] = source.scalars[key];
  for (const key of COLOR_KEYS) {
    const from = source.colors[key];
    const into = target.colors[key];
    into[0] = from[0]; into[1] = from[1]; into[2] = from[2];
  }
}

/* ---------- The fluid ----------
   glsSiriBand / glsSiriFluid from the reference, one pixel at a time.

   A band is two terms over one sine: a thin bright LINE on the curve itself,
   and a soft BAND filling the gap between that curve and the main wave. Four
   of them at spread phase offsets is what gives Siri its stacked, chromatically
   separated ribbon rather than one glowing stroke. */

/* Everything in the wave that moves with time but not with position, hoisted
   out of the pixel loop — three sines a frame instead of three a pixel. */
const wave = { scale: 1, low: 0, drift: 0, mainAmp: 0, bandAmp: 0, sep: 0, soft: 0 };

function primeWave(m, t) {
  /* Three slow LFOs at incommensurate rates. Because 0.37, 0.51 and 0.73
     share no common period the wave never visibly repeats, which is most of
     why the idle state reads as alive rather than as a loop. */
  const low = 0.5 + 0.5 * Math.cos(t * 0.37);
  const mid = 0.5 + 0.5 * Math.sin(t * 0.51 + 1.2);
  const high = 0.5 + 0.5 * Math.cos(t * 0.73 + 2.1);
  wave.scale = 0.74 + m.zoom * 0.34;
  wave.low = low;
  wave.drift = t * 2.4;
  wave.mainAmp = 0.25 + m.ridgeAmt * 0.075 + low * 0.018;
  wave.bandAmp = wave.mainAmp + mid * 0.025 + high * 0.018;
  wave.sep = 1.85 + m.warp * 0.2 + mid * 0.28;
  wave.soft = 0.035 + (1 - m.ridgeAmt) * 0.018 + mid * 0.006;
}

/** One band's weight at a point: its line term plus its enclosed-band term. */
function bandWeight(qx, qy, phase, mainY, envelope) {
  const y = wave.bandAmp * envelope * Math.sin(qx + wave.drift + phase);
  const dy = qy - y;
  const line = 0.018 / (Math.sqrt(dy * dy + wave.soft * wave.soft) + 0.026);
  const hi = mainY > y ? mainY : y;
  const lo = mainY < y ? mainY : y;
  const gap = Math.max(0, Math.max(qy - hi, lo - qy));
  return line + 0.018 / (gap + 0.075);
}

/* Written into rather than returned, so the pixel loop allocates nothing. */
const FIELD = new Float64Array(3);

function fluidAt(px, py, m) {
  const qx = px / wave.scale;
  const qy = py / wave.scale;

  /* cos² across the width: the wave tapers to nothing at the ball's left and
     right limbs instead of being cut off by the silhouette. */
  const e0 = Math.cos(HALF_PI * Math.min(Math.abs(0.9 * qx), 1));
  const envelope = e0 * e0;
  const mainY = wave.mainAmp * envelope * Math.sin(qx * 1.1 + wave.drift);

  const sep = wave.sep;
  const w0 = bandWeight(qx, qy, -sep, mainY, envelope);
  const w1 = bandWeight(qx, qy, -sep * 0.34, mainY, envelope);
  const w2 = bandWeight(qx, qy, sep * 0.34, mainY, envelope);
  const w3 = bandWeight(qx, qy, sep, mainY, envelope);

  /* Squaring before the weighted average lets the nearest band win its own
     pixel outright. Averaging the four linearly would grey the whole wave. */
  const d0 = w0 * w0, d1 = w1 * w1, d2 = w2 * w2, d3 = w3 * w3;
  const dTotal = Math.max(d0 + d1 + d2 + d3, 0.0001);
  const cA = m.colorA, cB = m.colorB, cC = m.colorC, cD = m.colorD;

  const gain = (1 - Math.exp(-(w0 + w1 + w2 + w3) * 0.58)) * envelope * 1.14;
  const sky = smoothstep(-0.7, 0.7, qy);
  const dMain = qy - mainY;
  const core = Math.exp(-(dMain * dMain) / 0.0028) * envelope * (0.18 + 0.1 * wave.low);
  const hl = m.highlight;

  for (let i = 0; i < 3; i += 1) {
    const spectral = (cA[i] * d0 + cC[i] * d1 + cB[i] * d2 + cD[i] * d3) / dTotal;
    const atmosphere = (cD[i] + (cB[i] - cD[i]) * sky) * 0.018;
    const v = atmosphere + spectral * gain + hl[i] * core;
    FIELD[i] = v / (1 + v * 0.18);          // Reinhard: keeps the crest off clipping
  }

  /* The shared shade tail: a highlight up-left, a shadow down-right, and a
     darkened limb, so the wave sits inside a sphere rather than on a disc. */
  const up = m.shade * 0.22 * smoothstep(0.15, 1.15, px * -0.32 + py * 0.78);
  const down = 1 - m.shade * 0.34 * smoothstep(-0.1, 1.2, px * 0.45 + py * -0.62);
  const limb = 1 - m.shade * 0.22 * smoothstep(0.72, 1.08, Math.hypot(px, py));
  for (let i = 0; i < 3; i += 1) {
    FIELD[i] = clamp01((FIELD[i] + (hl[i] - FIELD[i]) * up) * down * limb);
  }
}

/* ---------- The glass shell ----------
   A directional lobe: how much a light in (dx, dy) lands on a surface whose
   2D normal is (nx, ny), with `cut` widening the lobe past the terminator. */
function lobe(nx, ny, dx, dy, cut, power) {
  return clamp01((nx * dx + ny * dy - cut) / Math.max(1 - cut, 0.001)) ** power;
}

/* ---------- One frame ---------- */

function render(orb, t) {
  const m = orb.uniforms;
  const { data } = orb.image;
  const size = orb.size;
  const step = 2 / size;
  primeWave(m, t);

  const bg = m.canvas;
  /* Roughly 1.5 device pixels of feather whatever the buffer is. A fixed
     ±0.01 in ball units is 0.8px at the bubble's 88px buffer and 0.4px at the
     header's 40px one, which is visibly stepped on a curve this tight. */
  const feather = 0.75 * (2 / size) / BALL_RADIUS;
  const surfaceWidth = 0.026 + 0.055 * m.shellEdgeAlpha;
  const refractionWidth = 0.015 + 0.95 * m.shellMidAlpha;
  const glassOpacity = clamp01(m.glassOpacity);
  const gloss = Math.min(Math.max(m.gloss, 0), 2);
  const sheen = Math.min(Math.max(m.sheen, 0), 2);
  const exposure = Math.max(m.exposure, 0);

  let index = 0;
  for (let row = 0; row < size; row += 1) {
    // y up, matching the shader's ball space.
    const py = 1 - (row + 0.5) * step;
    for (let col = 0; col < size; col += 1, index += 4) {
      const px = (col + 0.5) * step - 1;
      const bx = px / BALL_RADIUS;
      const by = py / BALL_RADIUS;
      const pd = Math.hypot(bx, by);

      const ballA = 1 - smoothstep(1 - feather, 1 + feather, pd);
      if (ballA <= 0) { data[index + 3] = 0; continue; }

      /* Rim refraction. Near the limb the lens pulls its sample from deep
         inside the ball, which is what bends the wave into the glass instead
         of letting it run flat to the edge. */
      const edgeDepth = Math.max(1 - pd, 0);
      const depth = clamp01(edgeDepth / refractionWidth);
      const profile = (1 - Math.sqrt(Math.max(1 - (1 - depth) * (1 - depth), 0))) ** 0.68;
      const inv = pd > 0.0001 ? 1 / pd : 0;
      const nx = bx * inv;
      const ny = by * inv;
      const bend = 1.6 * glassOpacity * profile;
      fluidAt(bx - nx * bend, by - ny * bend, m);

      /* Composited over the ball's own near-black interior, at the same 1.22
         saturation the reference applies on the way. */
      const lum = FIELD[0] * 0.213 + FIELD[1] * 0.715 + FIELD[2] * 0.072;
      const cover = 0.99 * (1 - smoothstep(0.995, 1.04, pd));
      let r = bg[0] + (clamp01(lum + (FIELD[0] - lum) * 1.22) - bg[0]) * cover;
      let g = bg[1] + (clamp01(lum + (FIELD[1] - lum) * 1.22) - bg[1]) * cover;
      let b = bg[2] + (clamp01(lum + (FIELD[2] - lum) * 1.22) - bg[2]) * cover;

      /* Surface lighting lives on a thin arc, so the ~90% of pixels inside it
         skip the block entirely. */
      if (edgeDepth < surfaceWidth) {
        const rim = ((1 - smoothstep(0, surfaceWidth, edgeDepth)) * cover) ** 1.8;
        const inner = rim * glassOpacity * 0.45;
        const si = m.shellInner;
        r += (si[0] - r) * inner; g += (si[1] - g) * inner; b += (si[2] - b) * inner;

        /* Two lights of opposite temperature on opposite limbs — the cheap
           stand-in for dispersion, and the reason the rim is not one colour. */
        const dispersion = rim * gloss * (0.8 + 0.8 * m.shellEdgeAlpha);
        const cool = dispersion * lobe(nx, ny, 0.8412, 0.5408, -0.32, 1.8);
        const warm = dispersion * lobe(nx, ny, -0.6222, -0.7829, -0.28, 2.0);
        const sm = m.shellMid;
        const se = m.shellEdge;
        r += (sm[0] - r) * cool; g += (sm[1] - g) * cool; b += (sm[2] - b) * cool;
        r += (se[0] - r) * warm; g += (se[1] - g) * warm; b += (se[2] - b) * warm;

        const shadow = rim * (0.015 + 0.15 * m.shellEdgeAlpha)
          * (0.15 + 0.85 * Math.max(nx * 0.45 + ny * -0.89, 0));
        r *= 1 - shadow; g *= 1 - shadow; b *= 1 - shadow;

        const key = rim * lobe(nx, ny, -0.6817, 0.7317, 0.2, 2.8) * sheen * 1.4;
        const fill = rim * lobe(nx, ny, 0.7407, -0.6718, 0.4, 3.6) * sheen;
        const sc = m.sheenColor;
        const sp = m.specColor;
        r += (sc[0] - r) * key; g += (sc[1] - g) * key; b += (sc[2] - b) * key;
        r += (sp[0] - r) * fill; g += (sp[1] - g) * fill; b += (sp[2] - b) * fill;
      }

      data[index] = clamp01(r * exposure) * 255;
      data[index + 1] = clamp01(g * exposure) * 255;
      data[index + 2] = clamp01(b * exposure) * 255;
      /* Straight alpha, not premultiplied: putImageData writes the buffer
         verbatim, and the orb composites onto whatever is behind it. */
      data[index + 3] = ballA * 255;
    }
  }
  orb.ctx.putImageData(orb.image, 0, 0);
}

/* ---------- The shared ticker ----------
   One rAF for every orb on the page. Three canvases each running their own
   loop would be three wake-ups a frame for what is one animation. */

const orbs = new Set();          // the ones being ticked
const mounted = new Set();       // every one on the page, ticked or not
const reasons = new Set();       // why the assistant is currently thinking
let frame = null;
let lastAt = null;

const reducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Cheap "is this actually on screen" test. Both flags earn their place: the
 * card is hidden by `visibility` when closed, and the cursor companion by
 * `opacity` when stowed, so without them two of the three orbs would go on
 * being painted for nobody.
 */
function visible(canvas) {
  if (!canvas.isConnected) return false;
  if (canvas.checkVisibility) {
    return canvas.checkVisibility({ visibilityProperty: true, opacityProperty: true });
  }
  return canvas.offsetParent !== null;
}

function eased(orb, now) {
  if (orb.duration === 0) return 1;
  const raw = clamp01((now - orb.startedAt) / orb.duration);
  // Waking snaps and settles; settling drifts. Different curves on purpose.
  return orb.toName === 'thinking' ? 1 - (1 - raw) ** 3 : raw * raw * (3 - 2 * raw);
}

function tick(now) {
  frame = null;
  const delta = lastAt === null ? 0 : Math.min(0.1, Math.max(0, (now - lastAt) / 1000));
  lastAt = now;

  for (const orb of orbs) {
    blend(orb, eased(orb, now));
    /* Phase, not clock: speed changes sevenfold between the states, and
       driving the wave off `t · speed` would jump it forward by seconds at
       the moment of the change. Accumulating phase keeps the crest continuous
       through the transition and lets only its rate alter. */
    orb.phase += delta * orb.uniforms.speed;
    if (visible(orb.canvas)) render(orb, orb.phase);
  }

  if (orbs.size) frame = requestAnimationFrame(tick);
  else lastAt = null;
}

function startTicker() {
  if (frame === null && orbs.size) {
    lastAt = null;
    frame = requestAnimationFrame(tick);
  }
}

/* ---------- Public API ---------- */

/**
 * Put an orb inside `host` and hand back its controls.
 *
 * The host also carries `data-orb-state`, so CSS can answer the state without
 * reading anything out of here — the bubble's halo is a box-shadow transition
 * on that attribute rather than pixels this file has to paint.
 */
export function mountOrb(host, { size = 44 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'asst-orb';
  canvas.setAttribute('aria-hidden', 'true');

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const buffer = Math.max(16, Math.min(MAX_BUFFER, Math.round(size * dpr)));
  canvas.width = buffer;
  canvas.height = buffer;

  const ctx = canvas.getContext('2d', { alpha: true });
  const orb = {
    canvas,
    ctx,
    size: buffer,
    image: ctx.createImageData(buffer, buffer),
    from: lightBag(),
    to: STATES.idle,
    toName: 'idle',
    light: lightBag(),
    uniforms: renderBag(),
    startedAt: 0,
    duration: 0,
    phase: 0,
  };
  copyBag(orb.from, STATES.idle);
  blend(orb, 1);
  host.appendChild(canvas);
  host.dataset.orbState = 'idle';

  const still = reducedMotion();
  // Reduced motion gets the orb, not the animation: one frame per state, so it
  // still says which state it is in without ever moving.
  if (still) render(orb, 0);
  else { orbs.add(orb); startTicker(); }

  const handle = {
    setState(next) {
      if (!STATES[next] || next === orb.toName) return;
      const now = performance.now();
      /* Snapshot the blend exactly where it currently shows before re-aiming
         it. Without this, interrupting a two-second settle to wake again
         would jump the orb back to wherever the settle started. */
      blend(orb, eased(orb, now));
      copyBag(orb.from, orb.light);
      orb.to = STATES[next];
      orb.toName = next;
      orb.startedAt = now;
      orb.duration = reducedMotion() ? 0 : (next === 'thinking' ? WAKE_MS : SETTLE_MS);
      host.dataset.orbState = next;
      if (orb.duration === 0) { blend(orb, 1); render(orb, orb.phase); }
    },
    destroy() {
      orbs.delete(orb);
      mounted.delete(handle);
      canvas.remove();
    },
  };
  mounted.add(handle);
  if (reasons.size) handle.setState('thinking');
  return handle;
}

/* The card's border beam is CSS the whole way down, so the only thing it
   needs from here is the state as an attribute — the same shape the pointer
   already publishes as body[data-asst-pointer]. `fading` is a real third
   value, not a nicety: the beam's comet is a spun custom property, and cutting
   the animation the instant thinking ends would snap the angle back to 0 in
   full view. Holding it through the fade lets the comet keep travelling while
   it dims, which is what the React component's data-fading does. */
const BEAM_FADE_MS = 500;
let beamFade = null;

function publishThinking(on) {
  const body = document.body;
  if (beamFade) { clearTimeout(beamFade); beamFade = null; }
  if (on) { body.dataset.asstThinking = 'true'; return; }
  // Nothing to fade from if it was never lit.
  if (body.dataset.asstThinking !== 'true') { body.dataset.asstThinking = 'false'; return; }
  body.dataset.asstThinking = 'fading';
  beamFade = setTimeout(() => {
    beamFade = null;
    body.dataset.asstThinking = 'false';
  }, BEAM_FADE_MS);
}

/* ---------- One assistant, three orbs and a beam ----------
   The bubble, the card header, the cursor companion and the card's own edge
   are the same assistant shown in four places, so they move together — a
   header still idling while the answer streams below it reads as two machines.

   Counted by reason rather than set outright, because the two things that
   make it think overlap: a dwell that is cancelled while the answer it
   already asked for is still streaming must not put the orbs back to sleep. */
export function orbThinking(reason, on) {
  const had = reasons.size > 0;
  if (on) reasons.add(reason);
  else reasons.delete(reason);
  if ((reasons.size > 0) === had) return;
  const thinking = reasons.size > 0;
  for (const handle of mounted) handle.setState(thinking ? 'thinking' : 'idle');
  publishThinking(thinking);
}
