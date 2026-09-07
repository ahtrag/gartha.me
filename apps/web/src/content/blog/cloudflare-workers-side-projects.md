---
title: Why I moved my side projects to Cloudflare Workers
description: One account, one deploy, zero servers to babysit.
date: 2026-09-01
category: code
featured: true
---

For years every side project started the same way: pick a VPS, harden it, forget about it, then find out six months later that the box has been unpatched the whole time. I wanted the fun part without the ops part.

## The whole deploy is one file

```toml
name = "gartha-me"
main = "apps/api/src/index.ts"

[assets]
directory = "apps/web/dist"
```

That cron line is the whole scheduler.
