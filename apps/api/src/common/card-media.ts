/**
 * What a CARD is allowed to show.
 *
 * The creator picks; the API decides once, here, and every card surface
 * inherits it by simply receiving `videoUrl: null`. That is deliberate: the
 * hero rotator, the trending grid and the two magazine carousels all already do
 * the right thing with a null video — they render the cover and drop the ▶
 * affordance — so resolving the choice server-side means four independent
 * components cannot disagree about it, and a fifth surface added later gets the
 * behaviour for free without knowing the flag exists.
 *
 * The project DETAIL payload deliberately does NOT go through this. That is
 * where the creator edits the setting, so it needs the raw video and the flag.
 */
export function cardVideoUrl(p: { videoUrl: string | null; cardMedia: 'VIDEO' | 'POSTER' }): string | null {
  return p.cardMedia === 'POSTER' ? null : p.videoUrl;
}

/**
 * The two raw columns the rule needs, lifted off an untyped SQL row.
 *
 * Here rather than in discover.service because it is part of the rule, and
 * because a `videoUrl: r.videoUrl` read sitting in a card service is exactly
 * the shape card-media.spec.ts scans for — a legitimate one there would have
 * meant weakening the guard until it stopped catching the illegitimate kind.
 */
export function rawCardMedia(r: Record<string, unknown>): {
  videoUrl: string | null;
  cardMedia: 'VIDEO' | 'POSTER';
} {
  return {
    videoUrl: (r.videoUrl as string) ?? null,
    cardMedia: (r.cardMedia as 'VIDEO' | 'POSTER') ?? 'VIDEO',
  };
}
