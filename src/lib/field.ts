// The background: Atrium's calm grid of dots, as on Aale Spiele (aale-spiele/src/lib/field.ts). It
// wakes up around the mouse, and when a price is revealed a ring of red and the players' colours
// runs out from the price tag. It only draws while something moves, so an idle page is still, and
// it never reacts to scrolling. Touch moves are ignored: on a phone they're scrolls.

const GAP = 26;
const RADIUS = 170;
/** The ripple: how fast the ring runs out (px/s), how wide it is, how long it lasts (ms). */
const SPEED = 950;
const RING = 44;
const LIFE = 1300;

let setTint: (color: string | null) => void = () => {};
let addRipple: (x: number, y: number, colors: string[]) => void = () => {};

/** The colour dots near the pointer take, e.g. the hovered card's; null for none. */
export const tintField = (color: string | null) => setTint(color);

/** A ring of `colors` running out from (x, y), in viewport pixels. */
export const ripple = (x: number, y: number, colors: string[]) => addRipple(x, y, colors);

export function startField(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const dark = matchMedia('(prefers-color-scheme: dark)');

  let width = 0;
  let height = 0;
  let px = -1e4;
  let py = -1e4;
  let tx = -1e4;
  let ty = -1e4;
  let raf = 0;
  let ink = 'rgb(128 128 128)';
  let base = 0.1;
  let light = false;
  let tint: string | null = null;
  let wave: { x: number; y: number; colors: string[]; start: number } | null = null;

  /** The canvas's CSS colour is var(--ewo-fg), so reading it back gives the theme's ink as rgb(). */
  function readInk() {
    ink = getComputedStyle(canvas).color;
    const theme = document.documentElement.dataset.theme ?? (dark.matches ? 'dark' : 'light');
    light = theme === 'light';
    // A quiet texture, not a pattern (the user: "too intense"; Atrium's field uses the same numbers).
    base = light ? 0.045 : 0.035;
  }

  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    width = innerWidth;
    height = innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now());
  }

  function draw(now: number) {
    ctx!.clearRect(0, 0, width, height);
    const r2 = 2 * RADIUS * RADIUS;
    const reach = 9 * RADIUS * RADIUS;
    let ring = -1;
    let fade = 0;
    if (wave) {
      const p = (now - wave.start) / LIFE;
      if (p >= 1) wave = null;
      else {
        ring = (SPEED * (now - wave.start)) / 1000;
        // Glows are halved on a light page (learnings: "Tone glows down on light themes").
        fade = (1 - p) ** 1.4 * (light ? 0.6 : 1);
      }
    }
    let n = 0;
    for (let y = GAP / 2; y < height; y += GAP) {
      for (let x = GAP / 2; x < width; x += GAP) {
        n++;
        const dx = x - px;
        const dy = y - py;
        const d2 = dx * dx + dy * dy;
        const k = d2 < reach ? Math.exp(-d2 / r2) : 0;
        const push = (k * 7) / (Math.sqrt(d2) || 1);
        let size = 0.9 + 1.3 * k;
        let ox = dx * push;
        let oy = dy * push;

        let w = 0;
        if (wave && ring >= 0) {
          const wx = x - wave.x;
          const wy = y - wave.y;
          const d = Math.sqrt(wx * wx + wy * wy);
          const off = (d - ring) / RING;
          if (off > -2.5 && off < 2.5) {
            w = Math.exp(-off * off) * fade;
            size += 2.2 * w;
            // The ring pushes the dots outwards a little as it passes.
            ox += ((wx / (d || 1)) * 6 * w);
            oy += ((wy / (d || 1)) * 6 * w);
          }
        }

        if (w > 0.06) {
          ctx!.fillStyle = wave!.colors[n % wave!.colors.length];
          ctx!.globalAlpha = Math.min(1, 0.075 + 0.5 * w);
        } else if (k > 0.04 && tint) {
          ctx!.fillStyle = tint;
          ctx!.globalAlpha = Math.min(1, 0.1 + 0.6 * k);
        } else {
          ctx!.fillStyle = ink;
          ctx!.globalAlpha = base + 0.22 * k;
        }
        ctx!.fillRect(x + ox - size, y + oy - size, size * 2, size * 2);
      }
    }
    ctx!.globalAlpha = 1;
  }

  function frame(now: number) {
    raf = 0;
    px += (tx - px) * 0.18;
    py += (ty - py) * 0.18;
    draw(now);
    if (wave || Math.abs(tx - px) + Math.abs(ty - py) > 0.5) raf = requestAnimationFrame(frame);
  }

  function wake() {
    if (reduced.matches) return;
    if (!raf) raf = requestAnimationFrame(frame);
  }

  const onMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    tx = event.clientX;
    ty = event.clientY;
    // Arriving from outside the window: start where the pointer is, not from far away.
    if (px < -1e3) {
      px = tx;
      py = ty;
    }
    wake();
  };
  const onLeave = () => {
    tx = ty = px = py = -1e4;
    draw(performance.now());
  };
  const onTheme = () => {
    readInk();
    draw(performance.now());
  };

  setTint = (color) => {
    tint = color;
    wake();
  };
  addRipple = (x, y, colors) => {
    if (reduced.matches || !colors.length) return;
    wave = { x, y, colors, start: performance.now() };
    wake();
  };

  readInk();
  resize();
  addEventListener('resize', resize);
  addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  addEventListener('ewo-theme', onTheme);
  dark.addEventListener('change', onTheme);

  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
    removeEventListener('pointermove', onMove);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    removeEventListener('ewo-theme', onTheme);
    dark.removeEventListener('change', onTheme);
    setTint = () => {};
    addRipple = () => {};
  };
}
