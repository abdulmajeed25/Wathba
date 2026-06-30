import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * MinIO-backed media uploads.
 *
 * Uses the S3 SDK pointed at our local MinIO (S3-compatible). The web
 * client asks for a presigned PUT URL, then uploads the file directly
 * to MinIO (no proxy through Node, no memory bloat on big files).
 *
 * Each upload is keyed `<bucket>/<kind>/<yyyy>/<mm>/<uuid>.<ext>` so the
 * objects sort chronologically on the filesystem.
 *
 * Buckets live on the same MinIO that's already hosting Karaji and the
 * Wathba demo evidence buckets. We use the existing `venture-evidence`
 * bucket for project media; can be split later by `kind`.
 */

const ALLOWED_KINDS = ['hero', 'story', 'reward', 'evidence', 'avatar'] as const;
type Kind = (typeof ALLOWED_KINDS)[number];

const MIME_BY_KIND: Record<Kind, RegExp> = {
  hero:     /^image\/(jpeg|png|webp|avif)$/,
  story:    /^(image\/(jpeg|png|webp|avif|gif)|video\/(mp4|webm))$/,
  reward:   /^image\/(jpeg|png|webp|avif)$/,
  evidence: /^(image\/.*|application\/pdf|video\/.*)$/,
  avatar:   /^image\/(jpeg|png|webp|avif)$/,
};

const MAX_BYTES_BY_KIND: Record<Kind, number> = {
  hero:     8 * 1024 * 1024,   // 8 MB
  story:   25 * 1024 * 1024,   // 25 MB
  reward:   6 * 1024 * 1024,   // 6 MB
  evidence:50 * 1024 * 1024,   // 50 MB
  avatar:   2 * 1024 * 1024,   // 2 MB
};

export interface PresignedUpload {
  /** Pre-signed PUT URL the client uses directly. Expires in 5 minutes. */
  url: string;
  /** Object key inside the bucket. Returned to the client so it can save it. */
  key: string;
  /** The bucket name (in case we split later by `kind`). */
  bucket: string;
  /** Public read URL (works once the upload completes). */
  publicUrl: string;
  /** Expiry timestamp the client should respect. */
  expiresAt: string;
}

@Injectable()
export class MediaService {
  private readonly log = new Logger(MediaService.name);
  private readonly s3: S3Client;
  private readonly endpoint: string;
  private readonly publicEndpoint: string;
  private readonly bucket: string;

  constructor(cfg: ConfigService) {
    this.endpoint = cfg.get<string>('MINIO_ENDPOINT', 'http://localhost:9000');
    this.publicEndpoint = cfg.get<string>('MINIO_PUBLIC_ENDPOINT', this.endpoint);
    this.bucket = cfg.get<string>('MEDIA_BUCKET', 'venture-evidence');
    this.s3 = new S3Client({
      region: 'us-east-1', // any value works for MinIO; required by the SDK
      endpoint: this.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: cfg.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
        secretAccessKey: cfg.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
      },
    });
  }

  async createPresignedPut(opts: {
    userId: string;
    kind: Kind;
    mimeType: string;
    sizeBytes: number;
    ext?: string;
  }): Promise<PresignedUpload> {
    if (!ALLOWED_KINDS.includes(opts.kind)) {
      throw new BadRequestException(`unsupported kind: ${opts.kind}`);
    }
    if (!MIME_BY_KIND[opts.kind].test(opts.mimeType)) {
      throw new BadRequestException(
        `mimeType ${opts.mimeType} not allowed for kind ${opts.kind}`,
      );
    }
    if (opts.sizeBytes <= 0 || opts.sizeBytes > MAX_BYTES_BY_KIND[opts.kind]) {
      throw new BadRequestException(
        `sizeBytes ${opts.sizeBytes} exceeds max for kind ${opts.kind}`,
      );
    }

    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const extFromMime = opts.mimeType.split('/')[1]?.split('+')[0] ?? 'bin';
    const ext = opts.ext ?? extFromMime;
    const key = `${opts.kind}/${yyyy}/${mm}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: opts.mimeType,
      // ContentLength would be enforced via signed-headers — we keep the
      // signed URL simple here and let MinIO reject oversize PUTs via the
      // bucket policy if one is set.
      Metadata: { uploader: opts.userId, kind: opts.kind },
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: 300 });
    const publicUrl = `${this.publicEndpoint}/${this.bucket}/${key}`;
    const expiresAt = new Date(now.getTime() + 300 * 1000).toISOString();

    this.log.log(`presigned PUT user=${opts.userId} kind=${opts.kind} key=${key}`);
    return { url, key, bucket: this.bucket, publicUrl, expiresAt };
  }
}
