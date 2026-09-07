export function applyFilter(
  buttons: Iterable<HTMLButtonElement>,
  cards: Iterable<HTMLElement>,
  empty: HTMLElement | null,
  filter: string,
): void {
  for (const b of buttons) {
    b.setAttribute("aria-pressed", String(b.dataset.filter === filter));
  }
  let visible = 0;
  for (const c of cards) {
    const matches = filter === "all" || c.dataset.category === filter;
    c.hidden = !matches;
    if (matches) visible += 1;
  }
  if (empty) empty.hidden = visible > 0;
}
