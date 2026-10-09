---
title: Wiring graft into every repo on the machine, once
description: A user-level install, a session-start hook, and a per-repo graph that builds itself the first time an agent shows up.
date: 2026-09-11
category: code
---

Every coding agent I run starts a task the same way: grep, open a file, grep again, open three more. On a small repo that is a few thousand tokens of warm-up. On a monorepo it is most of the budget before any real work happens. [graft](https://github.com/NanoNets/graft) fixes that by keeping a prebuilt graph of each repo, every symbol with its exact `file:line` span and who calls what, and answering questions from the graph instead of from cold file reads.

The catch is that graft is per-repo. The graph lives in `<repo>/graft/`, nothing builds it for you, and I did not want to remember to set it up in every project. So the setup on this machine is done once, at the user level, and each repo picks it up the first time an agent opens it. This is how that is wired.

## One install, three hooks in

Graft is a global npm package, so the CLI and the MCP server are the same binary everywhere:

```bash
npm install -g @nanonets/graft
```

The MCP server is registered once in the user-level Claude config, not per project:

```json
"graft": { "type": "stdio", "command": "graft", "args": ["mcp"] }
```

That gives every session the same five tools (`graft_find_code`, `graft_find_all`, `graft_trace_calls`, `graft_file_api`, `graft_repo_map`) without touching a single repo's config.

## The session-start hook does the enforcing

The important piece is a tiny shell script registered as a `SessionStart` hook in `~/.claude/settings.json`. Its whole job is to notice when a repo has no graph yet:

```bash
command -v graft >/dev/null 2>&1 || exit 0
root="$(git -C "${CLAUDE_PROJECT_DIR:-$PWD}" rev-parse --show-toplevel 2>/dev/null)" || exit 0
[ -f "$root/graft/.graph/wiring.json" ] && exit 0
# otherwise: inject "graft graph missing, run graft build before exploring"
```

It is fail-open on purpose. No graft on the path, not a git repo, or graph already built, and it prints nothing and exits zero. Only when the graph is missing does it inject one line of context telling the agent to build it before grepping anything. The agent then runs `graft build`, which is structural only, needs no API key, takes a few seconds on a small repo and a minute or two on a big one, and adds `graft/` to `.gitignore` by itself.

Alongside that script there is a small Node helper wired to four more events. Together they cover the whole session lifecycle:

| Event | What it does |
|---|---|
| `SessionStart` | Check for the graph, print the repo map summary |
| `UserPromptSubmit` | Probe the graph for the prompt and hint which tool fits |
| `PostToolUse` on `Write`, `Edit` | Mark the graph stale so the next query refreshes it |
| `PostToolUse` on `Bash`, `Read`, `Grep`, `Glob`, `mcp__graft__*` | Tally tokens saved versus reading the files whole |
| `Stop` | Flush the tally |

None of this is per-repo. Clone something new, open a session, and the hooks are already there.

## Two skills, one rigid and one flexible

Hooks can inject context but they cannot make an agent follow a procedure. That part is two skills, also installed at the user level.

`graft-ensure` is the rigid one. It runs at the start of any work in a git repo and does exactly four things in order: find the root, check for `graft/.graph/wiring.json`, build if missing, then orient from `graft map` or `graft ask` instead of the source tree. It also carries the one rule I got wrong the first time: do not run `graft init` inside a repo. Init registers hooks, and the hooks are already registered globally, so a per-repo init makes every hook fire twice.

`graft` is the flexible one. It is the retrieval workflow after the graph exists: `ask` for "how does X work", `grep` when you need every occurrence, `skeleton` for a file's API in a couple hundred tokens, `callers` before any rename, `map` for orientation. The skill's main job is to stop the agent from chaining the same query five ways when one call already answered.

## What lands in the repo

Per repo, the footprint is a single gitignored folder:

```
graft/
  INDEX.md          # repo map, one line per file card
  apps/ packages/   # per-file markdown cards mirroring the source tree
  .graph/wiring.json  # the call graph itself
  .cache/
```

The `.gitignore` entry is what you would expect. The less obvious file is `.ignore` at the repo root:

```
!graft/
graft/.cache/
graft/.graph/
```

ripgrep reads `.ignore` before `.gitignore`, so this re-admits the markdown cards to search while keeping them out of git and keeping the binary cache out of search. The cards stay greppable, which matters because an agent that falls back to plain `rg` still lands on a card with prose and a `file:line` instead of raw source.

## Coverage today

The install is global, but the graphs are lazy. Right now two of the five repos in my Github folder have a built graph: this site, and one other project I opened this week. The other three will get theirs the first time a session starts in them. That is the whole point of doing it at the hook level rather than as a checklist: I never build a graph by hand, and I never open a repo that silently lacks one.

The payoff shows up as one line at the top of every graft result:

```
[graft] tokens saved ≈ 3,698 (86%) — this pack ≈ 615 tok vs reading the 6 source file(s) whole
```

On this monorepo the typical "where is the blog collection defined" question costs a few hundred tokens instead of a few thousand. Multiply by every task, every repo, every day, and the one-time global setup is the best hour I have spent on tooling this year.
