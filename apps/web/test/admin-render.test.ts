// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { type ReportPayload, renderReport } from "../src/scripts/admin";

const payload: ReportPayload = {
  report: {
    date: "2026-09-07",
    generatedAt: "2026-09-07T22:00:05Z",
    emailsRead: 47,
    needsReply: 3,
    billsDue: 2,
    archived: 31,
    summary: "Quiet inbox.",
    items: [{ kind: "reply", title: "Invoice", note: "before Friday", priority: "high" }],
  },
  runs: [
    {
      id: 1,
      startedAt: "2026-09-07T22:00:00Z",
      finishedAt: "2026-09-07T22:00:05Z",
      status: "ok",
      error: null,
      trigger: "cron",
    },
  ],
};

describe("renderReport", () => {
  it("fills the counts, summary, items and run log", () => {
    document.body.innerHTML = `
      <span data-field="date"></span><span data-field="emailsRead" aria-label="not loaded"></span><span data-field="needsReply"></span>
      <span data-field="billsDue"></span><span data-field="archived"></span><p data-field="summary"></p>
      <ul data-field="items"></ul><ul data-field="runs"></ul>`;
    renderReport(document, payload);
    expect(document.querySelector('[data-field="emailsRead"]')?.textContent).toBe("47");
    expect(document.querySelector('[data-field="emailsRead"]')?.hasAttribute("aria-label")).toBe(
      false,
    );
    expect(document.querySelector('[data-field="summary"]')?.textContent).toBe("Quiet inbox.");
    expect(document.querySelectorAll('[data-field="items"] li')).toHaveLength(1);
    expect(document.querySelector('[data-field="runs"]')?.textContent).toContain("cron");
  });
});
