// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initDust } from "../src/scripts/dust";

const press = (el: Element) =>
  el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 40, clientY: 60 }));

describe("initDust", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `<button id="b"><span id="inner">go</span></button><p id="p">text</p>`;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("puffs dust when a button is pressed, then clears it", () => {
    initDust(document, { count: 5, life: 100 });
    press(document.getElementById("inner") as Element);
    const motes = document.querySelectorAll(".dust-mote");
    expect(motes).toHaveLength(5);
    expect((motes[0] as HTMLElement).style.left).toBe("40px");
    vi.advanceTimersByTime(100);
    expect(document.querySelectorAll(".dust-mote")).toHaveLength(0);
  });

  it("ignores presses outside buttons", () => {
    initDust(document, { count: 5, life: 100 });
    press(document.getElementById("p") as Element);
    expect(document.querySelectorAll(".dust-mote")).toHaveLength(0);
  });
});
