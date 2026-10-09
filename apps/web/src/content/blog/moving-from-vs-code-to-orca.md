---
title: Today I closed VS Code for good and moved to Orca
description: One editor on the Mac, the same one on my Android, and an agent that does the typing.
date: 2026-09-11
category: code
featured: true
---

Today I stopped using VS Code. Not "I'm trying something new for a week", but closed it, removed it from the Dock, and moved everything I do to Orca, the AI-native coding app from Stably. I also installed it on my Android phone. This is a note on what that day actually looked like.

## Why now

VS Code was never the problem. The problem was the shape of my day. Most of my work on this site and my side projects is no longer typing code line by line. It is describing a change, watching an agent make it, reading the diff, and pushing. VS Code with extensions bolted on kept feeling like a text editor with an agent squeezed into a side panel. I wanted the reverse: the agent in the middle and the editor around it.

Orca is built that way from the start. The conversation with the agent is the main surface, the files and diffs sit next to it, and a browser the agent can drive is one click away. That last part matters for a site like this one, where half of what I want to check is "does the page look right".

## What I did today

**Morning: moved this repo over.** I opened `gartha.me` in Orca, pointed it at the monorepo, and gave it the same kind of tasks I would normally hand to a terminal agent. The workflow that stuck:

1. Describe the change in plain words.
2. Let the agent edit, run the tests, and show me the diff.
3. Read the diff like a code review, not like a draft I have to finish.
4. Commit and push.

Nothing in that loop needed a VS Code feature I miss yet. The one thing I reached for by reflex was the command palette, and Orca has its own.

**Afternoon: Android.** This is the part I was most curious about. I added Orca on my phone and connected it to the same projects. I do not expect to write real code on a six inch screen, and I did not try. What it is good for is the other 80% of the loop: reading what the agent did, answering its questions, approving a change, and kicking off the next task while I am away from the desk. I started a task on the Mac, walked out, and finished reviewing it on the phone. That was the moment the move felt real.

**Evening: this post.** Written and published from the same setup. The blog is a plain Markdown collection on an Astro site, so "publish a post" is just "add a file and push", which is exactly the kind of small task I now hand off and review instead of doing by hand.

## What I gave up

Being honest about the trade so I can look back at this later:

- **Extensions.** Years of muscle memory and a curated extension list are gone. Most of them were doing jobs the agent now does, but not all.
- **Offline editing.** VS Code was fully useful without a network. Orca is at its best when the agent is reachable.
- **Familiarity.** Every new tool has a tax, and I paid it today in small ways: where the settings live, which shortcut opens the terminal, how the diff view scrolls.

## What I got

- **One tool on two devices.** Desk and phone are the same workflow, not a desktop workflow and a mobile compromise.
- **Review as the default mode.** I read more code than I write now, and the tool is shaped for reading.
- **Less setup.** No extension list to maintain, no settings sync to babysit.

## Where this goes

I will keep this post honest by coming back to it. If in a month I have quietly reinstalled VS Code, I will say so here. For now: one editor, on the Mac and in my pocket, and the agent does the typing.
