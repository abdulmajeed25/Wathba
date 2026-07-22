'use client';

import { useEffect, useState } from 'react';

/**
 * OPS Phase B (Unit 2) — resolve a User id → display name so audit / support /
 * agents screens stop showing raw UUIDs. Drop-in for Unit-3 adoption:
 *
 *   <ActorName id={row.actorId} />
 *
 * Resolution is BATCHED + CACHED across every instance on the page: each
 * mounted <ActorName> registers its id, a microtask coalesces all pending ids
 * into ONE call to the ops read layer (`/api/ops/read/resolve/actors?ids=…`,
 * built by the Unit-1 backend), and the shared cache fans the result back out.
 * The endpoint is masked/permission-gated server-side like every read.
 *
 * DEGRADES SAFELY: while loading — and permanently if the endpoint is absent
 * (404) or the id doesn't resolve — it renders the truncated id (dir=ltr, full
 * id in the title) exactly as the raw columns do today, so nothing regresses
 * before the backend lands.
 */

type Resolved = { name: string; handle?: string | null } | null;

const cache = new Map<string, Resolved>();
const inflight = new Set<string>();
let pending = new Set<string>();
let scheduled = false;
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((fn) => fn());
}

async function flush() {
  scheduled = false;
  const ids = [...pending].filter((id) => !cache.has(id) && !inflight.has(id));
  pending = new Set();
  if (ids.length === 0) return;
  ids.forEach((id) => inflight.add(id));
  try {
    const r = await fetch(`/api/ops/read/resolve/actors?ids=${encodeURIComponent(ids.join(','))}`);
    if (r.ok) {
      const body = (await r.json()) as {
        actors?: Record<string, { name?: string; handle?: string | null }>;
        items?: Array<{ id: string; name?: string; handle?: string | null }>;
      };
      // Accept either shape: { actors: { id: {...} } } or { items: [{ id, ... }] }.
      const map = new Map<string, { name?: string; handle?: string | null }>();
      if (body.actors) for (const [id, v] of Object.entries(body.actors)) map.set(id, v);
      if (body.items) for (const it of body.items) map.set(it.id, it);
      for (const id of ids) {
        const hit = map.get(id);
        cache.set(id, hit?.name ? { name: hit.name, handle: hit.handle ?? null } : null);
      }
    } else {
      // Endpoint missing / refused → cache as unresolved so we don't re-hammer.
      for (const id of ids) cache.set(id, null);
    }
  } catch {
    for (const id of ids) cache.set(id, null);
  } finally {
    ids.forEach((id) => {
      inflight.delete(id);
      if (!cache.has(id)) cache.set(id, null);
    });
    notify();
  }
}

function request(id: string) {
  if (cache.has(id) || inflight.has(id)) return;
  pending.add(id);
  if (!scheduled) {
    scheduled = true;
    queueMicrotask(flush);
  }
}

function truncate(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

export function ActorName({
  id,
  className,
  fallback,
}: {
  id: string | null | undefined;
  className?: string;
  /** Rendered when there is no id at all (e.g. system-authored rows). */
  fallback?: string;
}) {
  const [, force] = useState(0);

  useEffect(() => {
    if (!id) return;
    if (cache.has(id)) return;
    const rerender = () => force((n) => n + 1);
    subscribers.add(rerender);
    request(id);
    return () => {
      subscribers.delete(rerender);
    };
  }, [id]);

  if (!id) return <span className={className}>{fallback ?? '—'}</span>;

  const resolved = cache.get(id);
  if (resolved && resolved.name) {
    return (
      <span className={className} title={id}>
        {resolved.name}
        {resolved.handle ? <span className="text-[#8b949e]"> @{resolved.handle}</span> : null}
      </span>
    );
  }

  // Loading or unresolved → truncated id, exactly like the raw columns.
  return (
    <code dir="ltr" className={className ?? 'text-[11px] text-[#8b949e]'} title={id}>
      {truncate(id)}
    </code>
  );
}
