export const profile = {
  name: "Gartha",
  title: "Software Engineer +1",
  level: 7,
  xpPercent: 40,
  stars: 4,
  tagline: "Ships backend systems by day, grinds ranked lobbies by night.",
  intro:
    "Ships backend systems by day, grinds ranked lobbies by night. This site is the save file: notes on code, games, and whatever I am building this week.",
  bio: [
    "I'm Gartha, a software engineer who mostly builds backend systems. Lately that means TypeScript on Cloudflare Workers, and a workflow where AI agents do most of the typing while I describe, review, and ship.",
    "This site is my save file. I write up the setups that actually stuck, like the tools, hooks, and editors I use every day, so the next person (usually future me) doesn't have to rediscover them.",
    "Outside work I play ranked games, which is where this site gets its look.",
  ],
  stack: [
    { label: "FRONTEND", value: "TypeScript", glyph: "TS", color: "var(--blue)" },
    { label: "BACKEND", value: "Workers", glyph: "λ", color: "var(--orange)" },
  ],
  // Entries with an empty href are not rendered; fill them in to show them.
  socials: [
    { label: "GitHub", href: "https://github.com/ahtrag" },
    { label: "LinkedIn", href: "" },
    { label: "X", href: "" },
    { label: "Email", href: "mailto:garthaprasidhiyanta@gmail.com" },
  ],
} as const;

export const socials = profile.socials.filter((s) => s.href !== "");
