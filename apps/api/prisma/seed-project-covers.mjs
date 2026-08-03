// ============================================================================
// Wathba — deterministic project COVER generator.
//
//   node --env-file=.env prisma/seed-project-covers.mjs [--force] [--limit=N]
//
// Every seeded project had an empty `mediaUrls`, so `imageUrl` (= mediaUrls[0])
// was null for all of them and every card on the site fell back to the empty-
// media placeholder — a 26px outline rocket on a pale wash, repeated down the
// grid. This renders one cover per project and fills mediaUrls.
//
// The art is GENERATED, not photographic, and that is deliberate: it carries no
// third-party licence, needs no network, and re-runs to byte-identical output.
// Every cover is derived from the project's own id, so the same project always
// gets the same cover and the grid still looks varied — which matters here
// because 512 of the ~520 projects sit under one category (technology/apps),
// and a per-category image would have made the grid look broken.
//
// Idempotent: projects that already have media are skipped unless --force.
//
// Rendering uses Chromium's canvas (via @playwright/test, a devDependency) and
// emits WebP. SVG would need no rasteriser, but media.service.ts deliberately
// excludes image/svg+xml from every image kind, and seed data should not walk
// around a security decision the upload path enforces.
// ============================================================================
import { PrismaClient } from '@prisma/client';
import {
  GetBucketPolicyCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const prisma = new PrismaClient();

const W = 1600;
const H = 900;
const BUCKET = process.env.MEDIA_BUCKET ?? 'venture-evidence';
const PUBLIC = process.env.MINIO_PUBLIC_ENDPOINT ?? process.env.MINIO_ENDPOINT;

const FORCE = process.argv.includes('--force');
// Render to files and touch neither the bucket nor the database. Making objects
// world-readable is not something to do just to find out what the art looks
// like — this is how you look first.
const OUT_DIR = process.argv.find((a) => a.startsWith('--out='))?.split('=')[1];
const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 0);

// lucide geometry, inlined. Reading it out of lucide-react at runtime would tie
// the seed to that package's private dist layout; these shapes are stable and
// the file is a copy, not a fork.
const GLYPHS = {
  'cpu': [["path",{"d":"M12 20v2"}],["path",{"d":"M12 2v2"}],["path",{"d":"M17 20v2"}],["path",{"d":"M17 2v2"}],["path",{"d":"M2 12h2"}],["path",{"d":"M2 17h2"}],["path",{"d":"M2 7h2"}],["path",{"d":"M20 12h2"}],["path",{"d":"M20 17h2"}],["path",{"d":"M20 7h2"}],["path",{"d":"M7 20v2"}],["path",{"d":"M7 2v2"}],["rect",{"x":"4","y":"4","width":"16","height":"16","rx":"2"}],["rect",{"x":"8","y":"8","width":"8","height":"8","rx":"1"}]],
  'palette': [["path",{"d":"M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"}],["circle",{"cx":"13.5","cy":"6.5","r":".5","fill":"currentColor"}],["circle",{"cx":"17.5","cy":"10.5","r":".5","fill":"currentColor"}],["circle",{"cx":"6.5","cy":"12.5","r":".5","fill":"currentColor"}],["circle",{"cx":"8.5","cy":"7.5","r":".5","fill":"currentColor"}]],
  'gamepad-2': [["line",{"x1":"6","x2":"10","y1":"11","y2":"11"}],["line",{"x1":"8","x2":"8","y1":"9","y2":"13"}],["line",{"x1":"15","x2":"15.01","y1":"12","y2":"12"}],["line",{"x1":"18","x2":"18.01","y1":"10","y2":"10"}],["path",{"d":"M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"}]],
  'film': [["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2"}],["path",{"d":"M7 3v18"}],["path",{"d":"M3 7.5h4"}],["path",{"d":"M3 12h18"}],["path",{"d":"M3 16.5h4"}],["path",{"d":"M17 3v18"}],["path",{"d":"M17 7.5h4"}],["path",{"d":"M17 16.5h4"}]],
  'utensils': [["path",{"d":"M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"}],["path",{"d":"M7 2v20"}],["path",{"d":"M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"}]],
  'book-open': [["path",{"d":"M12 7v14"}],["path",{"d":"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"}]],
  'camera': [["path",{"d":"M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"}],["circle",{"cx":"12","cy":"13","r":"3"}]],
  'shirt': [["path",{"d":"M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"}]],
  'hand-heart': [["path",{"d":"M11 14h2a2 2 0 0 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16"}],["path",{"d":"m14.45 13.39 5.05-4.694C20.196 8 21 6.85 21 5.75a2.75 2.75 0 0 0-4.797-1.837.276.276 0 0 1-.406 0A2.75 2.75 0 0 0 11 5.75c0 1.2.802 2.248 1.5 2.946L16 11.95"}],["path",{"d":"m2 15 6 6"}],["path",{"d":"m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a1 1 0 0 0-2.75-2.91"}]],
  'scissors': [["circle",{"cx":"6","cy":"6","r":"3"}],["path",{"d":"M8.12 8.12 12 12"}],["path",{"d":"M20 4 8.12 15.88"}],["circle",{"cx":"6","cy":"18","r":"3"}],["path",{"d":"M14.8 14.8 20 20"}]],
  'rocket': [["path",{"d":"M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"}],["path",{"d":"M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"}],["path",{"d":"M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"}],["path",{"d":"M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05"}]],
  'sparkles': [["path",{"d":"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"}],["path",{"d":"M20 2v4"}],["path",{"d":"M22 4h-4"}],["circle",{"cx":"4","cy":"20","r":"2"}]],
};

