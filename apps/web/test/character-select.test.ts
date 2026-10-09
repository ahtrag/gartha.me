// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { initCharacterSelect, wrapIndex } from "../src/scripts/character-select";

function setup() {
  document.body.innerHTML = `
    <div data-character-select>
      <button data-step="-1">Prev</button>
      <div data-slide data-name="PROGRAMMER">coder</div>
      <div data-slide data-name="GAMER" hidden>gamer</div>
      <button data-step="1">Next</button>
      <span data-character-label>PROGRAMMER</span>
    </div>
  `;
  const pick = <T extends Element>(scope: ParentNode, selector: string): T => {
    const el = scope.querySelector<T>(selector);
    if (!el) throw new Error(`missing ${selector}`);
    return el;
  };
  const root = pick<HTMLElement>(document, "[data-character-select]");
  const prev = pick<HTMLButtonElement>(root, '[data-step="-1"]');
  const next = pick<HTMLButtonElement>(root, '[data-step="1"]');
  const slides = root.querySelectorAll<HTMLElement>("[data-slide]");
  const label = pick<HTMLElement>(root, "[data-character-label]");
  initCharacterSelect(root);
  return { root, prev, next, slides, label };
}

const visible = (slides: NodeListOf<HTMLElement>) =>
  [...slides].filter((s) => !s.hidden).map((s) => s.dataset.name);

describe("wrapIndex", () => {
  it("wraps past both ends", () => {
    expect(wrapIndex(0, 1, 2)).toBe(1);
    expect(wrapIndex(1, 1, 2)).toBe(0);
    expect(wrapIndex(0, -1, 2)).toBe(1);
  });
});

describe("initCharacterSelect", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("next shows the gamer and updates the label", () => {
    const { next, slides, label } = setup();
    next.click();
    expect(visible(slides)).toEqual(["GAMER"]);
    expect(label.textContent).toBe("GAMER");
  });

  it("prev from the first character wraps to the last", () => {
    const { prev, slides } = setup();
    prev.click();
    expect(visible(slides)).toEqual(["GAMER"]);
  });

  it("arrow keys switch characters", () => {
    const { root, slides } = setup();
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(visible(slides)).toEqual(["GAMER"]);
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(visible(slides)).toEqual(["PROGRAMMER"]);
  });
});
