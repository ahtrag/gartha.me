export const profile = {
  name: "Gartha",
  title: "Software Engineer +1",
  tagline: "Software engineer at Imajinyata by day, ranked grinder by night.",
  intro:
    "Software engineer at Imajinyata by day, ranked grinder by night. This site is the save file: notes on code, games, and whatever I am building this week.",
  bio: [
    "I'm Gartha, a software engineer at Imajinyata. Most of my work runs through a workflow where AI agents do the typing while I describe what I want, review what comes back, and decide what ships.",
    "This site is my save file. I write up the setups that actually stuck, like wiring the graft code-graph tool into every repo so agents stop grepping blind, and closing VS Code for good to work in the Orca AI coding app, so the next person (usually future me) doesn't have to rediscover them.",
    "Outside work I play ranked games. In here, everything gets written up on the board.",
  ],
  stack: [
    { label: "LANGUAGE", value: "TypeScript", glyph: "TS", color: "var(--blue)" },
    { label: "FRAMEWORK", value: "Astro", glyph: "A", color: "var(--purple)" },
    { label: "RUNTIME", value: "Workers", glyph: "λ", color: "var(--orange)" },
    { label: "DATABASE", value: "D1", glyph: "D1", color: "var(--green)" },
    { label: "TOOLING", value: "Bun", glyph: "B", color: "var(--coral)" },
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