// Top-level category → its glyph and hue. The hue is the SECOND gradient stop;
// the first is always the brand green, so every cover still reads as Wathba.
// Unknown slugs fall back to the brand mark, which is correct rather than loud —
// a project in a new category should look plain, not broken.
const LOOK = {
  technology:      { glyph: 'cpu',         hue: 168 },
  design:          { glyph: 'palette',     hue: 268 },
  art:             { glyph: 'palette',     hue: 330 },
  games:           { glyph: 'gamepad-2',   hue: 244 },
  'film-video':    { glyph: 'film',        hue: 38 },
  food:            { glyph: 'utensils',    hue: 22 },
  publishing:      { glyph: 'book-open',   hue: 205 },
  photography:     { glyph: 'camera',      hue: 190 },
  fashion:         { glyph: 'shirt',       hue: 320 },
  crafts:          { glyph: 'scissors',    hue: 96 },
  'social-impact': { glyph: 'hand-heart',  hue: 150 },
};
const FALLBACK = { glyph: 'rocket', hue: 154 };

/** FNV-1a — a project's id is its seed, so covers never move between runs. */
function seedOf(id) {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Draws the cover on an OffscreenCanvas-free 2D context and returns a WebP data
 * URL. Runs inside the page: canvas gives us gradients, a real blur filter,
 * Path2D for the glyph and correct Arabic shaping from one API.
 */
function paint({ glyph, hue, seed, label }) {
  const W = 1600;
  const H = 900;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const x = cv.getContext('2d');

  // Deterministic pseudo-random stream off the project's seed.
  let s = seed >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };

  const shift = (rnd() - 0.5) * 46;      // per-project hue drift
  const h1 = 154 + shift * 0.5;          // brand green, moved but still green
  const h2 = hue + shift;                // the category's colour

  // Gradient ANGLE varies, not just its colours. Hue drift alone left twelve
  // technology covers looking like one image repeated down the grid, which is
  // the failure this whole script exists to avoid — 512 of ~520 projects sit
  // under technology, so same-category variation is the only variation most
  // visitors will ever see.
  const ang = rnd() * Math.PI * 2;
  const dx = (Math.cos(ang) * W) / 2;
  const dy = (Math.sin(ang) * H) / 2;
  const lift = rnd();
  const base = x.createLinearGradient(W / 2 - dx, H / 2 - dy, W / 2 + dx, H / 2 + dy);
  base.addColorStop(0, `hsl(${h1} ${72 + rnd() * 14}% ${26 + lift * 16}%)`);
  base.addColorStop(1, `hsl(${h2} ${54 + rnd() * 18}% ${36 + lift * 14}%)`);
  x.fillStyle = base;
  x.fillRect(0, 0, W, H);

  // Mesh blobs — soft lights, blurred hard enough to read as depth rather than
  // as circles. Count varies too, so the density of the field differs.
  x.save();
  x.filter = `blur(${90 + rnd() * 50}px)`;
  const blobs = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < blobs; i++) {
    const cx = W * (0.05 + rnd() * 0.9);
    const cy = H * (0.05 + rnd() * 0.9);
    const r = H * (0.24 + rnd() * 0.44);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    const bh = i % 2 ? h2 + 24 : h1 - 12;
    g.addColorStop(0, `hsl(${bh} 82% ${56 + rnd() * 14}% / ${0.38 + rnd() * 0.26})`);
    g.addColorStop(1, `hsl(${bh} 82% 58% / 0)`);
    x.fillStyle = g;
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fill();
  }
  x.restore();

  // One of four motifs, chosen by seed. This is what actually separates two
  // covers of the same category at a glance; colour alone does not.
  x.save();
  x.strokeStyle = 'rgba(255,255,255,.07)';
  const motif = Math.floor(rnd() * 4);
  if (motif === 0) {
    // The site's own placeholder hatch, at its 45deg.
    x.lineWidth = 9;
    for (let i = -H; i < W + H; i += 22 + rnd() * 14) {
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i + H, H);
      x.stroke();
    }
  } else if (motif === 1) {
    // Concentric rings off one corner.
    x.lineWidth = 7;
    const ox = rnd() > 0.5 ? 0 : W;
    const oy = rnd() > 0.5 ? 0 : H;
    for (let r = 120; r < W * 1.15; r += 76) {
      x.beginPath();
      x.arc(ox, oy, r, 0, Math.PI * 2);
      x.stroke();
    }
  } else if (motif === 2) {
    // Dot field.
    x.fillStyle = 'rgba(255,255,255,.08)';
    const step = 46 + rnd() * 22;
    for (let gx = step / 2; gx < W; gx += step) {
      for (let gy = step / 2; gy < H; gy += step) {
        x.beginPath();
        x.arc(gx, gy, 3.2, 0, Math.PI * 2);
        x.fill();
      }
    }
  } else {
    // Wide vertical bands.
    x.fillStyle = 'rgba(255,255,255,.045)';
    const bw = 70 + rnd() * 50;
    for (let bx = rnd() * bw; bx < W; bx += bw * 2) x.fillRect(bx, 0, bw, H);
  }
  x.restore();

  // Glyph — a watermark, not a subject. Kept on the LEFT half so the pill and
  // the card's own title (right, RTL) never collide with it, but its exact
  // place, size and tilt move per project.
  const shapes = GLYPHS[glyph] ?? GLYPHS.rocket;
  const size = H * (0.38 + rnd() * 0.2);
  const scale = size / 24;
  const gx = W * (0.2 + rnd() * 0.22);
  const gy = H * (0.34 + rnd() * 0.32);
  x.save();
  x.translate(gx, gy);
  x.rotate((rnd() - 0.5) * 0.34);
  x.translate(-size / 2, -size / 2);
  x.scale(scale, scale);
  x.strokeStyle = `rgba(255,255,255,${(0.22 + rnd() * 0.14).toFixed(3)})`;
  x.lineWidth = 1.35;
  x.lineCap = 'round';
  x.lineJoin = 'round';
  for (const [kind, a] of shapes) {
    if (kind === 'path') {
      x.stroke(new Path2D(a.d));
    } else if (kind === 'circle') {
      x.beginPath();
      x.arc(+a.cx, +a.cy, +a.r, 0, Math.PI * 2);
      x.stroke();
    } else if (kind === 'rect') {
      x.beginPath();
      x.roundRect(+a.x, +a.y, +a.width, +a.height, +(a.rx ?? 0));
      x.stroke();
    } else if (kind === 'line') {
      x.beginPath();
      x.moveTo(+a.x1, +a.y1);
      x.lineTo(+a.x2, +a.y2);
      x.stroke();
    }
  }
  x.restore();

  // Category pill, bottom-RIGHT because the page is RTL and that is where the
  // reader starts.
  x.save();
  x.direction = 'rtl';
  x.font = '600 40px system-ui, "Noto Sans Arabic", "Segoe UI", sans-serif';
  x.textBaseline = 'middle';
  const tw = x.measureText(label).width;
  const padX = 34;
  const pw = tw + padX * 2;
  const ph = 78;
  const px = W - 72 - pw;
  const py = H - 72 - ph;
  x.fillStyle = 'rgba(4,22,15,.34)';
  x.beginPath();
  x.roundRect(px, py, pw, ph, 26);
  x.fill();
  x.fillStyle = 'rgba(255,255,255,.94)';
  x.textAlign = 'right';
  x.fillText(label, px + pw - padX, py + ph / 2 + 1);
  x.restore();

  // Vignette — pulls the eye off the corners so the pill and glyph carry.
  const vg = x.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.92);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,.26)');
  x.fillStyle = vg;
  x.fillRect(0, 0, W, H);

  return cv.toDataURL('image/webp', 0.9);
}

