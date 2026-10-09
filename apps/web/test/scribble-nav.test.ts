// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initScribbleNav } from "../src/scripts/scribble-nav";

function setup() {
  document.body.innerHTML = `
    <nav>
      <a data-scribble href="/blog" style="--c: red">blog</a>
      <a data-scribble href="/" aria-current="page">home</a>
    </nav>
  `;
  const root = document.querySelector("nav") as HTMLElement;
  const go = vi.fn();
  initScribbleNav(root, { delay: 0, go });
  const pick = (sel: string) => {
    const el = root.querySelector<HTMLAnchorElement>(sel);
    if (!el) throw new Error(`missing ${sel}`);
    return el;
  };
  const blog = pick('a[href="/blog"]');
  const home = pick('a[href="/"]');
  return { go, blog, home };
}

const click = (el: HTMLElement, init: MouseEventInit = {}) => {
  const e = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
  el.dispatchEvent(e);
  return e;
};

describe("initScribbleNav", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  it("draws a scribble, then navigates", () => {
    const { go, blog } = setup();
    const e = click(blog);
    expect(e.defaultPrevented).toBe(true);
    expect(document.querySelector("svg.scribble path")).not.toBeNull();
    vi.runAllTimers();
    expect(go).toHaveBeenCalledWith(blog.href);
  });

  it("leaves modified clicks to the browser", () => {
    const { go, blog } = setup();
    const e = click(blog, { metaKey: true });
    expect(e.defaultPrevented).toBe(false);
    vi.runAllTimers();
    expect(go).not.toHaveBeenCalled();
  });

  it("does nothing special for the current page", () => {
    const { go, home } = setup();
    const e = click(home);
    expect(e.defaultPrevented).toBe(false);
    expect(document.querySelector("svg.scribble")).toBeNull();
    vi.runAllTimers();
    expect(go).not.toHaveBeenCalled();
  });
});
