// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { addCopyButtons, markWhenSeen } from "../src/scripts/reading";

describe("addCopyButtons", () => {
  it("adds a copy button to each code block that copies its code", async () => {
    document.body.innerHTML = "<pre><code>npm i graft</code></pre><pre><code>ls</code></pre>";
    const writeText = vi.fn().mockResolvedValue(undefined);
    addCopyButtons(document, { writeText });
    const buttons = document.querySelectorAll<HTMLButtonElement>("pre > button.copy");
    expect(buttons).toHaveLength(2);
    buttons[0]?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith("npm i graft");
    expect(buttons[0]?.textContent).toBe("copied ✓");
  });

  it("adds nothing when the clipboard is unavailable", () => {
    document.body.innerHTML = "<pre><code>x</code></pre>";
    vi.stubGlobal("navigator", {});
    addCopyButtons(document);
    expect(document.querySelector("button.copy")).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe("markWhenSeen", () => {
  it("marks everything at once when IntersectionObserver is missing", () => {
    document.body.innerHTML = "<h2>a</h2><h2>b</h2>";
    markWhenSeen(document.querySelectorAll("h2"));
    expect(document.querySelectorAll("h2.seen")).toHaveLength(2);
  });
});
