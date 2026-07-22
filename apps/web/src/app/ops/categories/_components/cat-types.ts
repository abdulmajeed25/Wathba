/**
 * OPS Part 5 (CONTENT) — shared category shapes for the «الفئات» screen.
 *
 * Plain module (NO 'use client'): imported by BOTH the server page (which
 * fetches the flat ops list and builds the tree) and the client editor island.
 * Keeping the type + the tree builder here avoids the Next pitfall of a server
 * component importing a value from a 'use client' file.
 */

/** One node as the ops read `GET /v1/ops/categories` returns it (flat). */
export interface CatApiNode {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  /** LIVE per-node attachment count (all statuses; not rolled up to parent). */
  projectCount: number;
  /** True → permanently barred by the cultural-exclusion list (can't reactivate). */
  excluded: boolean;
}

/** A node in the assembled two-level tree the editor renders. */
export interface CatNode extends CatApiNode {
  children: CatNode[];
}

/**
 * Assemble the flat ops list into the two-level tree, preserving the sortOrder
 * the API already applied. Unknown parents (shouldn't happen) are dropped to
 * top-level so nothing silently disappears.
 */
export function buildCatTree(items: CatApiNode[]): CatNode[] {
  const byParent = new Map<string | null, CatApiNode[]>();
  for (const it of items) {
    const key = it.parentId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(it);
    byParent.set(key, list);
  }
  const toNode = (r: CatApiNode): CatNode => ({
    ...r,
    children: (byParent.get(r.id) ?? []).map(toNode),
  });
  return (byParent.get(null) ?? []).map(toNode);
}
