export const profile = {
  name: "Gartha",
  title: "Software Engineer +1",
  level: 7,
  xpPercent: 40,
  stars: 4,
  tagline: "Ships backend systems by day, grinds ranked lobbies by night.",
  intro:
    "Ships backend systems by day, grinds ranked lobbies by night. This site is the save file: notes on code, games, and whatever I am building this week.",
  stack: [
    { label: "FRONTEND", value: "TypeScript", glyph: "TS", color: "var(--blue)" },
    { label: "BACKEND", value: "Workers", glyph: "λ", color: "var(--orange)" },
  ],
  stats: [
    { label: "LINES SHIPPED", value: "[N]", color: "var(--coral)" },
    { label: "HOURS PLAYED", value: "[N]", color: "var(--blue)" },
    { label: "COFFEE", value: "[N]", color: "var(--green)" },
    { label: "CURRENT GAME", value: "[GAME]", color: "var(--orange)" },
  ],
  years: "[YEARS]",
  commits: "[COMMITS]",
} as const;
