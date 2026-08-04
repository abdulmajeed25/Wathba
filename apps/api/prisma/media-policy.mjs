// ============================================================================
// Wathba — the media bucket's public-read policy, in one place.
//
//   node --env-file=.env prisma/media-policy.mjs          # apply
//   node --env-file=.env prisma/media-policy.mjs --show   # print, change nothing
//
// The bucket ships with NO policy, so every object in it is private and the
// `publicUrl` MediaService hands back 403s. These are the prefixes that are
// public BY DESIGN — a project cover, a story image or video, and a profile
// avatar are all rendered to anonymous visitors on pages that need no login.
// Without this they load nowhere.
//
// The list is the prefixes something ACTUALLY WRITES TO, not the API's set of
// accepted kinds. It was first written as "every ALLOWED_KIND except evidence",
// by symmetry with MediaService rather than by checking producers, and that put
// `hero/` and `reward/` in the policy:
//
//   reward — no producer has ever existed; it has only ever been a member of
//            the UploadKind union.
//   hero   — one producer, wathba-start.tsx, which had no importer and could
//            never render. Deleted in #111; it was already unreachable.
//
// Both prefixes were empty, so nothing was exposed — but a standing anonymous
// grant on a path nothing writes to is a claim about the system that is not
// true, and this file is where someone checks what the public surface is.
//
// NOTE FOR WHOEVER ADDS ONE OF THEM BACK: MediaService still ACCEPTS the `hero`
// and `reward` kinds, so an upload will succeed and then 403 on read until you
// add the prefix here. Add it in the same change as the producer.
//
// `evidence/` is deliberately absent and must stay that way. It is where the
// `evidence` upload kind puts payout proof and KYC documents, and it lives in
// the SAME bucket (which is why the bucket is called venture-evidence). A
// bucket-wide policy here would be a data leak, not a fix.
//
// Objects are keyed `<kind>/<yyyy>/<mm>/<uuid>.<ext>`, so a public prefix is
// not an index: the UUID is unguessable and s3:ListBucket is never granted, so
// anonymous callers cannot enumerate what they were not linked to.
//
// This file is the single writer of the policy. It used to live inside
// seed-project-covers.mjs, which is the wrong home for bucket configuration and
// would have fought this script for ownership of the same document.
// ============================================================================
import {
  GetBucketPolicyCommand,
  PutBucketPolicyCommand,
  S3Client,
} from '@aws-sdk/client-s3';

/**
 * Prefixes served to anonymous visitors — each one has a live producer.
 * `evidence` is NOT one, on purpose. See the header before adding to this list.
 */
export const PUBLIC_PREFIXES = ['demo-covers', 'story', 'avatar'];

/** Sids this file owns. Anything else in the policy is left untouched. */
const MANAGED_SIDS = ['PublicReadMedia', 'PublicReadDemoCovers'];

const SID = 'PublicReadMedia';

export function buildStatement(bucket) {
  return {
    Sid: SID,
    Effect: 'Allow',
    Principal: { AWS: ['*'] },
    Action: ['s3:GetObject'],
    // Sorted, because MinIO stores it sorted and hands it back that way. An
    // unsorted literal here compares unequal to what was just written, so the
    // "is it already current" check never matched and the policy was rewritten
    // on every single run while reporting each one as a change.
    Resource: PUBLIC_PREFIXES.map((p) => `arn:aws:s3:::${bucket}/${p}/*`).sort(),
  };
}

/** Order-insensitive compare — see the note on Resource above. */
function canon(statement) {
  if (!statement) return '';
  const sortArr = (v) => (Array.isArray(v) ? [...v].sort() : v);
  return JSON.stringify({
    Sid: statement.Sid,
    Effect: statement.Effect,
    Principal: { AWS: sortArr(statement.Principal?.AWS) },
    Action: sortArr(statement.Action),
    Resource: sortArr(statement.Resource),
  });
}

export function makeClient() {
  return new S3Client({
    region: 'us-east-1',
    endpoint: process.env.MINIO_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretAccessKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    },
  });
}

/**
 * Idempotent. Rewrites only the statements this file owns and preserves every
 * other statement in the document — a blind PutBucketPolicy would silently drop
 * anything another tool had added, and bucket policies have no merge semantics
 * of their own.
 */
export async function ensureMediaPolicy(s3, bucket) {
  let existing = null;
  try {
    const got = await s3.send(new GetBucketPolicyCommand({ Bucket: bucket }));
    existing = JSON.parse(got.Policy);
  } catch {
    /* no policy yet — the bucket's shipped state */
  }

  const foreign = (existing?.Statement ?? []).filter((s) => !MANAGED_SIDS.includes(s.Sid));
  const wanted = buildStatement(bucket);
  const current = (existing?.Statement ?? []).find((s) => s.Sid === SID);

  if (current && canon(current) === canon(wanted)) {
    console.log(`media policy: already current (${PUBLIC_PREFIXES.length} public prefixes)`);
    return { changed: false };
  }

  await s3.send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify({ Version: '2012-10-17', Statement: [...foreign, wanted] }),
    }),
  );
  console.log(
    `media policy: anonymous s3:GetObject on ${PUBLIC_PREFIXES.map((p) => `${p}/*`).join(', ')}` +
      `${foreign.length ? ` (kept ${foreign.length} unmanaged statement(s))` : ''}`,
  );
  return { changed: true };
}

// Run directly: `node --env-file=.env prisma/media-policy.mjs`
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const bucket = process.env.MEDIA_BUCKET ?? 'venture-evidence';
  const s3 = makeClient();
  if (process.argv.includes('--show')) {
    try {
      const got = await s3.send(new GetBucketPolicyCommand({ Bucket: bucket }));
      console.log(JSON.stringify(JSON.parse(got.Policy), null, 2));
    } catch {
      console.log(`${bucket}: no policy — every object is private`);
    }
  } else {
    await ensureMediaPolicy(s3, bucket);
  }
}
