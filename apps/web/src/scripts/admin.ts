import type { JobRun, Report } from "@gartha/db";

export type ReportPayload = { report: Report; runs: JobRun[] };

function el<T extends Element>(root: ParentNode, field: string): T | null {
  return root.querySelector<T>(`[data-field="${field}"]`);
}

export function renderReport(root: ParentNode, { report, runs }: ReportPayload): void {
  const set = (f: string, v: string | number) => {
    const e = el<HTMLElement>(root, f);
    if (e) e.textContent = String(v);
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
        li.textContent = `${r.startedAt.slice(11, 19)} ${r.trigger} · ${r.status}${r.error ? ` · ${r.error}` : ""}`;
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

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function mount(root: Document): void {
  const load = async (path: string, init?: RequestInit) => {
    try {
      const err = el<HTMLElement>(root, "error");
      if (err) err.hidden = true;
      renderReport(root, await getJson<ReportPayload>(path, init));
    } catch (e) {
      showError(root, e instanceof Error ? e.message : "something went wrong");
    }
  };

  root
    .querySelector('[data-action="run"]')
    ?.addEventListener("click", () => load("/api/admin/reports/run", { method: "POST" }));
  root.querySelector<HTMLInputElement>('[data-action="date"]')?.addEventListener("change", (ev) => {
    const v = (ev.target as HTMLInputElement).value;
    if (v) load(`/api/admin/reports/${v}`);
  });

  load("/api/admin/reports/latest");
}
