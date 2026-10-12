---
title: A weekly sweep for node_modules, not a watcher
description: My Documents folder was full of dependencies for projects I hadn't touched in months. A dry run says 30 GB can go.
date: 2026-10-12
category: builds
---

My Mac told me the Documents folder was taking almost 100 GB. I knew the reason without looking: every JavaScript project I've ever cloned carries its own `node_modules`, and most of those projects haven't been opened in weeks.

My first idea was a watcher. Put a file watcher on every project, and if one goes untouched for 30 days, delete its `node_modules`. I asked Claude Code what it thought before building anything, and the answer changed most of the plan.

## Measure first

Before giving an opinion, it measured. `du` put the real number at 51 GB, not 100. Finder counts differently, and I had taken its number at face value. Then it broke the 51 GB down:

| What | Size |
|---|---|
| `node_modules`, across 24 projects | 21.5 GB |
| `.next` build caches | 18.8 GB |
| Old git worktrees | 2.2 GB |
| `.turbo` and other small caches | about 1 GB |

The surprise was `.next`. Next.js build caches were almost as big as all the dependencies combined, and they're the safest thing to delete, because the next `dev` or `build` regenerates them. If I had only cleaned `node_modules`, I would have left nearly half the space on the table.

## Why not a watcher

A watcher is a daemon that runs all the time, watching thousands of files across two dozen projects, to answer a question that only matters once a week: has anything here changed lately? A scheduled job answers the same question and costs nothing in between. So the watcher became a weekly sweep, run by macOS's own scheduler, launchd, every Sunday night.

## What counts as inactive

This is the part worth getting right, since it decides what gets deleted. A project's last activity is the newest of three things:

- its last git commit,
- its last branch checkout, from git's own log,
- its newest source file, ignoring dependencies, build output and `.git`.

File access times are deliberately left out, because macOS barely updates them. A project I opened yesterday could look untouched for months.

From there, two thresholds:

- **Idle for 7 days:** remove build caches only, like `.next`, `.turbo` and `.open-next`. They're cheap to rebuild.
- **Idle for 30 days:** remove `node_modules` as well.

Each project is found by its git root, so an old worktree is judged on its own and doesn't ride along on the main repo's activity.

## Things it refuses to touch

Deleting things automatically is only fine if it's hard to delete the wrong thing. The script has a few guards:

- **Anything that's running.** It lists the working folder of every running process, and skips any project with something inside it. In the first run, that skipped this very site, because its dev server was up.
- **Anything I've marked.** An empty `.keep-deps` file in a project excludes it for good.
- **Anything, by default.** Running `dev-sweep` alone is a dry run. It deletes nothing and writes a report of what it would remove. Deleting takes an explicit `--apply`.

The report lists every project under "would clean", "kept" or "skipped", with sizes and idle days, so the weekly run is something I read, not something I have to trust.

One detail I wouldn't have known: about half my projects use pnpm, which keeps one shared copy of every package and links each project to it. Deleting a pnpm project's `node_modules` frees almost nothing until the shared store is cleaned too. So after a real run, the script also runs `pnpm store prune`.

## The gotcha with macOS

The first scheduled test run reported 0 MB to free. That looked like a clean result, but it was macOS privacy protection quietly hiding `~/Documents` from the background job. Background jobs need Full Disk Access to read that folder, and without it they just see nothing.

Two fixes came out of that. The script now checks that it can actually read the folder, and if it can't, it shows a "dev-sweep failed" notification instead of a cheerful 0 MB. And the job needs one macOS setting from me: adding `/bin/bash` under Privacy & Security, then Full Disk Access. That grants it to every bash script, which is broad, so the alternative is running the sweep by hand from a terminal that already has access.

## Where it stands

The dry run found **30.1 GB** it would free across the inactive projects. The biggest single item was a 6.8 GB `.next` cache in a project that had been idle for 19 days. Under the rules, only its cache goes, and its dependencies stay. A few projects sat right at 31 days idle, which is exactly where a `.keep-deps` file earns its place.

I haven't run it for real yet. That's on purpose: I want to read one or two weekly reports first. When they look right, it's a single `dev-sweep --apply`, and bringing a cleaned project back is just `pnpm i` or `bun i` the next time I open it.

## What I'd tell myself

- **Measure before you design.** My plan was aimed at `node_modules`, and the biggest single category on disk turned out to be build caches.
- **Prefer a schedule to a watcher** when the question you're asking only changes slowly.
- **Make the dry run the default,** and make failure loud. A blocked job that reports "0 MB" is worse than one that reports nothing.

Longer term, the real fix is fewer copies in the first place. I'm currently mixing pnpm, npm, bun and yarn across projects. Settling on one that shares packages between projects would keep even the active ones small.
