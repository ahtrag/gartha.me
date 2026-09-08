import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Logo from "../src/Logo.astro";

describe("Logo", () => {
  it("renders the </g> mark as an accessible svg at the given size", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Logo, { props: { size: 40 } });
    expect(html).toContain("<svg");
    expect(html).toContain('width="40"');
    expect(html).toContain('aria-label="gartha.me"');
    expect(html).toContain('data-glyph="g"');
  });

  it("defaults to 48px", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Logo, {});
    expect(html).toContain('width="48"');
  });
});
