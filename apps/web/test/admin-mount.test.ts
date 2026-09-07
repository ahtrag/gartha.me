// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "../src/scripts/admin";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function setup() {
  document.body.innerHTML = `
    <p data-field="error" hidden></p>
    <input type="date" data-action="date" />
    <button data-action="run">Run now</button>
    <section>
      <span data-field="date"></span>
      <p data-field="summary">Loading…</p>
      <ul data-field="items"></ul>
    </section>
    <ul data-field="runs"></ul>
    <span data-field="emailsRead"></span>
    <span data-field="needsReply"></span>
    <span data-field="billsDue"></span>
    <span data-field="archived"></span>
  `;
}

const payload = {
  report: {
    date: "2026-09-07",
    generatedAt: "2026-09-07T22:00:05Z",
    emailsRead: 47,
    needsReply: 3,
    billsDue: 2,
    archived: 31,
    summary: "Quiet inbox.",
    items: [],
  },
  runs: [],
};

describe("mount", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    setup();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the latest report on mount", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    mount(document);

    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/reports/latest", undefined),
    );
  });

  it("shows a 503 error message in the error box", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: "access not configured" }, 503));
    vi.stubGlobal("fetch", fetchMock);

    mount(document);

    await vi.waitFor(() => {
      const err = document.querySelector('[data-field="error"]') as HTMLElement;
      expect(err.hidden).toBe(false);
      expect(err.textContent).toBe("access not configured");
    });
  });

  it("hides the error box and renders counts on a later successful load", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "access not configured" }, 503))
      .mockResolvedValueOnce(jsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    mount(document);
    await vi.waitFor(() => {
      expect((document.querySelector('[data-field="error"]') as HTMLElement).hidden).toBe(false);
    });

    document.querySelector<HTMLButtonElement>('[data-action="run"]')?.click();

    await vi.waitFor(() => {
      expect((document.querySelector('[data-field="error"]') as HTMLElement).hidden).toBe(true);
      expect(document.querySelector('[data-field="emailsRead"]')?.textContent).toBe("47");
    });
  });

  it("requests the given date when the date input changes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    mount(document);
    const runBtn = document.querySelector<HTMLButtonElement>('[data-action="run"]');
    await vi.waitFor(() => expect(runBtn?.disabled).toBe(false));

    const input = document.querySelector<HTMLInputElement>('[data-action="date"]');
    if (input) {
      input.value = "2026-09-01";
      input.dispatchEvent(new Event("change"));
    }

    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/reports/2026-09-01", undefined),
    );
  });

  it("sends a POST when Run now is clicked", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    mount(document);
    const runBtn = document.querySelector<HTMLButtonElement>('[data-action="run"]');
    await vi.waitFor(() => expect(runBtn?.disabled).toBe(false));

    runBtn?.click();

    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/reports/run", { method: "POST" }),
    );
  });

  it("ignores a second click while a request is in flight", async () => {
    let resolveFetch: (r: Response) => void = () => {};
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    mount(document);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    resolveFetch(jsonResponse(payload));
    const runBtn = document.querySelector<HTMLButtonElement>('[data-action="run"]');
    await vi.waitFor(() => expect(runBtn?.disabled).toBe(false));

    runBtn?.click();
    runBtn?.click();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(runBtn?.disabled).toBe(true);
    expect(runBtn?.getAttribute("aria-busy")).toBe("true");
    expect(runBtn?.textContent).toBe("Running…");

    resolveFetch(jsonResponse(payload));
    await vi.waitFor(() => expect(runBtn?.disabled).toBe(false));
    expect(runBtn?.textContent).toBe("Run now");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows a session-expired message for a non-JSON 200 response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(payload))
      .mockResolvedValueOnce(
        new Response("<html>login</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    mount(document);
    const runBtn = document.querySelector<HTMLButtonElement>('[data-action="run"]');
    await vi.waitFor(() => expect(runBtn?.disabled).toBe(false));

    runBtn?.click();

    await vi.waitFor(() => {
      const err = document.querySelector('[data-field="error"]') as HTMLElement;
      expect(err.hidden).toBe(false);
      expect(err.textContent).toBe("session expired, reload the page to sign in again");
    });
  });
});