/**
 * The bucket has no policy at all, so every object in it is private and the
 * `publicUrl` the media service hands back 403s. Uploading covers without
 * fixing that just moves the broken image from "no URL" to "URL that 403s".
 *
 * This grants anonymous read to the `demo-covers/` prefix and NOTHING else. The
 * same bucket is the destination for the `evidence` upload kind — payout and
 * KYC documents — so a bucket-wide public policy would be a data leak, not a
 * fix. `avatar/` is left alone too: it is equally unreadable today (36 objects),
 * but opening it is a separate decision and not one this seed should take.
 *
 * If a policy already exists it is NOT overwritten — a merge would need to
 * reason about statements this script did not write. It prints what to add.
 */
async function ensurePublicPrefix(s3) {
  const statement = {
    Sid: 'PublicReadDemoCovers',
    Effect: 'Allow',
    Principal: { AWS: ['*'] },
    Action: ['s3:GetObject'],
    Resource: [`arn:aws:s3:::${BUCKET}/demo-covers/*`],
  };
  let existing = null;
  try {
    const got = await s3.send(new GetBucketPolicyCommand({ Bucket: BUCKET }));
    existing = JSON.parse(got.Policy);
  } catch {
    /* no policy — the expected state */
  }
  if (existing) {
    if (existing.Statement?.some((s) => s.Sid === statement.Sid)) {
      console.log('bucket policy: demo-covers already public');
      return;
    }
    console.warn(
      'bucket policy: one already exists and was NOT modified. Covers will 403 ' +
        'until this statement is added by hand:\n' +
        JSON.stringify(statement, null, 2),
    );
    return;
  }
  await s3.send(
    new PutBucketPolicyCommand({
      Bucket: BUCKET,
      Policy: JSON.stringify({ Version: '2012-10-17', Statement: [statement] }),
    }),
  );
  console.log(`bucket policy: granted anonymous read on ${BUCKET}/demo-covers/* (only)`);
}

