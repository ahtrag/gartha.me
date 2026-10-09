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
}

// Only real, verifiable projects live here. Entries are added as real projects are named.
export const projects: Project[] = [
  {
    name: "gartha.me",
    description:
      "This site: a Bun + Turbo monorepo with an Astro static site and a shared Astro UI kit, served by a Cloudflare Worker whose Hono API keeps its data in D1 through Drizzle ORM.",
    stack: ["TypeScript", "Astro", "Bun", "Turbo", "Cloudflare Workers", "Hono", "D1", "Drizzle ORM"],
    links: [
      { label: "Live site", href: "https://gartha.me" },
      { label: "Source", href: "https://github.com/ahtrag/gartha.me" },
    ],
    status: "Live",
  },
];
