import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Character from "../src/Character.astro";

const ITEMS = ["laptop", "controller", "terminal"] as const;

describe("Character", () => {
  it.each([
    ["coder", "laptop"],
    ["gamer", "controller"],
    ["builder", "terminal"],
  ] as const)("renders the %s variant holding its item and no other", async (variant, item) => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Character, { props: { variant } });
    expect(html).toContain("<svg");
    expect(html).toContain(`data-item="${item}"`);
    for (const other of ITEMS.filter((i) => i !== item)) {
      expect(html).not.toContain(`data-item="${other}"`);
    }
    expect(html).toContain(`aria-label="Gartha, ${variant}"`);
  });

  it("defaults to the coder variant", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Character, {});
    expect(html).toContain('data-item="laptop"');
    expect(html).toContain('aria-label="Gartha, coder"');
  });

  it("scales height to 1.25x the given size", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Character, { props: { size: 200 } });
    expect(html).toContain('width="200"');
    expect(html).toContain('height="250"');
  });
});
