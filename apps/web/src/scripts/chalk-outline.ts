/**
 * A hand-drawn rounded rectangle as an SVG path, sized to `w` x `h`.
 * Corners and edges wobble a little (deterministically, from `seed`) so the
 * outline reads as chalk rather than a CSS border. The path starts and ends
 * at the middle of the bottom edge and overshoots slightly, like a stroke
 * that doesn't quite meet itself.
 */
export function wobblyRect(w: number, h: number, r = 24, seed = 3): string {
  let s = seed;
  const j = (amt: number) => {
    s = (s * 9301 + 49297) % 233280;
    return ((s / 233280) * 2 - 1) * amt;
  };
  const rad = Math.max(0, Math.min(r, h / 2, w / 2));
  const p = 2; // inset so the stroke isn't clipped
  const L = p;
  const T = p;
  const R = w - p;
  const B = h - p;
  const f = (n: number) => n.toFixed(1);
  const mid = w / 2;
  return [
    `M${f(mid - 6)} ${f(B + j(0.6))}`,
    `C${f(mid - w * 0.2)} ${f(B + j(1.2))} ${f(L + rad + 10)} ${f(B + j(1.2))} ${f(L + rad)} ${f(B)}`,
    `Q${f(L + j(1))} ${f(B + j(1))} ${f(L + j(0.8))} ${f(B - rad)}`,
    `C${f(L + j(1.4))} ${f(B - rad - (B - T - 2 * rad) * 0.4)} ${f(L + j(1.4))} ${f(T + rad + (B - T - 2 * rad) * 0.4)} ${f(L + j(0.8))} ${f(T + rad)}`,
    `Q${f(L + j(1))} ${f(T + j(1))} ${f(L + rad)} ${f(T + j(0.6))}`,
    `C${f(L + rad + (R - L - 2 * rad) * 0.35)} ${f(T + j(1.4))} ${f(R - rad - (R - L - 2 * rad) * 0.35)} ${f(T + j(1.4))} ${f(R - rad)} ${f(T + j(0.6))}`,
    `Q${f(R + j(1))} ${f(T + j(1))} ${f(R + j(0.8))} ${f(T + rad)}`,
    `C${f(R + j(1.4))} ${f(T + rad + (B - T - 2 * rad) * 0.4)} ${f(R + j(1.4))} ${f(B - rad - (B - T - 2 * rad) * 0.4)} ${f(R + j(0.8))} ${f(B - rad)}`,
    `Q${f(R + j(1))} ${f(B + j(1))} ${f(R - rad)} ${f(B)}`,
    `C${f(mid + w * 0.2)} ${f(B + j(1.2))} ${f(mid + 14)} ${f(B + j(1.2))} ${f(mid + 4)} ${f(B - 1.5)}`,
  ].join(" ");
}

/**
 * Keeps an SVG path's `d` matched to its host element's size, so the chalk
 * outline follows the dock as it grows and shrinks.
 */
export function traceOutline(host: HTMLElement, path: SVGPathElement, r = 24): () => void {
  const update = () => {
    const { width, height } = host.getBoundingClientRect();
    if (width > 0 && height > 0) path.setAttribute("d", wobblyRect(width, height, r));
  };
  update();
  const ro = new ResizeObserver(update);
  ro.observe(host);
  return () => ro.disconnect();
}
