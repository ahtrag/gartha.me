/**
 * Page links inside `root` marked [data-scribble] draw a chalk scribble
 * across the screen before navigating. Modified clicks (new tab, etc.),
 * links to the current page and reduced-motion users navigate normally.
 */
export function initScribbleNav(
  root: HTMLElement,
  opts: { delay?: number; go?: (href: string) => void; win?: Window } = {},
): void {
  const win = opts.win ?? window;
  const doc = root.ownerDocument;
  const delay = opts.delay ?? 380;
  const go = opts.go ?? ((href: string) => win.location.assign(href));

  for (const link of root.querySelectorAll<HTMLAnchorElement>("a[data-scribble]")) {
    link.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (link.getAttribute("aria-current") === "page") return;
      if (win.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
      e.preventDefault();
      const color = link.style.getPropertyValue("--c") || "var(--chalk)";
      doc.body.append(scribble(doc, color));
      win.setTimeout(() => go(link.href), delay);
    });
  }
}

const SVG = "http://www.w3.org/2000/svg";

/** A loose zig-zag stroke across the viewport, drawn by CSS (.scribble). */
function scribble(doc: Document, color: string): SVGSVGElement {
  const svg = doc.createElementNS(SVG, "svg");
  svg.setAttribute("class", "scribble");
  svg.setAttribute("viewBox", "0 0 1000 600");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  const path = doc.createElementNS(SVG, "path");
  path.setAttribute("pathLength", "1");
  path.setAttribute(
    "d",
    "M-20 470 C 120 380 160 520 300 420 S 470 300 560 360 S 720 470 820 300 S 960 160 1030 120",
  );
  path.style.stroke = color;
  svg.append(path);
  return svg;
}
