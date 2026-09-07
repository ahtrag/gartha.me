type Dated = { id: string; data: { date: Date; draft: boolean } };

export function sortNewest<T extends Dated>(posts: T[]): T[] {
  return posts
    .filter((p) => !p.data.draft)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function readTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

/** In a newest-first list, prev is the older neighbour and next is the newer one. */
export function neighbours<T extends Dated>(sorted: T[], id: string): { prev?: T; next?: T } {
  const i = sorted.findIndex((p) => p.id === id);
  return { prev: sorted[i + 1], next: i > 0 ? sorted[i - 1] : undefined };
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
