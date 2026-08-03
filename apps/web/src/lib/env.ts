import { z } from 'zod';

/**
 * STAKES/Q4 — build-time env validation: a production build with a missing
 * or malformed NEXT_PUBLIC_API_URL must FAIL LOUD at build, not 502 at
 * runtime. Imported from next.config.ts (build) — dev gets a warning only.
 *
 * NOTE the dotenv gotcha (burned on project200): use `.or(z.literal(''))`
 * nowhere here — empty strings must FAIL for required URLs.
 */
const schema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url({ message: 'NEXT_PUBLIC_API_URL must be a full URL (e.g. https://api.wathba.sa)' }),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_BUILD_SHA: z.string().max(40).optional(),
  // Origin serving project media (MinIO). Optional: a deployment whose media is
  // on HTTPS is already covered by the `https:` source in img-src and needs no
  // entry. Malformed is still a build failure — a typo here fails the way this
  // bug did, with the browser making no request at all and nothing in the log.
  NEXT_PUBLIC_MEDIA_URL: z.string().url().optional(),
});

export function validateEnv(): void {
  const parsed = schema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_BUILD_SHA: process.env.NEXT_PUBLIC_BUILD_SHA,
    NEXT_PUBLIC_MEDIA_URL: process.env.NEXT_PUBLIC_MEDIA_URL,
  });
  if (parsed.success) return;
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  const message = `[env] invalid web environment:\n${issues}`;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(message);
  }
  // Dev keeps working (localhost fallbacks exist) but says so loudly.
  console.warn(`${message}\n[env] continuing in dev with localhost fallbacks.`);
}
