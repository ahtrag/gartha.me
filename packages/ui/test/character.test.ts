import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Character from "../src/Character.astro";

describe("Character", () => {
  it.each([
    ["coder", "&lt;/&gt;"],
    ["gamer", 'cx="92"'],
    ["builder", 'width="52" height="8"'],
  ] as const)("renders the %s variant with its held item", async (variant, marker) => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Character, { props: { variant } });
    expect(html).toContain("<svg");
    expect(html).toContain(marker);
    expect(html).toContain(`aria-label="Gartha, ${variant}"`);
  });
});