async function main() {
  if (!PUBLIC) throw new Error('MINIO_PUBLIC_ENDPOINT / MINIO_ENDPOINT is not set');

  const projects = await prisma.project.findMany({
    // `categoryRef`, NOT `category`. `category` is the LEGACY enum column and is
    // still a valid field name, so selecting it does not error — it just hands
    // back a string like 'TECH', whose `.parent` is undefined, and every cover
    // silently takes the fallback look. Worth naming here because the wrong one
    // reads more natural than the right one.
    select: {
      id: true,
      mediaUrls: true,
      categoryRef: {
        select: { slug: true, nameAr: true, parent: { select: { slug: true, nameAr: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
    ...(LIMIT ? { take: LIMIT } : {}),
  });
  const todo = projects.filter((p) => FORCE || p.mediaUrls.length === 0);
  console.log(`${projects.length} project(s); ${todo.length} need a cover${FORCE ? ' (--force)' : ''}`);
  if (!todo.length) return;

  const s3 = OUT_DIR
    ? null
    : new S3Client({
        region: 'us-east-1',
        endpoint: process.env.MINIO_ENDPOINT,
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
          secretAccessKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
        },
      });

  if (s3) await ensurePublicPrefix(s3);
  else console.log(`--out=${OUT_DIR} — rendering to files; bucket and database untouched`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 200, height: 200 } });
  await page.addInitScript(`window.__GLYPHS = ${JSON.stringify(GLYPHS)};`);
  await page.goto('about:blank');

  let n = 0;
  let bytes = 0;
  // Which slugs took FALLBACK. The first run of this script silently gave every
  // project the fallback look because of the categoryRef/category slip above,
  // and the output looked plausible enough to ship. It reports itself now.
  const unmapped = new Set();
  for (const p of todo) {
    // Art keys off the TOP-LEVEL category: a project under `apps` should look
    // like technology, not like a category of its own.
    const top = p.categoryRef?.parent ?? p.categoryRef ?? null;
    const look = LOOK[top?.slug] ?? FALLBACK;
    const label = top?.nameAr ?? 'وثبة';
    if (!LOOK[top?.slug]) unmapped.add(top?.slug ?? '∅');

    const dataUrl = await page.evaluate(
      ({ fn, cfg }) => new Function('GLYPHS', `return (${fn})`)(window.__GLYPHS)(cfg),
      { fn: paint.toString(), cfg: { ...look, seed: seedOf(p.id), label } },
    );
    const body = Buffer.from(dataUrl.split(',')[1], 'base64');
    const key = `demo-covers/${p.id}.webp`;
    if (s3) {
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: body,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      await prisma.project.update({ where: { id: p.id }, data: { mediaUrls: [`${PUBLIC}/${BUCKET}/${key}`] } });
    } else {
      writeFileSync(`${OUT_DIR}/${top?.slug ?? 'none'}-${p.id.slice(0, 8)}.webp`, body);
    }
    n += 1;
    bytes += body.length;
    if (n % 50 === 0) console.log(`  ${n}/${todo.length}`);
  }

  await browser.close();
  console.log(`done — ${n} cover(s), ${(bytes / 1024 / 1024).toFixed(1)} MB, avg ${Math.round(bytes / n / 1024)} KB`);
  if (unmapped.size) {
    console.warn(
      `${unmapped.size} top-level slug(s) had no entry in LOOK and took the ` +
        `fallback mark: ${[...unmapped].join(', ')}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
