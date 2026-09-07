import { describe, expect, it } from "vitest";
import { neighbours, readTime, sortNewest } from "../src/lib/posts";

const p = (id: string, date: string, draft = false) => ({
  id,
  data: { date: new Date(date), draft },
});

describe("posts helpers", () => {
  it("sortNewest orders by date desc and drops drafts", () => {
    const out = sortNewest([
      p("a", "2026-01-01"),
      p("b", "2026-03-01"),
      p("c", "2026-02-01", true),
    ]);
    expect(out.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("readTime rounds up at 200 wpm with a floor of 1", () => {
    expect(readTime("one two three")).toBe(1);
    expect(readTime(Array(401).fill("w").join(" "))).toBe(3);
  });

  it("neighbours returns previous (older) and next (newer)", () => {
    const sorted = sortNewest([p("a", "2026-01-01"), p("b", "2026-02-01"), p("c", "2026-03-01")]);
    expect(neighbours(sorted, "b")).toEqual({ prev: sorted[2], next: sorted[0] });
    expect(neighbours(sorted, "c")).toEqual({ prev: sorted[1], next: undefined });
  });
});
