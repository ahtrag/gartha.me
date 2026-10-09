import { describe, expect, it } from "vitest";
import { wobblyRect } from "../src/scripts/chalk-outline";

const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe("wobblyRect", () => {
  it("starts with a move and keeps every point near the box", () => {
    const d = wobblyRect(250, 54);
    expect(d.startsWith("M")).toBe(true);
    const pts = numbers(d);
    const xs = pts.filter((_, i) => i % 2 === 0);
    const ys = pts.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-1);
    expect(Math.max(...xs)).toBeLessThanOrEqual(251);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(-1);
    expect(Math.max(...ys)).toBeLessThanOrEqual(55);
  });

  it("is stable for the same input and changes with size", () => {
    expect(wobblyRect(250, 54)).toBe(wobblyRect(250, 54));
    expect(wobblyRect(340, 300)).not.toBe(wobblyRect(250, 54));
  });

  it("never uses a corner radius bigger than half the height", () => {
    const d = wobblyRect(200, 20, 50);
    expect(Math.max(...numbers(d).filter((_, i) => i % 2 === 1))).toBeLessThanOrEqual(21);
  });
});
