import type { JobRun, Report } from "@gartha/db";

export type ReportPayload = { report: Report; runs: JobRun[] };

function el<T extends Element>(root: ParentNode, field: string): T | null {
  return root.querySelector<T>(`[data-field="${field}"]`);
}

export function renderReport(root: ParentNode, { report, runs }: ReportPayload): void {
  const set = (f: string, v: string | number) => {
    const e = el<HTMLElement>(root, f);
    if (e) {
      e.textContent = String(v);
      e.removeAttribute("aria-label");
    }
  };
  set("date", report.date);
  set("emailsRead", report.emailsRead);
  set("needsReply", report.needsReply);
  set("billsDue", report.billsDue);
  set("archived", report.archived);
  set("summary", report.summary);

  const items = el<HTMLUListElement>(root, "items");
  if (items) {
    items.replaceChildren(
      ...report.items.map((it) => {
        const li = document.createElement("li");
        li.dataset.kind = it.kind;
        li.dataset.priority = it.priority;
        const t = document.createElement("b");
        t.textContent = it.title;
        const n = document.createElement("span");
        n.textContent = it.note;
        li.append(t, n);
        return li;
      }),
    );
  }

  const log = el<HTMLUListElement>(root, "runs");
  if (log) {
    log.replaceChildren(
      ...runs.map((r) => {
        const li = document.createElement("li");
        li.dataset.status = r.status;
        li.textContent = `${r.startedAt.slice(0, 10)} ${r.startedAt.slice(11, 19)}Z ${r.trigger} · ${r.status}${r.error ? ` · ${r.error}` : ""}`;
        return li;
      }),
    );
  }
}

export function showError(root: ParentNode, message: string): void {
  const box = el<HTMLElement>(root, "error");
  if (box) {
    box.textContent = message;
    box.hidden = false;
  }
}

export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    if (e instanceof TypeError) throw new Error("could not reach the API");
    throw e;
  }

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  if (res.status < 400) {
    if (res.redirected || !isJson) {
      throw new Error("session expired, reload the page to sign in again");
    }
    return res.json() as Promise<T>;
  }

  if (isJson) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new HttpError(body.error ?? `request failed (${res.status})`, res.status);
  }
  throw new HttpError(`request failed (${res.status})`, res.status);
}

export function mount(root: Document): void {
  let inFlight = false;
  let hasReport = false;
  const runBtn = root.querySelector<HTMLButtonElement>('[data-action="run"]');
  const runLabel = runBtn?.textContent ?? "Run now";
  const summaryEl = el<HTMLElement>(root, "summary");
  const summaryCard = summaryEl?.closest("section") ?? null;

  const load = async (path: string, init?: RequestInit) => {
    if (inFlight) return;
    inFlight = true;
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.setAttribute("aria-busy", "true");
      runBtn.textContent = "Running…";
    }
    summaryCard?.setAttribute("aria-busy", "true");
    try {
      const err = el<HTMLElement>(root, "error");
      if (err) err.hidden = true;
      renderReport(root, await getJson<ReportPayload>(path, init));
      hasReport = true;
    } catch (e) {
      if (!hasReport && e instanceof HttpError && e.status === 404) {
        // Empty state: nothing generated yet, not an error.
        if (summaryEl)
          summaryEl.textContent = "No reports yet. Click Run now to generate today's report.";
      } else {
        showError(root, e instanceof Error ? e.message : "something went wrong");
        if (!hasReport && summaryEl) summaryEl.textContent = "Could not load the report.";
      }
    } finally {
      inFlight = false;
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.removeAttribute("aria-busy");
        runBtn.textContent = runLabel;
      }
      summaryCard?.removeAttribute("aria-busy");
    }
  };

  runBtn?.addEventListener("click", () => load("/api/admin/reports/run", { method: "POST" }));
  root.querySelector<HTMLInputElement>('[data-action="date"]')?.addEventListener("change", (ev) => {
    const v = (ev.target as HTMLInputElement).value;
    if (v) load(`/api/admin/reports/${v}`);
  });

  load("/api/admin/reports/latest");
}
