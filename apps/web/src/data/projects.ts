export interface ProjectLink {
  label: string;
  href: string;
}

export interface Project {
  name: string;
  description: string;
  stack: string[];
  links: ProjectLink[];
  status?: string;
  /** Who the project was made for, shown as "Made to help {person} {purpose}". */
  madeFor?: { name: string; href: string; purpose: string };
}

// Only real, verifiable projects live here. Entries are added as real projects are named.
export const projects: Project[] = [
  {
    name: "F15 Library",
    description:
      "Book summaries in Bahasa Indonesia that you can finish in 15 minutes, across more than 2,000 best sellers. I rebuilt it at Imajinyata to run entirely on Cloudflare: a server-rendered React Router frontend and a Hono API on Workers, with the catalogue in D1. Reading needs no account. Signing in syncs bookmarks, highlights and reading position across devices, summaries can be listened to as narration, and editors curate books and collections from an admin workspace.",
    stack: [
      "TypeScript",
      "React Router",
      "Tailwind CSS",
      "HeroUI",
      "Cloudflare Workers",
      "Hono",
      "D1",
      "Drizzle ORM",
      "Firebase Auth",
      "Bun",
      "Turbo",
    ],
    links: [{ label: "Live site", href: "https://www.f15library.com/" }],
    madeFor: {
      name: "Adythia Pratama",
      href: "https://www.instagram.com/pratama.adythia/",
      purpose:
        "realize his vision of book summaries that are easy for every Indonesian reader to access",
    },
    status: "Live",
  },
  {
    name: "gartha.me",
    description:
      "This site: a Bun + Turbo monorepo with an Astro static site and a shared Astro UI kit, served by a Cloudflare Worker whose Hono API keeps its data in D1 through Drizzle ORM.",
    stack: [
      "TypeScript",
      "Astro",
      "Bun",
      "Turbo",
      "Cloudflare Workers",
      "Hono",
      "D1",
      "Drizzle ORM",
    ],
    links: [
      { label: "Live site", href: "https://gartha.me" },
      { label: "Source", href: "https://github.com/ahtrag/gartha.me" },
    ],
    status: "Live",
  },
];
