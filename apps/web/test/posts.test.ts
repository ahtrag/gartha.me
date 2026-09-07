import { describe, expect, it } from "vitest";
import { formatDate, neighbours, readTime, sortNewest } from "../src/lib/posts";

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

  it("sortNewest does not mutate its input", () => {
    const input = [p("a", "2026-01-01"), p("b", "2026-03-01"), p("c", "2026-02-01")];
    const original = [...input];
    sortNewest(input);
    expect(input).toEqual(original);
  });

  it("readTime rounds up at 200 wpm with a floor of 1", () => {
    expect(readTime("one two three")).toBe(1);
    expect(readTime(Array(401).fill("w").join(" "))).toBe(3);
  });

  it("readTime is 2 at exactly 400 words and 1 for an empty string", () => {
    expect(readTime(Array(400).fill("w").join(" "))).toBe(2);
    expect(readTime("")).toBe(1);
  });

  it("neighbours returns previous (older) and next (newer)", () => {
    const sorted = sortNewest([p("a", "2026-01-01"), p("b", "2026-02-01"), p("c", "2026-03-01")]);
    expect(neighbours(sorted, "b")).toEqual({ prev: sorted[2], next: sorted[0] });
    expect(neighbours(sorted, "c")).toEqual({ prev: sorted[1], next: undefined });
  });

  it("neighbours returns prev: undefined for the oldest item", () => {
    const sorted = sortNewest([p("a", "2026-01-01"), p("b", "2026-02-01")]);
    expect(neighbours(sorted, "a")).toEqual({ prev: undefined, next: sorted[0] });
  });

  it("neighbours returns {} for an unknown id", () => {
    const sorted = sortNewest([p("a", "2026-01-01"), p("b", "2026-02-01")]);
    expect(neighbours(sorted, "nope")).toEqual({});
  });

  it("formatDate treats the date as UTC", () => {
    expect(formatDate(new Date("2026-09-01T00:00:00Z"))).toBe("2026-09-01");
  });
});
