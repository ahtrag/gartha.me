export function wrapIndex(index: number, step: number, length: number): number {
  return (index + step + length) % length;
}

/** Wires the chevrons and arrow keys inside `root` to cycle its [data-slide] children. */
export function initCharacterSelect(root: HTMLElement): void {
  const slides = [...root.querySelectorAll<HTMLElement>("[data-slide]")];
  const label = root.querySelector<HTMLElement>("[data-character-label]");
  let current = Math.max(0, slides.findIndex((s) => !s.hidden));

  const go = (step: number) => {
    current = wrapIndex(current, step, slides.length);
    slides.forEach((s, i) => (s.hidden = i !== current));
    if (label) label.textContent = slides[current]?.dataset.name ?? "";
  };

  for (const b of root.querySelectorAll<HTMLButtonElement>("[data-step]")) {
    b.addEventListener("click", () => go(Number(b.dataset.step)));
  }
  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
  });
}
