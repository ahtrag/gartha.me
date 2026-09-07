// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { applyFilter } from "../src/scripts/filter";

function setup() {
  document.body.innerHTML = `
    <div class="filters">
      <button data-filter="all">All</button>
      <button data-filter="code">Code</button>
      <button data-filter="games">Games</button>
    </div>
    <div class="grid">
      <a data-category="code">Code post</a>
      <a data-category="games">Games post</a>
    </div>
    <p class="empty" hidden>No quests in this category yet.</p>
  `;
  const buttons = document.querySelectorAll<HTMLButtonElement>("[data-filter]");
  const cards = document.querySelectorAll<HTMLElement>("[data-category]");
  const empty = document.querySelector<HTMLElement>(".empty");
  return { buttons, cards, empty };
}

describe("applyFilter", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("hides cards whose category does not match and keeps matching ones visible", () => {
    const { buttons, cards, empty } = setup();
    applyFilter(buttons, cards, empty, "code");
    const [codeCard, gamesCard] = [...cards];
    expect(codeCard?.hidden).toBe(false);
    expect(gamesCard?.hidden).toBe(true);
  });

  it("clears filtering for 'all'", () => {
    const { buttons, cards, empty } = setup();
    applyFilter(buttons, cards, empty, "code");
    applyFilter(buttons, cards, empty, "all");
    for (const c of cards) expect(c.hidden).toBe(false);
  });

  it("toggles aria-pressed on the matching button", () => {
    const { buttons, cards, empty } = setup();
    applyFilter(buttons, cards, empty, "games");
    const pressed = [...buttons].filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    expect(pressed[0]?.dataset.filter).toBe("games");
  });

  it("shows the empty message when no cards remain visible", () => {
    const { buttons, cards, empty } = setup();
    applyFilter(buttons, cards, empty, "builds");
    expect(empty?.hidden).toBe(false);
  });

  it("hides the empty message when at least one card is visible", () => {
    const { buttons, cards, empty } = setup();
    applyFilter(buttons, cards, empty, "code");
    expect(empty?.hidden).toBe(true);
  });
});
