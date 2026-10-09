/** Sets `--p` (0..1) on `bar` as the reader moves through `article`. */
export function initProgress(article: HTMLElement, bar: HTMLElement, win: Window = window): void {
  let queued = false;
  const update = () => {
    queued = false;
    const rect = article.getBoundingClientRect();
    const total = rect.height - win.innerHeight;
    const p = total <= 0 ? 1 : Math.min(1, Math.max(0, -rect.top / total));
    bar.style.setProperty("--p", p.toFixed(3));
  };
  win.addEventListener(
    "scroll",
    () => {
      if (queued) return;
      queued = true;
      win.requestAnimationFrame(update);
    },
    { passive: true },
  );
  update();
}

/** Adds `.seen` to each element the first time it scrolls into view. */
export function markWhenSeen(els: Iterable<Element>): void {
  const list = [...els];
  if (typeof IntersectionObserver === "undefined") {
    for (const el of list) el.classList.add("seen");
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("seen");
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -15% 0px" },
  );
  for (const el of list) io.observe(el);
}

/**
 * Gives every code block a "copy" button. After copying it reads "copied"
 * for a moment, then goes back.
 */
export function addCopyButtons(root: ParentNode, clipboard?: Pick<Clipboard, "writeText">): void {
  const clip = clipboard ?? globalThis.navigator?.clipboard;
  if (!clip) return;
  for (const pre of root.querySelectorAll("pre")) {
    const btn = pre.ownerDocument.createElement("button");
    btn.type = "button";
    btn.className = "copy mono";
    btn.textContent = "copy";
    btn.setAttribute("aria-label", "Copy code");
    btn.addEventListener("click", async () => {
      try {
        await clip.writeText(pre.querySelector("code")?.textContent ?? pre.textContent ?? "");
        btn.textContent = "copied ✓";
        btn.classList.add("done");
      } catch {
        btn.textContent = "couldn't copy";
      }
      setTimeout(() => {
        btn.textContent = "copy";
        btn.classList.remove("done");
      }, 1600);
    });
    pre.append(btn);
  }
}
