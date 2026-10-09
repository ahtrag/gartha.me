// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { initDock } from "../src/scripts/dock";

function pick<T extends Element>(scope: ParentNode, selector: string): T {
  const el = scope.querySelector<T>(selector);
  if (!el) throw new Error(`missing ${selector}`);
  return el;
}

function setup() {
  document.body.innerHTML = `
    <p id="outside">page</p>
    <nav data-dock>
      <div data-panel="pages"><a href="/blog">blog</a></div>
      <div data-panel="more"><a href="https://github.com">GitHub</a></div>
      <button data-back>Back</button>
      <button data-tray="pages">Home</button>
      <button data-tray="more">More</button>
    </nav>
  `;
  const root = pick<HTMLElement>(document, "[data-dock]");
  initDock(root);
  return {
    root,
    pages: pick<HTMLButtonElement>(root, '[data-tray="pages"]'),
    more: pick<HTMLButtonElement>(root, '[data-tray="more"]'),
  };
}

describe("initDock", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("starts closed", () => {
    const { root, pages, more } = setup();
    expect(root.dataset.open).toBe("");
    expect(pages.getAttribute("aria-expanded")).toBe("false");
    expect(more.getAttribute("aria-expanded")).toBe("false");
  });

  it("opens a tray and closes it on a second press", () => {
    const { root, pages } = setup();
    pages.click();
    expect(root.dataset.open).toBe("pages");
    expect(pages.getAttribute("aria-expanded")).toBe("true");
    pages.click();
    expect(root.dataset.open).toBe("");
  });

  it("switches straight from one tray to the other", () => {
    const { root, pages, more } = setup();
    pages.click();
    more.click();
    expect(root.dataset.open).toBe("more");
    expect(pages.getAttribute("aria-expanded")).toBe("false");
    expect(more.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes on Escape and returns focus to the opener", () => {
    const { root, more } = setup();
    more.click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(root.dataset.open).toBe("");
    expect(document.activeElement).toBe(more);
  });

  it("closes on a click outside the dock", () => {
    const { root, pages } = setup();
    pages.click();
    pick<HTMLElement>(document, "#outside").click();
    expect(root.dataset.open).toBe("");
  });
});
