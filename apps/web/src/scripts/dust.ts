const SELECTOR = "button, a.btn, [data-dust]";

/**
 * Pressing a button lets off a small puff of chalk dust where the pointer
 * touched. Each mote flies out on its own angle (CSS vars --dx/--dy) and is
 * removed once its animation is done. Skipped for reduced motion.
 */
export function initDust(
  doc: Document = document,
  opts: { count?: number; life?: number } = {},
): void {
  const count = opts.count ?? 7;
  const life = opts.life ?? 700;
  const win = doc.defaultView;

  doc.addEventListener("pointerdown", (e) => {
    if (!(e.target instanceof Element) || !e.target.closest(SELECTOR)) return;
    if (win?.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    puff(doc, e.clientX, e.clientY, count, life);
  });
}

export function puff(doc: Document, x: number, y: number, count: number, life: number): void {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const dist = 14 + Math.random() * 22;
    const mote = doc.createElement("span");
    mote.className = "dust-mote";
    mote.setAttribute("aria-hidden", "true");
    mote.style.left = `${x}px`;
    mote.style.top = `${y}px`;
    mote.style.setProperty("--dx", `${(Math.cos(angle) * dist).toFixed(1)}px`);
    mote.style.setProperty("--dy", `${(Math.sin(angle) * dist - 8).toFixed(1)}px`);
    mote.style.setProperty("--s", (0.6 + Math.random() * 0.8).toFixed(2));
    doc.body.append(mote);
    setTimeout(() => mote.remove(), life);
  }
}
