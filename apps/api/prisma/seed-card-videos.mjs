/**
 * Demo seed — give a handful of demo projects a real campaign video, so the
 * hover-video feature is visible without waiting for a creator to upload one.
 *
 * WHY THIS EXISTS. `videoUrl` is null for 1,226 of 1,229 projects, and the
 * three that had one all pointed at the SAME uploaded file. A feature nobody
 * can see is a feature nobody can review, and "it works, there is just nothing
 * to play" is indistinguishable from "it is broken" when you are looking at the
 * page rather than at the tests.
 *
 * WHAT THE CLIPS ARE. Each project's own cover image, given a slow 6-second
 * push (a Ken Burns move) at 640x360. Not stock footage and not pretending to
 * be: it is derived from media the project already owns, so every clip belongs
 * to its project, matches its cover exactly — which is what makes the card's
 * cross-fade read as one surface rather than a cut — and no third-party asset
 * enters the repo or the bucket. The cross-fade poster is that same cover, so
 * the first video frame and the image underneath it are identical by
 * construction.
 *
 * FIXTURE GUARD. `isTestFixture: false` is in the WHERE clause and is not
 * negotiable: the e2e suite asserts no fixture-titled project appears in any
 * public listing (batch-polish-fixtures.spec.ts F1-F5), and the timestamped
 * golden-journey projects would otherwise be candidates here. LIVE + published +
 * has-a-cover is the same presentability rule the hero pool uses, so seeded
 * projects are ones a reader can actually reach.
 *
 * Idempotent: projects that already have a videoUrl are skipped, so re-running
 * costs nothing and never overwrites a creator's real upload.
 *
 *   node prisma/seed-card-videos.mjs [count]      (default 12)
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

const COUNT = Number(process.argv[2] ?? 12);
const BUCKET = process.env.MEDIA_BUCKET;
const ENDPOINT = process.env.MINIO_ENDPOINT;
const PUBLIC_ENDPOINT = process.env.MINIO_PUBLIC_ENDPOINT ?? ENDPOINT;
const KEY = process.env.MINIO_ACCESS_KEY;
const SECRET = process.env.MINIO_SECRET_KEY;

if (!BUCKET || !ENDPOINT || !KEY || !SECRET) {
  console.error('missing MEDIA_BUCKET / MINIO_ENDPOINT / MINIO_ACCESS_KEY / MINIO_SECRET_KEY');
  process.exit(1);
}

/** Minimal SigV4 PUT. The media module owns uploads in the app; this is a
 *  one-off seed and pulling its Nest graph in for four lines of signing would
 *  cost more than it saves. */
async function putObject(key, body, contentType) {
  const url = new URL(`${ENDPOINT}/${BUCKET}/${key}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const region = 'us-east-1';
  const service = 's3';
  const sha = createHash('sha256').update(body).digest('hex');
  const canonicalHeaders =
    `host:${url.host}\nx-amz-content-sha256:${sha}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `PUT\n${url.pathname}\n\n${canonicalHeaders}\n${signedHeaders}\n${sha}`;
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const toSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  const { createHmac } = await import('node:crypto');
  const hmac = (k, d) => createHmac('sha256', k).update(d).digest();
  const signature = createHmac(
    'sha256',
    hmac(hmac(hmac(hmac(`AWS4${SECRET}`, dateStamp), region), service), 'aws4_request'),
  )
    .update(toSign)
    .digest('hex');
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'content-type': contentType,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': sha,
      Authorization: `AWS4-HMAC-SHA256 Credential=${KEY}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`PUT ${key} -> ${res.status} ${await res.text()}`);
}

const prisma = new PrismaClient();
const work = mkdtempSync(join(tmpdir(), 'wathba-seed-vid-'));

try {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT p."id", p."titleAr", p."mediaUrls"[1] AS cover
    FROM "Project" p
    WHERE p."status" = 'LIVE'
      AND p."hiddenAt" IS NULL
      AND p."isTestFixture" = false
      AND p."publishedAt" IS NOT NULL
      AND p."videoUrl" IS NULL
      AND array_length(p."mediaUrls", 1) > 0
      AND p."titleAr" !~ '[0-9]{10,}'
    ORDER BY p."publishedAt" DESC
    LIMIT ${COUNT}`);

  console.log(`${rows.length} project(s) to seed`);
  let done = 0;
  for (const r of rows) {
    if (!r.cover) continue;
    const src = join(work, 'cover.jpg');
    const out = join(work, 'clip.mp4');
    const img = await fetch(r.cover);
    if (!img.ok) {
      console.log(`  skip ${r.titleAr}: cover ${img.status}`);
      continue;
    }
    const { writeFileSync } = await import('node:fs');
    writeFileSync(src, Buffer.from(await img.arrayBuffer()));

    // 6s, 640x360, slow push from 1.00 to 1.12. yuv420p + faststart so it
    // plays inline on every browser and starts before the whole file lands.
    const ff = spawnSync(
      'ffmpeg',
      ['-y', '-loop', '1', '-i', src, '-t', '6',
       '-vf', "scale=1280:-2,zoompan=z='min(zoom+0.0006,1.12)':d=150:s=640x360:fps=25,format=yuv420p",
       '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-movflags', '+faststart', out],
      { encoding: 'utf8' },
    );
    if (ff.status !== 0) {
      console.log(`  skip ${r.titleAr}: ffmpeg ${ff.status}`);
      continue;
    }
    const body = readFileSync(out);
    const now = new Date();
    const key = `story/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.mp4`;
    await putObject(key, body, 'video/mp4');
    const publicUrl = `${PUBLIC_ENDPOINT}/${BUCKET}/${key}`;
    await prisma.project.update({ where: { id: r.id }, data: { videoUrl: publicUrl } });
    done++;
    console.log(`  ${done}. ${r.titleAr} -> ${(body.length / 1024).toFixed(0)}KB`);
  }
  console.log(`seeded ${done} project(s)`);
} finally {
  rmSync(work, { recursive: true, force: true });
  await prisma.$disconnect();
}
