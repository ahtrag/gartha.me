export type Tray = "" | "pages" | "more";

/**
 * Wires the floating dock: buttons with [data-tray] open their tray inside
 * the dock (and close it when pressed again), Escape and clicks outside
 * close it, and [data-back] goes back within the site or home otherwise.
 */
export function initDock(root: HTMLElement, win: Window = window): void {
  const toggles = [...root.querySelectorAll<HTMLButtonElement>("[data-tray]")];
  let opener: HTMLButtonElement | null = null;

  const set = (tray: Tray, focusPanel = false) => {
    root.dataset.open = tray;
    for (const t of toggles) t.setAttribute("aria-expanded", String(t.dataset.tray === tray));
    if (tray && focusPanel) {
      root
        .querySelector<HTMLElement>(`[data-panel="${tray}"] a, [data-panel="${tray}"] button`)
        ?.focus();
    }
  };

  for (const t of toggles) {
    t.addEventListener("click", () => {
      const tray = (t.dataset.tray ?? "") as Tray;
      const next = root.dataset.open === tray ? "" : tray;
      opener = next ? t : null;
      set(next);
    });
  }

  root.ownerDocument.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !root.dataset.open) return;
    set("");
    opener?.focus();
  });

  root.ownerDocument.addEventListener("click", (e) => {
    if (root.dataset.open && e.target instanceof Node && !root.contains(e.target)) set("");
  });

  root.querySelector<HTMLButtonElement>("[data-back]")?.addEventListener("click", () => {
    const ref = root.ownerDocument.referrer;
    const sameSite = ref !== "" && new URL(ref).origin === win.location.origin;
    if (sameSite && win.history.length > 1) win.history.back();
    else win.location.assign("/");
  });

  set("");
}
